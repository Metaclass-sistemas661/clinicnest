# Guia Completo de Configuração da IA — ClinicNest

## Visão Geral

O ClinicNest usa **AWS Bedrock** (Claude 3 Haiku) para funcionalidades de IA e **Amazon Transcribe Medical** para transcrição de áudio médico.

### Funcionalidades de IA Disponíveis

| Funcionalidade | Descrição | Custo Estimado |
|----------------|-----------|----------------|
| Triagem Virtual | Chatbot que coleta sintomas e sugere especialidade | ~$0.001/conversa |
| Sugestão de CID | Sugere códigos CID-10 baseado na descrição clínica | ~$0.0005/sugestão |
| Resumo de Prontuário | Gera resumo do histórico do paciente | ~$0.002/resumo |
| Transcrição Médica | Converte áudio em texto com vocabulário médico | ~$0.0125/minuto |
| Análise de Sentimento | Analisa feedbacks de pacientes | ~$0.0005/análise |
| Predição de No-Show | Prevê probabilidade de falta (sem custo - ML local) | Gratuito |

---

## PASSO 1: Criar Conta AWS (se não tiver)

1. Acesse: https://aws.amazon.com/
2. Clique em **"Criar uma conta da AWS"**
3. Preencha os dados:
   - Email
   - Senha
   - Nome da conta (ex: "ClinicNest-Producao")
4. Adicione um cartão de crédito (obrigatório, mas só cobra o que usar)
5. Verifique seu telefone
6. Escolha o plano **"Basic Support - Free"**

---

## PASSO 2: Habilitar o AWS Bedrock

O Bedrock não vem habilitado por padrão. Você precisa solicitar acesso.

### 2.1 Acessar o Console do Bedrock

1. Faça login no AWS Console: https://console.aws.amazon.com/
2. Na barra de busca, digite **"Bedrock"**
3. Clique em **"Amazon Bedrock"**

### 2.2 Solicitar Acesso ao Modelo

1. No menu lateral, clique em **"Model access"** (Acesso a modelos)
2. Clique em **"Manage model access"** (Gerenciar acesso)
3. Encontre **"Anthropic"** na lista
4. Marque o checkbox de **"Claude 3 Haiku"**
5. Clique em **"Request model access"** (Solicitar acesso)
6. Aceite os termos de uso
7. Aguarde aprovação (geralmente instantâneo, máximo 24h)

### 2.3 Verificar Aprovação

1. Volte para **"Model access"**
2. O status deve mostrar **"Access granted"** (Acesso concedido) ao lado do Claude 3 Haiku

---

## PASSO 3: Habilitar o Amazon Transcribe Medical

1. Na barra de busca do AWS Console, digite **"Transcribe"**
2. Clique em **"Amazon Transcribe"**
3. O serviço já vem habilitado por padrão
4. Verifique se a região está correta (recomendado: **us-east-1**)

---

## PASSO 4: Criar Bucket S3 para Áudios

O Transcribe Medical precisa de um bucket S3 para armazenar os arquivos de áudio.

### 4.1 Criar o Bucket

1. Na barra de busca, digite **"S3"**
2. Clique em **"S3"**
3. Clique em **"Create bucket"** (Criar bucket)
4. Configure:
   - **Bucket name:** `ClinicNest-audio-transcriptions` (ou outro nome único)
   - **AWS Region:** `us-east-1` (mesma região do Bedrock)
   - **Object Ownership:** ACLs disabled (recomendado)
   - **Block Public Access:** Mantenha TUDO marcado (bloqueado)
   - **Bucket Versioning:** Disable
   - **Encryption:** SSE-S3 (padrão)
5. Clique em **"Create bucket"**

### 4.2 Configurar Lifecycle (Opcional - Economia)

Para não acumular arquivos de áudio indefinidamente:

1. Clique no bucket criado
2. Vá na aba **"Management"**
3. Clique em **"Create lifecycle rule"**
4. Configure:
   - **Rule name:** `delete-old-audio`
   - **Apply to all objects**
   - **Lifecycle rule actions:** Expire current versions
   - **Days after object creation:** 30
