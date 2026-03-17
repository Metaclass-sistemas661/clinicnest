# RELATÓRIO FINAL DE AUDITORIA — CLINICNEST

**Data:** 16 de Março de 2026  
**Autora:** Arquiteta de Software Principal / SecOps / HealthTech  
**Escopo:** Auditoria Exaustiva — Modo Somente Leitura  
**Versão:** 1.0  

---

## ÍNDICE

1. [Resumo Executivo](#1-resumo-executivo)
2. [Lógica de Negócio e Ciclo de Vida do Paciente](#2-lógica-de-negócio-e-ciclo-de-vida-do-paciente)
3. [Gestão de Contratos e Termos de Consentimento](#3-gestão-de-contratos-e-termos-de-consentimento)
4. [Fluxo de Assinatura Dupla (Facial e Manual)](#4-fluxo-de-assinatura-dupla-facial-e-manual)
5. [Segurança e Conformidade (LGPD/HIPAA)](#5-segurança-e-conformidade-lgpdhipaa)
6. [UX/UI e Usabilidade](#6-uxui-e-usabilidade)
7. [Inteligência Artificial — AI GPS](#7-inteligência-artificial--ai-gps)
8. [Matriz de Severidade Consolidada](#8-matriz-de-severidade-consolidada)
9. [Arquitetura: Drawer de Contratos do Paciente](#9-arquitetura-drawer-de-contratos-do-paciente)
10. [Arquitetura: Sistema de Assinatura Híbrida](#10-arquitetura-sistema-de-assinatura-híbrida)
11. [Arquitetura: AI GPS — Guia Inteligente de Atendimento](#11-arquitetura-ai-gps--guia-inteligente-de-atendimento)
12. [Plano de Execução Priorizado](#12-plano-de-execução-priorizado)

---

## 1. RESUMO EXECUTIVO

O ClinicNest é um SaaS médico multi-tenant construído com React + Vite + TypeScript + Supabase + Shadcn UI, com 300+ migrações, 85+ páginas, 60+ Edge Functions, 19 módulos de IA e integrações HL7/FHIR/RNDS/TISS.

### Veredicto Geral

| Dimensão | Nota | Status |
|----------|------|--------|
| Lógica de Negócio | 8.5/10 | ✅ Ciclo de vida robusto e realista |
| Contratos & Termos | 6/10 | ⚠️ Funcional mas com gaps críticos |
| Assinatura Digital | 5/10 | 🔴 Apenas facial — sem assinatura manual, sem PDF selado |
| Segurança (RLS) | 7.5/10 | ⚠️ Forte no core, gaps em tabelas de compliance |
| UX/UI | 8/10 | ✅ Consistente, responsivo, ShadCN bem aplicado |
| Inteligência Artificial | 7/10 | ⚠️ Abrangente mas sem métricas de precisão e sem AI GPS |

### Achados Críticos (Top 5)

| # | Achado | Severidade |
|---|--------|-----------|
| 1 | Não existe PDF selado/criptografado após assinatura de consentimento | 🔴 CRÍTICO |
| 2 | 4 tabelas de compliance sem RLS (prontuario_exports, sbis_documentation, ripd_reports, backup_logs) | 🔴 CRÍTICO |
| 3 | Sem opção de assinatura manual (Canvas) — apenas facial | 🟠 ALTO |
| 4 | Sem Drawer dedicado de contratos na listagem de pacientes | 🟠 ALTO |
| 5 | IA sem métricas de precisão/recall e sem fluxo AI GPS guiado | 🟡 MÉDIO |

---

## 2. LÓGICA DE NEGÓCIO E CICLO DE VIDA DO PACIENTE

### 2.1 Fluxo Mapeado (Estado Atual)

```
┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌──────────────┐
│  CADASTRO   │──▶│ AGENDAMENTO  │──▶│   CHECK-IN    │──▶│   TRIAGEM    │
│ Pacientes.tsx│   │  Agenda.tsx  │   │ DashRecepcao  │   │ Triagem.tsx  │
└─────────────┘   └──────────────┘   └───────────────┘   └──────────────┘
                                                                  │
                                                                  ▼
┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌──────────────┐
│ FATURAMENTO │◀──│  DOCUMENTOS  │◀──│  PRONTUÁRIO   │◀──│ FILA ESPERA  │
│Financeiro.tsx│   │ ProntDocs.tsx│   │ProntuarioForm │   │FilaAtend.tsx │
└─────────────┘   └──────────────┘   └───────────────┘   └──────────────┘
       │                                      │
       ▼                                      ▼
┌─────────────┐                      ┌───────────────┐
│PORTAL PACTE │                      │ PLANO TRATAM. │
│PatientFinanc│                      │PlanosTratam.tsx│
└─────────────┘                      └───────────────┘
```

### 2.2 Análise por Etapa

#### Cadastro (`src/pages/Pacientes.tsx` — 1400+ linhas)
- **Adequação:** ✅ Excelente — CPF validado via Zod, CEP com auto-fill, estados civis, alergias
- **Diferencial:** Ranking de pacientes por faturamento total, importação CSV em massa
- **Gap:** Modal de detalhes tem 6 tabs mas os contratos estão na última tab ("Termos") — baixa visibilidade

#### Agendamento (`src/pages/Agenda.tsx`)
- **Adequação:** ✅ Excelente — detecção de conflitos por profissional, validação de autorização de convênio, limite de teleconsultas
- **Status workflow:** `pending → confirmed → arrived → completed`
- **Gap menor:** Sem integração direta com planos de tratamento que já tenham procedimentos planejados

#### Check-in e Recepção (`src/pages/recepcao/DashboardRecepcao.tsx`)
- **Adequação:** ✅ Bom — Estratégia dual: `setAppointmentStatusV2("arrived")` + fallback `add_patient_to_queue()` RPC
- **Diferencial:** Som de notificação quando paciente entra na fila
- **Tabs:** Agenda (pendentes), Chegadas, Fila, Retornos

#### Triagem (`src/pages/Triagem.tsx`)
- **Adequação:** ✅ Bom — PA, FC, FR, Temp, O2, peso, altura, escala de dor, alergias, medicações atuais
- **Classificação Manchester:** Emergência (🔴), Urgente (🟠), Pouco Urgente (🟡), Não Urgente (🟢)
- **IA integrada:** `AiTriageChatbot` para triagem conversacional assistida
- **Gap:** Triagem por IA não gera score de confiança numérico

#### Fila de Espera (`src/pages/recepcao/FilaAtendimento.tsx`)
- **Adequação:** ✅ Bom — Estatísticas em tempo real, ações de rechamar, iniciar, não-comparecimento
- **Componente:** `CallNextButton` com seleção de sala e navegação para prontuário

#### Prontuário (`src/components/prontuario/ProntuarioForm.tsx` — 355+ linhas)
- **Adequação:** ✅ Excelente — SOAP completo, sinais vitais, CID-10, assinatura ICP-Brasil, versionamento, lock após 24h
- **IA:** Copilot sidebar com sugestões de CID, medicamentos, exames, alertas
- **Documentos derivados:** Receita, Atestado, Laudo, Encaminhamento (drawers individuais)

#### Planos de Tratamento (`src/pages/PlanosTratamento.tsx`)
- **Adequação:** ✅ Bom — Status workflow: Pendente → Apresentado → Aprovado → Em Andamento → Concluído
- **Odonto:** Integração com dente/superfície e código TUSS
- **Gap:** Sem aprovação digital pelo paciente (apenas status manual)

#### Faturamento (`src/pages/Financeiro.tsx` + `src/pages/FaturasPacientes.tsx`)
- **Adequação:** ✅ Bom — Faturas com status, métodos de pagamento (PIX, Boleto, Cartão), integração Asaas
- **Portal do paciente:** Faturas abertas, histórico de pagamentos, extrato em PDF
- **Pacotes:** Sistema de sessões contratadas com consumo automático

### 2.3 Veredicto da Lógica de Negócio

O ciclo de vida reflete com fidelidade a operação de uma clínica médica de alto padrão. Os fluxos são completos, interconectados e cobrem desde agendamento até faturamento. O principal gap é a **falta de integração entre Plano de Tratamento e Contratos** — quando um plano é aprovado, o sistema deveria auto-gerar os contratos/termos correspondentes.

---

## 3. GESTÃO DE CONTRATOS E TERMOS DE CONSENTIMENTO

### 3.1 Onde os Documentos Legais São Armazenados

| Tipo | Tabela | Storage Bucket | Formato |
|------|--------|----------------|---------|
| Templates de Consentimento | `consent_templates` | `consent-pdfs` (quando PDF) | HTML (body_html) ou PDF upload |
| Consentimentos Assinados | `patient_consents` | `consent-photos` (foto facial) | Snapshot HTML + foto biométrica |
| Templates Pré-Construídos | `consent_templates` (seeds) | — | HTML com variáveis dinâmicas |

**Templates disponíveis (seeds):**
- Contrato de Prestação de Serviços
- Termo de Autorização de Uso de Imagem
- Termo de Ciência de Riscos e Desconfortos
- Consentimento LGPD
- 20+ templates por especialidade (Estética, Odontologia, Dermatologia, etc.)

**14 variáveis dinâmicas substituíveis:**
`{{nome_paciente}}`, `{{cpf_paciente}}`, `{{data_nascimento}}`, `{{email_paciente}}`, `{{phone_paciente}}`, `{{endereco_paciente}}`, `{{nome_clinica}}`, `{{cnpj_clinica}}`, `{{endereco_clinica}}`, `{{responsavel_clinica}}`, `{{crm_responsavel}}`, `{{data_atual}}`, `{{cidade_clinica}}`, `{{estado_clinica}}`

### 3.2 Separação Lógica: Clínico vs. Jurídico

| Aspecto | Documentos Clínicos | Documentos Jurídicos |
|---------|---------------------|---------------------|
| **Tabelas** | `prescriptions`, `medical_certificates`, `exam_results`, `medical_reports` | `consent_templates`, `patient_consents` |
| **Assinatura** | ICP-Brasil (A1/A3/BirdID) opcional | Facial (Banuba SDK) obrigatória |
| **PDF** | Gerado client-side via jsPDF | ❌ Não gera PDF selado |
| **QR Code** | ✅ Sim (verificável por hash SHA-256) | ❌ Não possui |
| **Storage** | `exam-files` (20MB) | `consent-pdfs` + `consent-photos` |
| **Versionamento** | `medical_record_versions` | `template_snapshot_html` (cópia imutável) |

**🔴 GAP CRÍTICO:** A separação existe no nível de tabelas, mas **não existe uma classificação unificada de `document_type`** que permita ao sistema tratar todos os documentos de forma polimórfica. Cada tipo tem seu próprio componente, página e fluxo isolado.

### 3.3 Gaps de UI/UX na Listagem de Pacientes

**Estado Atual da página `Pacientes.tsx`:**

A listagem mostra por paciente:
- 📨 MessageCircle → Enviar link de assinatura via WhatsApp
- ✍️ FileSignature → Gerar Contratos (abre `GenerateContractsDialog`)
- 📦 Package → Vender Pacotes (admin)
- ✏️ Pencil → Editar dados

**A tab "Termos" existe DENTRO do modal de detalhes do paciente (6ª tab)**, mas:

| Gap | Impacto |
|-----|---------|
| Contratos estão na última tab do modal | Baixa visibilidade — enfermeira/recepcionista não encontra rápido |
| Sem ícone de status visual na listagem | Não é possível ver quem tem contratos pendentes sem abrir o modal |
| Sem Drawer dedicado | Obriga navegação em modal com 6 tabs para chegar aos contratos |
| Sem badge de "Pendente" na listagem | Clínica não sabe rapidamente quais pacientes precisam assinar |

### 3.4 Plano de Ação: Drawer de Contratos

> **Entregável arquitetural detalhado na [Seção 9](#9-arquitetura-drawer-de-contratos-do-paciente).**

---

## 4. FLUXO DE ASSINATURA DUPLA (FACIAL E MANUAL)

### 4.1 Fluxo Atual Auditado

```
PORTAL DA CLÍNICA                          PORTAL DO PACIENTE
─────────────────                          ──────────────────
Admin cria template                        Paciente faz login
       │                                          │
       ▼                                          ▼
GenerateContractsDialog                    ConsentGate verifica
(seleciona templates)                      pendências
       │                                          │
       ▼                                          ▼
SendConsentLinkDialog                      /paciente/termos
(gera token 72h)                           (lista termos pendentes)
       │                                          │
       ▼                                          ▼
WhatsApp/Email com link                    Lê cada termo
(/assinar-termos/{token})                         │
                                                  ▼
                                           FacialCapture.tsx
                                           (Banuba SDK v1.17.7)
                                                  │
                                                  ▼
                                           Upload foto → consent-photos
                                                  │
                                                  ▼
                                           RPC sign_consent()
                                           (SECURITY DEFINER)
                                                  │
                                                  ▼
                                           patient_consents record
                                           (snapshot + foto + IP + UA)
```

### 4.2 Achados e Gaps do Fluxo Atual

| # | Achado | Severidade | Detalhe |
|---|--------|-----------|---------|
| 1 | **Sem opção de assinatura manual** | 🟠 ALTO | Paciente SÓ pode usar câmera facial. Sem fallback para dispositivos sem câmera ou preferência por assinatura manuscrita |
| 2 | **Sem PDF selado pós-assinatura** | 🔴 CRÍTICO | Após assinar, o sistema armazena snapshot HTML + foto, mas **NÃO gera PDF criptograficamente assinado** com a prova embutida |
| 3 | **Comprovante exporta apenas HTML** | 🟠 ALTO | `PatientConsentsViewer` exporta comprovante como arquivo HTML, não como PDF com assinatura digital |
| 4 | **Sem cadeia de custódia verificável** | 🟠 ALTO | O documento assinado não possui QR code de verificação, hash criptográfico ou timestamp TSA |
| 5 | **Token expiração padrão 72h** | 🟡 MÉDIO | Adequado, mas sem option de customização ou re-envio automático |
| 6 | **Sem notificação de retorno à clínica** | 🟡 MÉDIO | Quando paciente assina, a clínica não recebe push/toast em tempo real |

### 4.3 Arquitetura da Assinatura Híbrida

> **Entregável arquitetural detalhado na [Seção 10](#10-arquitetura-sistema-de-assinatura-híbrida).**

---

## 5. SEGURANÇA E CONFORMIDADE (LGPD/HIPAA)

### 5.1 Arquitetura de Segurança Atual

**Funções Core (SECURITY DEFINER):**
```sql
get_user_tenant_id(p_user_id UUID) → UUID     -- Isolamento multi-tenant
is_tenant_admin(p_user_id, p_tenant_id) → BOOL -- Permissão admin
is_clinical_professional(p_user_id) → BOOL     -- Permissão clínica
is_prescriber(p_user_id) → BOOL                -- Permissão prescrição
is_nursing_professional(p_user_id) → BOOL      -- Permissão enfermagem
is_admin_or_faturista(p_user_id) → BOOL        -- Permissão faturamento
```

**Criptografia:**
- AES-256-GCM com PBKDF2 (100k iterações) para dados sensíveis
- SHA-256 para hashes de documentos
- ICP-Brasil (A1/A3/BirdID) para assinatura digital clínica

### 5.2 Análise de RLS (Row Level Security)

#### Tabelas Protegidas (✅ RLS Ativo + FORCE RLS)

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `patients` | tenant_id | tenant_id | tenant_id | admin |
| `medical_records` | tenant_id + clinical | tenant_id + clinical | tenant_id + clinical | admin |
| `prescriptions` | tenant_id + prescriber | tenant_id + prescriber | tenant_id + prescriber | admin |
| `exam_results` | tenant_id | tenant_id | tenant_id | admin |
| `triage_records` | tenant_id | tenant_id | tenant_id | admin |
| `consent_templates` | tenant_id | admin | admin | admin |
| `patient_consents` | own (paciente) / tenant (staff) | own (paciente) | — | admin |
| `patient_profiles` | own (paciente) / tenant (staff) | — | own | admin |
| `appointments` | tenant_id | tenant_id | tenant_id | admin |
| `financial_transactions` | tenant_id | tenant_id | tenant_id | admin |

#### 🔴 Tabelas SEM RLS (GAPS CRÍTICOS)

| Tabela | Dados Expostos | Risco |
|--------|---------------|-------|
| `prontuario_exports` | Exportações completas de prontuários | Qualquer usuário autenticado acessa exports de TODOS os tenants |
| `sbis_documentation` | Documentação SBIS de compliance | Acesso cross-tenant a dados de auditoria |
| `ripd_reports` | Relatórios de Impacto à Proteção de Dados (LGPD) | Irônico: relatórios LGPD sem proteção LGPD |
| `backup_logs` | Metadados de backup do sistema | Exposição de informações de infraestrutura |

### 5.3 Isolamento Paciente A vs. Paciente B

| Cenário | Resultado | Veredicto |
|---------|-----------|-----------|
| Paciente A acessa `medical_records` de Paciente B | ❌ BLOQUEADO | ✅ OK — RLS filtra por `patient_user_id = auth.uid()` via join |
| Paciente A acessa `patient_consents` de Paciente B | ❌ BLOQUEADO | ✅ OK — RLS filtra por `patient_user_id = auth.uid()` |
| Paciente A acessa `patient_proms` de Paciente B | ❌ BLOQUEADO | ✅ OK |
| Paciente A acessa fotos de consentimento de B | ⚠️ Possível via Storage | 🟡 MÉDIO — bucket `consent-photos` precisa verificar owner |

### 5.4 Gaps de Granularidade Clínica

**Achado:** Um profissional clínico pode acessar prontuários de **QUALQUER paciente do tenant**, não apenas os que atendeu pessoalmente.

```sql
-- Policy atual (simplificada):
USING (
  is_tenant_admin(auth.uid(), tenant_id)
  OR is_clinical_professional(auth.uid())
)
-- Falta: AND professional_id = auth.uid()  (opcional por decisão de negócio)
```

**Veredicto:** Para uma clínica pequena/média (~5-20 profissionais), esse é o padrão aceitável. Para clínicas maiores (>50), considerar filtro por profissional.

### 5.5 Outros Achados de Segurança

| # | Achado | Severidade |
|---|--------|-----------|
| 1 | Policy `contact_messages` com `WITH CHECK (true)` — qualquer um envia sem validação | 🟡 MÉDIO |
| 2 | Renomeação incompleta `clients → patients` — queries com fallback duplo | 🟡 MÉDIO |
| 3 | Storage `consent-photos` sem filtering por owner | 🟡 MÉDIO |
| 4 | Sem rate limiting em RPC de assinatura de consentimento | 🟡 MÉDIO |
| 5 | Tokens de consentimento sem invalidação após uso | 🟢 BAIXO |

### 5.6 Conformidade LGPD

| Requisito LGPD | Status | Detalhe |
|----------------|--------|---------|
| Base legal para tratamento | ✅ | Consentimento explícito via termos |
| Direito de acesso | ✅ | Portal do paciente com dados completos |
| Direito de exclusão | ⚠️ | Não há mecanismo de "data erasure" automatizado |
| Relatório de Impacto (RIPD) | ⚠️ | Tabela `ripd_reports` existe mas sem RLS |
| Encarregado (DPO) | ✅ | Configurável em settings |
| Minimização de dados | ✅ | Campos sensíveis com AES-256-GCM |
| Portabilidade | ⚠️ | Export existe mas só em HTML (deveria ser JSON/FHIR) |

---

## 6. UX/UI E USABILIDADE

### 6.1 Design System

| Aspecto | Avaliação | Detalhe |
|---------|-----------|---------|
| Component Library | ✅ Excelente | 52 componentes Shadcn UI customizados |
| Responsividade | ✅ Bom | Mobile: Cards / Desktop: Tables + Sidebar fixo |
| Loading States | ✅ Bom | Skeleton components (não spinners) |
| Empty States | ✅ Bom | EmptyState component padronizado |
| Cores e Categorização | ✅ Excelente | Teal (Recepção), Blue (Clínico), Yellow (Financeiro), Orange (Admin) |
| Dark Mode | ✅ Implementado | Toggle interno via `InternalDarkMode` |

### 6.2 Hierarquia de Navegação (Sidebar)

```
🟦 RECEPÇÃO
├── Dashboard Recepção
├── Agenda
├── Painel TV
├── Retornos
└── Triagem

🟩 CLÍNICO
├── Pacientes
├── Prontuários
├── Evoluções
├── Teleconsulta
└── Planos de Tratamento

🟨 FINANCEIRO
├── Visão Geral
├── Contas a Pagar
├── Contas a Receber
├── TISS Billing
└── Repasses/Comissões

🟧 ADMINISTRATIVO
├── Equipe
├── Especialidades
├── Procedimentos
├── Convênios
└── Configurações
```

### 6.3 Achados de UX

| # | Achado | Severidade | Recomendação |
|---|--------|-----------|--------------|
| 1 | Contratos/Termos não são item de menu na sidebar | 🟠 ALTO | Adicionar "Contratos" como sub-item em "Clínico" ou "Recepção" |
| 2 | Tab "Termos" é a 6ª tab no modal (baixa visibilidade) | 🟠 ALTO | Mover para Drawer dedicado com badge de pendentes |
| 3 | Página `Pacientes.tsx` com 1400+ linhas | 🟡 MÉDIO | Refatorar em sub-componentes (PatientTable, PatientDetailModal, etc.) |
| 4 | Sem viewer unificado de documentos | 🟡 MÉDIO | Criar `DocumentViewer` com suporte a PDF, HTML, DICOM |
| 5 | Ranking de faturamento misturado com CRM | 🟢 BAIXO | Separar visão CRM da visão financeira |
| 6 | Sem toast/push quando paciente assina contrato | 🟡 MÉDIO | Realtime subscription em `patient_consents` |

### 6.4 Portal do Paciente — Avaliação

| Módulo | Status | UX |
|--------|--------|-----|
| Dashboard | ✅ | Auto-link + quick actions claras |
| Agendamento | ✅ | Self-scheduling com slot picker |
| Consultas | ✅ | Cancel (24h), remarcar, check-in, avaliação |
| Termos/Contratos | ⚠️ | Funcional mas sem opção de assinatura manual |
| Financeiro | ✅ | 3 tabs: Faturas, Pagamentos, Extrato |
| Exames | ✅ | Upload próprio + resultados do profissional |
| Teleconsulta | ✅ | Vídeo integrado |

---

## 7. INTELIGÊNCIA ARTIFICIAL — AI GPS

### 7.1 Estado Atual da IA

**Backend:** Google Vertex AI (Gemini 2.0 Flash) como provider principal, com fallback para AWS Bedrock Claude.

**Arquivo core:** `supabase/functions/_shared/vertex-ai-client.ts` (450+ linhas)
- Autenticação: GCP Service Account JWT (RS256)
- Retry: 2 tentativas com exponential backoff
- Timeout: 25 segundos

**19 Módulos de IA implementados:**

| Módulo | Função | Edge Function | Status |
|--------|--------|---------------|--------|
| Copilot Prontuário | Sugestões CID, medicamentos, exames, alertas | `ai-copilot` | ✅ Ativo |
| Triagem Virtual | Chat conversacional para triagem | `ai-triage` | ✅ Ativo |
| Transcrição Médica | Áudio → texto (Vertex Chirp pt-BR) | `ai-transcribe` | ✅ Ativo |
| Interação Medicamentosa | Verificação de drug-drug interactions | `ai-drug-interactions` | ✅ Ativo |
| Protocolos Clínicos | Sugestão de protocolos por diagnóstico | `ai-clinical-protocols` | ✅ Ativo |
| Resumo do Paciente | Sumarização automática do prontuário | `ai-summary` | ✅ Ativo |
| Encaminhamento Inteligente | Sugestão de especialidade para referral | `ai-smart-referral` | ✅ Ativo |
| Predição No-Show | Risco de não-comparecimento | `ai-no-show` | ✅ Ativo |
| Alerta de Deterioração | Red flags em sinais vitais | `ai-deterioration` | ✅ Ativo |
| Predição de Cancelamento | Risco de churning | `ai-cancel-prediction` | ✅ Ativo |
| Chat com Paciente | Assistência ao paciente via chat IA | `ai-patient-chat` | ✅ Ativo |
| Sugestão CID-10 | Recomendação de código CID | `ai-cid-suggest` | ✅ Ativo |
| Sentimento | Análise de sentimento do paciente | `ai-sentiment` | ✅ Ativo |
| Ditado por Voz | Voice-first dictation | Frontend | ✅ Ativo |
| Agent Chat | Tool-use agent com Claude | `ai-agent-chat` | ✅ Ativo |
| Odontograma IA | Sugestões odontológicas | `ai-odonto` | ✅ Ativo |
| SOAP Generator | Geração automática de notas SOAP | `ai-soap` | ✅ Ativo |
| Risk Score | Score de risco do paciente | `ai-risk` | ✅ Ativo |
| NLP Extract | Extração de entidades clínicas | `ai-nlp` | ✅ Ativo |

### 7.2 Copilot no Prontuário (Arquitetura Atual)

```
ProntuarioForm.tsx
       │
       ├── CopilotProntuarioContext.tsx
       │   ├── register(patientId, currentInputs)
       │   ├── updateInput(field, value)    -- Watch fields changes
       │   └── callbacks: onSelectCid, onAppendPrescription, onAppendPlan, onAppendExam
       │
       └── AiCopilotPanel.tsx (right sidebar)
           ├── Sugestões de CID-10
           ├── Sugestões de medicamentos
           ├── Sugestões de exames
           ├── Alertas clínicos
           └── Condutas recomendadas
           
           invoca → supabase.functions.invoke("ai-copilot")
```

### 7.3 Gaps de IA Identificados

| # | Gap | Severidade | Detalhe |
|---|-----|-----------|---------|
| 1 | **Sem métricas de precisão/recall** | 🟡 MÉDIO | Nenhum módulo tem accuracy tracking. Sugestões de CID podem estar erradas sem feedback loop |
| 2 | **Sem feedback loop** | 🟡 MÉDIO | Quando médico aceita/rejeita sugestão, não há registro para fine-tuning |
| 3 | **Sem AI GPS (Guia de Atendimento)** | 🟡 MÉDIO | IA sugere reativamente, não guia proativamente o fluxo do atendimento |
| 4 | **Sem validação de alucinação** | 🟡 MÉDIO | Sugestões de medicamento/CID não são validadas contra base de dados local |
| 5 | **Rate limit genérico** | 🟢 BAIXO | 15 req/min por usuário — adequado, mas sem priorização por tipo |

### 7.4 Arquitetura AI GPS

> **Entregável arquitetural detalhado na [Seção 11](#11-arquitetura-ai-gps--guia-inteligente-de-atendimento).**

---

## 8. MATRIZ DE SEVERIDADE CONSOLIDADA

### 🔴 CRÍTICO (Ação Imediata)

| ID | Problema | Módulo | Impacto |
|----|----------|--------|---------|
| C1 | Sem PDF selado/criptografado após assinatura de consentimento | Contratos | Documento legal sem integridade criptográfica — contestável em juízo |
| C2 | 4 tabelas de compliance sem RLS | Segurança | Exposição cross-tenant de dados de auditoria e LGPD |
| C3 | Sem mecanismo de data erasure automatizado (LGPD Art. 18) | Compliance | Violação direta da LGPD — risco de sanção pela ANPD |

### 🟠 ALTO (Próximo Sprint)

| ID | Problema | Módulo | Impacto |
|----|----------|--------|---------|
| A1 | Sem opção de assinatura manual (Canvas) | Contratos | Exclusão de pacientes sem câmera / com deficiência visual |
| A2 | Sem Drawer dedicado de contratos na listagem de pacientes | UX | Recepcionistas não visualizam status de contratos rapidamente |
| A3 | Sem notificação real-time quando paciente assina | UX | Clínica não sabe que contrato foi assinado até checar manualmente |
| A4 | Sem QR code de verificação em consentimentos assinados | Contratos | Autenticidade do documento não é verificável publicamente |
| A5 | Storage `consent-photos` sem owner-based filtering | Segurança | Staff pode acessar fotos biométricas de todos os pacientes do tenant |
| A6 | Sem integração Plano de Tratamento → Contratos | Lógica | Aprovação de orçamento não gera contrato automaticamente |

### 🟡 MÉDIO (Backlog Priorizado)

| ID | Problema | Módulo | Impacto |
|----|----------|--------|---------|
| M1 | IA sem métricas de precisão/recall | IA | Sem visibilidade da qualidade das sugestões |
| M2 | IA sem feedback loop (aceitar/rejeitar) | IA | Sem possibilidade de melhoria contínua |
| M3 | Sem AI GPS (guia proativo de atendimento) | IA | Médico não é guiado para padronizar consulta |
| M4 | Renomeação incompleta clients → patients | Código | Queries com fallback duplo, risco de incompatibilidade |
| M5 | Pacientes.tsx com 1400+ linhas | Código | Manutenibilidade reduzida |
| M6 | Sem viewer unificado de documentos | UX | Cada tipo de documento tem viewer separado |
| M7 | Export de portabilidade apenas em HTML (deveria ser JSON/FHIR) | LGPD | Portabilidade incompleta |
| M8 | Policy `contact_messages` com `WITH CHECK (true)` | Segurança | Spam sem validação |

### 🟢 BAIXO (Melhorias Futuras)

| ID | Problema | Módulo | Impacto |
|----|----------|--------|---------|
| B1 | Token de consentimento sem invalidação após uso | Segurança | Re-uso teórico (mitigado por signed_at check) |
| B2 | Rate limit genérico para IA (sem priorização) | IA | Todas as funções IA compartilham mesmo limite |
| B3 | Sem integração DICOM viewer | UX | Exames de imagem abrem externamente |
| B4 | Ranking de faturamento misturado com CRM | UX | Visões de negócio e clínica se confundem |

---

## 9. ARQUITETURA: DRAWER DE CONTRATOS DO PACIENTE

### 9.1 Visão Geral

Criar um **ícone de escudo/contrato** na listagem de pacientes que, ao clicado, abra um `Sheet` (Drawer) do Shadcn UI focado exclusivamente na documentação legal.

### 9.2 Componente: `PatientContractsDrawer`

```
src/components/consent/
├── PatientContractsDrawer.tsx      ← NOVO (Drawer principal)
├── ContractStatusBadge.tsx         ← NOVO (Badge na listagem)
├── ContractCard.tsx                ← NOVO (Card dentro do Drawer)
├── ConsentGate.tsx                 (existente)
├── ConsentRichTextEditor.tsx       (existente)
├── FacialCapture.tsx               (existente)
├── GenerateContractsDialog.tsx     (existente)
├── PatientConsentsViewer.tsx       (existente - refatorar para usar dentro do Drawer)
└── SendConsentLinkDialog.tsx       (existente)
```

### 9.3 Especificação do Drawer

```
┌──────────────────────────────────────────────┐
│  Contratos & Termos — Maria Silva       [X]  │
│──────────────────────────────────────────────│
│                                              │
│  📊 Resumo                                   │
│  ┌──────────┬──────────┬───────────┐         │
│  │ 3 Total  │ 2 Assin. │ 1 Pendent │         │
│  │          │  ✅      │  ⏳       │         │
│  └──────────┴──────────┴───────────┘         │
│                                              │
│  [+ Gerar Contrato]  [📤 Enviar Link]        │
│                                              │
│  ── PENDENTES ──────────────────────         │
│  ┌──────────────────────────────────┐        │
│  │ ⏳ Contrato de Prestação Serviços │        │
│  │    Criado: 15/03/2026            │        │
│  │    Expira: 18/03/2026            │        │
│  │    [Reenviar] [Cancelar]         │        │
│  └──────────────────────────────────┘        │
│                                              │
│  ── ASSINADOS ──────────────────────         │
│  ┌──────────────────────────────────┐        │
│  │ ✅ Termo de Uso de Imagem         │        │
│  │    Assinado: 10/03/2026 14:32    │        │
│  │    Método: 📸 Facial              │        │
│  │    [Ver] [Baixar PDF] [Verificar] │        │
│  └──────────────────────────────────┘        │
│  ┌──────────────────────────────────┐        │
│  │ ✅ LGPD - Consentimento           │        │
│  │    Assinado: 10/03/2026 14:30    │        │
│  │    Método: ✍️ Manual              │        │
│  │    [Ver] [Baixar PDF] [Verificar] │        │
│  └──────────────────────────────────┘        │
│                                              │
└──────────────────────────────────────────────┘
```

### 9.4 Fluxo de Dados

```typescript
// Hook: usePatientContracts(patientId: string)
// Fonte de dados: patient_consents JOIN consent_templates
// Agrupamento: { pending: ConsentItem[], signed: ConsentItem[] }

interface ConsentItem {
  id: string;
  template_id: string;
  template_name: string;
  template_type: 'html' | 'pdf';
  status: 'pending' | 'signed' | 'expired' | 'cancelled';
  created_at: string;
  expires_at: string | null;
  signed_at: string | null;
  signature_method: 'facial' | 'manual' | null;
  facial_photo_path: string | null;
  manual_signature_path: string | null;
  sealed_pdf_path: string | null;
  ip_address: string | null;
}
```

### 9.5 Integração na Listagem de Pacientes

```typescript
// Em Pacientes.tsx — Adicionar na coluna de ações de cada paciente:

// Badge de status na listagem (sem clique)
<ContractStatusBadge 
  patientId={patient.id}
  // Mostra: ✅ (todos assinados) | ⏳ N pendentes | — (sem contratos)
/>

// Ícone/botão que abre o Drawer
<Button variant="ghost" size="icon" onClick={() => openContractsDrawer(patient.id)}>
  <Scale className="h-4 w-4" />  {/* Ícone de balança/legal */}
</Button>

// Drawer (renderizado uma vez no nível da página)
<PatientContractsDrawer
  patientId={selectedPatientId}
  open={isDrawerOpen}
  onOpenChange={setIsDrawerOpen}
/>
```

### 9.6 Queries Supabase Necessárias

```sql
-- Nova RPC: get_patient_contracts_summary(p_patient_id UUID)
-- Retorna: { total, signed, pending, expired }

-- Nova RPC: get_patient_contracts_detail(p_patient_id UUID)  
-- Retorna: Array de ConsentItem com JOIN em consent_templates

-- Realtime subscription para atualização automática:
-- supabase.channel('patient-consents-{patientId}')
--   .on('postgres_changes', { table: 'patient_consents', filter: 'patient_id=eq.{id}' })
```

### 9.7 Ações do Drawer

| Ação | Componente | Permissão |
|------|-----------|-----------|
| Gerar Contrato | `GenerateContractsDialog` (existente) | admin, staff |
| Enviar Link | `SendConsentLinkDialog` (existente) | admin, staff |
| Reenviar Link | novo botão → regenera token | admin, staff |
| Cancelar Pendente | soft-delete com motivo | admin |
| Ver Assinado | modal com snapshot HTML + foto | admin, staff, profissional |
| Baixar PDF Selado | download do PDF gerado pós-assinatura | admin, staff |
| Verificar Autenticidade | página pública via QR/hash | público |

---

## 10. ARQUITETURA: SISTEMA DE ASSINATURA HÍBRIDA

### 10.1 Visão Geral

Dar ao paciente, ao abrir o contrato no celular, a **opção de escolha**:
1. **📸 Assinatura Facial** (câmera) — fluxo existente aprimorado
2. **✍️ Assinatura Manual** (Canvas touch) — novo fluxo

### 10.2 Fluxo Completo

```
Paciente abre link/portal
         │
         ▼
Lê o termo completo
(scroll obrigatório até o final)
         │
         ▼
┌────────────────────────────┐
│  Como deseja assinar?      │
│                            │
│  ┌──────┐    ┌──────────┐  │
│  │ 📸   │    │  ✍️      │  │
│  │Facial│    │ Desenhar │  │
│  │      │    │          │  │
│  └──────┘    └──────────┘  │
│                            │
│  Reconhec.    Assinatura   │
│  Facial       Manual       │
└────────────────────────────┘
         │              │
         ▼              ▼
┌──────────────┐  ┌──────────────┐
│FacialCapture │  │SignatureCanvas│
│  (existente) │  │   (NOVO)     │
│  Banuba SDK  │  │ react-signat.│
│  Webcam      │  │ Canvas touch │
└──────────────┘  └──────────────┘
         │              │
         ▼              ▼
    Upload foto    Upload PNG
    consent-photos consent-signatures (novo bucket)
         │              │
         └──────┬───────┘
                ▼
       RPC sign_consent_v2()
       (SECURITY DEFINER)
                │
                ▼
       patient_consents record
       + signature_method: 'facial' | 'manual'
       + facial_photo_path | manual_signature_path
                │
                ▼
       Edge Function: seal-consent-pdf
       (Deno + pdf-lib)
                │
                ▼
       PDF Selado gerado:
       ┌─────────────────────────┐
       │  CONTRATO ASSINADO      │
       │  ─────────────────      │
       │  [Conteúdo do Termo]    │
       │                         │
       │  ─── ASSINATURA ───     │
       │  [Foto] ou [Desenho]    │
       │  Nome: Maria Silva      │
       │  CPF: ***.***.***-**    │
       │  Data: 16/03/2026 14:32 │
       │  IP: 189.XX.XX.XX       │
       │  Hash: abc123...        │
       │  [QR Code Verificação]  │
       └─────────────────────────┘
                │
                ▼
       Upload PDF → consent-sealed-pdfs (novo bucket)
                │
                ▼
       Update patient_consents.sealed_pdf_path
                │
                ▼
       Notificação Realtime → Drawer da Clínica
       (toast + badge update)
```

### 10.3 Novo Componente: `SignatureCanvas`

```
src/components/signature/
├── CertificateSelector.tsx    (existente — ICP-Brasil)
├── DocumentQRCode.tsx         (existente — QR code)
├── SignatureCanvas.tsx         ← NOVO
└── SignatureMethodSelector.tsx ← NOVO
```

**Especificação do `SignatureCanvas`:**

```typescript
// Dependência: react-signature-canvas ou signature_pad
// Props:
interface SignatureCanvasProps {
  onComplete: (signatureDataUrl: string) => void;
  onClear: () => void;
  penColor?: string;       // default: "#1a1a2e"
  penWidth?: number;        // default: 2
  canvasWidth?: number;     // responsive
  canvasHeight?: number;    // default: 200
  patientName: string;      // exibido como guia abaixo do canvas
}

// Características:
// - Canvas touch-friendly (pointer events)
// - Botão "Limpar" para recomeçar
// - Preview da assinatura antes de confirmar
// - Export como PNG (data URL → Blob)
// - Validação: mínimo de 50 pontos (evitar rabisco acidental)
// - Guia pontilhada com nome do paciente abaixo
```

### 10.4 Novo Componente: `SignatureMethodSelector`

```typescript
interface SignatureMethodSelectorProps {
  onSelectMethod: (method: 'facial' | 'manual') => void;
  hasCamera: boolean;  // detect via navigator.mediaDevices
}

// Se não tem câmera: auto-seleciona 'manual'
// Se tem câmera: mostra as duas opções
```

### 10.5 Novos Storage Buckets

```sql
-- Bucket para assinaturas manuais (Canvas)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('consent-signatures', 'consent-signatures', false, 1048576, -- 1MB
  ARRAY['image/png', 'image/jpeg']);

-- Bucket para PDFs selados pós-assinatura
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('consent-sealed-pdfs', 'consent-sealed-pdfs', false, 10485760, -- 10MB
  ARRAY['application/pdf']);
```

### 10.6 RPC: `sign_consent_v2`

```sql
CREATE OR REPLACE FUNCTION public.sign_consent_v2(
  p_consent_id UUID,
  p_signature_method TEXT,        -- 'facial' | 'manual'
  p_facial_photo_path TEXT DEFAULT NULL,
  p_manual_signature_path TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validações:
  -- 1. Consent existe e pertence ao paciente (auth.uid())
  -- 2. Ainda não foi assinado
  -- 3. Token não expirou
  -- 4. Pelo menos um path fornecido (facial OU manual)
  
  UPDATE patient_consents SET
    signed_at = NOW(),
    signature_method = p_signature_method,
    facial_photo_path = p_facial_photo_path,
    manual_signature_path = p_manual_signature_path,
    ip_address = p_ip_address,
    user_agent = p_user_agent
  WHERE id = p_consent_id
    AND patient_user_id = auth.uid()
    AND signed_at IS NULL;
    
  -- Dispara Edge Function seal-consent-pdf via pg_net
  -- (ou via webhook trigger)
  
  RETURN jsonb_build_object('success', true, 'consent_id', p_consent_id);
END;
$$;
```

### 10.7 Edge Function: `seal-consent-pdf`

```
supabase/functions/seal-consent-pdf/index.ts

Fluxo:
1. Recebe: consent_id
2. Busca: patient_consents + consent_templates + patients
3. Renderiza: HTML template → PDF (via pdf-lib ou puppeteer-deno)
4. Embute: foto facial OU assinatura manual como imagem no PDF
5. Adiciona metadados: IP, data/hora, user-agent, hash SHA-256
6. Gera QR code: URL de verificação pública
7. Upload: PDF → consent-sealed-pdfs/{tenant_id}/{patient_id}/{consent_id}.pdf
8. Update: patient_consents.sealed_pdf_path
9. Notifica: via Realtime channel (toast na clínica)
```

### 10.8 Cadeia de Custódia

```
GERAÇÃO              ASSINATURA            SELAGEM              ARMAZENAMENTO
────────              ──────────            ───────              ─────────────
Admin cria     →     Paciente assina  →   Edge Function    →   PDF selado em
template no          via facial ou         gera PDF com         bucket protegido
editor visual        canvas manual         prova embutida       com RLS
                          │                     │                     │
                          ▼                     ▼                     ▼
                     patient_consents      seal-consent-pdf     consent-sealed-pdfs
                     (signed_at, IP,       (SHA-256 hash,       /{tenant}/{patient}/
                      method, paths)        QR code, foto)      {consent_id}.pdf
                                                │
                                                ▼
                                           VERIFICAÇÃO PÚBLICA
                                           /verificar-documento/{hash}
                                           (existente: DocumentQRCode.tsx)
```

### 10.9 Alterações no Schema

```sql
-- Adicionar colunas em patient_consents:
ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS
  signature_method TEXT CHECK (signature_method IN ('facial', 'manual'));

ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS
  manual_signature_path TEXT;

ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS
  sealed_pdf_path TEXT;

ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS
  sealed_pdf_hash TEXT;  -- SHA-256 do PDF final

ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS
  sealed_at TIMESTAMPTZ;  -- Quando o PDF foi selado
```

---

## 11. ARQUITETURA: AI GPS — GUIA INTELIGENTE DE ATENDIMENTO

### 11.1 Conceito

O **AI GPS** atua como um **navegador inteligente da consulta**, guiando o médico por cada etapa do atendimento de forma proativa, sugerindo o próximo passo e verificando completude.

### 11.2 Fases do Atendimento Padronizado

```
┌────────────────────────────────────────────────────────┐
│                    AI GPS — GUIA DE CONSULTA            │
│                                                        │
│  ① Queixa Principal    ✅ Completa                     │
│  ② História da Doença  ✅ Completa                     │
│  ③ Revisão Sistemas    🔵 Em Andamento (3/7 sistemas)  │
│  ④ Exame Físico        ⬜ Pendente                     │
│  ⑤ Hipótese Diagnóst.  ⬜ Pendente                     │
│  ⑥ Exames Complem.     ⬜ Pendente                     │
│  ⑦ Conduta/Plano       ⬜ Pendente                     │
│  ⑧ Orientações         ⬜ Pendente                     │
│  ⑨ Retorno             ⬜ Pendente                     │
│                                                        │
│  💡 Sugestão: "Paciente relata dor torácica há 3 dias. │
│  Considere investigar: irradiação, fatores agravantes, │
│  associação com esforço. Avançar para Exame Físico     │
│  cardiovascular?"                                      │
│                                                        │
│  [Aceitar Sugestão] [Pular Etapa] [Personalizar]       │
└────────────────────────────────────────────────────────┘
```

### 11.3 Arquitetura Técnica

```
src/components/ai/
├── AiCopilotPanel.tsx           (existente — refatorar para incluir GPS)
├── AiGpsNavigator.tsx           ← NOVO (widget de progresso)
├── AiGpsStepCard.tsx            ← NOVO (card por etapa)
├── AiGpsSuggestion.tsx          ← NOVO (sugestão contextual)
└── useAiGps.ts                  ← NOVO (hook de estado)

src/contexts/
├── CopilotProntuarioContext.tsx (existente — estender)
└── AiGpsContext.tsx             ← NOVO (estado global do GPS)

supabase/functions/
├── ai-copilot/index.ts          (existente — estender prompt)
└── ai-gps-evaluate/index.ts     ← NOVO (avaliação de completude)
```

### 11.4 Modelo de Dados

```typescript
interface AiGpsState {
  consultationId: string;
  patientId: string;
  specialty: string;   // 'clinica_geral' | 'cardiologia' | 'ortopedia' | etc.
  steps: AiGpsStep[];
  currentStepIndex: number;
  overallProgress: number; // 0-100
  suggestions: AiGpsSuggestion[];
}

interface AiGpsStep {
  id: string;
  name: string;          // 'queixa_principal' | 'historia_doenca' | etc.
  label: string;         // 'Queixa Principal'
  status: 'pending' | 'in_progress' | 'complete' | 'skipped';
  completeness: number;  // 0-100 (avaliado pela IA)
  requiredFields: string[];
  filledFields: string[];
  aiEvaluation?: string; // "Queixa bem detalhada, duração e intensidade registradas"
}

interface AiGpsSuggestion {
  id: string;
  stepId: string;
  type: 'advance' | 'complete' | 'investigate' | 'alert';
  message: string;
  actions: AiGpsAction[];
  confidence: number;  // 0-1
  timestamp: string;
}

interface AiGpsAction {
  label: string;
  type: 'accept' | 'skip' | 'customize' | 'navigate';
  targetField?: string;
  suggestedValue?: string;
}
```

### 11.5 Templates por Especialidade

```typescript
// Cada especialidade define seu próprio protocolo de atendimento:

const GPS_TEMPLATES: Record<string, AiGpsStep[]> = {
  clinica_geral: [
    { name: 'queixa_principal', requiredFields: ['chief_complaint'] },
    { name: 'historia_doenca', requiredFields: ['anamnesis'] },
    { name: 'revisao_sistemas', requiredFields: ['review_of_systems'] },
    { name: 'exame_fisico', requiredFields: ['physical_exam'] },
    { name: 'hipotese_diagnostica', requiredFields: ['diagnosis', 'cid_code'] },
    { name: 'exames_complementares', requiredFields: [] }, // opcional
    { name: 'conduta', requiredFields: ['treatment'] },
    { name: 'orientacoes', requiredFields: ['orientations'] },
    { name: 'retorno', requiredFields: ['return_date'] },
  ],
  cardiologia: [
    // ... steps específicos com foco cardiovascular
    { name: 'exame_fisico', requiredFields: ['cardiac_auscultation', 'peripheral_pulses', 'bp_bilateral'] },
  ],
  odontologia: [
    { name: 'queixa_principal', requiredFields: ['chief_complaint'] },
    { name: 'exame_intraoral', requiredFields: ['intraoral_exam'] },
    { name: 'odontograma', requiredFields: ['odontogram_updated'] },
    { name: 'plano_tratamento', requiredFields: ['treatment_plan'] },
    { name: 'procedimento', requiredFields: ['procedure_performed'] },
    { name: 'prescricao', requiredFields: [] },
    { name: 'orientacoes', requiredFields: ['post_op_instructions'] },
    { name: 'retorno', requiredFields: ['return_date'] },
  ],
  // ... dermatologia, psicologia, fisioterapia, etc.
};
```

### 11.6 Edge Function: `ai-gps-evaluate`

```
Entrada:
  - consultation_steps: { field: value }[]
  - specialty: string
  - patient_context: { age, sex, allergies, history }

Processamento (Gemini 2.0 Flash):
  System Prompt: "Você é um assistente de navegação clínica. Avalie a completude
  de cada etapa do atendimento e sugira o próximo passo. Não diagnostique —
  apenas guie o fluxo. Responda em JSON estruturado."

Saída:
  {
    "steps_evaluation": [
      { "step": "queixa_principal", "completeness": 85, "feedback": "..." },
      { "step": "historia_doenca", "completeness": 60, "feedback": "Falta duração e fatores agravantes" }
    ],
    "next_suggestion": {
      "step": "exame_fisico",
      "message": "Considere ausculta cardíaca dado o relato de...",
      "priority": "high"
    },
    "alerts": [
      { "type": "red_flag", "message": "Dor torácica + dispneia: considerar ECG urgente" }
    ]
  }
```

### 11.7 Feedback Loop e Métricas

```sql
-- Nova tabela: ai_gps_feedback
CREATE TABLE ai_gps_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  consultation_id UUID REFERENCES medical_records(id),
  step_name TEXT NOT NULL,
  suggestion_id TEXT,
  action TEXT CHECK (action IN ('accepted', 'rejected', 'modified', 'skipped')),
  professional_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Métricas derivadas:
-- acceptance_rate = COUNT(accepted) / COUNT(total) por step
-- skip_rate = COUNT(skipped) / COUNT(total) por specialty
-- completion_time = AVG(tempo entre step_start e step_complete)
```

### 11.8 Integração com Copilot Existente

```
┌─────────────────────────────────────────────────┐
│         PRONTUÁRIO (ProntuarioForm.tsx)          │
│                                                  │
│  ┌────────────────────┐  ┌────────────────────┐  │
│  │   FORMULÁRIO       │  │  AI SIDEBAR        │  │
│  │                    │  │                    │  │
│  │  [Queixa: ___]     │  │  ┌──────────────┐  │  │
│  │  [Anamnese: ___]   │  │  │ 🗺️ AI GPS    │  │  │
│  │  [Ex. Físico: ___] │  │  │ Progresso    │  │  │
│  │  [Diagnóstico: __] │  │  │ ① ✅ ② ✅    │  │  │
│  │  [Tratamento: ___] │  │  │ ③ 🔵 ④ ⬜    │  │  │
│  │                    │  │  │ Sugestão...  │  │  │
│  │                    │  │  └──────────────┘  │  │
│  │                    │  │                    │  │
│  │                    │  │  ┌──────────────┐  │  │
│  │                    │  │  │ 🤖 Copilot   │  │  │
│  │                    │  │  │ CID: J06.9   │  │  │
│  │                    │  │  │ Med: ...     │  │  │
│  │                    │  │  └──────────────┘  │  │
│  └────────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────┘
```

O AI GPS fica **acima** do Copilot no sidebar, como um widget de progresso. O Copilot continua fazendo sugestões reativas, enquanto o GPS guia proativamente.

---

## 12. PLANO DE EXECUÇÃO PRIORIZADO

### Sprint 1 — Segurança Crítica (Imediato)

| Task | Esforço | Entregável |
|------|---------|-----------|
| Adicionar RLS às 4 tabelas de compliance | P | Migration SQL |
| Implementar owner-based filtering no bucket `consent-photos` | P | Storage policy |
| Tighten `contact_messages` policy | P | Migration SQL |

### Sprint 2 — Drawer de Contratos + Assinatura Manual

| Task | Esforço | Entregável |
|------|---------|-----------|
| Criar `PatientContractsDrawer` | M | Componente React |
| Criar `ContractStatusBadge` | P | Componente React |
| Integrar badge + drawer em `Pacientes.tsx` | P | Refatoração |
| Criar `SignatureCanvas` | M | Componente React |
| Criar `SignatureMethodSelector` | P | Componente React |
| Criar buckets `consent-signatures` e `consent-sealed-pdfs` | P | Migration SQL |
| Criar RPC `sign_consent_v2` | M | Migration SQL |
| Adicionar colunas `signature_method`, `manual_signature_path`, `sealed_pdf_path` | P | Migration SQL |

### Sprint 3 — PDF Selado + Cadeia de Custódia

| Task | Esforço | Entregável |
|------|---------|-----------|
| Criar Edge Function `seal-consent-pdf` | G | Deno function |
| Integrar pdf-lib para geração server-side | M | Dependência |
| Implementar QR code no PDF selado | P | Feature |
| Criar página de verificação pública | M | Página React |
| Realtime subscription para notificação na clínica | P | Feature |
| Implementar data erasure automático (LGPD Art. 18) | M | RPC + UI |

### Sprint 4 — AI GPS

| Task | Esforço | Entregável |
|------|---------|-----------|
| Criar `AiGpsContext` | M | Context React |
| Criar `AiGpsNavigator` widget | M | Componente React |
| Criar `AiGpsStepCard` e `AiGpsSuggestion` | M | Componentes React |
| Criar Edge Function `ai-gps-evaluate` | G | Deno function |
| Criar templates por especialidade | M | Dados |
| Integrar com `CopilotProntuarioContext` | M | Refatoração |
| Criar tabela `ai_gps_feedback` | P | Migration SQL |
| Implementar métricas de precisão/recall | G | Dashboard |

**Legenda de Esforço:** P = Pequeno (1-2h) | M = Médio (3-8h) | G = Grande (1-2 dias)

---

## APÊNDICE A — ARQUIVOS AUDITADOS

| Categoria | Arquivos Principais |
|-----------|-------------------|
| **Pacientes** | `src/pages/Pacientes.tsx` (1400+ linhas) |
| **Agenda** | `src/pages/Agenda.tsx` |
| **Recepção** | `src/pages/recepcao/DashboardRecepcao.tsx`, `FilaAtendimento.tsx` |
| **Triagem** | `src/pages/Triagem.tsx` |
| **Prontuário** | `src/components/prontuario/ProntuarioForm.tsx` (355+ linhas) |
| **Consentimento** | `src/components/consent/` (6 arquivos) |
| **Assinatura** | `src/components/signature/` (2 arquivos) |
| **IA** | `src/components/ai/` (20 arquivos) |
| **Financeiro** | `src/pages/Financeiro.tsx`, `FaturasPacientes.tsx` |
| **Portal Paciente** | `src/pages/paciente/` (17 páginas) |
| **Layout** | `src/components/layout/Sidebar.tsx` |
| **Contexts** | `src/contexts/CopilotProntuarioContext.tsx` + 5 outros |
| **Edge Functions** | `supabase/functions/` (60+ functions) |
| **Migrations** | `supabase/migrations/` (300+ migrations) |
| **Backend IA** | `supabase/functions/_shared/vertex-ai-client.ts` (450+ linhas) |
| **Lib** | `src/lib/` (77+ arquivos) |
| **Utils** | `src/utils/` (6 arquivos) |
| **Types** | `src/types/` (3 arquivos) |

## APÊNDICE B — STACK TECNOLÓGICO

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| UI | Shadcn UI (52 componentes) + Tailwind CSS |
| State | TanStack Query + React Context |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime) |
| IA | Google Vertex AI (Gemini 2.0 Flash) + AWS Bedrock (Claude fallback) |
| Pagamentos | Asaas (primary) + PagSeguro + Stone |
| Certificados | ICP-Brasil (A1/A3/BirdID) via WebPKI (Lacuna) |
| Facial | Banuba SDK v1.17.7 |
| PDF | jsPDF (client-side) + pdf-lib (proposto server-side) |
| PWA | Service Worker + Offline Cache + Sync |

---

**FIM DO RELATÓRIO**

*Documento gerado em 16/03/2026. Classificação: Confidencial — Uso Interno.*
