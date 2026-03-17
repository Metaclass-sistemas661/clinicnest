/**
 * Manual Técnico — ClinicNest
 * Documentação técnica para certificação SBIS NGS1/NGS2
 */

import { APP_VERSION } from "@/lib/version";

export interface TechnicalSection {
  id: string;
  title: string;
  content: string;
  subsections?: TechnicalSubsection[];
}

export interface TechnicalSubsection {
  id: string;
  title: string;
  content: string;
}

export const MANUAL_TECNICO: TechnicalSection[] = [
  {
    id: "arquitetura",
    title: "1. Arquitetura do Sistema",
    content: `O ClinicNest utiliza arquitetura moderna baseada em cloud computing, garantindo escalabilidade, disponibilidade e segurança.`,
    subsections: [
      {
        id: "stack",
        title: "1.1 Stack Tecnológico",
        content: `**Frontend:**
• React 18 com TypeScript
• Vite como bundler
• TailwindCSS para estilização
• Shadcn/UI como biblioteca de componentes
• React Query para gerenciamento de estado servidor

**Backend:**
• Supabase (PostgreSQL + Auth + Storage + Realtime)
• Edge Functions (Deno) para lógica serverless
• Row Level Security (RLS) para isolamento de dados

**Infraestrutura:**
• Hospedagem: Supabase Cloud (AWS)
• CDN: Cloudflare
• Monitoramento: Supabase Dashboard + Logs`,
      },
      {
        id: "diagrama",
        title: "1.2 Diagrama de Arquitetura",
        content: `┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Browser   │  │   Mobile    │  │   PWA       │          │
│  │   (React)   │  │   (PWA)     │  │   Offline   │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │ HTTPS/WSS
          ┌────────────────┴────────────────┐
          │           SUPABASE              │
          │  ┌──────────────────────────┐   │
          │  │      API Gateway         │   │
          │  │   (PostgREST + Auth)     │   │
          │  └────────────┬─────────────┘   │
          │               │                 │
          │  ┌────────────┴─────────────┐   │
          │  │      PostgreSQL          │   │
          │  │   (RLS + Triggers)       │   │
          │  └────────────┬─────────────┘   │
          │               │                 │
          │  ┌────────────┴─────────────┐   │
          │  │    Edge Functions        │   │
          │  │  (Deno - Serverless)     │   │
          │  └──────────────────────────┘   │
          └─────────────────────────────────┘`,
      },
      {
        id: "multitenancy",
        title: "1.3 Multi-tenancy",
        content: `O sistema implementa multi-tenancy com isolamento por tenant_id:
• Cada clínica possui um tenant_id único (UUID)
• Todas as tabelas possuem coluna tenant_id
• Row Level Security (RLS) garante isolamento automático
• Usuários só acessam dados do seu tenant

Política RLS padrão:
\`\`\`sql
CREATE POLICY "tenant_isolation" ON tabela
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );
\`\`\``,
      },
    ],
  },
  {
    id: "seguranca",
    title: "2. Segurança",
    content: `O ClinicNest implementa múltiplas camadas de segurança para proteção dos dados de saúde.`,
    subsections: [
      {
        id: "autenticacao",
        title: "2.1 Autenticação",
        content: `**Mecanismo:** Supabase Auth (baseado em GoTrue)
• Tokens JWT com expiração configurável
• Refresh tokens para renovação automática
• Suporte a MFA (Multi-Factor Authentication)
• Rate limiting para prevenção de brute force

**Fluxo de autenticação:**
1. Usuário envia credenciais
2. Supabase Auth valida e gera JWT
3. JWT é armazenado no cliente (httpOnly cookie)
4. Requisições incluem JWT no header Authorization
5. RLS valida permissões automaticamente`,
      },
      {
        id: "autorizacao",
        title: "2.2 Autorização (RBAC)",
        content: `**Modelo:** Role-Based Access Control

**Roles disponíveis:**
• admin: Acesso total
• medico: Prontuários, prescrições, agenda própria
• enfermeiro: Triagem, evoluções, sinais vitais
• secretaria: Agenda, cadastros, recepção
• faturista: TISS, faturamento

**Implementação:**
• Tabela \`roles\` com definição de permissões
• Tabela \`user_roles\` associando usuários a roles
• Função \`check_permission()\` para validação
• Componente \`PermissionGate\` no frontend`,
      },
      {
        id: "criptografia",
        title: "2.3 Criptografia",
        content: `**Em trânsito:**
• TLS 1.3 para todas as conexões
• Certificados gerenciados automaticamente
• HSTS habilitado

**Em repouso:**
• Banco de dados criptografado (AES-256)
• Backups criptografados
• Secrets em variáveis de ambiente

**Dados sensíveis:**
• Senhas: bcrypt com salt
• Prontuários: Hash SHA-256 para integridade
• Assinaturas: RSA com certificado ICP-Brasil`,
      },
      {
        id: "auditoria",
        title: "2.4 Auditoria",
        content: `**Tabela audit_logs:**
• Registro de todas as operações CRUD
• Campos: user_id, action, table_name, record_id, old_data, new_data, ip_address, timestamp

**Tabela clinical_access_logs:**
• Registro específico de acesso a dados clínicos
• Atende requisito SBIS de rastreabilidade
• Campos: user_id, patient_id, record_type, action, justification, timestamp

**Retenção:**
• Logs de auditoria: 5 anos (requisito legal)
• Logs de acesso clínico: 20 anos (CFM)`,
      },
    ],
  },
  {
    id: "banco-dados",
    title: "3. Banco de Dados",
    content: `O ClinicNest utiliza PostgreSQL 15 com extensões específicas para saúde.`,
    subsections: [
      {
        id: "modelo",
        title: "3.1 Modelo de Dados",
        content: `**Tabelas principais:**
• tenants: Clínicas/organizações
• profiles: Usuários do sistema
• clients: Pacientes
• appointments: Agendamentos
• medical_records: Prontuários
• prescriptions: Receituários
• tiss_guides: Guias TISS
• transactions: Movimentações financeiras

**Relacionamentos:**
• Todas as tabelas referenciam tenant_id
• Pacientes podem ter múltiplos prontuários
• Agendamentos vinculam paciente, profissional e procedimento
• Prontuários possuem versionamento`,
      },
      {
        id: "integridade",
        title: "3.2 Integridade de Dados",
        content: `**Constraints:**
• Primary keys UUID (gen_random_uuid())
• Foreign keys com ON DELETE CASCADE/RESTRICT
• Check constraints para validação de domínio
• Unique constraints para campos únicos

**Triggers:**
• updated_at automático em todas as tabelas
• Versionamento de prontuários
• Cálculo de hash para assinatura digital
• Geração de logs de auditoria`,
      },
      {
        id: "backup",
        title: "3.3 Backup e Recuperação",
        content: `**Política de backup:**
• Backup completo: Diário às 02:00 UTC
• Backup incremental: A cada 6 horas
• Point-in-Time Recovery: Últimas 7 dias
• Retenção: 365 dias

**Verificação:**
• Hash SHA-256 de cada backup
• Teste de restauração mensal
• Logs de backup com status e métricas

**Recuperação:**
• RTO (Recovery Time Objective): 4 horas
• RPO (Recovery Point Objective): 6 horas`,
      },
    ],
  },
  {
    id: "integracoes",
    title: "4. Integrações",
    content: `O sistema oferece integrações com diversos sistemas externos.`,
    subsections: [
      {
        id: "hl7",
        title: "4.1 HL7 v2.x (Laboratórios)",
        content: `**Protocolo:** HL7 v2.5.1
**Mensagens suportadas:**
• ORU^R01: Recebimento de resultados
• ORM^O01: Envio de pedidos
• ACK: Confirmação de recebimento

**Implementação:**
• Parser completo em \`hl7-v2-parser.ts\`
• Mapeamento automático para FHIR
• Validação de estrutura e campos obrigatórios`,
      },
      {
        id: "fhir",
        title: "4.2 HL7 FHIR R4",
        content: `**Versão:** FHIR R4
**Profiles:** RNDS (Rede Nacional de Dados em Saúde)

**Recursos suportados:**
• Patient: Dados do paciente
• Encounter: Atendimentos
• Observation: Sinais vitais e exames
• Condition: Diagnósticos (CID-10)
• MedicationRequest: Prescrições

**Operações:**
• Export: Bundle JSON para interoperabilidade
• Import: Parse de bundles recebidos`,
      },
      {
        id: "tiss",
        title: "4.3 TISS (ANS)",
        content: `**Versão:** TISS 3.05.00
**Guias implementadas:**
• Consulta
• SP/SADT (Serviço Profissional/SADT)
• Honorários

**Funcionalidades:**
• Geração de XML válido
• Validação contra schema XSD
• Parse de retorno (glosas)
• Gestão de recursos`,
      },
      {
        id: "sngpc",
        title: "4.4 SNGPC (ANVISA)",
        content: `**Sistema:** Sistema Nacional de Gerenciamento de Produtos Controlados
**Versão:** API REST (nova especificação 2024)

**Funcionalidades:**
• Registro de movimentações
• Balanço de estoque
• Transmissão automática
• Livro de registro digital`,
      },
    ],
  },
  {
    id: "conformidade",
    title: "5. Conformidade",
    content: `O ClinicNest atende às principais normas e regulamentações do setor de saúde.`,
    subsections: [
      {
        id: "sbis",
        title: "5.1 SBIS (NGS1/NGS2)",
        content: `**Requisitos atendidos:**
✓ Identificação única do usuário
✓ Autenticação segura
✓ Controle de acesso por perfil
✓ Registro de auditoria
✓ Integridade dos dados (hash)
✓ Backup automático
✓ Estrutura do prontuário (SOAP)
✓ Prescrição eletrônica
✓ Assinatura ICP-Brasil (NGS2)
✓ Carimbo de tempo TSA (NGS2)`,
      },
      {
        id: "lgpd",
        title: "5.2 LGPD",
        content: `**Medidas implementadas:**
• Consentimento explícito para coleta de dados
• Direito de acesso aos dados pessoais
• Direito de retificação
• Direito de exclusão (quando permitido)
• Portabilidade de dados (export FHIR)
• Registro de tratamento de dados
• Notificação de incidentes
• DPO configurável por tenant`,
      },
      {
        id: "cfm",
        title: "5.3 CFM (Resoluções)",
        content: `**Resoluções atendidas:**
• CFM 1.638/2002: Prontuário médico
• CFM 1.821/2007: Prontuário eletrônico
• CFM 2.217/2018: Telemedicina
• CFM 2.299/2021: Prescrição eletrônica

**Requisitos:**
• Guarda de prontuários: 20 anos
• Assinatura digital com certificado ICP-Brasil
• Identificação do profissional (CRM)
• Registro de data e hora`,
      },
    ],
  },
  {
    id: "operacao",
    title: "6. Operação",
    content: `Informações sobre a operação e manutenção do sistema.`,
    subsections: [
      {
        id: "disponibilidade",
        title: "6.1 Disponibilidade",
        content: `**SLA:** 99.9% de uptime
**Manutenção programada:** Domingos 02:00-04:00 UTC

**Monitoramento:**
• Health checks a cada 30 segundos
• Alertas automáticos por e-mail/SMS
• Dashboard de status público`,
      },
      {
        id: "escalabilidade",
        title: "6.2 Escalabilidade",
        content: `**Horizontal:**
• Edge Functions auto-scaling
• CDN para assets estáticos
• Connection pooling (PgBouncer)

**Vertical:**
• Upgrade de instância sob demanda
• Particionamento de tabelas grandes
• Índices otimizados`,
      },
      {
        id: "suporte",
        title: "6.3 Suporte Técnico",
        content: `**Níveis de suporte:**
• N1: Atendimento inicial (FAQ, orientações)
• N2: Suporte técnico (configurações, bugs)
• N3: Desenvolvimento (correções, melhorias)

**Canais:**
• E-mail: suporte@ClinicNest.com.br
• Chat: Dentro do sistema
• WhatsApp: Planos Pro/Premium`,
      },
    ],
  },
];

export const MANUAL_TECNICO_INFO = {
  titulo: "Manual Técnico — ClinicNest",
  versao: APP_VERSION,
  dataAtualizacao: "2026-02-23",
  empresa: "ClinicNest Sistemas de Saúde",
  classificacao: "Confidencial — Uso interno e auditoria",
  certificacao: "Em conformidade com SBIS NGS1/NGS2",
};