5. Clique em **"Create rule"**

---

## PASSO 5: Criar Usuário IAM com Permissões

### 5.1 Criar Política de Permissões

1. Na barra de busca, digite **"IAM"**
2. Clique em **"IAM"**
3. No menu lateral, clique em **"Policies"**
4. Clique em **"Create policy"**
5. Clique na aba **"JSON"**
6. Cole a seguinte política:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "BedrockAccess",
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream"
            ],
            "Resource": [
                "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
            ]
        },
        {
            "Sid": "TranscribeMedicalAccess",
            "Effect": "Allow",
            "Action": [
                "transcribe:StartMedicalTranscriptionJob",
                "transcribe:GetMedicalTranscriptionJob",
                "transcribe:ListMedicalTranscriptionJobs"
            ],
            "Resource": "*"
        },
        {
            "Sid": "S3AudioAccess",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::ClinicNest-audio-transcriptions/*"
            ]
        }
    ]
}
```

> ⚠️ **IMPORTANTE:** Substitua `ClinicNest-audio-transcriptions` pelo nome do seu bucket!

7. Clique em **"Next"**
8. **Policy name:** `ClinicNest-AI-Policy`
9. Clique em **"Create policy"**

### 5.2 Criar Usuário IAM

1. No menu lateral do IAM, clique em **"Users"**
2. Clique em **"Create user"**
3. **User name:** `ClinicNest-ai-service`
4. Clique em **"Next"**
5. Selecione **"Attach policies directly"**
6. Busque e marque **"ClinicNest-AI-Policy"**
7. Clique em **"Next"**
8. Clique em **"Create user"**

### 5.3 Criar Access Key

1. Clique no usuário **"ClinicNest-ai-service"**
2. Vá na aba **"Security credentials"**
3. Em **"Access keys"**, clique em **"Create access key"**
4. Selecione **"Application running outside AWS"**
5. Clique em **"Next"**
6. **Description:** `ClinicNest Supabase Edge Functions`
7. Clique em **"Create access key"**
8. **COPIE E SALVE** as credenciais:
   - **Access key ID:** `AKIA...` (começa com AKIA)
   - **Secret access key:** `...` (string longa)

> ⚠️ **ATENÇÃO:** O Secret Access Key só é mostrado UMA VEZ. Salve em local seguro!

---

## PASSO 6: Configurar Secrets no Supabase

### 6.1 Via Dashboard (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/cxficwktocdouerhamhh/settings/functions
2. Role até **"Edge Function Secrets"**
3. Adicione cada secret clicando em **"Add new secret"**:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | Sua Access Key (AKIA...) |
| `AWS_SECRET_ACCESS_KEY` | Seu Secret Access Key |
| `AWS_REGION` | `us-east-1` |
| `AWS_S3_BUCKET` | `ClinicNest-audio-transcriptions` |

### 6.2 Via CLI (Alternativa)

```bash
npx supabase secrets set AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
npx supabase secrets set AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
npx supabase secrets set AWS_REGION=us-east-1
npx supabase secrets set AWS_S3_BUCKET=ClinicNest-audio-transcriptions
```

---

## PASSO 7: Executar Migration do Banco

Execute a migration para criar as tabelas necessárias:

```bash
npx supabase db push
```

Ou execute manualmente no SQL Editor do Supabase:
- Arquivo: `supabase/migrations/20260329200000_ai_integration_v1.sql`

---

## PASSO 8: Habilitar Feature Flags

As funcionalidades de IA estão desabilitadas por padrão. Para habilitar:

### 8.1 Via SQL (Habilitar para todos os tenants)

```sql
UPDATE feature_flags 
SET enabled = TRUE 
WHERE key IN (
    'ai_triage',
    'ai_cid_suggest', 
    'ai_summary',
    'ai_transcribe',
    'ai_sentiment',
    'ai_no_show_prediction'
);
```

### 8.2 Via SQL (Habilitar para tenant específico)

```sql
-- Primeiro, descubra o tenant_id da clínica
SELECT id, name FROM tenants;

-- Depois, habilite para esse tenant
INSERT INTO tenant_feature_flags (tenant_id, feature_flag_key, enabled)
VALUES 
    ('SEU-TENANT-ID', 'ai_triage', TRUE),
    ('SEU-TENANT-ID', 'ai_cid_suggest', TRUE),
    ('SEU-TENANT-ID', 'ai_summary', TRUE),
    ('SEU-TENANT-ID', 'ai_transcribe', TRUE),
    ('SEU-TENANT-ID', 'ai_sentiment', TRUE),
    ('SEU-TENANT-ID', 'ai_no_show_prediction', TRUE);
```

---

## PASSO 9: Testar as Funcionalidades

### 9.1 Testar Triagem (via curl)

```bash
curl -X POST 'https://cxficwktocdouerhamhh.supabase.co/functions/v1/ai-triage' \
  -H 'Authorization: Bearer SEU_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"messages": [{"role": "user", "content": "Estou com dor de cabeça forte há 3 dias"}]}'
```

### 9.2 Testar Sugestão de CID

```bash
curl -X POST 'https://cxficwktocdouerhamhh.supabase.co/functions/v1/ai-cid-suggest' \
  -H 'Authorization: Bearer SEU_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"description": "Paciente com tosse seca há 5 dias, sem febre, coriza hialina"}'
```

---

## Monitoramento de Custos

### Ver Custos no AWS

1. Acesse: https://console.aws.amazon.com/billing/
2. Clique em **"Bills"** para ver a fatura atual
3. Clique em **"Cost Explorer"** para análise detalhada

### Configurar Alerta de Custo

1. No Billing, clique em **"Budgets"**
2. Clique em **"Create budget"**
3. Selecione **"Cost budget"**
4. Configure:
   - **Budget name:** `ClinicNest-AI-Budget`
   - **Budget amount:** $50 (ou o valor desejado)
   - **Alert threshold:** 80%
   - **Email:** seu email
5. Clique em **"Create budget"**

---

## Estimativa de Custos Mensais

| Uso | Custo Estimado |
|-----|----------------|
| 100 triagens/mês | ~$0.10 |
| 500 sugestões CID/mês | ~$0.25 |
| 200 resumos/mês | ~$0.40 |
| 50 minutos de transcrição/mês | ~$0.63 |
| 100 análises de sentimento/mês | ~$0.05 |
| **TOTAL** | **~$1.43/mês** |

Para uma clínica média com uso intenso:
- 1.000 triagens + 2.000 CIDs + 500 resumos + 200 min transcrição = **~$5-10/mês**

---

## Troubleshooting

### Erro: "AWS credentials not configured"

**Causa:** Secrets não configurados no Supabase.

**Solução:** Verifique se os 4 secrets estão configurados corretamente no dashboard do Supabase.

### Erro: "Access denied" no Bedrock

**Causa:** Modelo não habilitado ou política IAM incorreta.

**Solução:**
1. Verifique se o Claude 3 Haiku está com "Access granted" no Bedrock
2. Verifique se a política IAM inclui a permissão `bedrock:InvokeModel`

### Erro: "Bucket not found" no Transcribe

**Causa:** Nome do bucket incorreto ou bucket não existe.

**Solução:** Verifique se o nome do bucket no secret `AWS_S3_BUCKET` está correto.

### Erro: "Region mismatch"

**Causa:** Região do Bedrock diferente da configurada.

**Solução:** Use `us-east-1` para todos os serviços (Bedrock, S3, Transcribe).

---

## Suporte

Se tiver problemas:
1. Verifique os logs das Edge Functions no Supabase Dashboard
2. Verifique os logs do CloudWatch na AWS
3. Confirme que todas as credenciais estão corretas

---

*Documento criado em 25/02/2026 — ClinicNest v1.0*
