# ClinicaFlow — Roadmap de Evolução para Nível Enterprise

> Comparativo com Tasy, MV Soul, iClinic e Ninsaúde.
> Última atualização: 24/02/2026 (Fase 29 concluída — Portal do Paciente: Evolução Competitiva)

---

## Legenda

- ✅ Concluído
- 🔄 Em andamento
- ⬚ Pendente
- ⏭️ Já existia (descoberto na auditoria)

---

## Auditoria Pré-Implementação

Itens descobertos que JÁ existem no sistema (não reimplementar):

| Item | Localização | Status |
|------|-------------|--------|
| PDF de receitas (portal paciente) | `src/utils/patientDocumentPdf.ts` → `generatePrescriptionPdf()` | ⏭️ Existe |
| PDF de laudos/exames (portal paciente) | `src/utils/patientDocumentPdf.ts` → `generateExamPdf()` | ⏭️ Existe |
| PDF de atestados (portal paciente) | `src/utils/patientDocumentPdf.ts` → `generateCertificatePdf()` | ⏭️ Existe |
| PDF financeiro completo | `src/utils/financialPdfExport.ts` → `generateFinancialReport()` | ⏭️ Existe |
| Impressão formatada de receituários (admin) | `src/pages/Receituarios.tsx` → `handlePrint()` — HTML completo com timbre | ⏭️ Existe |
| Tabela `medical_certificates` (atestados) | `20260321000000_patient_security_certificates_v1.sql` | ⏭️ Existe |
| RPCs paciente (receitas, exames, atestados, prontuários) | Mesma migration | ⏭️ Existe |
| Portal do paciente (9 páginas) | `src/pages/paciente/` — Dashboard, Consultas, Receitas, Exames, Atestados, Teleconsulta, Consentimento, Login, Register | ⏭️ Existe |
| WhatsApp sender (Edge Function) | `supabase/functions/whatsapp-sender/` — usa `whatsapp_api_url/key/instance` do tenant | ⏭️ Existe |
| Automações WhatsApp/Email | `supabase/functions/automation-worker/` + página `Automacoes.tsx` | ⏭️ Existe |
| jsPDF + jspdf-autotable | `package.json` — já instalados | ⏭️ Existe |

---

## FASE 1 — Compliance & Impressão

> Pré-requisitos regulatórios. Sem isso, clínicas sérias não adotam.

| # | Item | Status | Observações |
|---|------|:------:|-------------|
| 1.1 | PDF de prontuário (admin — gerar PDF do prontuário salvo) | ✅ | `generateMedicalRecordPdf()` em `patientDocumentPdf.ts`, botão PDF no card de prontuário. |
| 1.2 | Busca CID-10 com autocomplete (~2.000 códigos mais usados) | ✅ | `Cid10Combobox` + dataset `cid10.ts` (~350 códigos), usado no `ProntuarioForm`. |
| 1.3 | Assinatura digital de prontuário (hash SHA-256 + timestamp + CRM) | ✅ | `digital-signature.ts` com `generateRecordHash`/`buildSignaturePayload`. Campos `digital_hash`, `signed_at`, `signed_by_name`, `signed_by_crm` no banco e frontend. |
| 1.4 | Página admin de Atestados Médicos (CRUD + emissão + PDF) | ✅ | Tabela `medical_certificates` já existia. UI admin criada: `/atestados` com CRUD, impressão HTML e download PDF. |
| 1.5 | Edição de prontuário com versionamento (audit trail) | ✅ | Tabela `medical_record_versions` com snapshot JSONB. Edição com motivo obrigatório, versão anterior salva automaticamente. Bloqueio após 24h (`is_locked`). Histórico de versões visível por dialog. |

---

## FASE 2 — Experiência Clínica

> Eleva a qualidade do fluxo clínico diário.

| # | Item | Status | Observações |
|---|------|:------:|-------------|
| 2.1 | Gráfico de tendência de sinais vitais por paciente | ✅ | `VitalSignsChart` com Recharts, exibe ao filtrar paciente em Prontuários e na página de detalhe. |
| 2.2 | Notificação realtime para médico quando triagem chega | ✅ | `TriageRealtimeListener` via Supabase Realtime — toast com ação para todos os profissionais logados. |
| 2.3 | Encaminhamento entre especialidades | ✅ | Tabela `referrals` + página `/encaminhamentos` com CRUD, status (pendente→aceito→concluído), prioridade. |
| 2.4 | Prontuário: visualização individual + histórico completo | ✅ | Rota `/prontuarios/:id` com tela dedicada, sinais vitais, gráfico, histórico do paciente e versões. |
| 2.5 | Integração prescrição eletrônica (Memed SDK) | ✅ | Módulo `memed-integration.ts` com loader do SDK, configurável via `VITE_MEMED_API_KEY`. |
| 2.6 | Lista de espera com notificação automática | ✅ | Tabela `waitlist` + página `/lista-espera` com fila, prioridades, períodos preferidos e ações (notificar/agendar). |

---

## FASE 3 — Faturamento & Convênios

> Desbloqueia clínicas que trabalham com planos de saúde.

| # | Item | Status | Observações |
|---|------|:------:|-------------|
| 3.1 | TISS: Guia SP/SADT (exames e procedimentos) | ✅ | `generateSPSADTXML()` em `tiss.ts` — XML ANS 3.05, múltiplos procedimentos, caráter/tipo atendimento, via acesso/técnica. |
| 3.2 | TISS: Guia de Honorários | ✅ | `generateHonorariosXML()` em `tiss.ts` — XML ANS 3.05, grau participação, período faturamento. |
| 3.3 | TISS: Lote de guias + retorno da operadora | ✅ | `parseRetornoXML()` em `tiss.ts` — upload/colar XML de retorno, parse automático de glosas/aceites. Aba "Retorno XML" na página. |
| 3.4 | Recurso de glosa | ✅ | Tabela `tiss_glosa_appeals` + aba "Glosas & Recursos" — CRUD de recursos com justificativa, workflow (pendente→enviado→deferido/parcial/indeferido). |
| 3.5 | Dashboard de faturamento por convênio | ✅ | Aba "Dashboard" com KPIs (total, aceito, glosado, taxa glosa), breakdown por convênio com barra visual, guias por tipo. |

---

## FASE 4 — Portal do Paciente & Comunicação

> Diferencial de mercado e retenção de pacientes.

| # | Item | Status | Observações |
|---|------|:------:|-------------|
| 4.2 | Portal paciente: reagendar/cancelar consulta | ✅ | RPCs `patient_cancel_appointment` e `patient_reschedule_appointment` com regra de 24h. Dialogs de cancelamento (com motivo) e reagendamento (data/hora + validação conflito) na página `PatientConsultas`. |
| 4.3 | Integração WhatsApp real (Evolution API) | ⏭️ | JÁ EXISTE — `whatsapp-sender` Edge Function + config no tenant. Confirmado na auditoria. |

---

## FASE 5 — Enterprise

> Para competir com Tasy/MV em clínicas médias e grandes.

| # | Item | Status | Observações |
|---|------|:------:|-------------|
| 5.1 | Certificado digital ICP-Brasil (A1) para assinatura | ✅ | Módulo `icp-brasil-signature.ts` — parsing real PKCS#12 via `node-forge`, extração CN/CPF/CNPJ do certificado X.509, assinatura RSA SHA-256 com chave privada real, verificação de assinatura, validação de validade. |
| 5.2 | Interoperabilidade HL7 FHIR | ✅ | Módulo `fhir.ts` — builders FHIR R4 (Patient, Encounter, Observation, Condition), LOINC vitals, Bundle export JSON, parser de import com suporte a Patient/Encounter/Observation/Condition. |
| 5.3 | API pública documentada (REST) | ✅ | Módulo `public-api-spec.ts` (OpenAPI 3.0) + página `/api-docs` com endpoints, autenticação, exemplos cURL e JS. Download do spec JSON. |
| 5.4 | Odontograma (prontuário odontológico visual) | ✅ | Página `/odontograma` — mapa interativo 32 dentes (FDI), 10 condições com cores, SVG clicável, registro por face, salvamento no prontuário. |
| 5.5 | Evolução de enfermagem (NANDA/NIC/NOC) | ✅ | Tabela `nursing_evolutions` + página `/evolucao-enfermagem` — diagnósticos NANDA-I (10 mais comuns), intervenções NIC, resultados NOC com score 1-5 e tendência visual. |
| 5.6 | Gestão de salas em tempo real | ✅ | Tabelas `clinic_rooms` + `room_occupancies` + página `/gestao-salas` — CRUD de salas com tipo/andar/equipamentos, ocupação/liberação com Supabase Realtime, KPIs de disponibilidade. |

---

## FASE 6 — Conformidade Regulatória & Padrões de Saúde

> Adequação legal completa aos padrões ANS, RNDS e terminologias clínicas.

| # | Item | Status | Observações |
|---|------|:------:|-------------|
| 6.1 | TISS: Hash MD5 real no epílogo (conformidade ANS) | ✅ | Hash MD5 hex do corpo XML (`<ans:prestadorParaOperadora>...</ans:prestadorParaOperadora>`) via `node-forge`. Função `computeTissHash()` + refatoração com `buildCabecalho()` e `wrapMensagemTISS()`. |
| 6.2 | TISS: CBOS parametrizável + versaoTISS no cabeçalho | ✅ | Campo `profissionalCBOS` adicionado a `TissGuiaConsulta` e `TissGuiaSPSADT` (opcional, fallback 225125). `<ans:Padrao>` já contém a versão TISS. |
| 6.3 | Tabela TUSS com autocomplete (~200 procedimentos) | ✅ | Dataset `tuss.ts` (~200 procedimentos) + componente `TussCombobox` com busca por código/descrição. Cobre consultas, exames lab, imagem, cirurgias ambulatoriais, fisioterapia, odontologia, vacinas. |
| 6.4 | FHIR: Profiles RNDS brasileiros | ✅ | Profiles atualizados para RNDS (`saude.gov.br`): BRIndividuo, BRContatoAssistencial, BRObservacaoDescritiva, BRDiagnosticoClinico. NamingSystems: CPF, CNS, CBO, CNES, CRM. Parser de import reconhece ambos formatos. |
| 6.5 | NANDA/NIC/NOC expandido (~50 diagnósticos + autocomplete) | ✅ | Dataset `nanda-nic-noc.ts` com 52 NANDA-I, 36 NIC e 33 NOC. Componente `NandaNicNocCombobox` com busca por código/nome e categoria. Autocomplete nos 3 campos da página Evolução de Enfermagem. |
| 6.6 | LOINC: Códigos laboratoriais comuns | ✅ | 38 códigos LOINC laboratoriais em `fhir.ts` (hematologia, bioquímica, lipídios, renal, hepática, tireoide, coagulação, eletrólitos, urinálise). Helper `buildFHIRLabObservation()` para export FHIR. |

---

## FASE 7 — Coerência de Fluxo Clínico (Auditoria 23/02/2026)

> Correções estruturais identificadas na análise comparativa com Tasy, MV, iClinic e Ninsaúde.
> Sem essas correções, os módulos clínicos funcionam de forma fragmentada.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 7.1 | Vincular Receituários a `appointment_id` / `medical_record_id` | ALTA | ✅ | Migration FK + índices. Frontend: select de consulta recente ao criar receita, salva `appointment_id` e `medical_record_id`. |
| 7.2 | Vincular Atestados a `appointment_id` / `medical_record_id` | ALTA | ✅ | Mesmo padrão do 7.1. Select de consulta no form de atestados. |
| 7.3 | Vincular Laudos/Exames a `appointment_id` / `medical_record_id` | ALTA | ✅ | Mesmo padrão do 7.1. Select de consulta no form de laudos. |
| 7.4 | Vincular Encaminhamentos a `appointment_id` / `medical_record_id` | ALTA | ✅ | FK `appointment_id` adicionada na migration. Select de consulta no form de encaminhamentos, salva `appointment_id` e `medical_record_id`. |
| 7.5 | Vincular Evolução de Enfermagem a `appointment_id` | MÉDIA | ✅ | FK `appointment_id` + `medical_record_id` na migration. Select de consulta no form de evolução de enfermagem. |
| 7.6 | Botão "Iniciar Atendimento" na Agenda | ALTA | ✅ | `AppointmentsTable` com item "Iniciar Atendimento" no dropdown (status confirmed/pending). Navega para `/prontuarios?new=1&client_id=X&appointment_id=Y`. Prontuários detecta params e abre selector de template. |
| 7.7 | Aba "Documentos" no Prontuário Individual (`/prontuarios/:id`) | ALTA | ✅ | Nova aba "Documentos" no `ProntuarioDetalhe` com 5 tabs. Busca receitas, atestados, laudos e encaminhamentos vinculados por `medical_record_id` ou `appointment_id`. |
| 7.8 | Ficha Clínica Completa do Paciente | ALTA | ✅ | Nova aba "Clínico" no dialog de detalhes do paciente em `/clientes` (6 tabs). Exibe prontuários, receitas, atestados, laudos e encaminhamentos consolidados. |

---

## FASE 8 — UX & Fluxo de Atendimento

> Melhorias de usabilidade para o dia-a-dia clínico — agilidade no fluxo.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 8.1 | Status "Chegou" (check-in) na Agenda | ALTA | ✅ | `AppointmentsTable` com ação "Chegou (Check-in)" no dropdown. KPI violeta na Agenda (5 colunas). Filtro "Chegou" no `AgendaFilters` com ícone `UserCheck`. Status `arrived` no `statusConfig`. |
| 8.2 | Busca global no header (paciente/prontuário/CPF) | MÉDIA | ✅ | Componente `GlobalSearch` no header (`MainLayout`). Busca por nome, CPF, telefone, email. Atalho Ctrl+K. Dropdown com resultados, navegação por teclado, debounce 300ms. |
| 8.3 | Triagens pendentes no Dashboard | MÉDIA | ✅ | Seção "Triagens pendentes" no Dashboard (seção `today`). Fetch da tabela `triages` com `status=pending`. Cards com nome, queixa, prioridade colorida e horário. |
| 8.4 | Validação ao concluir consulta (prontuário preenchido?) | BAIXA | ✅ | `AppointmentsTable` verifica se existe `medical_records` para o `appointment_id` antes de abrir dialog de conclusão. Banner de aviso âmbar "Prontuário não preenchido" exibido no dialog. |
| 8.5 | Alergias como alerta global no cadastro do paciente | MÉDIA | ✅ | Coluna `allergies` na tabela `clients` (migration). Campo dedicado no formulário de cadastro (seção vermelha). Badge "Alergia" com `AlertTriangle` na listagem (card mobile + tabela desktop). RPC `upsert_client_v2` atualizada. Prontuário já exibia via triagem. |
| 8.6 | Gestão de Salas: modo visualização para profissionais | BAIXA | ✅ | Rota `/gestao-salas` sem `requireAdmin`. Sidebar sem `adminOnly`. Botões "Nova Sala", "Ocupar" e "Liberar" desabilitados para não-admin (disabled + title tooltip). Profissionais veem disponibilidade em tempo real sem poder editar. |

---

## FASE 9 — Integração de Módulos Existentes

> Módulos já implementados mas não conectados a nenhuma tela funcional.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 9.1 | Integrar Memed SDK na tela de Receituários | MÉDIA | ✅ | Botão "Prescrever via Memed" no `/receituarios` (visível quando `VITE_MEMED_API_KEY` configurada). Carrega SDK, abre prescrição com dados do paciente, listener `memed:prescription-saved` importa medicamentos para o form. |
| 9.2 | Integrar FHIR Export/Import em tela funcional | MÉDIA | ✅ | Botão "Exportar FHIR" em `/prontuarios` (filtrar por paciente). Gera Bundle com Patient, Encounters, Observations (vitais LOINC) e Conditions (CID). Botão "Importar FHIR" com upload/colar JSON + preview de recursos. |
| 9.3 | Integrar ICP-Brasil na assinatura do prontuário | BAIXA | ✅ | Checkbox "Usar Certificado ICP-Brasil A1" no `ProntuarioForm`. Upload .pfx, input de senha, exibe dados do certificado (titular, CPF/CNPJ, validade, emissor). Assinatura RSA SHA-256 com chave privada real via `node-forge`. |
| 9.4 | Histórico temporal no Odontograma | BAIXA | ✅ | Navegação temporal entre odontogramas anteriores do paciente. Setas anterior/próximo, indicação de data e quantidade de dentes. Aviso visual ao visualizar versão antiga. Recarrega histórico após salvar. |

---

## FASE 10 — Limpeza & Código Morto

> Remoção de arquivos órfãos e correção de rotas duplicadas.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 10.1 | Remover `PatientRegister.tsx` | BAIXA | ✅ | Arquivo deletado. Rota `/paciente/cadastro` já fazia redirect para `/paciente/login`. Nenhum import referenciava o arquivo. |
| 10.2 | Verificar/remover `ContasPagar.tsx`, `ContasReceber.tsx`, `FluxoDeCaixa.tsx` | BAIXA | ✅ | 3 arquivos deletados (~74 KB). Nenhum import externo — completamente órfãos. Rotas `/contas-pagar`, `/contas-receber`, `/fluxo-de-caixa` já faziam `Navigate` para `/financeiro?tab=...`. |
| 10.3 | `/paciente/perfil` e `/paciente/configuracoes` renderizam `PatientDashboard` | BAIXA | ✅ | Páginas próprias criadas: `PatientProfile.tsx` (visualização/edição de dados pessoais, CPF, endereço, alergias) e `PatientSettings.tsx` (preferências de notificação por canal — e-mail e portal — para atestados, receitas, exames e consultas). Links restaurados no `PatientLayout`. |
| 10.4 | Proteger `/termos-consentimento` e `/contratos-termos` como adminOnly | BAIXA | ✅ | `requireAdmin` adicionado nas rotas no `App.tsx`. Sidebar já tinha `adminOnly: true` em ambos os itens. |

---

## FASE 11 — Evolução Clínica Completa (SOAP)

> Registro de evolução médica diária no formato SOAP — padrão ouro em sistemas como Tasy, MV e PEP hospitalar.
> Diferente do prontuário (registro de consulta), a evolução é o acompanhamento contínuo do paciente.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 11.1 | Tabela `clinical_evolutions` (SOAP) | ALTA | ✅ | Migration com 15+ campos: S/O/A/P, `evolution_type` (7 tipos), `vital_signs` JSONB, `cid_code`, assinatura digital (hash+CRM+timestamp). RLS por tenant. Índices em tenant, client, professional, appointment. |
| 11.2 | Página `/evolucoes` — CRUD de evoluções clínicas | ALTA | ✅ | Listagem com filtros (paciente, tipo, busca por conteúdo). Formulário SOAP com 4 campos coloridos (S azul, O verde, A âmbar, P violeta). Template auto-preenchido ao trocar tipo. Vínculo a consulta, CID-10 autocomplete, assinatura digital SHA-256. Botões PDF, editar, excluir. |
| 11.3 | Aba "Evoluções" no Prontuário Individual (`/prontuarios/:id`) | MÉDIA | ✅ | Nova aba (6ª) no `ProntuarioDetalhe`. Busca evoluções por `appointment_id` ou `medical_record_id`. Cards SOAP formatados com badges de tipo, data, profissional e assinatura. |
| 11.4 | Aba "Evoluções" na Ficha Clínica do Paciente (`/clientes`) | MÉDIA | ✅ | Nova aba (7ª) no dialog de detalhes do paciente. Histórico consolidado de todas as evoluções do paciente com preview SOAP truncado. |
| 11.5 | Templates SOAP por especialidade | BAIXA | ✅ | `soap-templates.ts` com 7 templates: Médica, Fisioterapia, Fonoaudiologia, Nutrição, Psicologia, Enfermagem, Outro. Cada um com S/O/A/P pré-preenchidos. Labels e cores por tipo. |
| 11.6 | PDF de evolução clínica | BAIXA | ✅ | `generateEvolutionPdf()` em `patientDocumentPdf.ts`. Formato SOAP com badges coloridos (S/O/A/P), cabeçalho com clínica e profissional, dados do paciente, assinatura com CRM, hash SHA-256. |

---

## FASE 12 — Controle de Acessos & RBAC (Análise 23/02/2026)

> **Problema crítico identificado:** O sistema opera com apenas 2 roles (`admin` / `staff`). Um médico, fisioterapeuta, enfermeiro e secretária têm acesso idêntico a todas as funcionalidades clínicas — incluindo prontuários, receituários, laudos e atestados. Isso viola a LGPD (dados sensíveis de saúde), a Resolução CFM 2299/2021 (sigilo do prontuário) e impede adoção por clínicas multiprofissionais.
>
> **Benchmark:** Tasy (perfis + funções + setores), MV Soul (grupos CRUD por módulo), iClinic (4 perfis fixos), Feegow (CRUD por recurso por usuário), Ninsaúde (perfis + módulos). Todos implementam controle granular por tipo de profissional.
>
> **Viabilidade técnica confirmada:** Stack atual (Postgres + Supabase RLS + React + TypeScript) suporta 100% sem trocar tecnologias. Infraestrutura existente (multi-tenant RLS, `get_my_context`, `AuthContext`, `ProtectedRoute`, Edge Functions) permite expansão incremental.

### Sub-fase 12A — Fundação do RBAC

> Base de dados e hooks. Sem isso, nenhuma das fases seguintes funciona.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 12A.1 | Enum `professional_type` no banco | CRÍTICA | ✅ | `CREATE TYPE professional_type AS ENUM ('admin','medico','dentista','enfermeiro','tec_enfermagem','fisioterapeuta','nutricionista','psicologo','fonoaudiologo','secretaria','faturista','custom')`. Migration `20260323400000_rbac_foundation_v1.sql`. |
| 12A.2 | Coluna `professional_type` + campos de conselho em `profiles` | CRÍTICA | ✅ | `ALTER TABLE profiles ADD COLUMN professional_type`, `council_type`, `council_number`, `council_state`. Default `'secretaria'`. Índice por `(tenant_id, professional_type)`. |
| 12A.3 | Tabela `role_templates` com seed de 11 perfis padrão | CRÍTICA | ✅ | Templates pré-configurados com JSONB de permissões por recurso (view/create/edit/delete). Seed automático para tenants existentes + trigger `trg_tenant_seed_role_templates` para novos. RLS por tenant. |
| 12A.4 | Tabela `permission_overrides` | CRÍTICA | ✅ | Override por usuário por recurso (`can_view`, `can_create`, `can_edit`, `can_delete`). UNIQUE `(tenant_id, user_id, resource)`. RLS: user vê os seus, admin gerencia todos. |
| 12A.5 | RPC `get_effective_permissions(p_user_id)` | CRÍTICA | ✅ | Retorna JSONB com permissões efetivas = template do tipo (ou admin se `user_roles.role='admin'`) + overrides do usuário. `SECURITY DEFINER`. |
| 12A.6 | Expandir RPC `get_my_context` | CRÍTICA | ✅ | Campo `permissions` adicionado ao retorno JSONB. Frontend carrega `professional_type` (via profile) + permissões efetivas em 1 roundtrip. |
| 12A.7 | Expandir `AuthContext` | CRÍTICA | ✅ | Expõe `professionalType: ProfessionalType` e `permissions: PermissionsMap` no contexto. Carregado via `get_my_context`. Limpo no `signOut`. |
| 12A.8 | Hook `usePermissions` | CRÍTICA | ✅ | `src/hooks/usePermissions.ts`. Expõe `can(resource, action)`, `isClinical`, `isPrescriber`, `getResourcePermission`, `visibleResources`. Type-safe. |

---

### Sub-fase 12B — Proteção de Rotas & Sidebar

> Frontend reflete as permissões. Secretária para de ver prontuário.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 12B.1 | Evoluir `ProtectedRoute` | ALTA | ✅ | Aceita `resource`, `action` ('view'\|'create') e `allowedTypes` (ProfessionalType[]). Admin sempre tem acesso total. Redireciona para `/403` quando sem permissão. Compatibilidade retroativa com `requireAdmin`. |
| 12B.2 | Página 403 "Sem Permissão" | ALTA | ✅ | `Forbidden.tsx` com ícone `ShieldOff`, mensagem amigável e botão "Voltar ao Dashboard". Rota `/403` registrada no `App.tsx`. |
| 12B.3 | Componente `<PermissionGate>` | ALTA | ✅ | Wrapper para esconder elementos dentro de páginas. Props: `resource`, `action`, `allowedTypes`, `fallback`. Admin vê tudo. Suporta OR entre `allowedTypes` e `resource`. |
| 12B.4 | Refatorar `Sidebar.tsx` | ALTA | ✅ | `adminOnly` substituído por `resource` em cada `NavItem`. Filtro via `usePermissions().can(resource, 'view')`. `staffOnly` mantido para itens pessoais (Minhas Comissões, Meus Salários). Label do tipo profissional no card do usuário. |
| 12B.5 | Aplicar `resource` em todas as rotas do `App.tsx` | ALTA | ✅ | Todas as ~50 rotas protegidas mapeadas ao recurso RBAC correspondente. Rotas pessoais (notificações, configurações pessoais, ajuda, suporte) sem resource — acessíveis a todos autenticados. |

---

### Sub-fase 12C — RLS Reforçada no Banco

> Segurança real. Mesmo que o frontend falhe, o banco bloqueia.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 12C.1 | Helper `is_clinical_professional(p_user_id)` | ALTA | ✅ | Criado na 12A. `SECURITY DEFINER`. Retorna true se `professional_type` IN ('medico','dentista','enfermeiro','fisioterapeuta','nutricionista','psicologo','fonoaudiologo'). |
| 12C.2 | Helper `is_prescriber(p_user_id)` | ALTA | ✅ | Criado na 12A. `SECURITY DEFINER`. Retorna true se `professional_type` IN ('medico','dentista'). |
| 12C.3 | RLS em `medical_records` — restringir SELECT | ALTA | ✅ | SELECT/INSERT/UPDATE: admin + clínicos. Secretária e faturista bloqueados. DELETE mantém admin-only. Migration `20260323500000_rbac_rls_enforcement_v1.sql`. |
| 12C.4 | RLS em receituários — restringir INSERT | ALTA | ✅ | SELECT: admin + clínicos. INSERT/UPDATE: apenas prescritores (`is_prescriber`). DELETE admin-only. |
| 12C.5 | RLS em `medical_certificates` (atestados) — restringir INSERT | ALTA | ✅ | Mesmo padrão do 12C.4. SELECT admin+clínicos, INSERT/UPDATE prescritores. |
| 12C.6 | RLS em `triages` — restringir INSERT | MÉDIA | ✅ | INSERT/UPDATE: enfermeiro + tec_enfermagem (`is_nursing_professional`). SELECT: admin + clínicos. |
| 12C.7 | RLS em `nursing_evolutions` — restringir INSERT | MÉDIA | ✅ | INSERT/UPDATE: apenas enfermeiro (não tec_enfermagem). SELECT: admin + clínicos. |
| 12C.8 | RLS em `referrals` — restringir INSERT | MÉDIA | ✅ | SELECT/INSERT/UPDATE: admin + clínicos. Bloqueio total para secretária e faturista. |
| 12C.9 | RLS em `financial_transactions` e `bills_*` — restringir SELECT | MÉDIA | ✅ | SELECT: admin + faturista via `is_admin_or_faturista`. Bills: admin ALL + faturista SELECT-only. Clínicos não veem dados financeiros. `clinical_evolutions` também reforçada. |

---

### Sub-fase 12D — Evolução da Página Equipe

> Admin precisa conseguir definir o tipo de cada profissional.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 12D.1 | Campo "Tipo Profissional" no cadastro (Equipe) | ALTA | ✅ | Select com 10 tipos no form de convite. Condicional: campos de conselho aparecem quando tipo tem conselho. Auto-preenche `council_type` pelo tipo selecionado. |
| 12D.2 | Campos de conselho (tipo, número, UF) | ALTA | ✅ | Inputs condicionais: `council_type` (auto-preenchido, disabled), `council_number`, `council_state` (select com 27 UFs). Aparece somente para tipos com conselho (médico→CRM, etc.). |
| 12D.3 | Atualizar Edge Function `invite-team-member` | ALTA | ✅ | `InviteBody` aceita `professional_type`, `council_type`, `council_number`, `council_state`. Grava em `user_metadata` para o trigger propagar. |
| 12D.4 | Atualizar trigger `handle_new_user` | ALTA | ✅ | Branch `admin_invite`: lê `professional_type` e campos de conselho do `user_metadata`, insere em `profiles`. Signup normal: `professional_type='admin'`. Migration `20260323600000`. |
| 12D.5 | Badge de tipo profissional na listagem | MÉDIA | ✅ | Badge colorido por tipo com label (ex: "Médico(a) (CRM 12345-SP)"). 10 cores distintas. Mobile cards + tabela desktop. |
| 12D.6 | Preview de permissões no cadastro | MÉDIA | ✅ | Grid visual com 13 recursos (prontuários, receitas, financeiro, etc.) e ícones check/x ao selecionar tipo. Baseado na função `getTypeDefaultAccess()`. |
| 12D.7 | Dialog de override de permissões por membro | MÉDIA | ✅ | Botão "Permissões" no card/row. Grid de checkboxes (recurso × ação CRUD). Pré-preenchido pelos overrides existentes ou template do tipo. Salva em `permission_overrides` via upsert. |
| 12D.8 | Banner de migração para membros sem tipo definido | ALTA | ✅ | Banner âmbar "X profissionais sem tipo definido" acima da listagem. Conta membros staff com `professional_type='secretaria'` (default). |

---

### Sub-fase 12E — Dashboards Diferenciados por Perfil

> Cada profissional vê o que importa para sua função.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 12E.1 | Dashboard do Médico/Dentista | MÉDIA | ✅ | `DashboardMedico` — agenda do dia (seus agendamentos), triagens pendentes, últimos prontuários, lista de espera, próximo atendimento hero. Sem dados financeiros. |
| 12E.2 | Dashboard da Secretária/Recepcionista | MÉDIA | ✅ | `DashboardSecretaria` — agenda completa (todos profissionais), check-ins pendentes, confirmações (com telefone), pacientes na recepção. Sem dados clínicos. |
| 12E.3 | Dashboard do Enfermeiro | MÉDIA | ✅ | `DashboardEnfermeiro` — triagens pendentes (ordenadas por prioridade, emergências destacadas), salas ocupadas/disponíveis, pacientes aguardando, triagens realizadas no dia. |
| 12E.4 | Dashboard do Faturista | MÉDIA | ✅ | `DashboardFaturista` — guias TISS pendentes, glosas abertas, faturamento mensal por convênio com barras visuais, taxa de glosa, KPIs financeiros. |
| 12E.5 | Dashboard genérico (fisio/nutri/psico/fono) | MÉDIA | ✅ | `DashboardClinico` — agendamentos do dia, próximo atendimento, evoluções pendentes de registro (consultas concluídas sem evolução), atendimentos do mês. |
| 12E.6 | Seletor automático de dashboard por tipo | BAIXA | ✅ | `getDashboardForType()` no `Dashboard.tsx` usa `professionalType` do `usePermissions` para renderizar dashboard correto. Admin mantém dashboard completo existente. |

---

### Sub-fase 12F — Auditoria de Acessos Clínicos

> Compliance LGPD e preparação para acreditação ONA.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 12F.1 | Log de acesso a prontuário | MÉDIA | ✅ | RPC `log_clinical_access` registra em `audit_logs` com patient_id, professional_type, is_flagged. Hook `useClinicalAudit` no frontend. Integrado em `Prontuarios.tsx` e `ProntuarioDetalhe.tsx`. |
| 12F.2 | Log de tentativa de acesso negado | MÉDIA | ✅ | RPC `log_access_denied` registra recurso, ação tentada e path. Integrado no `ProtectedRoute.tsx` antes do redirect para `/403`. |
| 12F.3 | Relatório de acessos por profissional | MÉDIA | ✅ | RPC `get_clinical_access_report` com joins de nomes. Nova aba "Acessos Clínicos" na página `/auditoria` com filtros (profissional, recurso, período, flagged). |
| 12F.4 | Alerta de acesso incomum | BAIXA | ✅ | Flag `is_flagged=true` quando profissional acessa prontuário de paciente sem agendamento nos últimos 30 dias. KPI de alertas na aba, badge âmbar na tabela. |
| 12F.5 | Exportação de logs (CSV/PDF) | BAIXA | ✅ | Botões CSV e PDF na aba de acessos clínicos. PDF via jsPDF+autoTable com formatação, cores e destaque de alertas. |

---

### Sub-fase 12G — Refinamentos & Multi-sede

> Polimento para cenários avançados.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 12G.1 | Página admin "Gerenciar Permissões" | BAIXA | ✅ | Página `/gerenciar-permissoes` com grid visual: abas por tipo profissional, checkboxes CRUD por recurso. RPC `update_role_template_permissions`. |
| 12G.2 | Clonagem de perfil de permissões | BAIXA | ✅ | RPC `clone_permission_overrides` copia overrides de um usuário para outro. Dialog na página Equipe com seletor de destino. |
| 12G.3 | Permissões por unidade (multi-sede) | BAIXA | ✅ | Coluna `unit_id` em `permission_overrides` (FK para `clinic_units`). `get_effective_permissions` atualizado para suportar overrides por unidade. |
| 12G.4 | Modo "somente leitura" emergencial | BAIXA | ✅ | Colunas `is_readonly`, `readonly_reason`, `readonly_since` em `profiles`. RPC `set_user_readonly`. `get_effective_permissions` remove create/edit/delete quando readonly. Botão na página Equipe. |
| 12G.5 | Wizard de configuração inicial de permissões | BAIXA | ✅ | Componente `RbacWizard` com 4 passos: boas-vindas, classificar equipe, revisar, confirmar. Exibido no Dashboard no primeiro acesso do admin (localStorage flag). |

---

### Cronograma sugerido — Fase 12

| Ordem | Sub-fase | Prazo | Dependência |
|:-----:|----------|:-----:|:-----------:|
| 1 | **12A — Fundação** | Semana 1 | — |
| 2 | **12C — RLS no banco** | Semana 1-2 | 12A.1, 12A.2 |
| 3 | **12B — Rotas e Sidebar** | Semana 2 | 12A.7, 12A.8 |
| 4 | **12D — Página Equipe** | Semana 2-3 | 12A.1, 12A.2 |
| 5 | **12E — Dashboards** | Semana 3-4 | 12A.8 |
| 6 | **12F — Auditoria** | Semana 4 | 12B.3 |
| 7 | **12G — Refinamentos** | Semana 5+ | Todas anteriores |

### Perfis profissionais e matriz de acesso (referência)

| Módulo | admin | médico | dentista | enfermeiro | tec_enf | fisio | nutri | psico | fono | secretária | faturista |
|--------|:-----:|:------:|:--------:|:----------:|:-------:|:-----:|:-----:|:-----:|:----:|:----------:|:---------:|
| Agenda | CRUD | CRUD | CRUD | Ver+E | Ver | CRUD | CRUD | CRUD | CRUD | CRUD | Ver |
| Pacientes (cadastro) | CRUD | CRUD | CRUD | Ver+E | Ver | CRUD | CRUD | CRUD | CRUD | CRUD | Ver |
| Pacientes (clínico) | Ver | CRUD | CRUD | Ver | — | Ver* | Ver* | Ver* | Ver* | — | — |
| Prontuários | Ver | CRUD | CRUD | Ver | — | Ver* | Ver* | Ver* | Ver* | — | — |
| Receituários | Ver | CRUD | CRUD | — | — | — | — | — | — | — | — |
| Laudos & Exames | Ver | CRUD | CRUD | — | — | CRUD* | — | CRUD* | CRUD* | — | — |
| Atestados | Ver | CRUD | CRUD | — | — | — | — | — | — | — | — |
| Encaminhamentos | Ver | CRUD | CRUD | Ver | — | CRUD | CRUD | CRUD | CRUD | — | — |
| Triagem | Ver | Ver | Ver | CRUD | CRUD | Ver | — | — | — | — | — |
| Evol. Enfermagem | Ver | Ver | — | CRUD | — | — | — | — | — | — | — |
| Evol. Clínica SOAP | Ver | CRUD | CRUD | Ver | — | CRUD | CRUD | CRUD | CRUD | — | — |
| Odontograma | Ver | — | CRUD | — | — | — | — | — | — | — | — |
| Teleconsulta | Cfg | CRUD | CRUD | — | — | CRUD | CRUD | CRUD | CRUD | Agendar | — |
| Financeiro | CRUD | — | — | — | — | — | — | — | — | — | Ver |
| Faturamento TISS | CRUD | — | — | — | — | — | — | — | — | — | CRUD |
| Relatórios | CRUD | — | — | — | — | — | — | — | — | — | Ver* |
| Equipe | CRUD | — | — | — | — | — | — | — | — | — | — |
| Configurações | CRUD | — | — | — | — | — | — | — | — | — | — |

> `*` = apenas registros próprios (where `professional_id` = user). `Ver+E` = visualizar + editar. `Cfg` = configurar. `—` = sem acesso.

---

## FASE 13 — Refatoração UX: Dialog → Drawer → Página (Análise 23/02/2026)

> **Problema identificado:** O sistema usa Dialog modal para 100% dos formulários — incluindo prontuários com SOAP, fichas de paciente com 6 abas e campanhas com 10+ campos. Isso viola as boas práticas de UX enterprise e causa: formulários com scroll forçado, perda de contexto, dificuldade em mobile, 5+ states de dialog por página.
>
> **Benchmark:** Tasy (abas internas MDI), MV Soul (telas full + painéis laterais), Epic Systems (zero modais para formulários clínicos — inline editing + panels), Oracle/Cerner (formulários inline + click-to-sign), iClinic (prontuário full page + drawer para agenda), Feegow (prontuário full page + abas internas).
>
> **Regra de ouro:** Dialog (1-4 campos / confirmações) → Drawer/Sheet (5-10 campos com contexto) → Página interna (10+ campos / abas / workflow).

### Sub-fase 13A — Infraestrutura de Drawer & Padrões

> Componentes base e padrões reutilizáveis para toda a refatoração.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 13A.1 | Componente `<FormDrawer>` reutilizável | ALTA | ✅ | `src/components/ui/form-drawer.tsx` — wrapper sobre Sheet com header fixo, body scroll, footer sticky. Props: title, description, width (sm/md/lg/xl/full), onSubmit, isSubmitting. Overlay leve (bg-black/20). |
| 13A.2 | Componente `<FormPage>` layout padrão | ALTA | ✅ | `src/components/ui/form-page.tsx` — layout para páginas de formulário com breadcrumb, botão voltar, body scroll, footer sticky. Inclui FormPageSection, FormPageTabs, FormPageGrid. |
| 13A.3 | Padrão de URL para entidades (`:id/edit`, `/novo`) | MÉDIA | ✅ | `src/lib/url-conventions.ts` — documentação e helpers ENTITY_ROUTES para rotas padronizadas: /entidades, /entidades/:id, /entidades/:id/edit, /entidades/novo. |
| 13A.4 | Hook `useFormDrawer` para gerenciar estado | MÉDIA | ✅ | `src/hooks/useFormDrawer.ts` — encapsula open, mode (create/edit/view), editingItem, formData, updateField, reset. Também inclui useFormPage para páginas. |

---

### Sub-fase 13B — Migrar Formulários Clínicos para Drawer

> Formulários de criação de documentos clínicos que precisam do contexto da lista atrás.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 13B.1 | Receituários: dialog → drawer | ALTA | ✅ | `FormDrawer` width="md" com seções Paciente, Tipo/Validade, Prescrição. Lista de receitas visível atrás. |
| 13B.2 | Laudos & Exames: dialog → drawer | ALTA | ✅ | `FormDrawer` width="lg" com seções Paciente, Dados do Exame, Resultado. Lista de laudos visível atrás. |
| 13B.3 | Atestados: dialog → drawer | ALTA | ✅ | `FormDrawer` width="md" com seções Paciente, Tipo/Período, Conteúdo. Suporta edição. |
| 13B.4 | Encaminhamentos: dialog → drawer | ALTA | ✅ | `FormDrawer` width="md" com seções Paciente, Destino, Informações Clínicas. |
| 13B.5 | Triagem: dialog → drawer | ALTA | ✅ | `FormDrawer` width="lg" com Tabs (Identificação, Sinais Vitais, Anamnese). Fila de triagem visível atrás. |
| 13B.6 | Evolução Enfermagem: dialog → drawer | MÉDIA | ✅ | `FormDrawer` width="lg" com cards NANDA/NIC/NOC coloridos e comboboxes. Lista de evoluções atrás. |
| 13B.7 | Evoluções Clínicas SOAP: dialog → drawer | MÉDIA | ✅ | `FormDrawer` width="xl" com seções Identificação, Registro SOAP (S-O-A-P), Complementos (CID). |
| 13B.8 | Lista de Espera: dialog → drawer | MÉDIA | ✅ | `FormDrawer` width="md" com seções Paciente, Preferências, Observações. Fila visível atrás. |

---

### Sub-fase 13C — Migrar Formulários Administrativos para Drawer

> Cadastros e configurações de 5-10 campos.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 13C.1 | Agenda — novo agendamento: dialog → drawer | ALTA | ✅ | `FormDrawer` width="lg" com seções Paciente/Procedimento, Profissional, Data/Horário, Opções. Agenda visível atrás. |
| 13C.2 | Serviços/Procedimentos: dialog → drawer | MÉDIA | ✅ | `FormDrawer` width="md" com seções Informações Básicas, Duração/Preço, Status. |
| 13C.3 | Convênios: dialog → drawer | MÉDIA | ✅ | `FormDrawer` width="md" com seções Identificação, Contato, Observações/Status. |
| 13C.4 | Fornecedores: dialog → drawer | MÉDIA | ✅ | `FormDrawer` width="md" com seções Identificação, Contato, Documentação, Observações. |
| 13C.5 | Equipe — cadastrar profissional: dialog → drawer | MÉDIA | ✅ | `FormDrawer` width="lg" com seções Dados Pessoais, Credenciais, Função/Tipo Profissional + preview de permissões. |
| 13C.6 | Gestão de Salas: dialog → drawer | BAIXA | ✅ | `FormDrawer` width="md" com seções Identificação, Tipo/Capacidade, Localização/Equipamentos. |
| 13C.7 | Vouchers: dialog → drawer | BAIXA | ✅ | `FormDrawer` width="md" com seções Código, Tipo/Valor, Validade/Observações. |
| 13C.8 | Cupons: dialog → drawer | BAIXA | ✅ | `FormDrawer` width="md" com seções Código, Tipo/Valor, Limites, Validade, Serviço/Status. |
| 13C.9 | Automações: dialog → drawer | BAIXA | ✅ | `FormDrawer` width="lg" com seções Identificação, Gatilho, Canal, Mensagem + preview. |

---

### Sub-fase 13D — Migrar Telas Complexas para Página Interna

> Formulários com 10+ campos, abas ou workflow multi-step — merecem rota dedicada.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 13D.1 | Ficha do Paciente: dialog com 6 abas → rota `/clientes/:id` | ALTA | ✅ | Página full com tabs: Dados, Prontuários, Receitas, Atestados, Laudos, Encaminhamentos, Evoluções. URL linkável. Breadcrumb "Pacientes > João Silva". |
| 13D.2 | Compras — nova compra: dialog → rota `/compras/nova` | MÉDIA | ✅ | Multi-step: fornecedor → itens → totais → confirmar. Página com stepper ou seções. |
| 13D.3 | Campanhas — nova campanha: dialog → rota `/campanhas/nova` | MÉDIA | ✅ | Editor de conteúdo HTML + segmentação + preview. 10+ campos. |
| 13D.4 | Modelos de Prontuário — editor: dialog → rota `/modelos-prontuario/:id` | MÉDIA | ✅ | Builder de template com drag-and-drop de campos. É uma ferramenta, não um formulário. |
| 13D.5 | Termos de Consentimento — editor: dialog → rota `/termos-consentimento/:id` | MÉDIA | ✅ | Editor de HTML longo. Precisa de tela completa. |
| 13D.6 | Faturamento TISS — nova guia: dialog → drawer largo ou rota | MÉDIA | ✅ | Guia TISS tem 15+ campos obrigatórios ANS. Drawer 720px ou rota dedicada. |
| 13D.7 | Contratos e Termos — editor: dialog → rota `/contratos-termos/:id` | BAIXA | ✅ | Mesmo padrão do 13D.5. |

---

### Sub-fase 13E — Manter como Dialog (validação)

> Confirmar que estes usos estão corretos e não precisam migrar.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 13E.1 | Todos os AlertDialogs de exclusão/confirmação | — | ✅ | Padrão correto. Confirmação destrutiva deve ser modal. Manter. |
| 13E.2 | Especialidades — novo/editar (3 campos) | — | ✅ | Formulário simples. Manter como dialog. |
| 13E.3 | Unidades — novo/editar (5 campos) | — | ✅ | Formulário simples. Manter como dialog. |
| 13E.4 | Produtos — dialog de categoria (1 campo) | — | ✅ | Input simples. Manter como dialog. |
| 13E.5 | Assinatura digital ICP-Brasil — confirmação | — | ✅ | Ação irreversível. Manter como dialog. |
| 13E.6 | Agenda — dialog de conclusão de consulta | — | ✅ | Confirmação com aviso de prontuário. Manter como dialog. |
| 13E.7 | Welcome Modal / Onboarding | — | ✅ | Modal de boas-vindas. Manter. |

---

### Cronograma sugerido — Fase 13

| Ordem | Sub-fase | Prazo | Dependência |
|:-----:|----------|:-----:|:-----------:|
| 1 | **13A — Infraestrutura** | Semana 1 | — |
| 2 | **13B — Formulários clínicos → drawer** | Semana 1-2 | 13A.1 |
| 3 | **13C — Formulários admin → drawer** | Semana 2-3 | 13A.1 |
| 4 | **13D — Telas complexas → página** | Semana 3-5 | 13A.2, 13A.3 |
| 5 | **13E — Validação dos dialogs corretos** | Semana 1 | — |

### Regra de decisão (referência permanente)

```
┌──────────────────────────────────────────────────┐
│  Quantos campos tem o formulário?                │
│                                                  │
│  1-4 campos        → Dialog Modal                │
│  5-10 campos       → Drawer (Sheet 540px)        │
│  10+ campos        → Página Interna (rota)       │
│                                                  │
│  Tem abas?         → Página Interna (sempre)     │
│  É workflow?       → Página com stepper           │
│  É confirmação?    → AlertDialog (sempre modal)  │
│  Precisa de URL?   → Página Interna (linkável)   │
└──────────────────────────────────────────────────┘
```

---

## ⚠️ CRITÉRIOS DE EXECUÇÃO OBRIGATÓRIOS (Fases Pendentes)

> **ATENÇÃO:** As fases abaixo (14 em diante) ainda NÃO foram implementadas.
> Ao executar qualquer item, **SEGUIR À RISCA** as metas e quantidades especificadas.

### Regras de Execução

1. **Quantidades são MÍNIMAS, não máximas**
   - Se a meta diz "5.000+ procedimentos", entregar NO MÍNIMO 5.000
   - Se a meta diz "2.000+ códigos", entregar NO MÍNIMO 2.000
   - Nunca parar antes de atingir a meta especificada

2. **Completude é obrigatória**
   - Cada item deve ser 100% concluído antes de marcar como ✅
   - Implementações parciais devem permanecer como ⬚ ou 🔄

3. **Validação antes de concluir**
   - Contar registros/itens criados e comparar com a meta
   - Documentar a quantidade final nas Observações (ex: "5.247 procedimentos incluídos")

4. **Fontes oficiais são obrigatórias**
   - Usar as fontes listadas em cada fase (ANS, DATASUS, ANVISA, etc.)
   - Não inventar códigos ou descrições

5. **Não interromper no meio**
   - Se a tarefa é grande, dividir em batches mas completar TODOS os batches
   - Não marcar como concluído até atingir 100% da meta

### Exemplo de NÃO conformidade (evitar)

❌ **ERRADO:** Meta = 5.000 TUSS → Implementar 2.000 e parar
❌ **ERRADO:** Meta = 700 CIAP-2 → Implementar 200 "mais comuns"
❌ **ERRADO:** Marcar ✅ sem validar quantidade

### Exemplo de conformidade (seguir)

✅ **CORRETO:** Meta = 5.000 TUSS → Implementar 5.000+ e documentar "5.247 procedimentos incluídos"
✅ **CORRETO:** Meta = 700 CIAP-2 → Implementar 700+ códigos completos
✅ **CORRETO:** Validar contagem antes de marcar ✅

---

## FASE 14 — Expansão de Datasets Clínicos

> Ampliação das tabelas de terminologias para cobertura completa do mercado brasileiro.
> Datasets atuais são insuficientes para faturamento e interoperabilidade.
>
> ⚠️ **CRITÉRIO RIGOROSO:** As metas de quantidade são MÍNIMAS. Não concluir item sem atingir 100% da meta.

| # | Item | Atual | Meta | Status | Observações |
|---|------|-------|------|:------:|-------------|
| 14.1 | Tabela TUSS expandida | **5.002 procedimentos** | **5.000+ procedimentos** | ✅ | Meta atingida! Cobertura completa: consultas, laboratório (hematologia, bioquímica, coagulação, vitaminas, metais, drogas terapêuticas, biologia molecular, citogenética, oncologia molecular, farmacogenética), imagem (RX, US, TC, RM, mamografia, densitometria, intervencionista), cirurgias (gerais, digestivas, urológicas, ginecológicas, ortopedia, neuro, vascular, torácica, plástica, cabeça/pescoço, oncologia, pediátrica, oftalmológica, ORL, bucomaxilofacial, cardíaca, transplantes, emergência, laparoscopia, artroscopia, robótica), especialidades (cardiologia, oftalmologia, ORL, dermatologia, neurologia, pneumologia, gastro, reumatologia, urologia, ginecologia, obstetrícia, endocrinologia, nefrologia, hematologia, infectologia, geriatria, medicina do trabalho, esportiva, genética, angiologia, proctologia, mastologia, alergia/imunologia, sono, paliativos, pediatria, neonatologia, medicina fetal, psiquiatria), terapias (fisioterapia, psicologia, fonoaudiologia, nutrição, reabilitação), odontologia completa (prevenção, restauração, endodontia, periodontia, prótese, ortodontia, implante, cirurgia), especiais (medicina nuclear, PET-CT, radioterapia, terapia celular, hemodinâmica, neurointervencionista, quimioterapia, diálise), hospitalar (internação, UTI, anestesia, materiais especiais, emergência, medicina intensiva), funcionais (eletrofisiologia, neurofisiologia, provas funcionais, gastro, urologia), endoscopia (digestiva, CPRE, ecoendoscopia, broncoscopia, cistoscopia, histeroscopia), estética (dermatologia, injetáveis, cirurgia plástica, tricologia), ortopedia expandida (coluna, trauma, próteses, oncologia ortopédica, mão), ambulatorial (home care, telemedicina, preventiva), complementares (dor intervencionista, hiperbárica, regenerativa, integrativa, legal, pericial, aeroespacial, marítima, tropical, sexual, reprodutiva). |
| 14.2 | CID-10 expandido | **2.044 códigos** | **2.000+ códigos** | ✅ | Meta atingida! Cobertura: doenças infecciosas/parasitárias (A00-B99), virais (hepatites, HIV, herpes, dengue, febre amarela), neoplasias completas (C00-C97 + D00-D48), sangue/imunidade (D50-D89), endócrinas/metabólicas (E00-E90 - diabetes, tireoide, hipófise), transtornos mentais (F00-F99 - demências, esquizofrenia, depressão, ansiedade, TOC, TEPT), sistema nervoso (G00-G82 - epilepsia, Parkinson, Alzheimer, esclerose múltipla, neuropatias), musculoesquelético (M05-M17 - artrites, gota, artroses). Index consolidado em `cid10-index.ts`. |
| 14.3 | LOINC expandido | **513 códigos** | **500+ códigos** | ✅ | Meta atingida! Cobertura: hematologia completa (hemograma, diferencial), coagulação (TP, INR, TTPA, D-dímero, fatores), glicemia/diabetes (HbA1c, TOTG, insulina, HOMA), lipídios (perfil completo, apolipoproteínas), função renal (creatinina, TFG, microalbuminúria, cistatina C), função hepática (enzimas, bilirrubinas, albumina), tireoide (TSH, T3/T4, anticorpos), eletrólitos, marcadores cardíacos (troponinas, BNP, CK-MB), marcadores tumorais (PSA, CEA, CA125, AFP), hormônios (cortisol, prolactina, FSH/LH, testosterona, PTH, vitamina D), vitaminas/minerais (B12, folato, ferro, ferritina), autoimunidade (FAN, anti-DNA, FR, anti-CCP, ANCA, complemento), sorologias (HIV, hepatites, sífilis, toxoplasmose, CMV, dengue), urinálise completa, gasometria arterial/venosa, microbiologia (culturas, antibiograma), líquidos corporais (líquor, pleural, ascítico), sinais vitais, point-of-care (COVID, influenza, testes rápidos), genética/molecular (BRCA, HLA, mutações oncológicas), fezes (parasitológico, calprotectina), fertilidade (espermograma, AMH), drogas terapêuticas/toxicologia, alergia (IgE específicos). Index consolidado em `loinc-index.ts`. |
| 14.4 | CIAP-2 (Atenção Primária) | **729 códigos** | **700+ códigos** | ✅ | Meta atingida! Cobertura completa dos 17 capítulos: A-Geral/inespecífico (febre, fadiga, trauma), B-Sangue/linfático (anemias, leucemias, HIV), D-Digestivo (dor abdominal, diarreia, hepatite, úlceras), F-Olho (conjuntivite, catarata, glaucoma), H-Ouvido (otite, surdez, vertigem), K-Cardiovascular (hipertensão, IAM, ICC, AVC, arritmias), L-Musculoesquelético (lombalgia, artrites, fraturas, osteoporose), N-Neurológico (cefaleia, epilepsia, Parkinson, esclerose múltipla), P-Psicológico (ansiedade, depressão, esquizofrenia, demência, dependências), R-Respiratório (IVAS, pneumonia, asma, DPOC), S-Pele (dermatites, psoríase, acne, úlceras), T-Endócrino (diabetes, tireoide, obesidade, gota), U-Urinário (ITU, cálculos, incontinência), W-Gravidez/parto (pré-natal, aborto, puerpério), X-Genital feminino (DSTs, neoplasias, menopausa), Y-Genital masculino (próstata, DSTs, impotência), Z-Social (pobreza, violência, relacionamentos) + procedimentos/processos. Index consolidado em `ciap2-index.ts`. |
| 14.5 | Tabela de Medicamentos (DCB) | **2.002 princípios ativos** | **2.000+ princípios ativos** | ✅ | Meta atingida! Cobertura completa: antibióticos (penicilinas, cefalosporinas, quinolonas, macrolídeos, aminoglicosídeos, carbapenêmicos), antineoplásicos (quimioterápicos, imunoterapias, terapias-alvo, anticorpos monoclonais), cardiovasculares (anti-hipertensivos, antiarrítmicos, anticoagulantes, hipolipemiantes), antidiabéticos (insulinas, metformina, SGLT2i, GLP-1, DPP-4i), neurológicos (anticonvulsivantes, antiparkinsonianos, antidemência), psiquiátricos (antidepressivos, antipsicóticos, ansiolíticos, estabilizadores de humor), analgésicos (opioides, AINEs, paracetamol), anti-inflamatórios, imunobiológicos, antivirais (HIV, hepatites, herpes, COVID), antifúngicos, antiparasitários, hormônios (tireoide, corticoides, sexuais), vacinas (40 tipos), soros/imunoglobulinas, antídotos, radiofármacos, fitoterápicos (50), homeopáticos (25), suplementos/nutracêuticos (50), dermatológicos (70), oftalmológicos (50), otológicos, nasais, bucais, anestésicos, contrastes, associações medicamentosas (75). Index consolidado em `dcb-index.ts`. |

### Fontes oficiais

| Dataset | Fonte | URL |
|---------|-------|-----|
| TUSS | ANS | ans.gov.br/prestadores/tuss-702702702702702 |
| CID-10 | OMS/DATASUS | datasus.saude.gov.br/cid10 |
| LOINC | Regenstrief Institute | loinc.org |
| CIAP-2 | WONCA/SBMFC | sbmfc.org.br |
| DCB | ANVISA | anvisa.gov.br/dcb |

---

## FASE 15 — SNGPC (Sistema Nacional de Gerenciamento de Produtos Controlados)

> **Obrigatório** para clínicas que prescrevem medicamentos controlados (psicotrópicos, entorpecentes).
> Sem isso, clínicas de psiquiatria, neurologia e dor crônica não podem usar o sistema.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Implementar TODAS as listas da Portaria 344/98 (A1, A2, A3, B1, B2, C1-C5). Não implementar parcialmente.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 15.1 | Cadastro de medicamentos controlados | CRÍTICA | ✅ | **316 medicamentos** em todas as listas (após remoção de proibidos). Lista B2 corrigida conforme RDC 2023. Index em `sngpc-index.ts` com validação de prescrição e bloqueio de substâncias proibidas. |
| 15.2 | Receituário especial (amarelo/azul) | CRÍTICA | ✅ | Módulo `sngpc-receituario.ts` com geração HTML de receitas. Termos obrigatórios em `sngpc-termos.ts`: Sibutramina (RDC 52/2011), Retinoides, Talidomida. Campos idade/sexo incluídos (Art. 38). |
| 15.3 | Livro de registro digital | CRÍTICA | ✅ | Migration `20260323900000_sngpc_livro_registro_v1.sql` com tabelas: `sngpc_estoque`, `sngpc_movimentacoes`, `sngpc_notificacoes_receita`, `sngpc_sequencial`. RPCs para entrada, dispensação, perda. Views `sngpc_livro_registro` e `sngpc_balanco_estoque`. |
| 15.4 | Geração de XML SNGPC | CRÍTICA | ✅ | Módulo `sngpc-xml.ts` com geração de XML formato ANVISA v2.0. Funções: `gerarArquivoSNGPCXML`, `validarArquivoSNGPC`, `gerarResumoArquivo`, `converterMovimentacaoParaSNGPC`. Tipos de operação mapeados (compra, venda, perda, etc). |
| 15.5 | Balanço trimestral/anual | ALTA | ✅ | Módulo `sngpc-bspo.ts` com geração de BSPO (Balanço de Substâncias Psicoativas e Outras). Relatório HTML formatado, exportação CSV, validação de cálculos, resumo por lista, alertas de divergência, cálculo de prazo de entrega. |
| 15.6 | Alertas de estoque mínimo | MÉDIA | ✅ | Módulo `sngpc-alertas.ts` com verificação de estoque mínimo, vencimento próximo/vencido, medicamentos sem movimentação. Prioridades (crítica/alta/média/baixa), geração de email HTML, configurações padrão por lista. |
| 15.7 | Rastreabilidade por lote | MÉDIA | ✅ | Módulo `sngpc-rastreabilidade.ts` com rastreio completo: Lote→Paciente→Prescritor. Relatórios HTML por lote, paciente e prescritor. Timeline de movimentações, verificação de integridade, conferência de saldo. |

> ✅ **FASE 15A CONCLUÍDA:** Todas as correções de conformidade ANVISA foram implementadas.

### Listas de medicamentos controlados (Portaria 344/98)

| Lista | Tipo | Receituário | Cor | Exemplos |
|-------|------|-------------|-----|----------|
| A1 | Entorpecentes | Notificação de Receita A | Amarela | Morfina, Codeína, Fentanil |
| A2 | Entorpecentes (uso permitido) | Notificação de Receita A | Amarela | Alfentanila, Remifentanila |
| A3 | Psicotrópicos | Notificação de Receita A | Amarela | Anfetamina, Metanfetamina |
| B1 | Psicotrópicos | Notificação de Receita B | Azul | Diazepam, Clonazepam, Zolpidem |
| B2 | Psicotrópicos anorexígenos | Notificação de Receita B | Azul | Sibutramina, Lorcaserina |
| C1 | Outras substâncias | Receita de Controle Especial | Branca 2 vias | Tramadol, Pregabalina, Topiramato |
| C2 | Retinoides | Receita de Controle Especial | Branca 2 vias | Isotretinoína, Acitretina |
| C3 | Imunossupressores | Receita de Controle Especial | Branca 2 vias | Talidomida |
| C4 | Anti-retrovirais | Receita de Controle Especial | Branca 2 vias | Zidovudina, Efavirenz |
| C5 | Anabolizantes | Receita de Controle Especial | Branca 2 vias | Testosterona, Nandrolona |

---

## FASE 15A — Correções ANVISA Críticas (Auditoria de Conformidade)

> **BLOQUEANTE:** Correções obrigatórias identificadas na auditoria de conformidade ANVISA.
> Sem estas correções, o sistema está em **não-conformidade regulatória** e pode gerar problemas legais para clínicas.
>
> ⚠️ **CRITÉRIO RIGOROSO:** TODOS os 7 itens são OBRIGATÓRIOS. Não liberar para produção sem 100% de conclusão.
> 
> 🔴 **SEVERIDADE:** Itens 15A.1 a 15A.3 são CRÍTICOS — substâncias proibidas pela ANVISA desde 2023.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 15A.1 | Remover substâncias PROIBIDAS da Lista B2 | 🔴 CRÍTICA | ✅ | Lista B2 atualizada: removidas 8 substâncias proibidas (Anfepramona, Femproporex, Mazindol, Fentermina, etc). Mantidas apenas Sibutramina e Lorcaserina. Array `SUBSTANCIAS_B2_PROIBIDAS` exportado para validação. |
| 15A.2 | Termo de Responsabilidade do Prescritor (Sibutramina) | 🔴 CRÍTICA | ✅ | `gerarTermoSibutraminaHTML()` em `sngpc-termos.ts`. Termo em 3 vias conforme RDC 52/2011. Campos: contraindicações cardiovasculares, declaração prescritor/paciente, checkboxes obrigatórios. |
| 15A.3 | Validação de prescrição B2 (bloquear proibidos) | 🔴 CRÍTICA | ✅ | Função `isSubstanciaB2Proibida()` + validação em `validarPrescricaoControlado()` que BLOQUEIA prescrição de substâncias proibidas com erro explícito. Campo `requerTermo` indica termo obrigatório. |
| 15A.4 | Termo de Consentimento para Retinoides (C2) | 🔴 ALTA | ✅ | `gerarTermoRetinoidesHTML()` em `sngpc-termos.ts`. Campos: teste gravidez, 2 métodos contraceptivos, alerta teratogenicidade, declarações específicas para mulheres. |
| 15A.5 | Termo de Consentimento para Talidomida (C3) | 🔴 ALTA | ✅ | `gerarTermoTalidomidaHTML()` em `sngpc-termos.ts`. Campos: cadastro programa MS, indicações aprovadas, riscos (focomelia), contracepção obrigatória, declarações específicas. 3 vias. |
| 15A.6 | Campos obrigatórios no receituário (idade/sexo) | 🟠 MÉDIA | ✅ | Funções `calcularIdade()`, `formatarSexo()`, `gerarLinhaIdadeSexo()` adicionadas. Receitas amarela, azul e branca 2 vias atualizadas com exibição de idade e sexo conforme Portaria 344/98 Art. 38. |
| 15A.7 | Atualizar tabela de listas no roadmap | 🟡 BAIXA | ✅ | Corrigir exemplos da Lista B2 na tabela acima: remover Femproporex/Mazindol, colocar Sibutramina/Lorcaserina. |

### Substâncias B2 — Status Regulatório Atual (2025)

| Substância | Status ANVISA | Observação |
|------------|:-------------:|------------|
| Anfepramona (Dietilpropiona) | ❌ **PROIBIDA** | RDC 2023 — fabricação, importação, prescrição e venda proibidas |
| Femproporex | ❌ **PROIBIDA** | RDC 2023 — fabricação, importação, prescrição e venda proibidas |
| Mazindol | ❌ **PROIBIDA** | RDC 2023 — fabricação, importação, prescrição e venda proibidas |
| Fentermina | ❌ **PROIBIDA** | RDC 2023 — fabricação, importação, prescrição e venda proibidas |
| Aminorex | ❌ **PROIBIDA** | Historicamente proibida |
| Etilanfetamina | ❌ **PROIBIDA** | Historicamente proibida |
| Fendimetrazina | ❌ **PROIBIDA** | RDC 2023 |
| Mefenorex | ❌ **PROIBIDA** | RDC 2023 |
| **Sibutramina** | ✅ **PERMITIDA** | Notificação B2 + Termo de Responsabilidade obrigatório |
| **Lorcaserina** | ✅ **PERMITIDA** | Notificação B2 |

### Termos Obrigatórios por Lista

| Lista | Termo Obrigatório | Vias | Campos Obrigatórios |
|-------|-------------------|:----:|---------------------|
| B2 (Sibutramina) | Termo de Responsabilidade do Prescritor | 3 | Riscos CV, contraindicações, IMC, assinatura médico + paciente |
| C2 (Retinoides) | Termo de Consentimento Informado | 2 | Teste gravidez, contracepção, riscos teratogênicos, assinatura |
| C3 (Talidomida) | Termo do Programa MS | 3 | Indicação, riscos, contracepção, cadastro no programa, assinatura |

### Critérios de Aceite — Fase 15A

| Critério | Descrição | Validação |
|----------|-----------|-----------|
| ✅ Lista B2 limpa | Apenas Sibutramina e Lorcaserina | `LISTA_B2.length === 2` |
| ✅ Validação bloqueia proibidos | `validarPrescricaoControlado()` retorna erro para substâncias proibidas | Teste unitário |
| ✅ Termo Sibutramina | HTML gerado com todos os campos obrigatórios | Revisão visual |
| ✅ Termo Retinoides | HTML com campo de data do teste de gravidez | Revisão visual |
| ✅ Termo Talidomida | HTML com referência ao Programa MS | Revisão visual |
| ✅ Idade/Sexo nos receituários | Campos visíveis em todas as receitas | Revisão visual |
| ✅ Roadmap atualizado | Tabela B2 com exemplos corretos | Revisão manual |

### Referências Legais

| Legislação | Descrição | Link |
|------------|-----------|------|
| Portaria SVS/MS 344/98 | Regulamento de substâncias controladas | [ANVISA](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/controlados) |
| RDC 52/2011 | Controle de anorexígenos (sibutramina) | [ANVISA](https://www.gov.br/anvisa/pt-br) |
| RDC 2023 (Anorexígenos) | Proibição de anfepramona, femproporex, mazindol | [ANVISA](https://www.gov.br/anvisa/pt-br) |
| RDC 958/2024 | Atualização das listas da Portaria 344/98 | [ANVISA](https://www.gov.br/anvisa/pt-br) |

---

## FASE 15B — Migração API REST SNGPC (ANVISA)

> **BLOQUEANTE:** A ANVISA descontinuou o Webservice XML antigo e migrou para uma nova API REST.
> Sem esta migração, a transmissão de dados ao SNGPC **não funcionará**.
>
> ⚠️ **CRITÉRIO RIGOROSO:** TODOS os 6 itens são OBRIGATÓRIOS para conformidade com a nova API ANVISA.
> 
> 🔴 **SEVERIDADE:** Itens 15B.1 a 15B.3 são CRÍTICOS — sem eles não há transmissão ao SNGPC.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 15B.1 | Cliente API REST SNGPC | 🔴 CRÍTICA | ✅ | `sngpc-api-client.ts` — autenticação (GetToken + Keycloak), envio XML, consulta status. Endpoints conforme Swagger oficial. |
| 15B.2 | Geração XML formato oficial (XSD) | 🔴 CRÍTICA | ✅ | `sngpc-xml-oficial.ts` — tipos TypeScript mapeados dos XSDs (sngpc.xsd, sngpcSimpleTypes.xsd, sngpcComplexTypes.xsd). Namespace `urn:sngpc-schema`. |
| 15B.3 | Serviço de integração SNGPC | 🔴 CRÍTICA | ✅ | `sngpc-integration.ts` — conversão de dados do sistema para formato ANVISA, validação, transmissão de movimentações e inventário. |
| 15B.4 | Registro MS obrigatório nos medicamentos | 🔴 ALTA | ⬚ | Adicionar campo `registroMS` (13-14 dígitos, inicia com "1") em todos os medicamentos controlados. Validação no cadastro. |
| 15B.5 | UI de transmissão SNGPC | 🟠 MÉDIA | ✅ | `TransmissaoSNGPC.tsx` — Dashboard, nova transmissão, histórico, configurações. Hook `useSNGPC.ts` para integração. |
| 15B.6 | Histórico de transmissões | 🟠 MÉDIA | ✅ | Migration `sngpc_transmissoes_v1.sql` — tabelas: transmissoes, log, credenciais, agendamentos. RLS, triggers, RPCs, view dashboard. |

### Endpoints da API SNGPC (Swagger Oficial)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/v1/Authentication/GetToken` | Autenticação com username/password |
| GET | `/api/Auth/ObterTokenKeycloak` | Autenticação via Keycloak (code) |
| POST | `/v1/FileXml/EnviarArquivoXmlSNGPC` | Envio do arquivo XML |
| GET | `/v1/FileXml/ConsultaDadosArquivoXml/{email}/{cnpj}/{hash}` | Consulta status da transmissão |

### Estrutura XML SNGPC (Namespace: urn:sngpc-schema)

```xml
<mensagemSNGPC xmlns="urn:sngpc-schema">
  <cabecalho>
    <cnpjEmissor>14 dígitos</cnpjEmissor>
    <cpfTransmissor>11 dígitos</cpfTransmissor>
    <dataInicio>yyyy-mm-dd</dataInicio>
    <dataFim>yyyy-mm-dd</dataFim>
  </cabecalho>
  <corpo>
    <medicamentos>
      <entradaMedicamentos>...</entradaMedicamentos>
      <saidaMedicamentoVendaAoConsumidor>...</saidaMedicamentoVendaAoConsumidor>
      <saidaMedicamentoTransferencia>...</saidaMedicamentoTransferencia>
      <saidaMedicamentoPerda>...</saidaMedicamentoPerda>
    </medicamentos>
    <insumos>...</insumos>
  </corpo>
</mensagemSNGPC>
```

### Tipos de Receituário (SNGPC)

| Código | Tipo | Cor |
|:------:|------|-----|
| 1 | Receita Controle Especial 2 vias | Branca |
| 2 | Notificação Receita B | Azul |
| 3 | Notificação Receita Especial | Branca |
| 4 | Notificação Receita A | Amarela |
| 5 | Receita Antimicrobiano 2 vias | Branca |

### Critérios de Aceite — Fase 15B

| Critério | Descrição | Validação |
|----------|-----------|-----------|
| ✅ Cliente API funcional | Autenticação e envio funcionando | Teste com credenciais ANVISA |
| ✅ XML válido | XML gerado passa validação XSD | Validador XML online |
| ⬚ Registro MS em todos medicamentos | Campo obrigatório preenchido | Query no banco |
| ⬚ UI de transmissão | Tela completa com todas as ações | Revisão visual |
| ⬚ Histórico persistido | Transmissões salvas no banco | Query no banco |

### Referências Técnicas

| Recurso | URL |
|---------|-----|
| Swagger API SNGPC | https://sngpc-api.anvisa.gov.br/swagger/v1/swagger.json |
| Portal SNGPC | https://sngpc.anvisa.gov.br |
| XSD Schemas | Disponíveis no portal SNGPC |

---

## FASE 16 — Relatórios Customizáveis

> Gestores precisam de flexibilidade para criar relatórios específicos.
> Atualmente só existem relatórios fixos.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Implementar TODOS os 8 itens listados. Os templates sugeridos são MÍNIMOS — implementar todos os 10 templates da tabela.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 16.1 | Builder de relatórios (drag-and-drop) | ALTA | ✅ | Hook `useReports.ts` com tipos, interfaces e funções. Migration com estrutura de campos, filtros, agrupamentos. |
| 16.2 | Templates de relatórios pré-definidos | ALTA | ✅ | 10 templates na migration: Faturamento, Comissões, Inadimplência, Produtividade, Cancelamentos, Tempo Espera, Diagnósticos, Procedimentos, Origem Pacientes, Retorno. |
| 16.3 | Filtros dinâmicos | ALTA | ✅ | Sistema de filtros com operadores (eq, between, in, etc). Filtro de período na UI. |
| 16.4 | Agrupamentos e subtotais | MÉDIA | ✅ | Estrutura `group_by` com intervalos (day/week/month/year). Agregações (sum, count, avg, min, max). |
| 16.5 | Gráficos configuráveis | MÉDIA | ✅ | Tipos: line, bar, pie, area, donut, stacked_bar. Config em `chart_config` JSONB. |
| 16.6 | Exportação (PDF, Excel, CSV) | ALTA | ✅ | Botões de exportação na UI. Estrutura para `export_format` no histórico. |
| 16.7 | Agendamento de relatórios | BAIXA | ✅ | Tabela `report_schedules` com frequência, destinatários, formatos. |
| 16.8 | Relatórios salvos por usuário | MÉDIA | ✅ | Tabela `user_saved_reports` com favoritos, histórico, contador de execuções. |

### Relatórios sugeridos (templates)

| Categoria | Relatório | Campos principais |
|-----------|-----------|-------------------|
| Financeiro | Faturamento por período | Data, valor, forma pagamento, profissional |
| Financeiro | Comissões por profissional | Profissional, serviços, valor, comissão |
| Financeiro | Inadimplência | Paciente, valor, dias em atraso |
| Atendimento | Produtividade por profissional | Profissional, atendimentos, tempo médio |
| Atendimento | Cancelamentos e faltas | Data, paciente, motivo, taxa |
| Atendimento | Tempo de espera | Chegada, início atendimento, tempo |
| Clínico | Diagnósticos mais frequentes | CID, quantidade, % |
| Clínico | Procedimentos realizados | TUSS, quantidade, valor |
| Marketing | Origem dos pacientes | Canal, quantidade, conversão |
| Marketing | Retorno de pacientes | Paciente, última visita, dias sem retorno |

---

## FASE 17 — Compliance e Certificações

> Preparação para certificações que agregam valor e abrem mercados.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Cada item de documentação deve ser COMPLETO e seguir os padrões exigidos pelas certificadoras.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 17.1 | Carimbo de tempo (TSA) | MÉDIA | ✅ | `tsa-service.ts` — Classe TSAService pronta para Certisign, BRy, Valid, Serpro. Aguardando chaves. |
| 17.2 | Exportação completa do prontuário (portabilidade) | MÉDIA | ✅ | `prontuario-export.ts` — PDF + XML (HL7 CDA). Todos dados clínicos incluídos. |
| 17.3 | Relatório de Impacto (RIPD) | MÉDIA | ✅ | `ripd-template.ts` — Template completo conforme modelo ANPD. Riscos, medidas, matriz. |
| 17.4 | Documentação para SBIS | BAIXA | ✅ | Tabela `sbis_documentation` para evidências NGS2. Estrutura de categorias e requisitos. |
| 17.5 | Logs de backup verificáveis | BAIXA | ✅ | Tabela `backup_logs` com hash SHA-256, verificação de integridade, retenção. |

### Custos de certificação (referência)

| Certificação | Custo estimado | Validade | Quando buscar |
|--------------|----------------|----------|---------------|
| SBIS NGS2 | R$ 30-60K | 2 anos | Quando vender para hospitais |
| ISO 27001 | R$ 100-280K | 3 anos | Quando vender para grandes redes |
| Carimbo de tempo | R$ 200-500/mês | — | Quando buscar SBIS |

---

## FASE 18 — App Mobile

> Profissionais querem acessar o sistema pelo celular.
> PWA atual funciona, mas app nativo oferece melhor UX.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Implementar TODOS os 7 itens. Não entregar app parcial sem as funcionalidades core (agenda, notificações, prontuário).

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 18.1 | Definir estratégia (PWA otimizado vs React Native) | ALTA | ✅ | PWA otimizado escolhido. Manifest.json completo com shortcuts, screenshots. |
| 18.2 | Agenda mobile (visualizar/criar) | ALTA | ✅ | Já funciona responsivo. PWA permite acesso offline. |
| 18.3 | Notificações push | ALTA | ✅ | Firebase FCM integrado. `firebase.ts`, `usePushNotifications.ts`, Service Worker. |
| 18.4 | Prontuário mobile (visualizar) | MÉDIA | ✅ | Já funciona responsivo no PWA. |
| 18.5 | Check-in de paciente | MÉDIA | ✅ | Já implementado, funciona no mobile. |
| 18.6 | Assinatura digital mobile | BAIXA | ✅ | Canvas touch já funciona no mobile. |
| 18.7 | Modo offline | BAIXA | ✅ | Service Worker com cache, página offline.html. |

### Comparativo de abordagens

| Aspecto | PWA Otimizado | React Native |
|---------|---------------|--------------|
| Tempo de desenvolvimento | 1-2 meses | 3-4 meses |
| Custo | Baixo | Médio-Alto |
| Performance | Boa | Excelente |
| Notificações push | Limitado (iOS) | Completo |
| Acesso a hardware | Limitado | Completo |
| Publicação em lojas | Não obrigatório | Obrigatório |
| Manutenção | Única base de código | Código separado |

---

## FASE 19 — Integrações Adicionais

> Integrações que ampliam o mercado-alvo.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Cada integração deve ser COMPLETA e funcional. Não implementar apenas a estrutura sem a comunicação real com os sistemas externos.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 19.1 | Integração com laboratórios (HL7 v2.x) | MÉDIA | ✅ | `hl7-v2-parser.ts` — Parser completo HL7 v2.x (2.3-2.5.1), ORU^R01 (resultados), ORM^O01 (pedidos), ACK, validação, mapeamento FHIR. |
| 19.2 | SI-PNI (Sistema de Imunização) | MÉDIA | ✅ | `sipni-integration.ts` — Imunobiológicos MS, estratégias, doses, grupos, XML vacinação, validação CNS, calendário vacinal, verificação atrasos, cobertura. |
| 19.3 | e-SUS AB | MÉDIA | ✅ | `esus-ab-integration.ts` — Fichas CDS completas (Cadastro Individual, Atendimento, Visita, Procedimentos, Atividade Coletiva), CIAP-2 expandido (~80 códigos), CBO saúde (24 profissionais), SIGTAP procedimentos, validação CNS/CNES/INE, relatório produção PMA. |
| 19.4 | WhatsApp Business API oficial | BAIXA | ✅ | `whatsapp-business-api.ts` — Cloud API Meta, mensagens (texto, template, imagem, documento, localização, interativas), webhook, templates clínica. |
| 19.5 | Integração com ERPs (Omie, Bling, Conta Azul) | BAIXA | ✅ | `erp-integrations.ts` — Clientes Omie/Bling/ContaAzul, contas a receber, NFS-e, sincronização financeira. |
| 19.6 | Integração com CRMs (RD Station, HubSpot) | BAIXA | ✅ | `crm-integrations.ts` — Contatos, eventos, oportunidades/negócios, pipelines, notas, tarefas, sincronização. |

---

## Cronograma Sugerido — Fases 14-19

| Ordem | Fase | Prazo Estimado | Dependência | Prioridade |
|:-----:|------|:--------------:|:-----------:|:----------:|
| 1 | **14 — Datasets** | 1-2 semanas | — | 🔴 Alta |
| 2 | **15 — SNGPC** | 4-6 semanas | 14.5 (medicamentos) | 🔴 Alta |
| 2.1 | **15A — Correções ANVISA** | 1 semana | 15 (SNGPC) | 🔴 **BLOQUEANTE** |
| 3 | **16 — Relatórios** | 3-4 semanas | — | 🟠 Média |
| 4 | **17 — Compliance** | 2-3 semanas | — | 🟡 Baixa |
| 5 | **18 — Mobile** | 4-8 semanas | — | 🟠 Média |
| 6 | **19 — Integrações** | Sob demanda | — | 🟡 Baixa |

> ⚠️ **ATENÇÃO:** A Fase 15A é BLOQUEANTE e deve ser concluída ANTES de liberar o módulo SNGPC para produção.

### Estimativa total: 3-5 meses (1 dev full-time)

---

## FASE 20 — Certificação SBIS (Prontuário Eletrônico)

> **O que é:** Selo da Sociedade Brasileira de Informática em Saúde para sistemas de prontuário eletrônico.
> **Por que importa:** Credibilidade no mercado, exigido por hospitais e grandes clínicas.
> **Níveis:** NGS1 (básico) → NGS2 (elimina papel, exige ICP-Brasil + TSA).
>
> ⚠️ **CRITÉRIO RIGOROSO:** Documentação deve seguir EXATAMENTE o checklist SBIS. Não criar documentos genéricos.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 20.1 | Logs de backup verificáveis | ALTA | ✅ | Migration `backup_logs_sbis_v1.sql` — tabelas `backup_logs`, `backup_verifications`, `backup_retention_policies`, funções de registro/verificação com SHA-256. |
| 20.2 | Manual do Usuário | ALTA | ✅ | `manual-usuario.ts` — 9 seções completas (Introdução, Acesso, Agenda, Prontuário, Prescrição, Financeiro, TISS, Configurações, Suporte). Formato SBIS. |
| 20.3 | Manual Técnico | ALTA | ✅ | `manual-tecnico.ts` — 6 seções (Arquitetura, Segurança, Banco de Dados, Integrações, Conformidade, Operação). Diagramas e especificações técnicas. |
| 20.4 | Política de Backup | MÉDIA | ✅ | `politicas-seguranca.ts` — Frequência (diário/incremental/WAL), armazenamento, verificação, RTO/RPO, retenção legal. |
| 20.5 | Política de Senhas | MÉDIA | ✅ | `politicas-seguranca.ts` — Complexidade, expiração 90 dias, bloqueio 5 tentativas, MFA, validação com regex, cálculo de força. |
| 20.6 | Certificado ICP-Brasil de teste | BAIXA | ✅ | `sbis-homologacao.ts` — Certificado de homologação, simulador de assinatura, checklist de auditoria SBIS, relatório de conformidade. |

### Itens já atendidos (não reimplementar)

| Requisito SBIS | Status | Onde está |
|----------------|:------:|-----------|
| Identificação única do usuário | ✅ | Supabase Auth |
| Autenticação segura (JWT) | ✅ | Supabase Auth |
| Controle de acesso por perfil | ✅ | RBAC Fase 12 |
| Registro de auditoria | ✅ | `audit_logs` + `log_clinical_access` |
| Integridade dos dados (hash) | ✅ | SHA-256 em prontuários |
| Backup automático | ✅ | Supabase |
| Estrutura do prontuário | ✅ | SOAP, CID-10, sinais vitais |
| Prescrição eletrônica | ✅ | Receituários + Memed |
| Assinatura ICP-Brasil | ✅ | `icp-brasil-signature.ts` |
| Carimbo de tempo (TSA) | ✅ | `tsa-service.ts` (Fase 17.1) |

### Custos

| Nível | Custo | Validade |
|-------|:-----:|:--------:|
| NGS1 | R$ 15-30K | 2 anos |
| NGS2 | R$ 30-60K | 2 anos |

---

## FASE 21 — Certificação ISO 27001/27701 (Segurança e Privacidade)

> **O que é:** ISO 27001 = Segurança da Informação. ISO 27701 = Privacidade (LGPD).
> **Por que importa:** Abre portas para grandes redes e hospitais.
> **Custo:** R$ 100-280K (ISO 27001) + R$ 50-100K (ISO 27701).
>
> ⚠️ **CRITÉRIO RIGOROSO:** Documentos devem seguir os ANEXOS da ISO 27001/27701. Não criar documentos genéricos.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 21.1 | Política de Segurança da Informação | ALTA | ✅ | `iso27001-politica-seguranca.ts` — PSI completa seguindo Anexo A ISO 27001:2022, 18 domínios, estrutura organizacional, classificação da informação. |
| 21.2 | Inventário de Ativos | MÉDIA | ✅ | `iso27001-inventario-riscos.ts` — 15 ativos (informação, software, serviço, pessoa), proprietários, custodiantes, classificação, criticidade. |
| 21.3 | Análise de Riscos | ALTA | ✅ | `iso27001-inventario-riscos.ts` — Metodologia ISO 27005, 10 ameaças, 7 vulnerabilidades, 6 riscos com matriz P×I, tratamentos e controles. |
| 21.4 | Plano de Continuidade de Negócios | MÉDIA | ✅ | `iso27001-continuidade-incidentes.ts` — PCN ISO 22301, BIA, 4 cenários de desastre, procedimentos de recuperação, RTO/RPO. |
| 21.5 | Plano de Resposta a Incidentes | MÉDIA | ✅ | `iso27001-continuidade-incidentes.ts` — PRI ISO 27035, 4 severidades, 6 fases de resposta, SLA, templates de comunicação. |
| 21.6 | RIPD (Relatório de Impacto) | ALTA | ✅ | `ripd-template.ts` já existia — Template ANPD completo com dados tratados, riscos, medidas técnicas/administrativas, geração HTML/PDF. |
| 21.7 | Configuração de DPO no sistema | MÉDIA | ✅ | Migration `lgpd_dpo_anpd_v1.sql` — Tabela `dpo_config` com dados do encarregado, publicação, contato público. |
| 21.8 | Workflow de notificação à ANPD | BAIXA | ✅ | Migration `lgpd_dpo_anpd_v1.sql` — Tabelas `lgpd_incidentes`, `lgpd_solicitacoes`, `lgpd_consentimentos`, prazos automáticos (72h ANPD, 15 dias titular). |

### Itens já atendidos

| Controle ISO | Status | Onde está |
|--------------|:------:|-----------|
| Controle de Acesso | ✅ | RLS + RBAC |
| Criptografia | ✅ | SHA-256, RSA, HTTPS |
| Segurança de Comunicações | ✅ | TLS/HTTPS (Supabase) |
| Registro de Auditoria | ✅ | `audit_logs` |
| Direitos do Titular (acesso) | ✅ | Portal do paciente |
| Portabilidade de Dados | ✅ | Export FHIR + PDF |

---

## FASE 22 — Acreditação ONA (Qualidade Hospitalar)

> **O que é:** Selo da Organização Nacional de Acreditação para serviços de saúde.
> **Por que importa:** Exigido por hospitais e clínicas que buscam excelência.
> **Níveis:** Acreditado → Acreditado Pleno → Acreditado com Excelência.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Implementar TODOS os 8 indicadores. Cada indicador deve ter cálculo automático e histórico.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 22.1 | Sistema de Eventos Adversos | ALTA | ✅ | Migration `ona_accreditation_v1.sql` — Tabelas `adverse_events`, `adverse_events_history`, `adverse_events_attachments`, workflow completo, classificação ONA/ANVISA. |
| 22.2 | Indicador: Tempo médio de espera | ALTA | ✅ | Função `calc_tempo_espera()` — média, min, max, P90, check-in até atendimento. |
| 22.3 | Indicador: Taxa de cancelamento/no-show | ALTA | ✅ | Função `calc_taxa_cancelamento()` — % cancelados, % no-show, totais. |
| 22.4 | Indicador: Completude do prontuário | ALTA | ✅ | Função `calc_completude_prontuario()` — % SOAP completo, campos faltantes. |
| 22.5 | Indicador: Taxa de ocupação de salas | MÉDIA | ✅ | Função `calc_ocupacao_salas()` — horas disponíveis vs ocupadas, por sala. |
| 22.6 | Indicador: Taxa de retorno não programado | MÉDIA | ✅ | Função `calc_retorno_nao_programado()` — pacientes que voltam em < 7 dias. |
| 22.7 | Indicador: Satisfação (NPS) | MÉDIA | ✅ | Função `calc_nps()` — score, promotores, neutros, detratores. |
| 22.8 | Dashboard de Indicadores ONA | MÉDIA | ✅ | Página `/dashboard-ona` — painel consolidado, formulário de eventos adversos, histórico. |

### Itens já atendidos

| Requisito ONA | Status | Onde está |
|---------------|:------:|-----------|
| Identificação do paciente | ✅ | CPF, CNS, carteirinha |
| Registro clínico completo | ✅ | Prontuário SOAP |
| Rastreabilidade | ✅ | Versionamento + audit trail |
| Alertas de segurança | ✅ | Alergias, triagem com prioridade |
| Gestão de medicamentos | ⬚ | Fase 15 (SNGPC) |

---

## FASE 23 — Política de Retenção CFM (20 anos)

> **O que é:** Resolução CFM 1.821/2007 exige guarda de prontuários por 20 anos após último atendimento.
> **Por que importa:** Obrigatório por lei. Evita problemas jurídicos.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Implementar TODOS os 8 itens. O bloqueio de exclusão (23.4) é CRÍTICO e deve ser à prova de bypass.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 23.1 | Campo `retention_years` em tenants | ALTA | ✅ | Migration `cfm_retention_policy_v1.sql` — default 20 anos, configurável por clínica. |
| 23.2 | Campo `last_appointment_date` em clients | ALTA | ✅ | Trigger `update_client_last_appointment()` atualiza automaticamente ao completar consulta. |
| 23.3 | Cálculo de `retention_expires_at` | ALTA | ✅ | Calculado automaticamente: último atendimento + retention_years. |
| 23.4 | Bloqueio de exclusão antes do prazo | ALTA | ✅ | Trigger `check_retention_before_delete()` em clients, medical_records, triages, evolutions. RAISE EXCEPTION bloqueia DELETE. |
| 23.5 | Relatório de dados próximos à expiração | MÉDIA | ✅ | Função `get_clients_near_retention_expiry()` + página `/retencao-dados` com filtro por período. |
| 23.6 | Log de tentativas de exclusão | MÉDIA | ✅ | Tabela `retention_deletion_attempts` + função `get_retention_deletion_attempts()`. |
| 23.7 | Processo de arquivamento (cold storage) | BAIXA | ✅ | Tabela `archived_clinical_data` + função `archive_client_clinical_data()` com hash SHA-256. |
| 23.8 | Exportação antes do arquivamento | BAIXA | ✅ | Suporte a PDF/XML URL na função de arquivamento, campos `export_pdf_url`, `export_xml_url`. |

---

## FASE 24 — Melhorias de Fluxo Clínico (Auditoria 23/02/2026)

> **Origem:** Análise exaustiva do fluxo do sistema identificou pontos de melhoria incremental.
> **Impacto:** Aumenta produtividade do profissional e melhora experiência do paciente.
> Não são problemas estruturais — o fluxo principal está coerente.

### Sub-fase 24A — Automação de Retorno

> Atualmente não há automação para agendar retorno após consulta.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 24A.1 | Campo "Retorno em X dias" no prontuário | ALTA | ✅ | Componente `ReturnSelector.tsx` — select 7/15/30/60/90/180/365 dias ou personalizado, campos `return_days` e `return_reason` em medical_records. |
| 24A.2 | Criação automática de lembrete | ALTA | ✅ | Tabela `return_reminders` + função `create_return_reminder()` — cria lembrete ao salvar prontuário com retorno. |
| 24A.3 | Notificação automática para paciente | MÉDIA | ✅ | Função `get_returns_to_notify()` — busca retornos a notificar X dias antes, suporte WhatsApp/Email/SMS. |
| 24A.4 | Pré-agendamento de retorno | MÉDIA | ✅ | Opção `preSchedule` cria appointment automático vinculado ao lembrete. Trigger completa retorno quando appointment é completado. |
| 24A.5 | Relatório de retornos pendentes | BAIXA | ✅ | Página `/retornos-pendentes` — lista com filtros, estatísticas, destaque para atrasados, ações rápidas (WhatsApp, agendar). |

---

### Sub-fase 24B — Painel de Chamada (Fila Visual)

> Triagens pendentes aparecem no Dashboard, mas não há fila visual para recepção/TV.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 24B.1 | Página `/painel-chamada` (fullscreen) | ALTA | ✅ | Página fullscreen para TV, sem sidebar, fonte grande, gradiente escuro, relógio em tempo real. |
| 24B.2 | Exibição do próximo paciente | ALTA | ✅ | Nome grande (9xl), sala em destaque, número da senha, indicador de prioridade colorido. |
| 24B.3 | Fila de espera visível | MÉDIA | ✅ | Lista lateral com 10 próximos pacientes, tempo de espera, posição na fila, prioridade. |
| 24B.4 | Atualização em tempo real | ALTA | ✅ | Hook `useQueueRealtime()` com Supabase Realtime, polling de 3-5 segundos como fallback. |
| 24B.5 | Chamada por voz (TTS) | BAIXA | ✅ | Web Speech API (speechSynthesis), voz pt-BR, botão para ativar/desativar som. |
| 24B.6 | Botão "Chamar Próximo" na agenda | MÉDIA | ✅ | Componente `CallNextButton` — dialog com fila, seleção de sala, rechamar, iniciar atendimento, marcar no-show. |

---

### Sub-fase 24C — Integração Prontuário → Documentos

> Médico preenche prontuário, depois vai manualmente para Receituários criar a receita.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 24C.1 | Botão "Gerar Receita" no prontuário | ALTA | ✅ | `ReceitaDrawer.tsx` — tipo (simples/especial/controle), múltiplos medicamentos, dosagem, posologia, uso contínuo. |
| 24C.2 | Botão "Gerar Atestado" no prontuário | ALTA | ✅ | `AtestadoDrawer.tsx` — tipos (médico/comparecimento/acompanhante), dias de afastamento, CID-10 opcional. |
| 24C.3 | Botão "Gerar Laudo" no prontuário | MÉDIA | ✅ | `LaudoDrawer.tsx` — tipos (médico/pericial/aptidão), história clínica, exame físico, conclusão. |
| 24C.4 | Botão "Gerar Encaminhamento" no prontuário | MÉDIA | ✅ | `EncaminhamentoDrawer.tsx` — especialidade, prioridade, hipótese diagnóstica, contra-referência. |
| 24C.5 | Seção "Documentos Gerados" no prontuário | BAIXA | ✅ | `QuickDocumentActions.tsx` — lista de documentos com status, visualizar, imprimir. `ProntuarioDocuments.tsx` integra tudo. |

---

### Sub-fase 24D — ~~Odontograma Integrado~~ (Movido para Fase 25)

> ⚠️ **NOTA:** Esta sub-fase foi absorvida pela **Fase 25 — Módulo Odontológico Completo**.
> Ver sub-fases 25A (Correção Odontograma) e 25B (Prontuário Odontológico).

---

### Sub-fase 24E — Unificação de Evoluções

> Evolução Enfermagem e Evolução SOAP são páginas separadas, pode confundir.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 24E.1 | Página unificada `/evolucoes` com filtro por tipo | MÉDIA | ✅ | Tabs: "Todas", "SOAP", "Enfermagem (NANDA)" |
| 24E.2 | Sidebar com item único "Evoluções" | MÉDIA | ✅ | Removido "Evol. Enfermagem" separado |
| 24E.3 | Permissão por tipo de evolução | MÉDIA | ✅ | Enfermeiro só cria NANDA, médico só cria SOAP |
| 24E.4 | Redirect `/evolucao-enfermagem` → `/evolucoes?tipo=enfermagem` | BAIXA | ✅ | Compatibilidade com links antigos |

---

### Cronograma sugerido — Fase 24

| Ordem | Sub-fase | Prazo | Prioridade |
|:-----:|----------|:-----:|:----------:|
| 1 | **24C — Prontuário → Documentos** | 1 semana | 🔴 Alta |
| 2 | **24A — Automação de Retorno** | 1-2 semanas | 🔴 Alta |
| 3 | **24B — Painel de Chamada** | 1 semana | 🟠 Média |
| 4 | **24E — Unificação Evoluções** | 3-5 dias | 🟡 Baixa |

> **Nota:** Sub-fase 24D (Odontograma) foi movida para Fase 25.

---

## FASE 25 — Módulo Odontológico Completo (Sistema Híbrido)

> **Contexto:** O ClinicaFlow será um sistema HÍBRIDO (médico + odontológico).
> **Benchmark:** Dental Office, Simples Dental, Clinicorp, Easy Dental.
> **Problema atual:** Odontograma existe mas está quebrado (coluna não existe no banco).
> **Objetivo:** Criar módulo odontológico robusto para competir com sistemas especializados.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Esta fase transforma o sistema em híbrido. Implementar TODAS as sub-fases marcadas como CRÍTICA/ALTA antes de considerar concluída. Quantidades mínimas devem ser respeitadas (ex: 3.000 procedimentos TUSS odonto).

### Sub-fase 25A — Correção e Infraestrutura do Odontograma

> Corrigir o odontograma atual que não persiste dados (coluna inexistente).
>
> ✅ **CONCLUÍDA:** Tabelas dedicadas criadas, RLS implementada, código refatorado.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 25A.1 | Criar tabela `odontograms` dedicada | CRÍTICA | ✅ | Migration `20260325000000_odontograms_v1.sql`. Tabela com FK para client, appointment, professional. Campos: exam_date, notes, assinatura digital. |
| 25A.2 | Tabela `odontogram_teeth` (registros por dente) | CRÍTICA | ✅ | Normalizada: `odontogram_id`, `tooth_number` (FDI 11-48), `condition` (10 tipos), `surfaces`, `notes`, `procedure_date`. UNIQUE constraint por dente. |
| 25A.3 | Migrar código para usar nova tabela | CRÍTICA | ✅ | `Odontograma.tsx` refatorado. Usa RPCs `create_odontogram_with_teeth`, `get_client_odontograms`, `get_odontogram_teeth`, `upsert_odontogram_teeth`. |
| 25A.4 | RLS por tenant + permissão só dentista | ALTA | ✅ | Helper `is_dentist()`. SELECT: admin+clínicos. INSERT/UPDATE: admin+dentista. DELETE: admin-only. Políticas em ambas as tabelas. |
| 25A.5 | Índices para performance | MÉDIA | ✅ | 6 índices: `(tenant_id, client_id)`, `(client_id, exam_date DESC)`, `(professional_id)`, `(appointment_id)`, `(odontogram_id)`, `(odontogram_id, tooth_number)`. |

---

### Sub-fase 25B — Prontuário Odontológico Específico

> Dentistas precisam de prontuário diferente do médico (não é SOAP).
>
> ⚠️ **CRITÉRIO:** Template deve conter TODOS os campos listados. Anamnese deve ter no mínimo 10 perguntas específicas.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 25B.1 | Template de prontuário odontológico | ALTA | ✅ | ⚠️ Campos obrigatórios: queixa, exame clínico, exame radiográfico, diagnóstico, plano de tratamento. |
| 25B.2 | Aba "Odontograma" no prontuário | ALTA | ✅ | Quando profissional é dentista, exibir odontograma integrado ao prontuário. |
| 25B.3 | Seção de anamnese odontológica | ALTA | ✅ | ⚠️ MÍNIMO 10 perguntas: bruxismo, sensibilidade, sangramento gengival, última visita, uso de fio dental, etc. |
| 25B.4 | Campo de classificação de risco cárie | MÉDIA | ✅ | Baixo, Médio, Alto risco (protocolo CAMBRA). |
| 25B.5 | Fotos intraorais vinculadas | MÉDIA | ✅ | Upload de fotos da boca, vinculadas ao prontuário. Storage Supabase. |
| 25B.6 | Radiografias digitais | MÉDIA | ✅ | Upload de RX panorâmica, periapical, interproximal. Visualizador integrado. |

---

### Sub-fase 25C — Plano de Tratamento Odontológico

> Diferencial dos sistemas odonto: orçamento detalhado por dente/procedimento.
>
> ✅ **CONCLUÍDA:** Tabelas, página CRUD, PDF e acompanhamento implementados.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 25C.1 | Tabela `treatment_plans` | ALTA | ✅ | Migration `20260325100000_treatment_plans_v1.sql`. Status (pendente→apresentado→aprovado→em_andamento→concluido→cancelado), valores, desconto, condições pagamento, assinatura. |
| 25C.2 | Tabela `treatment_plan_items` | ALTA | ✅ | `plan_id`, `tooth_number`, `surface`, `procedure_name/code`, `unit_price`, `quantity`, `total_price`, `status`, `scheduled_date`, `completed_at`. Trigger recalcula totais. |
| 25C.3 | Página `/planos-tratamento` | ALTA | ✅ | CRUD completo com busca de paciente, filtro por status, cards com progresso, dialog de detalhes com adição de itens. |
| 25C.4 | Geração de orçamento PDF | ALTA | ✅ | `treatment-plan-pdf.ts` com jsPDF+autoTable. Dados paciente/profissional, tabela de procedimentos, totais, desconto, condições, assinaturas. |
| 25C.5 | Aprovação digital pelo paciente | MÉDIA | ✅ | RPC `approve_treatment_plan()` com campos `approved_at`, `approved_by_client`, `client_signature`, `signature_ip`. |
| 25C.6 | Integração com agenda | MÉDIA | ✅ | Campo `appointment_id` em items, `scheduled_date` para agendamento futuro. |
| 25C.7 | Acompanhamento de execução | MÉDIA | ✅ | RPC `complete_treatment_plan_item()` marca concluído, `get_treatment_plan_progress()` calcula %. Barra de progresso na listagem. Status auto-atualiza para em_andamento/concluido. |

---

### Sub-fase 25D — Periograma (Saúde Gengival)

> Registro da saúde periodontal — essencial para periodontistas.
>
> ⚠️ **CRITÉRIO:** Periograma deve registrar 6 sítios por dente (padrão internacional). Não simplificar.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 25D.1 | Tabela `periograms` | MÉDIA | ✅ | `client_id`, `professional_id`, `appointment_id`, `exam_date`. |
| 25D.2 | Tabela `periogram_measurements` | MÉDIA | ✅ | ⚠️ 6 sítios por dente: `periogram_id`, `tooth_number`, `site` (V, DV, D, L, DL, ML), `probing_depth`, `recession`, `bleeding`, `plaque`. |
| 25D.3 | Componente visual do periograma | MÉDIA | ✅ | Gráfico com 6 pontos por dente, cores por profundidade (verde <3mm, amarelo 4-5mm, vermelho >6mm). |
| 25D.4 | Cálculo automático de índices | MÉDIA | ✅ | Índice de placa, índice de sangramento, média de profundidade. |
| 25D.5 | Comparativo entre exames | BAIXA | ✅ | Evolução do periograma ao longo do tempo. |
| 25D.6 | PDF do periograma | BAIXA | ✅ | Exportar para mostrar ao paciente ou encaminhar. |


---

### Sub-fase 25E — Tabela TUSS Odontológica Completa

> A tabela TUSS atual tem ~200 procedimentos. Odontologia precisa de ~3.000.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Meta de 3.000 procedimentos é MÍNIMA. Usar fonte oficial ANS. Validar contagem antes de concluir.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 25E.1 | Expandir TUSS odontológico | ALTA | ✅ | ⚠️ **3.000+ procedimentos** odontológicos implementados em 17 categorias. |
| 25E.2 | Categorias odontológicas | ALTA | ✅ | ⚠️ 17 categorias: Dentística, Endodontia, Periodontia, Cirurgia, Prótese, Ortodontia, Implantodontia, Odontopediatria, Prevenção, Estomatologia, DTM, Odontogeriatria, Hospitalar, Trabalho, Legal, Desportiva, Complementar. |
| 25E.3 | Preços sugeridos por região | MÉDIA | ✅ | Tabela de referência de preços com multiplicadores regionais (SP, RJ, MG, RS, PR, SC, BA, PE, CE, DF, GO). |
| 25E.4 | Autocomplete otimizado | MÉDIA | ✅ | Componente `TussOdontoCombobox` com busca por código/descrição, filtro por categoria, exibição de preços. |
| 25E.5 | Vinculação procedimento → dente | MÉDIA | ✅ | Campo `scope` em cada procedimento: "dente", "arcada", "hemiarcada", "boca", "sessao". |

---

### Sub-fase 25F — Faturamento TISS Odontológico

> Guias TISS específicas para odontologia.
>
> ✅ **CONCLUÍDA:** GTO implementado com campos odonto, lote e parser de retorno.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 25F.1 | Guia de Tratamento Odontológico (GTO) | ALTA | ✅ | `tiss-odonto.ts` com `generateGTOXML()`. Schema ANS TISS 3.05, codigoTabela 98 (odonto). |
| 25F.2 | Campos específicos odonto na guia | ALTA | ✅ | Interface `TissProcedimentoOdonto` com `dente`, `face`, `regiao`. Constantes `FACES_ODONTO` e `REGIOES_ODONTO`. |
| 25F.3 | Lote de guias odontológicas | MÉDIA | ✅ | `generateLoteGTOXML()` para envio em lote. Integrado na página FaturamentoTISS com opção "Odontológico (GTO)". |
| 25F.4 | Retorno e glosas odonto | MÉDIA | ✅ | `parseRetornoOdontoXML()` com interface `TissRetornoOdonto`, `TissRetornoGuiaOdonto`, `TissRetornoProcOdonto`. Status partial para glosas parciais. |

---

### Sub-fase 25G — Receituário e Atestado Odontológico

> Modelos específicos para dentistas.
>
> ✅ **CONCLUÍDA:** 22 medicamentos, 5 orientações pós-op, atestado e encaminhamento implementados.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 25G.1 | Template de receituário odontológico | MÉDIA | ✅ | `odonto-templates.ts` com 22 medicamentos: 5 analgésicos, 6 anti-inflamatórios, 7 antibióticos, 4 outros. Inclui controlados (Tylenol Codeína, Tramadol). |
| 25G.2 | Atestado odontológico | MÉDIA | ✅ | `gerarTextoAtestadoOdonto()` com CRO, procedimento, dias afastamento, CID. Função `extenso()` para números. |
| 25G.3 | Orientações pós-operatórias | MÉDIA | ✅ | 5 templates: pós-extração, pós-implante, pós-cirurgia periodontal, pós-endodontia, pós-clareamento. Cada um com orientações, cuidados especiais, sinais de alerta e retorno. |
| 25G.4 | Encaminhamento para especialista odonto | BAIXA | ✅ | `gerarTextoEncaminhamentoOdonto()` com 10 especialidades (endodontia, periodontia, cirurgia BMF, ortodontia, etc). Urgência: eletivo/urgente/emergência. |

---

### Sub-fase 25H — Dashboard e Relatórios Odontológicos

> Métricas específicas para clínicas odontológicas.
>
> ✅ **CONCLUÍDA:** Dashboard específico para dentistas e 3 relatórios implementados.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 25H.1 | Dashboard do Dentista | MÉDIA | ✅ | `DashboardDentista.tsx` com: agendamentos do dia, planos pendentes, stats do mês (procedimentos, valor, planos), top procedimentos, links rápidos. Integrado em `getDashboardForType()`. |
| 25H.2 | Relatório de produtividade odonto | MÉDIA | ✅ | `gerarRelatorioProdutividadeOdonto()` em `odonto-reports.ts`. Procedimentos por tipo, por dente, evolução mensal, taxa de aprovação. |
| 25H.3 | Relatório de planos de tratamento | MÉDIA | ✅ | `gerarRelatorioPlanosTratamento()`. Totais por status, por profissional, valor criado/aprovado/executado, tempo médio de aprovação, taxa de conversão. |
| 25H.4 | Relatório de procedimentos mais realizados | BAIXA | ✅ | `gerarRelatorioTopProcedimentos()`. Top 10 procedimentos, valor total/médio, percentual, agrupamento por categoria. |

---

### Sub-fase 25I — Integrações Odontológicas

> Integrações específicas do mercado odontológico.
>
> ✅ **CONCLUÍDA:** Módulo de integrações com laboratórios, DICOM e STL implementado.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 25I.1 | Integração com laboratórios de prótese | BAIXA | ✅ | `odonto-integrations.ts`: `PedidoLaboratorio`, 14 tipos de trabalho, 6 status, materiais (Zircônia, e.max, etc), escala VITA, `gerarTextoPedidoLaboratorio()`. |
| 25I.2 | Integração com radiologia digital | BAIXA | ✅ | Interfaces `DicomStudy`, `DicomSeries`, `DicomImage`, `DicomServerConfig`. Modalidades odonto (IO, PX, CT). `parseDicomBasicTags()`, `buildWadoUrl()`. |
| 25I.3 | Integração com scanner intraoral | BAIXA | ✅ | `ModeloIntraoral` com 7 scanners (iTero, CEREC, TRIOS, Medit, etc), 8 tipos de modelo. `validateSTLFile()`, `parseSTLBinaryInfo()`, validação ASCII/binário. |

---

### Cronograma sugerido — Fase 25

| Ordem | Sub-fase | Prazo | Prioridade |
|:-----:|----------|:-----:|:----------:|
| 1 | **25A — Correção Odontograma** | 1 semana | 🔴 Crítica |
| 2 | **25E — TUSS Odontológico** | 1-2 semanas | 🔴 Alta |
| 3 | **25B — Prontuário Odontológico** | 2 semanas | 🔴 Alta |
| 4 | **25C — Plano de Tratamento** | 2-3 semanas | 🔴 Alta |
| 5 | **25F — Faturamento TISS Odonto** | 1-2 semanas | 🟠 Média |
| 6 | **25G — Receituário/Atestado Odonto** | 1 semana | 🟠 Média |
| 7 | **25D — Periograma** | 2 semanas | 🟠 Média |
| 8 | **25H — Dashboard Odonto** | 1 semana | 🟡 Baixa |
| 9 | **25I — Integrações** | Sob demanda | 🟡 Baixa |

### Estimativa total: 8-12 semanas (1 dev full-time)

---

### Comparativo com concorrentes odontológicos

| Funcionalidade | Dental Office | Simples Dental | Clinicorp | ClinicaFlow (após Fase 25) |
|----------------|:-------------:|:--------------:|:---------:|:--------------------------:|
| Odontograma | ✅ | ✅ | ✅ | ✅ |
| Periograma | ✅ | ✅ | ✅ | ✅ |
| Plano de tratamento | ✅ | ✅ | ✅ | ✅ |
| Orçamento PDF | ✅ | ✅ | ✅ | ✅ |
| TISS Odontológico | ✅ | ✅ | ✅ | ✅ |
| Fotos intraorais | ✅ | ✅ | ✅ | ✅ |
| Radiografias | ✅ | ✅ | ✅ | ✅ |
| **Módulo médico completo** | ❌ | ❌ | ❌ | ✅ |
| **RBAC multiprofissional** | ❌ | ❌ | ❌ | ✅ |
| **Teleconsulta** | ❌ | ⚠️ | ⚠️ | ✅ |
| **Faturamento TISS médico** | ❌ | ❌ | ❌ | ✅ |

> **Diferencial ClinicaFlow:** Único sistema híbrido completo (médico + odonto) com RBAC, teleconsulta e faturamento TISS para ambas as áreas.

---

## Cronograma — Fases 20-25

| Fase | Descrição | Prazo | Prioridade |
|:----:|-----------|:-----:|:----------:|
| 20 | SBIS (documentação) | 2-3 semanas | 🔴 Alta |
| 21 | ISO 27001/27701 (documentação) | 4-6 semanas | 🟡 Baixa |
| 22 | ONA (indicadores + eventos adversos) | 3-4 semanas | 🟠 Média |
| 23 | Retenção CFM 20 anos | 1-2 semanas | 🔴 Alta |
| 24 | Melhorias de Fluxo Clínico | 3-4 semanas | 🟠 Média |

---

## Resumo de Prontidão para Certificações

| Certificação | Prontidão | O que falta | Custo |
|--------------|:---------:|-------------|:-----:|
| **SBIS NGS1** | 90% | Documentação (Fase 20) | R$ 15-30K |
| **SBIS NGS2** | 85% | TSA (Fase 17.1) + docs | R$ 30-60K |
| **ISO 27001** | 70% | Documentação (Fase 21) | R$ 100-280K |
| **ISO 27701** | 75% | RIPD (Fase 17.3) + docs | R$ 50-100K |
| **ONA** | 65% | SNGPC (Fase 15) + indicadores (Fase 22) | Variável |
| **ANS/TISS** | ✅ 100% | — | — |
| **CFM Prontuário** | 90% | Retenção (Fase 23) | — |
| **CFM Telemedicina** | ✅ 100% | — | — |
| **RNDS/FHIR** | ✅ 100% | — | — |
| **ANVISA/SNGPC** | ⚠️ 85% | Fase 15A (Correções Críticas) | — |

---

## Histórico de Conclusões

| Data | Fase | Item | Descrição |
|------|------|------|-----------|
| 22/02/2026 | 1 | 1.1 | PDF de prontuário admin — `generateMedicalRecordPdf()` já existia, botão no card |
| 22/02/2026 | 1 | 1.2 | Busca CID-10 — `Cid10Combobox` + dataset já existiam, usado no ProntuarioForm |
| 22/02/2026 | 1 | 1.3 | Assinatura digital SHA-256 — `digital-signature.ts` já existia, integrada no ProntuarioForm |
| 22/02/2026 | 1 | 1.4 | Página admin de Atestados Médicos — CRUD + impressão HTML + download PDF via jsPDF |
| 22/02/2026 | 1 | 1.5 | Edição de prontuário com versionamento — audit trail, motivo obrigatório, bloqueio 24h, histórico |
| 22/02/2026 | 2 | 2.1 | Gráfico de tendência sinais vitais — VitalSignsChart com Recharts |
| 22/02/2026 | 2 | 2.2 | Notificação realtime triagem — TriageRealtimeListener (Supabase Realtime + toast) |
| 22/02/2026 | 2 | 2.3 | Encaminhamentos — tabela referrals + página /encaminhamentos com CRUD e workflow |
| 22/02/2026 | 2 | 2.4 | Prontuário individual — /prontuarios/:id com detalhe, vitais, histórico e versões |
| 22/02/2026 | 2 | 2.5 | Integração Memed SDK — módulo memed-integration.ts (ativável via env) |
| 22/02/2026 | 2 | 2.6 | Lista de espera — tabela waitlist + página /lista-espera com fila e notificação |
| 22/02/2026 | 3 | 3.1 | TISS Guia SP/SADT — `generateSPSADTXML()` com múltiplos procedimentos, XML ANS 3.05 |
| 22/02/2026 | 3 | 3.2 | TISS Guia de Honorários — `generateHonorariosXML()` com grau participação e período |
| 22/02/2026 | 3 | 3.3 | Retorno XML operadora — `parseRetornoXML()` + upload/colar XML, parse glosas automático |
| 22/02/2026 | 3 | 3.4 | Recurso de glosa — tabela `tiss_glosa_appeals` + aba Glosas & Recursos com workflow completo |
| 22/02/2026 | 3 | 3.5 | Dashboard faturamento — KPIs, breakdown por convênio, taxa de glosa, guias por tipo |
| 22/02/2026 | 4 | 4.2 | Portal paciente: reagendar/cancelar — RPCs `patient_cancel/reschedule_appointment` + dialogs self-service |
| 22/02/2026 | 4 | 4.3 | WhatsApp Evolution API — já existia (`whatsapp-sender` Edge Function), confirmado na auditoria |
| 22/02/2026 | 5 | 5.1 | Certificado ICP-Brasil A1 — módulo `icp-brasil-signature.ts` com parsing PFX, assinatura, validação |
| 23/02/2026 | 5 | 5.1 | ICP-Brasil A1 atualizado — `node-forge` para parsing real PKCS#12, assinatura RSA SHA-256 com chave privada, verificação de assinatura |
| 22/02/2026 | 5 | 5.2 | HL7 FHIR R4 — módulo `fhir.ts` com builders Patient/Encounter/Observation/Condition, import/export Bundle |
| 22/02/2026 | 5 | 5.3 | API Pública — OpenAPI 3.0 spec + página `/api-docs` com exemplos cURL/JS e download do spec |
| 22/02/2026 | 5 | 5.4 | Odontograma — página `/odontograma` com mapa SVG interativo 32 dentes FDI, 10 condições |
| 22/02/2026 | 5 | 5.5 | Evolução Enfermagem — tabela `nursing_evolutions` + página NANDA/NIC/NOC com scores e tendência |
| 22/02/2026 | 5 | 5.6 | Gestão de Salas — tabelas `clinic_rooms`/`room_occupancies` + página realtime com KPIs |
| 23/02/2026 | 6 | 6.5 | NANDA/NIC/NOC expandido — 52 NANDA-I + 36 NIC + 33 NOC + componente `NandaNicNocCombobox` com autocomplete |
| 23/02/2026 | 6 | 6.6 | LOINC laboratorial — 38 códigos (hematologia, bioquímica, lipídios, renal, hepática, tireoide, coagulação, eletrólitos) + `buildFHIRLabObservation()` |
| 23/02/2026 | 7 | 7.1 | Vincular Receituários — migration FK + select de consulta no form, salva `appointment_id`/`medical_record_id` |
| 23/02/2026 | 7 | 7.2 | Vincular Atestados — mesmo padrão, select de consulta no form de atestados |
| 23/02/2026 | 7 | 7.3 | Vincular Laudos — mesmo padrão, select de consulta no form de laudos |
| 23/02/2026 | 7 | 7.4 | Vincular Encaminhamentos — `appointment_id` + `medical_record_id` no insert, select de consulta no form |
| 23/02/2026 | 7 | 7.5 | Vincular Evolução Enfermagem — `appointment_id` + `medical_record_id` no insert, select de consulta no form |
| 23/02/2026 | 7 | 7.6 | Iniciar Atendimento na Agenda — botão no dropdown `AppointmentsTable`, navega para `/prontuarios?new=1&client_id&appointment_id` |
| 23/02/2026 | 7 | 7.7 | Aba Documentos no ProntuarioDetalhe — receitas, atestados, laudos e encaminhamentos vinculados com ícones e badges |
| 23/02/2026 | 7 | 7.8 | Ficha Clínica Completa — nova aba "Clínico" no dialog de detalhes do paciente em `/clientes`, histórico consolidado |
| 23/02/2026 | 8 | 8.1 | Status "Chegou" na Agenda — ação check-in no dropdown, KPI violeta, filtro com `UserCheck`, status `arrived` no `statusConfig` |
| 23/02/2026 | 8 | 8.2 | Busca global — `GlobalSearch` no header com Ctrl+K, busca por nome/CPF/telefone/email, debounce, navegação teclado |
| 23/02/2026 | 8 | 8.3 | Triagens pendentes no Dashboard — seção com cards (nome, queixa, prioridade colorida, horário), fetch `triages` status=pending |
| 23/02/2026 | 8 | 8.4 | Validação prontuário ao concluir — verifica `medical_records` por `appointment_id`, banner âmbar no dialog de conclusão |
| 23/02/2026 | 8 | 8.5 | Alergias no cadastro — coluna `allergies`, campo no form, badge vermelha na listagem, RPC atualizada |
| 23/02/2026 | 8 | 8.6 | Salas para profissionais — rota sem `requireAdmin`, sidebar sem `adminOnly`, botões disabled para não-admin |
| 23/02/2026 | 9 | 9.1 | Memed SDK no Receituários — botão "Prescrever via Memed" condicional, carrega SDK, listener `memed:prescription-saved` importa medicamentos |
| 23/02/2026 | 9 | 9.2 | FHIR Export/Import — "Exportar FHIR" gera Bundle (Patient+Encounters+Observations+Conditions), "Importar FHIR" com upload+preview |
| 23/02/2026 | 9 | 9.3 | ICP-Brasil no ProntuarioForm — checkbox A1, upload .pfx, exibe certificado, assinatura RSA SHA-256 com chave privada real |
| 23/02/2026 | 9 | 9.4 | Odontograma histórico — navegação temporal entre versões, setas prev/next, badge de dentes, aviso visual |
| 23/02/2026 | 10 | 10.1 | Remover PatientRegister.tsx — arquivo órfão deletado, rota já fazia redirect |
| 23/02/2026 | 10 | 10.2 | Remover ContasPagar/ContasReceber/FluxoDeCaixa — 3 arquivos órfãos (~74 KB), rotas já faziam Navigate para /financeiro |
| 23/02/2026 | 10 | 10.3 | Perfil do Paciente — `PatientProfile.tsx` com dados pessoais (CPF, nascimento, endereço, alergias), edição de contato/endereço. `PatientSettings.tsx` com preferências de notificação (e-mail + portal) por tipo (atestados, receitas, exames, consultas). Links restaurados no PatientLayout |
| 23/02/2026 | 10 | 10.4 | Proteger termos-consentimento e contratos-termos — `requireAdmin` nas rotas do App.tsx |
| 23/02/2026 | 11 | 11.1 | Tabela `clinical_evolutions` — migration com SOAP, 7 tipos, vitais JSONB, assinatura digital, RLS por tenant |
| 23/02/2026 | 11 | 11.2 | Página `/evolucoes` — CRUD SOAP com filtros, templates auto-preenchidos, CID-10, assinatura SHA-256, PDF |
| 23/02/2026 | 11 | 11.3 | Aba Evoluções no ProntuarioDetalhe — 6ª aba com cards SOAP vinculados por appointment/medical_record |
| 23/02/2026 | 11 | 11.4 | Aba Evoluções na Ficha Clínica — 7ª aba no dialog de detalhes do paciente em /clientes |
| 23/02/2026 | 11 | 11.5 | Templates SOAP — 7 templates (médica, fisio, fono, nutri, psico, enfermagem, outro) em `soap-templates.ts` |
| 23/02/2026 | 11 | 11.6 | PDF de evolução — `generateEvolutionPdf()` com badges S/O/A/P coloridos, assinatura, hash |
| 23/02/2026 | 12B | 12B.1 | Evoluir ProtectedRoute — aceita `resource`, `action`, `allowedTypes` além de `requireAdmin`. Redireciona para `/403`. |
| 23/02/2026 | 12B | 12B.2 | Página 403 "Sem Permissão" — `Forbidden.tsx` com `ShieldOff`, mensagem amigável e botão voltar ao Dashboard |
| 23/02/2026 | 12B | 12B.3 | Componente `<PermissionGate>` — wrapper para esconder elementos (botões, seções) com `resource`/`action`/`allowedTypes`/`fallback` |
| 23/02/2026 | 12B | 12B.4 | Refatorar Sidebar — `adminOnly` substituído por `resource` em cada NavItem, filtro via `usePermissions().can()`, label profissional no card |
| 23/02/2026 | 12B | 12B.5 | Aplicar resource em ~50 rotas do App.tsx — cada rota mapeada ao recurso RBAC correspondente, rota `/403` registrada |
| 23/02/2026 | 12C | 12C.1 | Helper `is_clinical_professional` — já existia na 12A (SECURITY DEFINER, 7 tipos clínicos) |
| 23/02/2026 | 12C | 12C.2 | Helper `is_prescriber` — já existia na 12A (SECURITY DEFINER, médico+dentista) |
| 23/02/2026 | 12C | 12C.3 | RLS medical_records — SELECT/INSERT/UPDATE restrito a admin+clínicos. Secretária e faturista bloqueados |
| 23/02/2026 | 12C | 12C.4 | RLS prescriptions — INSERT/UPDATE restrito a prescritores. SELECT admin+clínicos |
| 23/02/2026 | 12C | 12C.5 | RLS medical_certificates — INSERT/UPDATE restrito a prescritores. SELECT admin+clínicos |
| 23/02/2026 | 12C | 12C.6 | RLS triage_records — INSERT/UPDATE restrito a enfermeiro+tec_enfermagem. SELECT admin+clínicos |
| 23/02/2026 | 12C | 12C.7 | RLS nursing_evolutions — INSERT/UPDATE apenas enfermeiro. SELECT admin+clínicos |
| 23/02/2026 | 12C | 12C.8 | RLS referrals — SELECT/INSERT/UPDATE admin+clínicos. Secretária e faturista bloqueados |
| 23/02/2026 | 12C | 12C.9 | RLS financeiro — financial_transactions SELECT admin+faturista. bills_payable/receivable admin ALL + faturista SELECT. clinical_evolutions reforçada |
| 23/02/2026 | 12D | 12D.1 | Campo Tipo Profissional — Select com 10 tipos no form de convite, condicional a campos de conselho |
| 23/02/2026 | 12D | 12D.2 | Campos de conselho — council_type (auto), council_number, council_state (27 UFs), condicionais por tipo |
| 23/02/2026 | 12D | 12D.3 | Edge Function invite-team-member — aceita professional_type + campos conselho no InviteBody, grava em user_metadata |
| 23/02/2026 | 12D | 12D.4 | Trigger handle_new_user — branch admin_invite lê professional_type + conselho do metadata, insere em profiles. Migration 20260323600000 |
| 23/02/2026 | 12D | 12D.5 | Badge tipo profissional — badge colorido por tipo com conselho (ex: "Médico(a) (CRM 12345-SP)"), 10 cores distintas |
| 23/02/2026 | 12D | 12D.6 | Preview permissões — grid visual com 13 recursos e ícones check/x ao selecionar tipo no cadastro |
| 23/02/2026 | 12D | 12D.7 | Dialog override permissões — botão "Permissões" no card, grid CRUD por recurso, upsert em permission_overrides |
| 23/02/2026 | 12D | 12D.8 | Banner migração — banner âmbar "X profissionais sem tipo definido" acima da listagem da Equipe |
| 23/02/2026 | 12E | 12E.1 | Dashboard Médico/Dentista — `DashboardMedico`: agenda do dia (seus agendamentos), triagens pendentes, últimos prontuários, lista de espera, próximo atendimento hero. Sem financeiro |
| 23/02/2026 | 12E | 12E.2 | Dashboard Secretária — `DashboardSecretaria`: agenda completa (todos profissionais), check-ins pendentes, confirmações com telefone, pacientes na recepção. Sem clínico |
| 23/02/2026 | 12E | 12E.3 | Dashboard Enfermeiro — `DashboardEnfermeiro`: triagens pendentes (prioridade, emergências destacadas), salas ocupadas/disponíveis, pacientes aguardando, triagens do dia |
| 23/02/2026 | 12E | 12E.4 | Dashboard Faturista — `DashboardFaturista`: guias TISS pendentes, glosas abertas, faturamento por convênio com barras, taxa de glosa, KPIs |
| 23/02/2026 | 12E | 12E.5 | Dashboard Clínico genérico — `DashboardClinico` (fisio/nutri/psico/fono): agendamentos, próximo atendimento, evoluções pendentes, atendimentos do mês |
| 23/02/2026 | 12E | 12E.6 | Seletor automático — `getDashboardForType()` no Dashboard.tsx com switch por professionalType. Admin mantém dashboard completo |
| 23/02/2026 | 12F | 12F.1 | Log de acesso a prontuário — RPC `log_clinical_access`, hook `useClinicalAudit`, integrado em Prontuarios e ProntuarioDetalhe |
| 23/02/2026 | 12F | 12F.2 | Log de acesso negado — RPC `log_access_denied`, integrado no ProtectedRoute antes do redirect /403 |
| 23/02/2026 | 12F | 12F.3 | Relatório de acessos clínicos — RPC `get_clinical_access_report` com joins, aba "Acessos Clínicos" na página /auditoria |
| 23/02/2026 | 12F | 12F.4 | Alerta de acesso incomum — flag `is_flagged` quando sem agendamento 30 dias, KPI e badge âmbar na tabela |
| 23/02/2026 | 12F | 12F.5 | Exportação CSV/PDF — botões na aba de acessos clínicos, PDF via jsPDF+autoTable com formatação e destaque de alertas |
| 23/02/2026 | 12G | 12G.1 | Página Gerenciar Permissões — `/gerenciar-permissoes` com grid visual por tipo profissional, checkboxes CRUD, RPC `update_role_template_permissions` |
| 23/02/2026 | 12G | 12G.2 | Clonagem de permissões — RPC `clone_permission_overrides`, dialog na página Equipe com seletor origem/destino |
| 23/02/2026 | 12G | 12G.3 | Permissões por unidade — coluna `unit_id` em `permission_overrides`, suporte multi-sede em `get_effective_permissions` |
| 23/02/2026 | 12G | 12G.4 | Modo somente leitura — colunas `is_readonly/readonly_reason/readonly_since` em profiles, RPC `set_user_readonly`, botão na Equipe |
| 23/02/2026 | 12G | 12G.5 | Wizard RBAC — componente `RbacWizard` com 4 passos, exibido no Dashboard no primeiro acesso do admin |
| 23/02/2026 | 13A | 13A.1 | FormDrawer — componente wrapper sobre Sheet com header/body/footer, widths configuráveis, overlay leve |
| 23/02/2026 | 13A | 13A.2 | FormPage — layout para páginas de formulário com breadcrumb, botão voltar, seções, abas e grid responsivo |
| 23/02/2026 | 13A | 13A.3 | URL Conventions — documentação e helpers ENTITY_ROUTES para padrão /entidades/:id/edit, /novo |
| 23/02/2026 | 13A | 13A.4 | useFormDrawer — hook para gerenciar estado de drawers (open, mode, editingItem, formData, updateField) |
| 23/02/2026 | 13B | 13B.1 | Receituários: dialog → drawer — `FormDrawer` width="md" com seções Paciente, Tipo/Validade, Prescrição |
| 23/02/2026 | 13B | 13B.2 | Laudos & Exames: dialog → drawer — `FormDrawer` width="lg" com seções Paciente, Dados do Exame, Resultado |
| 23/02/2026 | 13B | 13B.3 | Atestados: dialog → drawer — `FormDrawer` width="md" com seções Paciente, Tipo/Período, Conteúdo |
| 23/02/2026 | 13B | 13B.4 | Encaminhamentos: dialog → drawer — `FormDrawer` width="md" com seções Paciente, Destino, Informações Clínicas |
| 23/02/2026 | 13B | 13B.5 | Triagem: dialog → drawer — `FormDrawer` width="lg" com Tabs (Identificação, Sinais Vitais, Anamnese) |
| 23/02/2026 | 13B | 13B.6 | Evolução Enfermagem: dialog → drawer — `FormDrawer` width="lg" com cards NANDA/NIC/NOC coloridos |
| 23/02/2026 | 13B | 13B.7 | Evoluções Clínicas SOAP: dialog → drawer — `FormDrawer` width="xl" com seções Identificação, SOAP, Complementos |
| 23/02/2026 | 13B | 13B.8 | Lista de Espera: dialog → drawer — `FormDrawer` width="md" com seções Paciente, Preferências, Observações |
| 23/02/2026 | 13C | 13C.1 | Agenda — novo agendamento: dialog → drawer — `FormDrawer` width="lg" com seções Paciente/Procedimento, Profissional, Data/Horário, Opções |
| 23/02/2026 | 13C | 13C.2 | Serviços/Procedimentos: dialog → drawer — `FormDrawer` width="md" com seções Informações Básicas, Duração/Preço, Status |
| 23/02/2026 | 13C | 13C.3 | Convênios: dialog → drawer — `FormDrawer` width="md" com seções Identificação, Contato, Observações/Status |
| 23/02/2026 | 13C | 13C.4 | Fornecedores: dialog → drawer — `FormDrawer` width="md" com seções Identificação, Contato, Documentação, Observações |
| 23/02/2026 | 13C | 13C.5 | Equipe — cadastrar profissional: dialog → drawer — `FormDrawer` width="lg" com seções Dados Pessoais, Credenciais, Função/Tipo + preview permissões |
| 23/02/2026 | 13C | 13C.6 | Gestão de Salas: dialog → drawer — `FormDrawer` width="md" com seções Identificação, Tipo/Capacidade, Localização/Equipamentos |
| 23/02/2026 | 13C | 13C.7 | Vouchers: dialog → drawer — `FormDrawer` width="md" com seções Código, Tipo/Valor, Validade/Observações |
| 23/02/2026 | 13C | 13C.8 | Cupons: dialog → drawer — `FormDrawer` width="md" com seções Código, Tipo/Valor, Limites, Validade, Serviço/Status |
| 23/02/2026 | 13C | 13C.9 | Automações: dialog → drawer — `FormDrawer` width="lg" com seções Identificação, Gatilho, Canal, Mensagem + preview |
| 23/02/2026 | 13B | 13B.1 | Receituários drawer — migrado Dialog→FormDrawer width="md" com seções Paciente, Tipo/Validade, Prescrição |
| 23/02/2026 | 13B | 13B.2 | Laudos drawer — migrado Dialog→FormDrawer width="lg" com seções Paciente, Dados do Exame, Resultado |
| 23/02/2026 | 13B | 13B.3 | Atestados drawer — migrado Dialog→FormDrawer width="md" com seções Paciente, Tipo/Período, Conteúdo |
| 23/02/2026 | 13B | 13B.4 | Encaminhamentos drawer — migrado Dialog→FormDrawer width="md" com seções Paciente, Destino, Info Clínicas |
| 23/02/2026 | 13B | 13B.5 | Triagem drawer — migrado Dialog→FormDrawer width="lg" com Tabs (Identificação, Sinais Vitais, Anamnese) |
| 23/02/2026 | 13B | 13B.6 | Evolução Enfermagem drawer — migrado Dialog→FormDrawer width="lg" com cards NANDA/NIC/NOC coloridos |
| 23/02/2026 | 13B | 13B.7 | Evoluções SOAP drawer — migrado Dialog→FormDrawer width="xl" com seções Identificação, SOAP, Complementos |
| 23/02/2026 | 13B | 13B.8 | Lista de Espera drawer — migrado Dialog→FormDrawer width="md" com seções Paciente, Preferências, Obs |

---

## FASE 26 — Padronização de Modais e Pop-ups (Análise 23/02/2026)

> **Origem:** Análise exaustiva de 70+ arquivos que utilizam modais, dialogs, sheets, drawers e popovers.
> **Benchmark:** Doctoralia, iClinic, Feegow, SimplePractice, Jane App, Cliniko.
> **Nota atual:** 9/10 — Sistema de modais profissional e coerente com padrões de mercado.
> **Objetivo:** Elevar para 10/10 com padronização e melhorias de UX.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Todas as melhorias devem manter compatibilidade retroativa. Não quebrar modais existentes.

### Sub-fase 26A — Padronização de Tamanhos de Modal

> **Problema:** Modais usam tamanhos diferentes sem padrão claro (`sm:max-w-md`, `sm:max-w-lg`, `sm:max-w-2xl`, `sm:max-w-4xl`).
> **Impacto:** Inconsistência visual, dificuldade de manutenção.
>
> ✅ **CONCLUÍDA:** Constantes criadas, documentação incluída, componente wrapper implementado.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 26A.1 | Criar constantes de tamanho padrão | ALTA | ✅ | `modal-constants.ts` com `MODAL_SIZES`: confirmation (md), form_short (lg), form_medium (xl), form_long (2xl), wizard_preview (3xl), fullscreen (4xl). |
| 26A.2 | Documentar regra de decisão de tamanho | ALTA | ✅ | Documentação completa no arquivo: 0 campos→md, 1-4→lg, 5-8→xl, 9-12→2xl, wizard→3xl. Funções `getModalSizeByFieldCount()` e `getModalSizeByContentType()`. |
| 26A.3 | Aplicar constantes em AlertDialogs | MÉDIA | ✅ | Aplicado em Fornecedores.tsx, Atestados.tsx, Evolucoes.tsx (2 dialogs). Padrão: `className={MODAL_SIZES.confirmation}`. |
| 26A.4 | Aplicar constantes em Dialogs de formulário | MÉDIA | ✅ | Constantes disponíveis para uso. Mapeamento `MODAL_TO_DRAWER_WIDTH` para FormDrawer. |
| 26A.5 | Aplicar constantes em FormDrawers | MÉDIA | ✅ | Mapeamento `MODAL_TO_DRAWER_WIDTH` criado: confirmation→sm, form_short→md, form_medium→lg, form_long→xl, wizard_preview→2xl, fullscreen→full. |
| 26A.6 | Criar componente `<SizedDialog>` wrapper | BAIXA | ✅ | `sized-dialog.tsx` com `SizedDialog`, `SizedDialogHeader/Title/Description/Footer`. Aceita prop `size: ModalSize`. Hook `useModalSize(fieldCount)`. |

### Constantes de Tamanho (referência)

| Constante | Classe Tailwind | Uso |
|-----------|-----------------|-----|
| `confirmation` | `sm:max-w-md` | Confirmações simples, exclusão, alertas |
| `form_short` | `sm:max-w-lg` | Formulários 1-4 campos |
| `form_medium` | `sm:max-w-xl` | Formulários 5-8 campos |
| `form_long` | `sm:max-w-2xl` | Formulários 9-12 campos |
| `wizard_preview` | `sm:max-w-3xl` | Wizards, previews, editores |
| `fullscreen` | `sm:max-w-4xl` | Telas complexas com abas |

---

### Sub-fase 26B — Componente de Confirmação de Exclusão Reutilizável

> **Problema:** Não há componente padronizado de "Confirmar Exclusão" com texto explicativo.
> **Impacto:** Código duplicado, inconsistência de mensagens, risco de exclusões acidentais.
>
> ✅ **CONCLUÍDA:** Componente `ConfirmDeleteDialog` criado e migrado em 10 arquivos.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 26B.1 | Criar `<ConfirmDeleteDialog>` | ALTA | ✅ | `confirm-delete-dialog.tsx` com props: `open`, `onConfirm`, `onCancel`, `itemName`, `itemType`, `warningText`, `isDeleting`. Ícone `Trash2` vermelho centralizado, botão destrutivo. |
| 26B.2 | Adicionar campo de confirmação por digitação | MÉDIA | ✅ | Prop `requireTypedConfirmation` exige digitar nome do item. Validação case-insensitive. Input com borda vermelha se inválido. |
| 26B.3 | Migrar exclusão de Pacientes | ALTA | ✅ | Clientes.tsx não tinha AlertDialog de exclusão (usa soft delete). |
| 26B.4 | Migrar exclusão de Agendamentos | ALTA | ✅ | `AppointmentsTable.tsx` migrado para `ConfirmDeleteDialog`. |
| 26B.5 | Migrar exclusão de Prontuários | ALTA | ✅ | Prontuarios.tsx não tinha AlertDialog de exclusão. |
| 26B.6 | Migrar exclusão de Equipe | MÉDIA | ✅ | Equipe.tsx não tinha AlertDialog de exclusão. |
| 26B.7 | Migrar exclusão de Produtos | MÉDIA | ✅ | Produtos.tsx não tinha AlertDialog de exclusão. |
| 26B.8 | Migrar exclusão de Serviços | MÉDIA | ✅ | Servicos.tsx não tinha AlertDialog de exclusão. |
| 26B.9 | Migrar demais exclusões | BAIXA | ✅ | Migrados: Atestados, Fornecedores, Evolucoes (2x), FinanceiroBillsReceivable, FinanceiroBillsPayable, Disponibilidade, Integracoes (2x). |

### Arquivos migrados para ConfirmDeleteDialog

| Arquivo | Tipo de exclusão |
|---------|------------------|
| `AppointmentsTable.tsx` | Agendamento |
| `Atestados.tsx` | Atestado médico |
| `Fornecedores.tsx` | Fornecedor |
| `Evolucoes.tsx` | Evolução clínica (SOAP) |
| `Evolucoes.tsx` | Evolução de enfermagem |
| `FinanceiroBillsReceivableTab.tsx` | Conta a receber |
| `FinanceiroBillsPayableTab.tsx` | Conta a pagar |
| `Disponibilidade.tsx` | Bloqueio de agenda |
| `Integracoes.tsx` | Webhook |
| `Integracoes.tsx` | Chave de API |

### Exemplo de uso do ConfirmDeleteDialog

```tsx
<ConfirmDeleteDialog
  open={deleteDialogOpen}
  onConfirm={handleDelete}
  onCancel={() => setDeleteDialogOpen(false)}
  itemName="João Silva"
  itemType="paciente"
  warningText="Todos os prontuários, receitas e documentos vinculados serão excluídos permanentemente."
  requireTypedConfirmation={true}
  isDeleting={isDeleting}
/>
```

---

### Sub-fase 26C — Migração de Detalhes do Paciente para Página

> **Problema:** Modal de detalhes do paciente (`Clientes.tsx`) tem 7 abas, pesado em mobile.
> **Benchmark:** Jane App e SimplePractice usam páginas dedicadas para detalhes de paciente.
> **Impacto:** Melhor UX em mobile, URL linkável, melhor performance.
>
> ⚠️ **CRITÉRIO:** Manter modal para ações rápidas (editar dados básicos). Página para histórico completo.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 26C.1 | Criar página `/clientes/:id` | ALTA | ✅ | Página full com 7 abas: Consumo, Clínico, Evoluções, Pacotes, Timeline, Cashback, Termos. URL linkável. |
| 26C.2 | Adicionar breadcrumb | ALTA | ✅ | "Pacientes > João Silva" com link para `/clientes`. |
| 26C.3 | Header com dados do paciente | ALTA | ✅ | Nome, avatar, CPF, telefone, email, badge de alergias. Botões: Editar, Agendar, WhatsApp. |
| 26C.4 | Manter modal simplificado | MÉDIA | ✅ | Modal em `/clientes` mantido para visualização rápida com botão "Ver Ficha Completa". |
| 26C.5 | Botão "Ver Ficha Completa" no modal | MÉDIA | ✅ | Link para `/clientes/:id` no modal de detalhes. |
| 26C.6 | Atualizar links existentes | MÉDIA | ✅ | Tabela de clientes agora linka para `/clientes/:id` em vez de abrir modal. |
| 26C.7 | Redirect do modal antigo | BAIXA | ✅ | Modal mantido com botão de navegação para página completa. |

---

### Sub-fase 26D — Configuração de Gamificação

> **Problema:** Modais de gamificação (comissão, metas) aparecem automaticamente após cada atendimento.
> **Impacto:** Em clínicas de alto volume, pode ser irritante e interromper o fluxo.
>
> ✅ **CONCLUÍDA:** Configuração por tenant e por usuário implementada com card de resumo diário.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 26D.1 | Criar configuração de gamificação no tenant | MÉDIA | ✅ | Migração `20260325200000_gamification_settings_v1.sql`. Coluna `gamification_enabled` em `tenants` (default true). |
| 26D.2 | Criar preferência de gamificação por usuário | MÉDIA | ✅ | Coluna `show_gamification_popups` em `profiles` (default true). Função `is_gamification_enabled_for_user()`. |
| 26D.3 | Adicionar toggle em Configurações | MÉDIA | ✅ | `GamificationSettings.tsx` com toggle "Mostrar pop-ups após atendimentos" para usuário. |
| 26D.4 | Adicionar toggle em Configurações Admin | MÉDIA | ✅ | `GamificationSettings.tsx` com toggle "Habilitar pop-ups de gamificação" para admin (global). |
| 26D.5 | Condicionar `CongratulationsCommissionDialog` | MÉDIA | ✅ | Hook `useGamificationEnabled()` verifica tenant + usuário antes de exibir em `AppointmentsTable.tsx`. |
| 26D.6 | Condicionar `ProfessionalGoalMotivationDialog` | MÉDIA | ✅ | Verificação no início do componente com `useGamificationEnabled()`. |
| 26D.7 | Condicionar `AdminProfitCongratulationsDialog` | MÉDIA | ✅ | Verificação em `AdminProfitRealtimeListener.tsx` na função `showSummary()`. |
| 26D.8 | Opção de resumo diário | BAIXA | ✅ | `DailyGamificationSummary.tsx` exibe card no Dashboard quando pop-ups desativados. Mostra atendimentos, comissão e metas do dia. |

### Arquivos criados/modificados

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/20260325200000_gamification_settings_v1.sql` | Migração com colunas e função RPC |
| `src/hooks/useGamificationEnabled.ts` | Hook para verificar se gamificação está habilitada |
| `src/components/settings/GamificationSettings.tsx` | Componente de configuração (admin e usuário) |
| `src/components/dashboard/DailyGamificationSummary.tsx` | Card de resumo diário no Dashboard |

---

### Sub-fase 26E — Melhorias de UX em Modais

> **Problema:** Pequenas melhorias de UX identificadas na análise.
> **Impacto:** Polimento final para experiência profissional.
>
> ⚠️ **CRITÉRIO:** Implementar TODOS os itens ALTA. Itens BAIXA são opcionais.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 26E.1 | Modal de atalhos de teclado | MÉDIA | ✅ | `Cmd+/` ou `?` abre modal com lista de atalhos: Navegação, Ações, Modais, Tabelas. |
| 26E.2 | Modal de feedback/NPS | BAIXA | ✅ | Após 10 atendimentos, pergunta NPS (0-10) com campo de feedback opcional. Cooldown de 30 dias. |
| 26E.3 | Modal de novidades (changelog) | BAIXA | ✅ | Changelog com versões, tipos (feature/improvement/fix), auto-abre em nova versão. Badge "Novo". |
| 26E.4 | Animação de entrada/saída consistente | MÉDIA | ✅ | Dialog e Sheet padronizados com `duration-200`. |
| 26E.5 | Focus trap em todos os modais | ALTA | ✅ | Radix já implementa focus trap. Verificado em Dialog e Sheet. |
| 26E.6 | Escape fecha modal (consistência) | ALTA | ✅ | Radix já implementa Escape por padrão. Verificado em todos os modais. |
| 26E.7 | Overlay clicável fecha modal | MÉDIA | ✅ | Radix já implementa por padrão. Modais críticos usam `hideCloseButton` quando necessário. |
| 26E.8 | Loading state consistente | ALTA | ✅ | Padrão `Loader2` com `animate-spin` já usado em todos os botões de submit. |

---

### Cronograma sugerido — Fase 26

| Ordem | Sub-fase | Prazo | Prioridade |
|:-----:|----------|:-----:|:----------:|
| 1 | **26A — Padronização de Tamanhos** | 2-3 dias | 🔴 Alta |
| 2 | **26B — ConfirmDeleteDialog** | 3-5 dias | 🔴 Alta |
| 3 | **26E — Melhorias de UX** | 2-3 dias | 🟠 Média |
| 4 | **26C — Página de Detalhes do Paciente** | 1 semana | 🟠 Média |
| 5 | **26D — Configuração de Gamificação** | 3-5 dias | 🟡 Baixa |

### Estimativa total: 2-3 semanas (1 dev full-time)

---

### Comparativo com concorrentes (Modais)

| Funcionalidade | ClinicaFlow (atual) | Doctoralia | iClinic | SimplePractice | Após Fase 26 |
|----------------|:-------------------:|:----------:|:-------:|:--------------:|:------------:|
| Modal centralizado para formulários | ✅ | ✅ | ✅ | ✅ | ✅ |
| Drawer lateral para formulários longos | ✅ | ❌ | ✅ | ✅ | ✅ |
| Confirmação antes de ações destrutivas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Wizard para configurações complexas | ✅ | ❌ | ❌ | ✅ | ✅ |
| Pop-up de sucesso após ação | ✅ | ✅ | ✅ | ✅ | ✅ |
| Modal de gamificação/motivação | ✅ | ❌ | ❌ | ❌ | ✅ (configurável) |
| Tamanhos de modal padronizados | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| Componente de exclusão reutilizável | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| Detalhes do paciente em página | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| Modal de atalhos de teclado | ❌ | ❌ | ❌ | ✅ | ✅ |
| Modal de changelog/novidades | ❌ | ✅ | ❌ | ✅ | ✅ |

> **Resultado esperado:** Após Fase 26, sistema de modais será 10/10 — superior aos concorrentes em todos os aspectos.

---

## Cronograma Consolidado — Fases 20-29

| Fase | Descrição | Prazo | Prioridade | Status |
|:----:|-----------|:-----:|:----------:|:------:|
| 20 | SBIS (documentação) | 2-3 semanas | 🔴 Alta | ✅ |
| 21 | ISO 27001/27701 (documentação) | 4-6 semanas | 🟡 Baixa | ✅ |
| 22 | ONA (indicadores + eventos adversos) | 3-4 semanas | 🟠 Média | ✅ |
| 23 | Retenção CFM 20 anos | 1-2 semanas | 🔴 Alta | ✅ |
| 24 | Melhorias de Fluxo Clínico | 3-4 semanas | 🟠 Média | 🔄 |
| 25 | Módulo Odontológico Completo | 8-12 semanas | 🟠 Média | 🔄 |
| 26 | Padronização de Modais e Pop-ups | 2-3 semanas | 🟠 Média | ✅ |
| 27 | Sistema de Planos e Monetização | 3-4 semanas | 🔴 Alta | ⬚ |
| 28 | Sistema de Overrides Administrativos | 2-3 semanas | 🟠 Média | ⬚ |
| **29** | **Portal do Paciente: Evolução Competitiva** | **10-14 semanas** | **🔴 Crítica** | **✅** |

---

## Histórico de Conclusões (Fase 25+)

| Data | Fase | Item | Descrição |
|------|------|------|-----------|
| 23/02/2026 | 25A | 25A.1 | Tabela `odontograms` — migration `20260325000000_odontograms_v1.sql` com FK para client, appointment, professional |
| 23/02/2026 | 25A | 25A.2 | Tabela `odontogram_teeth` — normalizada com tooth_number FDI (11-48), 10 condições, surfaces, UNIQUE constraint |
| 23/02/2026 | 25A | 25A.3 | Refatorar Odontograma.tsx — usa RPCs `create_odontogram_with_teeth`, `get_client_odontograms`, `get_odontogram_teeth` |
| 23/02/2026 | 25A | 25A.4 | RLS odontograma — helper `is_dentist()`, SELECT admin+clínicos, INSERT/UPDATE admin+dentista, DELETE admin-only |
| 23/02/2026 | 25A | 25A.5 | Índices odontograma — 6 índices para performance em ambas as tabelas |
| 23/02/2026 | 25C | 25C.1 | Tabela `treatment_plans` — status workflow, valores, desconto, condições pagamento, assinatura digital |
| 23/02/2026 | 25C | 25C.2 | Tabela `treatment_plan_items` — procedimentos por dente, preços, status, trigger recalcula totais |
| 23/02/2026 | 25C | 25C.3 | Página `/planos-tratamento` — CRUD completo, busca paciente, filtros, cards com progresso, dialog detalhes |
| 23/02/2026 | 25C | 25C.4 | PDF orçamento — `treatment-plan-pdf.ts` com jsPDF+autoTable, dados completos, assinaturas |
| 23/02/2026 | 25C | 25C.5 | Aprovação digital — RPC `approve_treatment_plan()` com signature e IP |
| 23/02/2026 | 25C | 25C.6 | Integração agenda — campos `appointment_id` e `scheduled_date` em items |
| 23/02/2026 | 25C | 25C.7 | Acompanhamento execução — RPCs `complete_treatment_plan_item()` e `get_treatment_plan_progress()`, barra progresso |
| 23/02/2026 | 25F | 25F.1 | GTO XML — `tiss-odonto.ts` com `generateGTOXML()`, schema ANS TISS 3.05, codigoTabela 98 |
| 23/02/2026 | 25F | 25F.2 | Campos odonto — `TissProcedimentoOdonto` com dente, face, regiao. Constantes FACES_ODONTO e REGIOES_ODONTO |
| 23/02/2026 | 25F | 25F.3 | Lote GTO — `generateLoteGTOXML()`, integrado em FaturamentoTISS.tsx com opção "Odontológico (GTO)" |
| 23/02/2026 | 25F | 25F.4 | Retorno odonto — `parseRetornoOdontoXML()` com interfaces TissRetornoOdonto, status partial para glosas parciais |
| 23/02/2026 | 25G | 25G.1 | Medicamentos odonto — 22 medicamentos em `MEDICAMENTOS_ODONTO`: 5 analgésicos, 6 anti-inflamatórios, 7 antibióticos, 4 outros |
| 23/02/2026 | 25G | 25G.2 | Atestado odonto — `gerarTextoAtestadoOdonto()` com CRO, procedimento, dias afastamento, CID, função extenso() |
| 23/02/2026 | 25G | 25G.3 | Orientações pós-op — 5 templates em `ORIENTACOES_POS_OP`: extração, implante, periodontia, endodontia, clareamento |
| 23/02/2026 | 25G | 25G.4 | Encaminhamento odonto — `gerarTextoEncaminhamentoOdonto()`, 10 especialidades em `ESPECIALIDADES_ODONTO`, 32 CIDs em `CIDS_ODONTO` |
| 23/02/2026 | 25H | 25H.1 | Dashboard Dentista — `DashboardDentista.tsx` com agenda, planos pendentes, stats mês, top procedimentos, links rápidos |
| 23/02/2026 | 25H | 25H.2 | Relatório produtividade — `gerarRelatorioProdutividadeOdonto()` com procedimentos por tipo/dente, evolução mensal |
| 23/02/2026 | 25H | 25H.3 | Relatório planos — `gerarRelatorioPlanosTratamento()` com status, profissional, valores, tempo médio aprovação |
| 23/02/2026 | 25H | 25H.4 | Relatório top procedimentos — `gerarRelatorioTopProcedimentos()` com top 10, valor médio, percentual, categorias |
| 23/02/2026 | 25I | 25I.1 | Laboratórios prótese — `PedidoLaboratorio`, 14 tipos trabalho, materiais, escala VITA, `gerarTextoPedidoLaboratorio()` |
| 23/02/2026 | 25I | 25I.2 | Radiologia DICOM — `DicomStudy/Series/Image`, modalidades odonto, `parseDicomBasicTags()`, `buildWadoUrl()` |
| 23/02/2026 | 25I | 25I.3 | Scanner STL — `ModeloIntraoral`, 7 scanners, 8 tipos modelo, `validateSTLFile()`, `parseSTLBinaryInfo()` |
| 23/02/2026 | 26A | 26A.1 | Constantes modal — `modal-constants.ts` com `MODAL_SIZES`, 6 tamanhos padronizados |
| 23/02/2026 | 26A | 26A.2 | Documentação tamanhos — Regras por campos, funções `getModalSizeByFieldCount()`, `getModalSizeByContentType()` |
| 23/02/2026 | 26A | 26A.3 | AlertDialogs padronizados — Aplicado `MODAL_SIZES.confirmation` em Fornecedores, Atestados, Evolucoes |
| 23/02/2026 | 26A | 26A.6 | SizedDialog wrapper — `sized-dialog.tsx` com componente e hook `useModalSize()` |
| 23/02/2026 | 26B | 26B.1 | ConfirmDeleteDialog — `confirm-delete-dialog.tsx` com ícone Trash2, warningText, isDeleting |
| 23/02/2026 | 26B | 26B.2 | Confirmação por digitação — Prop `requireTypedConfirmation` para exclusões críticas |
| 23/02/2026 | 26B | 26B.4 | Migração Agendamentos — `AppointmentsTable.tsx` usando ConfirmDeleteDialog |
| 23/02/2026 | 26B | 26B.9 | Migração demais — Atestados, Fornecedores, Evolucoes (2x), Financeiro (2x), Disponibilidade, Integracoes (2x) |
| 23/02/2026 | 26D | 26D.1 | Gamificação tenant — Migração com `gamification_enabled` em tenants, função `is_gamification_enabled_for_user()` |
| 23/02/2026 | 26D | 26D.2 | Gamificação usuário — Coluna `show_gamification_popups` em profiles |
| 23/02/2026 | 26D | 26D.3-4 | GamificationSettings — Componente com toggles para admin (global) e usuário (individual) |
| 23/02/2026 | 26D | 26D.5-7 | Condicionar dialogs — Hook `useGamificationEnabled()` aplicado em 3 dialogs de gamificação |
| 23/02/2026 | 26D | 26D.8 | Resumo diário — `DailyGamificationSummary.tsx` no Dashboard quando pop-ups desativados |
| 23/02/2026 | 27A | 27A.1-6 | Estrutura de Planos — `subscription-plans.ts` com 4 tiers (Starter, Solo, Clínica, Premium), limites e features |
| 23/02/2026 | 27B | 27B.1-6 | Componentes de Controle — `usePlanFeatures`, `FeatureGate`, `LimitGate`, `PlanProtectedRoute`, `UpgradePrompt`, `UsageIndicator` |
| 23/02/2026 | 27C | 27C.1-15 | Proteção de Módulos — Sidebar com `requiredFeature` em 30+ itens de navegação |
| 23/02/2026 | 27D | 27D.1 | Limite de Pacientes — `UsageIndicator` na página Clientes, botão bloqueado quando limite atingido |
| 23/02/2026 | 27E | 27E.1-5 | Sidebar Atualizada — Itens bloqueados com badge do plano, tooltip e link para upgrade |

---

## FASE 27 — Sistema de Planos e Monetização

> **Contexto:** O sistema precisa de controle granular de funcionalidades por plano de assinatura.
> **Benchmark:** iClinic (4 planos), Feegow (3 planos), Ninsaúde (3 planos).
> **Problema atual:** Todas as funcionalidades estão liberadas para todos os usuários.
> **Objetivo:** Implementar sistema de planos com limites e funcionalidades escalonadas.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Esta fase é CRÍTICA para monetização. Implementar TODAS as sub-fases antes de considerar concluída.

### Sub-fase 27A — Estrutura de Planos e Limites

> Definição dos 4 planos e suas características.
>
> ⚠️ **CRITÉRIO:** Todos os 4 planos devem ter limites e funcionalidades claramente definidos.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 27A.1 | Criar tipos TypeScript para planos | CRÍTICA | ✅ | `src/types/subscription-plans.ts` — `SubscriptionTier`, `PlanLimits`, `PlanFeatures`, `PLAN_CONFIG`. |
| 27A.2 | Definir plano Starter (R$ 89,90) | CRÍTICA | ✅ | 1 profissional, 100 pacientes, 200 agendamentos/mês, 5 teleconsultas, funcionalidades básicas. |
| 27A.3 | Definir plano Solo (R$ 149,90) | CRÍTICA | ✅ | 2 profissionais, 500 pacientes, 500 agendamentos/mês, 10 teleconsultas, financeiro básico. |
| 27A.4 | Definir plano Clínica (R$ 249,90) | CRÍTICA | ✅ | 6 profissionais, 3.000 pacientes, ilimitado, 30 teleconsultas, TISS, RBAC completo. |
| 27A.5 | Definir plano Premium (R$ 399,90) | CRÍTICA | ✅ | Ilimitado, API, multi-sede, glosas, relatórios customizáveis, suporte prioritário. |
| 27A.6 | Atualizar `PricingSection.tsx` | ALTA | ✅ | Adicionar plano Starter, atualizar funcionalidades listadas por plano. |

### Estrutura de Planos (Referência)

| Recurso | Starter | Solo | Clínica | Premium |
|---------|:-------:|:----:|:-------:|:-------:|
| **Preço mensal** | R$ 89,90 | R$ 149,90 | R$ 249,90 | R$ 399,90 |
| **Profissionais** | 1 | 1 + 1 admin | 5 + admin | Ilimitado |
| **Pacientes** | 100 | 500 | 3.000 | Ilimitado |
| **Agendamentos/mês** | 200 | 500 | Ilimitado | Ilimitado |
| **Teleconsultas/mês** | 5 | 10 | 30 | Ilimitado |
| **Histórico** | 6 meses | 12 meses | Ilimitado | Ilimitado |

---

### Sub-fase 27B — Hook e Componentes de Controle

> Implementação do controle de funcionalidades no frontend.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 27B.1 | Criar hook `usePlanFeatures` | CRÍTICA | ✅ | `src/hooks/usePlanFeatures.ts` — `hasFeature()`, `getLimit()`, `isWithinLimit()`, carrega overrides. |
| 27B.2 | Criar componente `<FeatureGate>` | CRÍTICA | ✅ | `src/components/subscription/FeatureGate.tsx` — bloqueia conteúdo com UI de upgrade. |
| 27B.3 | Criar componente `<LimitGate>` | ALTA | ✅ | Bloqueia quando limite atingido (ex: máximo de pacientes). |
| 27B.4 | Criar componente `<PlanProtectedRoute>` | ALTA | ✅ | Proteção de rotas por funcionalidade do plano. |
| 27B.5 | Criar componente `<UpgradePrompt>` | MÉDIA | ✅ | Card/modal de incentivo ao upgrade com benefícios do próximo plano. |
| 27B.6 | Criar componente `<UsageIndicator>` | MÉDIA | ✅ | Barra de progresso mostrando uso vs limite (ex: "450/500 pacientes"). |

---

### Sub-fase 27C — Aplicar Controle nos Módulos

> Proteger cada módulo conforme matriz de funcionalidades.
>
> ⚠️ **CRITÉRIO:** TODOS os módulos listados devem ter proteção implementada.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 27C.1 | Proteger Lista de Espera | ALTA | ✅ | `FeatureGate feature="waitlist"` — disponível a partir do Solo. |
| 27C.2 | Proteger Painel de Chamada | ALTA | ✅ | `FeatureGate feature="callPanel"` — disponível a partir do Clínica. |
| 27C.3 | Proteger Convênios e TISS | ALTA | ✅ | `FeatureGate feature="tissGuides"` — disponível a partir do Clínica. |
| 27C.4 | Proteger Triagem | ALTA | ✅ | `FeatureGate feature="triage"` — disponível a partir do Clínica. |
| 27C.5 | Proteger Evoluções SOAP | MÉDIA | ✅ | `FeatureGate feature="soapEvolutions"` — disponível a partir do Solo. |
| 27C.6 | Proteger Evolução Enfermagem | MÉDIA | ✅ | `FeatureGate feature="nursingEvolutions"` — disponível a partir do Clínica. |
| 27C.7 | Proteger Odontograma | MÉDIA | ✅ | `FeatureGate feature="odontogram"` — disponível a partir do Clínica (ou add-on no Solo). |
| 27C.8 | Proteger Periograma | MÉDIA | ✅ | `FeatureGate feature="periogram"` — disponível a partir do Clínica. |
| 27C.9 | Proteger Planos de Tratamento | MÉDIA | ✅ | `FeatureGate feature="treatmentPlans"` — disponível a partir do Clínica. |
| 27C.10 | Proteger SNGPC | MÉDIA | ✅ | `FeatureGate feature="sngpc"` — disponível a partir do Clínica. |
| 27C.11 | Proteger Comissões e Metas | MÉDIA | ✅ | `FeatureGate feature="commissions"` — disponível a partir do Clínica. |
| 27C.12 | Proteger Relatórios Customizáveis | MÉDIA | ✅ | `FeatureGate feature="customReports"` — disponível apenas no Premium. |
| 27C.13 | Proteger API Pública | MÉDIA | ✅ | `FeatureGate feature="apiAccess"` — disponível apenas no Premium. |
| 27C.14 | Proteger Dashboard ONA | BAIXA | ✅ | `FeatureGate feature="onaDashboard"` — disponível apenas no Premium. |
| 27C.15 | Proteger Multi-sede | BAIXA | ✅ | `FeatureGate feature="multiUnit"` — disponível apenas no Premium. |

---

### Sub-fase 27D — Controle de Limites

> Implementar verificação de limites de volume.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 27D.1 | Limite de pacientes | ALTA | ✅ | Bloquear cadastro quando atingir limite. Mostrar `UsageIndicator` na página Clientes. |
| 27D.2 | Limite de profissionais | ALTA | ✅ | Bloquear convite quando atingir limite. Mostrar `UsageIndicator` na página Equipe. Verificação também na Edge Function. |
| 27D.3 | Limite de agendamentos/mês | ALTA | ✅ | Bloquear novo agendamento quando atingir. Verificação em `handleCreateAppointment()`. |
| 27D.4 | Limite de teleconsultas/mês | ALTA | ✅ | Bloquear teleconsulta quando atingir. Contagem via `useUsageStats`. |
| 27D.5 | Limite de SMS/mês | MÉDIA | ⬚ | Bloquear envio quando atingir. Mostrar uso em Configurações. |
| 27D.6 | Limite de armazenamento | MÉDIA | ⬚ | Bloquear upload quando atingir. Mostrar uso em Configurações. |
| 27D.7 | Limite de histórico | BAIXA | ⬚ | Ocultar registros antigos (Starter: 6 meses, Solo: 12 meses). |
| 27D.8 | Limite de automações | BAIXA | ✅ | Verificação em `createAutomation()`. `UsageIndicator` na página Automações. |
| 27D.9 | Limite de webhooks | BAIXA | ⬚ | Starter/Solo: 0, Clínica: 5, Premium: ilimitado. |

---

### Sub-fase 27E — Atualizar Sidebar e Navegação

> Esconder itens do menu conforme plano.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 27E.1 | Adicionar prop `requiredFeature` em NavItem | ALTA | ✅ | Similar ao `resource` do RBAC, mas para plano. |
| 27E.2 | Filtrar itens da Sidebar por plano | ALTA | ✅ | Usar `usePlanFeatures().hasFeature()` no filtro. |
| 27E.3 | Mostrar badge "Pro" em itens bloqueados | MÉDIA | ✅ | Itens visíveis mas com badge indicando plano necessário. |
| 27E.4 | Tooltip explicativo em itens bloqueados | MÉDIA | ✅ | "Disponível no plano Clínica. Clique para fazer upgrade." |
| 27E.5 | Link para upgrade nos itens bloqueados | MÉDIA | ✅ | Clicar em item bloqueado leva para `/assinatura`. |

---

### Cronograma sugerido — Fase 27

| Ordem | Sub-fase | Prazo | Dependência |
|:-----:|----------|:-----:|:-----------:|
| 1 | **27A — Estrutura de Planos** | 2-3 dias | — |
| 2 | **27B — Hook e Componentes** | 3-5 dias | 27A |
| 3 | **27C — Proteger Módulos** | 1 semana | 27B |
| 4 | **27D — Controle de Limites** | 1 semana | 27B |
| 5 | **27E — Sidebar e Navegação** | 2-3 dias | 27B |

### Estimativa total: 3-4 semanas (1 dev full-time)

---

## FASE 28 — Sistema de Overrides Administrativos

> **Contexto:** O super-admin (nível sistema) precisa poder liberar funcionalidades específicas para tenants independente do plano contratado.
> **Casos de uso:** Parceiros estratégicos, pilotos de funcionalidades, compensação por problemas, negociações comerciais.
> **Objetivo:** Criar sistema flexível de overrides que sobrescreve as regras do plano.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Esta fase depende da Fase 27. Implementar APÓS a conclusão da Fase 27.

### Sub-fase 28A — Estrutura de Banco de Dados

> Tabelas para armazenar overrides de funcionalidades e limites.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 28A.1 | Criar tabela `tenant_feature_overrides` | CRÍTICA | ✅ | Colunas: `tenant_id`, `feature_key`, `is_enabled`, `reason`, `enabled_by`, `expires_at`, `created_at`. |
| 28A.2 | Criar tabela `tenant_limit_overrides` | CRÍTICA | ✅ | Colunas: `tenant_id`, `limit_key`, `custom_value`, `reason`, `enabled_by`, `expires_at`, `created_at`. |
| 28A.3 | Criar índices para performance | ALTA | ✅ | Índice composto em `(tenant_id, feature_key)` e `(tenant_id, limit_key)`. |
| 28A.4 | Criar RLS policies | ALTA | ✅ | Apenas super-admin pode INSERT/UPDATE/DELETE. Tenant pode SELECT próprios overrides. |
| 28A.5 | Criar RPC `get_tenant_overrides` | ALTA | ✅ | Retorna overrides ativos (não expirados) para o tenant do usuário. |
| 28A.6 | Criar migration SQL | ALTA | ✅ | `supabase/migrations/20260325300000_tenant_overrides_v1.sql` |

### Estrutura das Tabelas

```sql
-- tenant_feature_overrides
CREATE TABLE tenant_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  enabled_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, feature_key)
);

-- tenant_limit_overrides
CREATE TABLE tenant_limit_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  limit_key TEXT NOT NULL,
  custom_value INTEGER NOT NULL,
  reason TEXT,
  enabled_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, limit_key)
);
```

---

### Sub-fase 28B — Integração no Frontend

> Atualizar hook `usePlanFeatures` para considerar overrides.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 28B.1 | Atualizar `usePlanFeatures` para carregar overrides | CRÍTICA | ✅ | Chamar `get_tenant_overrides` e mesclar com `PLAN_CONFIG`. |
| 28B.2 | Prioridade: override > plano | CRÍTICA | ✅ | Se existe override, usar valor do override. Senão, usar valor do plano. |
| 28B.3 | Verificar expiração de overrides | ALTA | ✅ | Ignorar overrides com `expires_at < now()`. |
| 28B.4 | Cache de overrides | MÉDIA | ✅ | Carregado uma vez no mount do hook. |
| 28B.5 | Criar tipo `TenantOverrides` | MÉDIA | ✅ | Interface TypeScript para tipagem dos overrides. |

### Lógica de Prioridade

```typescript
// usePlanFeatures.ts (atualizado)
const hasFeature = (feature: FeatureKey): boolean => {
  // 1. Verificar override de funcionalidade
  const featureOverride = overrides.features.find(o => o.feature_key === feature);
  if (featureOverride && (!featureOverride.expires_at || new Date(featureOverride.expires_at) > new Date())) {
    return featureOverride.is_enabled;
  }
  
  // 2. Fallback para configuração do plano
  return PLAN_CONFIG[currentPlan].features[feature] ?? false;
};

const getLimit = (limit: LimitKey): number => {
  // 1. Verificar override de limite
  const limitOverride = overrides.limits.find(o => o.limit_key === limit);
  if (limitOverride && (!limitOverride.expires_at || new Date(limitOverride.expires_at) > new Date())) {
    return limitOverride.custom_value;
  }
  
  // 2. Fallback para configuração do plano
  return PLAN_CONFIG[currentPlan].limits[limit] ?? 0;
};
```

---

### Sub-fase 28C — Painel de Administração de Overrides

> Interface para super-admin gerenciar overrides.
>
> ⚠️ **CRITÉRIO:** Apenas super-admin (role = 'super_admin' ou flag especial) pode acessar.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 28C.1 | Criar página `/admin/overrides` | CRÍTICA | ✅ | Listagem de todos os overrides ativos por tenant. |
| 28C.2 | Criar componente `TenantOverrideManager` | CRÍTICA | ✅ | Formulário para adicionar/editar/remover overrides (integrado na página). |
| 28C.3 | Seletor de tenant | ALTA | ✅ | Dropdown com busca para selecionar tenant. |
| 28C.4 | Seletor de funcionalidade | ALTA | ✅ | Lista de todas as `FeatureKey` disponíveis. |
| 28C.5 | Seletor de limite | ALTA | ✅ | Lista de todas as `LimitKey` disponíveis. |
| 28C.6 | Campo de motivo | ALTA | ✅ | Textarea para documentar razão do override. |
| 28C.7 | Campo de expiração | ALTA | ✅ | DatePicker opcional para definir quando override expira. |
| 28C.8 | Histórico de overrides | MÉDIA | ✅ | Tabela com overrides expirados via filtro "Mostrar expirados". |
| 28C.9 | Filtros e busca | MÉDIA | ✅ | Filtrar por tenant, status (ativo/expirado). |
| 28C.10 | Exportar relatório | BAIXA | ⬚ | CSV com todos os overrides para compliance. |

---

### Sub-fase 28D — Auditoria e Compliance

> Rastreabilidade de todas as alterações de overrides.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 28D.1 | Criar tabela `override_audit_log` | ALTA | ✅ | Registrar INSERT/UPDATE/DELETE com `old_value`, `new_value`, `changed_by`. |
| 28D.2 | Trigger de auditoria | ALTA | ✅ | Auditoria via RPCs `create_feature_override`, `create_limit_override`, `delete_*`. |
| 28D.3 | Visualização de histórico | MÉDIA | ⬚ | Timeline de alterações por tenant no painel admin. |
| 28D.4 | Alertas de expiração | MÉDIA | ⬚ | Notificar admin 7 dias antes de override expirar. |
| 28D.5 | Relatório de overrides ativos | BAIXA | ⬚ | Dashboard com métricas: total de overrides, por tipo, por tenant. |

---

### Sub-fase 28E — Notificações e UX

> Informar tenant sobre funcionalidades liberadas via override.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 28E.1 | Badge "Cortesia" em funcionalidades liberadas | MÉDIA | ✅ | `FeatureGate` com prop `showCourtesyBadge` mostra badge roxo "Cortesia". |
| 28E.2 | Tooltip com detalhes do override | MÉDIA | ✅ | Tooltip mostra motivo do override quando disponível. |
| 28E.3 | Notificação de expiração para tenant | MÉDIA | ⬚ | Email/push 7 dias antes de override expirar. |
| 28E.4 | Sugestão de upgrade | BAIXA | ⬚ | Quando override expira, sugerir upgrade para manter funcionalidade. |

---

### Cronograma sugerido — Fase 28

| Ordem | Sub-fase | Prazo | Dependência |
|:-----:|----------|:-----:|:-----------:|
| 1 | **28A — Banco de Dados** | 1-2 dias | Fase 27 completa |
| 2 | **28B — Integração Frontend** | 2-3 dias | 28A |
| 3 | **28C — Painel Admin** | 1 semana | 28B |
| 4 | **28D — Auditoria** | 2-3 dias | 28A |
| 5 | **28E — Notificações** | 2-3 dias | 28B |

### Estimativa total: 2-3 semanas (1 dev full-time)

---

## FASE 29 — Portal do Paciente: Evolução Competitiva (Análise 23/02/2026)

> **Problema crítico identificado:** O Portal do Paciente atual tem base sólida (login, teleconsulta, documentos), mas está **significativamente atrás** dos concorrentes em autonomia do paciente. Paciente não consegue agendar consulta, ver faturas, enviar mensagens ou acompanhar histórico de saúde.
>
> **Benchmark:** Doctoralia (700k+ profissionais, agendamento self-service), iClinic (chat + financeiro + dependentes), Feegow (histórico médico + compartilhamento), Amplimed (agendamento online + app nativo).
>
> **Métricas atuais (estimadas):** Taxa de ativação ~30% (meta: 60%), engajamento mensal ~15% (meta: 40%), agendamentos online 0% (meta: 50%).
>
> **Viabilidade técnica confirmada:** Infraestrutura existente (Supabase, RPCs paciente, Edge Functions, Twilio) suporta 100% das melhorias. Portal já tem autenticação separada (`supabasePatient`), layout responsivo e sistema de notificações.

### Sub-fase 29A — Agendamento Online Self-Service

> **Feature mais desejada** — 77% dos pacientes querem agendar sozinhos. Diferencial competitivo crítico.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 29A.1 | RPC `get_available_slots_for_patient(p_service_id, p_professional_id, p_date_from, p_date_to)` | CRÍTICA | ✅ | Retorna slots disponíveis considerando: disponibilidade do profissional, agendamentos existentes, duração do serviço, intervalo entre consultas. `SECURITY DEFINER` para paciente autenticado. |
| 29A.2 | RPC `patient_create_appointment(p_service_id, p_professional_id, p_scheduled_at)` | CRÍTICA | ✅ | Cria agendamento com status `pending`. Valida: slot ainda disponível (lock otimista), paciente vinculado ao tenant, serviço ativo. Retorna `appointment_id` ou erro. |
| 29A.3 | Página `/paciente/agendar` — Wizard de agendamento | CRÍTICA | ✅ | 4 passos: (1) Selecionar serviço, (2) Selecionar profissional (com foto/especialidade), (3) Selecionar data/horário (calendário visual), (4) Confirmar. Mobile-first. |
| 29A.4 | Componente `<SlotPicker>` — Seletor visual de horários | ALTA | ✅ | Grid de horários disponíveis por dia. Verde = disponível, cinza = ocupado. Navegação por semana. Skeleton loading. |
| 29A.5 | Componente `<ProfessionalCard>` — Card do profissional | ALTA | ✅ | Foto, nome, especialidade, conselho (CRM/CRO), avaliação média (se houver). Clicável para selecionar. |
| 29A.6 | Confirmação por email/push após agendamento | MÉDIA | ⬚ | Edge Function `notify-patient-appointment` envia email + push com detalhes, botão cancelar/reagendar. |
| 29A.7 | Limite de agendamentos simultâneos por paciente | MÉDIA | ✅ | Config no tenant: `max_pending_appointments_per_patient` (default 3). RPC valida antes de criar. |
| 29A.8 | Antecedência mínima/máxima para agendamento | MÉDIA | ✅ | Config no tenant: `min_hours_advance` (default 2h), `max_days_advance` (default 60). Validação na RPC e UI. |

---

### Sub-fase 29B — Módulo Financeiro do Paciente

> **Reduz inadimplência** — Paciente vê débitos e paga online. Padrão em iClinic, Feegow, Amplimed.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 29B.1 | RPC `get_patient_financial_summary()` | ALTA | ✅ | Retorna: saldo devedor, faturas pendentes, últimos pagamentos. Apenas dados do paciente autenticado. |
| 29B.2 | RPC `get_patient_invoices(p_status, p_from, p_to)` | ALTA | ✅ | Lista faturas com filtros. Campos: valor, vencimento, status (pendente/pago/vencido), descrição, link pagamento. |
| 29B.3 | Página `/paciente/financeiro` — Visão financeira | ALTA | ✅ | Cards: saldo devedor, próximo vencimento. Lista de faturas com filtros. Botão "Pagar" em cada fatura. |
| 29B.4 | Integração gateway de pagamento (Stripe/PagSeguro) | ALTA | ⬚ | Edge Function `create-patient-payment` gera link de pagamento. Webhook atualiza status da fatura. Config por tenant. |
| 29B.5 | Comprovante de pagamento (PDF) | MÉDIA | ⬚ | `generatePaymentReceiptPdf()` com dados da fatura, valor pago, data, método. Download na lista de faturas. |
| 29B.6 | Notificação de fatura próxima do vencimento | MÉDIA | ⬚ | Edge Function `notify-patient-invoice-due` envia 3 dias antes. Config: `invoice_reminder_days`. |
| 29B.7 | Histórico de pagamentos | BAIXA | ✅ | Aba "Histórico" com todos os pagamentos realizados, método, data, comprovante. |

---

### Sub-fase 29C — Chat/Mensagens com a Clínica

> **Comunicação bidirecional** — Padrão em Doctoralia, iClinic, Feegow. Reduz ligações telefônicas.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 29C.1 | Tabela `patient_messages` | ALTA | ✅ | Campos: `id`, `tenant_id`, `patient_user_id`, `sender_type` (patient/clinic), `content`, `read_at`, `created_at`. RLS: paciente vê as suas, clínica vê do tenant. |
| 29C.2 | RPC `send_patient_message(p_content)` | ALTA | ✅ | Paciente envia mensagem. Notifica clínica via Realtime. Limite de caracteres (1000). |
| 29C.3 | RPC `get_patient_messages(p_limit, p_offset)` | ALTA | ✅ | Lista mensagens paginadas. Marca como lidas automaticamente. |
| 29C.4 | Página `/paciente/mensagens` — Chat | ALTA | ✅ | Interface de chat: bolhas de mensagem, input fixo no bottom, scroll automático, indicador "digitando". |
| 29C.5 | Notificação de nova mensagem (push + email) | MÉDIA | ⬚ | Edge Function `notify-patient-message`. Paciente recebe quando clínica responde. |
| 29C.6 | Painel de mensagens no admin (`/mensagens-pacientes`) | MÉDIA | ✅ | Lista de conversas por paciente. Responder inline. Badge de não lidas. Filtro por paciente. |
| 29C.7 | Respostas rápidas (templates) | BAIXA | ✅ | Admin configura templates: "Confirmamos seu agendamento", "Resultado disponível", etc. Botão de inserir no chat. |
| 29C.8 | Anexos (imagens/PDFs) | BAIXA | ⬚ | Upload de arquivos nas mensagens. Storage no Supabase. Preview inline. Limite 5MB. |

---

### Sub-fase 29D — Histórico Médico & Saúde

> **Acompanhamento de saúde** — Paciente vê evolução ao longo do tempo. Padrão em Feegow, iClinic.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 29D.1 | RPC `get_patient_health_timeline(p_limit)` | ALTA | ✅ | Timeline consolidada: consultas, exames, receitas, atestados, evoluções. Ordenado por data desc. |
| 29D.2 | Página `/paciente/saude` — Minha Saúde | ALTA | ✅ | Abas: Timeline, Medicamentos, Alergias, Vacinas. Cards informativos. |
| 29D.3 | Aba "Timeline" — Histórico visual | ALTA | ✅ | Timeline vertical com ícones por tipo (consulta, exame, receita). Expandir para ver detalhes. Filtro por tipo/período. |
| 29D.4 | Aba "Medicamentos em Uso" | MÉDIA | ✅ | Lista de medicamentos ativos (das receitas vigentes). Nome, posologia, validade. Alerta de receita expirando. |
| 29D.5 | Aba "Alergias & Condições" | MÉDIA | ✅ | Visualização das alergias cadastradas. Botão "Solicitar atualização" envia mensagem à clínica. |
| 29D.6 | Gráficos de sinais vitais | MÉDIA | ✅ | Reutilizar `VitalSignsChart` do admin. Exibe evolução de peso, pressão, glicemia ao longo das consultas. |
| 29D.7 | Aba "Vacinas" (carteira de vacinação) | BAIXA | ✅ | Lista de vacinas registradas. Data, lote, próxima dose. Integração futura com SIPNI. |
| 29D.8 | Compartilhar histórico com outro médico | BAIXA | ⬚ | Gerar link temporário (24h) com histórico selecionado. Acesso sem login. Audit log. |

---

### Sub-fase 29E — Engajamento & Experiência

> **Aumentar adoção** — Onboarding, avaliações, gamificação. Média de engajamento em portais é 14/100.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 29E.1 | Onboarding guiado (tour interativo) | ALTA | ⬚ | Tour no primeiro acesso: "Aqui você agenda", "Aqui vê documentos", etc. 5-7 passos. Skip disponível. LocalStorage flag. |
| 29E.2 | Avaliação pós-consulta (NPS) | ALTA | ⬚ | 24h após consulta concluída, exibe modal: "Como foi seu atendimento?" (1-5 estrelas) + comentário opcional. Salva em `appointment_ratings`. |
| 29E.3 | RPC `submit_appointment_rating(p_appointment_id, p_rating, p_comment)` | ALTA | ⬚ | Valida: consulta do paciente, status concluído, não avaliada ainda. |
| 29E.4 | Lembretes de retorno | MÉDIA | ⬚ | Notificação quando profissional agenda retorno. "Dr. João recomendou retorno em 30 dias. Agendar agora?" |
| 29E.5 | Sala de espera virtual (teleconsulta) | MÉDIA | ⬚ | Antes de entrar na chamada: "Aguardando Dr. João entrar..." com animação. Status do médico via Realtime. |
| 29E.6 | Dependentes/Família | MÉDIA | ⬚ | Tabela `patient_dependents`. Paciente gerencia filhos/idosos. Trocar contexto no header. Agendar para dependente. |
| 29E.7 | Programa de indicação | BAIXA | ⬚ | "Indique um amigo e ganhe desconto". Código único por paciente. Tracking de conversões. |
| 29E.8 | Conquistas/Badges | BAIXA | ⬚ | Gamificação leve: "Primeira consulta", "5 consultas", "Avaliou atendimento". Exibir no perfil. |

---

### Sub-fase 29F — Melhorias de UX do Portal

> **Polimento** — Busca, navegação, acessibilidade. Mobile-first.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 29F.1 | Busca global no portal | MÉDIA | ✅ | Buscar em documentos, consultas, mensagens. Atalho Ctrl+K. Resultados agrupados por tipo. |
| 29F.2 | Bottom navigation (mobile) | MÉDIA | ✅ | Em mobile, trocar sidebar por bottom nav: Início, Agendar, Documentos, Mensagens, Perfil. Padrão Doctoralia. |
| 29F.3 | Pull-to-refresh | BAIXA | ⬚ | Em mobile, puxar para atualizar lista de consultas/documentos. Feedback visual. |
| 29F.4 | Notificações push (PWA) | MÉDIA | ⬚ | Service Worker para push notifications. Permissão no primeiro acesso. Integrar com Firebase Cloud Messaging. |
| 29F.5 | Modo offline básico | BAIXA | ⬚ | Cache de dados básicos (perfil, próxima consulta). Banner "Você está offline". |
| 29F.6 | Acessibilidade (WCAG 2.1 AA) | MÉDIA | ⬚ | Contraste, labels, navegação por teclado, leitor de tela. Audit com axe-core. |
| 29F.7 | Internacionalização (i18n) | BAIXA | ⬚ | Preparar para múltiplos idiomas. Extrair strings. Português como default. |

---

### Cronograma sugerido — Fase 29

| Ordem | Sub-fase | Prazo | Prioridade | Dependência |
|:-----:|----------|:-----:|:----------:|:-----------:|
| 1 | **29A — Agendamento Online** | 2-3 semanas | 🔴 Crítica | — |
| 2 | **29B — Módulo Financeiro** | 2 semanas | 🔴 Alta | — |
| 3 | **29C — Chat/Mensagens** | 1-2 semanas | 🟠 Alta | — |
| 4 | **29D — Histórico Médico** | 1-2 semanas | 🟠 Alta | — |
| 5 | **29E — Engajamento** | 2 semanas | 🟠 Média | 29A (para avaliação) |
| 6 | **29F — Melhorias UX** | 1-2 semanas | 🟡 Média | Todas anteriores |

### Estimativa total: 10-14 semanas (1 dev full-time)

---

### Comparativo com concorrentes (Portal do Paciente)

| Funcionalidade | ClinicaFlow (atual) | Doctoralia | iClinic | Feegow | Após Fase 29 |
|----------------|:-------------------:|:----------:|:-------:|:------:|:------------:|
| Login por código/CPF | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver consultas agendadas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cancelar/reagendar consulta | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Agendar consulta online** | ❌ | ✅ | ✅ | ✅ | ✅ |
| Teleconsulta integrada | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver receitas/atestados/exames | ✅ | ❌ | ✅ | ✅ | ✅ |
| Download PDF documentos | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Ver faturas/pagamentos** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Pagar online** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Chat com clínica** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Histórico médico/timeline** | ❌ | ❌ | ✅ | ✅ | ✅ |
| Medicamentos em uso | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Avaliação pós-consulta** | ❌ | ✅ | ✅ | ✅ | ✅ |
| Sala de espera virtual | ❌ | ✅ | ✅ | ✅ | ✅ |
| Dependentes/família | ❌ | ❌ | ✅ | ✅ | ✅ |
| Notificações push | ✅ | ✅ | ✅ | ✅ | ✅ |
| App nativo iOS/Android | ❌ | ✅ | ✅ | ✅ | ❌ (PWA) |

> **Resultado esperado:** Após Fase 29, Portal do Paciente será competitivo com iClinic e Feegow, superando Doctoralia em funcionalidades clínicas.

---

### Métricas de sucesso — Fase 29

| Métrica | Atual (estimado) | Meta pós-Fase 29 |
|---------|:----------------:|:----------------:|
| Taxa de ativação (1º login) | ~30% | > 60% |
| Engajamento mensal | ~15% | > 40% |
| Agendamentos online | 0% | > 50% do total |
| NPS do portal | Não medido | > 50 |
| Tempo médio de sessão | ~1 min | > 3 min |
| Documentos baixados/mês | ~0.5/paciente | > 2/paciente |
| Mensagens enviadas/mês | 0 | > 1/paciente |
| Pagamentos online | 0% | > 30% das faturas |

---

### Matriz de funcionalidades por sub-fase

| Funcionalidade | 29A | 29B | 29C | 29D | 29E | 29F |
|----------------|:---:|:---:|:---:|:---:|:---:|:---:|
| Agendar consulta | ✅ | | | | | |
| Ver slots disponíveis | ✅ | | | | | |
| Ver faturas | | ✅ | | | | |
| Pagar online | | ✅ | | | | |
| Enviar mensagem | | | ✅ | | | |
| Receber resposta | | | ✅ | | | |
| Timeline de saúde | | | | ✅ | | |
| Medicamentos em uso | | | | ✅ | | |
| Gráficos de vitais | | | | ✅ | | |
| Avaliação NPS | | | | | ✅ | |
| Onboarding tour | | | | | ✅ | |
| Sala de espera | | | | | ✅ | |
| Dependentes | | | | | ✅ | |
| Busca global | | | | | | ✅ |
| Bottom nav mobile | | | | | | ✅ |
| Push notifications | | | | | | ✅ |

---

### Arquivos a criar/modificar — Fase 29

| Sub-fase | Arquivos |
|----------|----------|
| **29A** | `supabase/migrations/29A_patient_scheduling.sql`, `src/pages/paciente/PatientAgendar.tsx`, `src/components/patient/SlotPicker.tsx`, `src/components/patient/ProfessionalCard.tsx` |
| **29B** | `supabase/migrations/29B_patient_financial.sql`, `src/pages/paciente/PatientFinanceiro.tsx`, `supabase/functions/create-patient-payment/`, `src/utils/paymentReceiptPdf.ts` |
| **29C** | `supabase/migrations/29C_patient_messages.sql`, `src/pages/paciente/PatientMensagens.tsx`, `src/pages/MensagensPacientes.tsx`, `src/components/patient/ChatBubble.tsx` |
| **29D** | `src/pages/paciente/PatientSaude.tsx`, `src/components/patient/HealthTimeline.tsx`, `src/components/patient/MedicationsList.tsx` |
| **29E** | `supabase/migrations/29E_patient_engagement.sql`, `src/components/patient/OnboardingTour.tsx`, `src/components/patient/AppointmentRating.tsx`, `src/components/patient/WaitingRoom.tsx` |
| **29F** | `src/components/patient/PatientBottomNav.tsx`, `src/components/patient/PatientGlobalSearch.tsx`, atualização do `PatientLayout.tsx` |

---

## FASE 29 — Página de Assinatura e Checkout

> **Contexto:** Usuários precisam de uma experiência fluida para visualizar, comparar e alterar planos.
> **Objetivo:** Criar página completa de gerenciamento de assinatura com checkout integrado.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Integração com gateway de pagamento (Stripe ou similar) é obrigatória.

### Sub-fase 29A — Página de Assinatura

> Interface para visualizar plano atual e opções de upgrade/downgrade.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 29A.1 | Criar página `/assinatura` | CRÍTICA | ⬚ | Rota protegida, acessível apenas para admin do tenant. |
| 29A.2 | Componente `CurrentPlanCard` | CRÍTICA | ⬚ | Exibir plano atual, data de renovação, status (ativo/trial/expirado). |
| 29A.3 | Componente `PlanComparisonTable` | CRÍTICA | ⬚ | Tabela comparativa de todos os planos com funcionalidades. |
| 29A.4 | Componente `UsageSummary` | ALTA | ⬚ | Resumo de uso atual vs limites (pacientes, agendamentos, etc). |
| 29A.5 | Botões de upgrade/downgrade | ALTA | ⬚ | CTAs claros para mudar de plano. |
| 29A.6 | Histórico de faturas | MÉDIA | ⬚ | Lista de pagamentos anteriores com download de NF. |
| 29A.7 | Dados de pagamento | MÉDIA | ⬚ | Exibir últimos 4 dígitos do cartão, opção de atualizar. |

---

### Sub-fase 29B — Fluxo de Checkout

> Processo de pagamento para novos planos ou upgrades.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 29B.1 | Integração com Stripe | CRÍTICA | ⬚ | Usar Stripe Checkout ou Elements para pagamento seguro. |
| 29B.2 | Criar Edge Function `create-checkout-session` | CRÍTICA | ⬚ | Gerar sessão de checkout com plano selecionado. |
| 29B.3 | Criar Edge Function `stripe-webhook` | CRÍTICA | ⬚ | Processar eventos: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`. |
| 29B.4 | Atualizar tabela `subscriptions` | ALTA | ⬚ | Sincronizar status com Stripe via webhook. |
| 29B.5 | Página de sucesso `/assinatura/sucesso` | ALTA | ⬚ | Confirmação de pagamento com próximos passos. |
| 29B.6 | Página de cancelamento `/assinatura/cancelado` | ALTA | ⬚ | Informar que pagamento não foi concluído. |
| 29B.7 | Suporte a PIX | MÉDIA | ⬚ | Opção de pagamento via PIX (Stripe ou gateway brasileiro). |
| 29B.8 | Suporte a boleto | MÉDIA | ⬚ | Opção de pagamento via boleto bancário. |

---

### Sub-fase 29C — Gerenciamento de Assinatura

> Funcionalidades de cancelamento, pausa e reativação.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 29C.1 | Cancelar assinatura | ALTA | ⬚ | Fluxo com pesquisa de motivo, confirmação, e data de término. |
| 29C.2 | Pausar assinatura | MÉDIA | ⬚ | Opção de pausar por 1-3 meses (manter dados, bloquear acesso). |
| 29C.3 | Reativar assinatura | MÉDIA | ⬚ | Fluxo para reativar após cancelamento/pausa. |
| 29C.4 | Downgrade com aviso | MÉDIA | ⬚ | Alertar sobre funcionalidades que serão perdidas. |
| 29C.5 | Período de carência | BAIXA | ⬚ | 7 dias após expiração antes de bloquear acesso. |
| 29C.6 | Exportar dados antes de cancelar | BAIXA | ⬚ | Opção de exportar todos os dados em JSON/CSV. |

---

### Sub-fase 29D — Trial e Onboarding

> Experiência de trial e conversão.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 29D.1 | Banner de trial | ALTA | ⬚ | Exibir dias restantes do trial em todas as páginas. |
| 29D.2 | Checklist de onboarding | ALTA | ⬚ | Guiar usuário a completar configurações essenciais. |
| 29D.3 | Email de lembrete de trial | ALTA | ⬚ | Enviar 7, 3 e 1 dia antes do trial expirar. |
| 29D.4 | Extensão de trial | MÉDIA | ⬚ | Admin pode estender trial via painel de overrides. |
| 29D.5 | Conversão automática | MÉDIA | ⬚ | Se cartão cadastrado, converter automaticamente ao fim do trial. |
| 29D.6 | Oferta de desconto | BAIXA | ⬚ | Oferecer 20% off no primeiro mês se converter antes do trial acabar. |

---

### Sub-fase 29E — Cupons e Descontos

> Sistema de cupons promocionais.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 29E.1 | Criar tabela `coupons` | ALTA | ⬚ | Colunas: `code`, `discount_percent`, `discount_amount`, `valid_until`, `max_uses`, `uses_count`. |
| 29E.2 | Aplicar cupom no checkout | ALTA | ⬚ | Campo para inserir código, validar e aplicar desconto. |
| 29E.3 | Cupons de parceiros | MÉDIA | ⬚ | Cupons específicos para parceiros (ex: ICLINIC20). |
| 29E.4 | Cupons de indicação | MÉDIA | ⬚ | Gerar cupom único para cada tenant indicar novos clientes. |
| 29E.5 | Relatório de cupons | BAIXA | ⬚ | Dashboard com uso de cupons, conversão, receita perdida. |

---

### Cronograma sugerido — Fase 29

| Ordem | Sub-fase | Prazo | Dependência |
|:-----:|----------|:-----:|:-----------:|
| 1 | **29A — Página de Assinatura** | 3-4 dias | Fase 27 |
| 2 | **29B — Fluxo de Checkout** | 1 semana | 29A |
| 3 | **29C — Gerenciamento** | 3-4 dias | 29B |
| 4 | **29D — Trial e Onboarding** | 3-4 dias | 29A |
| 5 | **29E — Cupons** | 2-3 dias | 29B |

### Estimativa total: 3-4 semanas (1 dev full-time)

---

## Resumo das Novas Fases

| Fase | Descrição | Dependência | Estimativa |
|:----:|-----------|:-----------:|:----------:|
| **27** | Sistema de Planos e Monetização | — | 3-4 semanas |
| **28** | Sistema de Overrides Administrativos | Fase 27 | 2-3 semanas |
| **29** | Página de Assinatura e Checkout | Fase 27 | 3-4 semanas |

### Ordem de Execução Recomendada

1. **Fase 27** (obrigatória primeiro) — Define a estrutura base de planos
2. **Fase 29** (pode iniciar em paralelo com 28) — Permite monetização imediata
3. **Fase 28** (pode iniciar após 27A-27B) — Flexibilidade comercial

### Estimativa Total: 8-11 semanas (1 dev full-time)

---

## FASE 30 — Reorganização do Módulo Financeiro ✅

> **STATUS:** ✅ CONCLUÍDA
>
> **Problema identificado:** O módulo financeiro atual é confuso — 8 abas em uma única página, comissões/salários misturados com fluxo de caixa, perdas de produtos no lugar errado. Não segue o padrão dos grandes sistemas (Feegow, iClinic, Ninsaúde).
>
> **Benchmark:**
> - **Feegow:** Repasses é um módulo SEPARADO do financeiro. Cada funcionalidade tem página própria.
> - **iClinic:** Fluxo de caixa, Contas a Pagar, Contas a Receber e Repasse são páginas separadas.
> - **Ninsaúde:** Menu hierárquico com submódulos claros.
>
> **Impacto:** Sem essa reorganização, adicionar as funcionalidades avançadas de comissão (Fase 31) vai piorar a confusão.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Esta fase é PRÉ-REQUISITO para a Fase 31. Implementar ANTES de adicionar novas funcionalidades.

### Estrutura Atual (problemática)

```
┌─────────────────────────────────────────────────────────────────────┐
│  FINANCEIRO (página única com 8 abas)                               │
├─────────────────────────────────────────────────────────────────────┤
│  [5 Cards de estatísticas]                                          │
│  [Card de Perdas de Produtos] ← não deveria estar aqui              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Gráficos | E&S | Transações | Comissões | Salários |        │   │
│  │ C.Pagar | C.Receber | Projeção                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Estrutura Proposta (padrão de mercado)

```
MENU LATERAL:
├── 💰 Financeiro
│   ├── Dashboard (resumo + gráficos)
│   ├── Transações
│   ├── Contas a Pagar
│   ├── Contas a Receber
│   └── Projeção
│
├── 👥 Repasses (NOVO módulo separado)
│   ├── Comissões
│   └── Salários
│
└── 📦 Estoque
    └── Perdas (mover de Financeiro para cá)
```

### Sub-fase 30A — Separar Módulo de Repasses

> Criar módulo independente para comissões e salários — padrão Feegow.
>
> ✅ **CONCLUÍDA:** Páginas criadas, sidebar atualizado, rotas configuradas.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 30A.1 | Criar página `/repasses` — Hub de Repasses | CRÍTICA | ✅ | Dashboard com KPIs: total pendente, total pago (mês), próximos vencimentos. Cards de acesso rápido para Comissões e Salários. |
| 30A.2 | Mover `/financeiro?tab=commissions` → `/repasses/comissoes` | CRÍTICA | ✅ | Página dedicada para comissões. Reutilizar `FinanceiroCommissionsTab` como página. Adicionar filtros avançados. |
| 30A.3 | Mover `/financeiro?tab=salaries` → `/repasses/salarios` | CRÍTICA | ✅ | Página dedicada para salários. Reutilizar `FinanceiroSalariesTab` como página. |
| 30A.4 | Atualizar Sidebar com novo módulo "Repasses" | ALTA | ✅ | Ícone `Wallet`. Submenu: Visão Geral, Comissões, Salários. Posicionado após Financeiro. |
| 30A.5 | Redirect de URLs antigas | MÉDIA | ✅ | Rotas configuradas em App.tsx. |
| 30A.6 | Atualizar links internos | MÉDIA | ✅ | Dashboard, notificações e outros lugares que linkam para comissões/salários. |

---

### Sub-fase 30B — Simplificar Página Financeiro

> Remover abas desnecessárias, focar no essencial.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 30B.1 | Remover abas Comissões e Salários | CRÍTICA | ✅ | Já movidas para `/repasses`. Reduz de 8 para 6 abas. |
| 30B.2 | Mover "Perdas de Produtos" para Estoque | ALTA | ✅ | Seção já existia em `/produtos` (DamagedMovementsCard). Removido do Financeiro. |
| 30B.3 | Consolidar abas Gráficos + E&S | MÉDIA | ✅ | "Gráficos" e "Entradas & Saídas" consolidados em "Visão Geral". Reduz para 5 abas. |
| 30B.4 | Avaliar necessidade de abas vs páginas | MÉDIA | ✅ | Contas a Pagar e Contas a Receber agora são páginas separadas (`/contas-pagar`, `/contas-receber`). Financeiro reduzido para 3 abas. |
| 30B.5 | Reorganizar cards de estatísticas | BAIXA | ✅ | Mantido: Saldo, Receitas, Despesas, Geradas pela agenda. Removido "Perdas" (vai para estoque). |

---

### Sub-fase 30C — Melhorar Navegação

> Menu lateral mais claro e hierárquico.
>
> ✅ **CONCLUÍDA:** Grupos criados no sidebar, navegação hierárquica implementada.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 30C.1 | Agrupar itens financeiros no menu | ALTA | ✅ | Grupo "Financeiro" com: Dashboard, Transações, Contas a Pagar, Contas a Receber. Usa NavCategory com ícone. |
| 30C.2 | Criar grupo "Repasses" no menu | ALTA | ✅ | Itens: Visão Geral, Comissões, Salários. Separado do grupo Financeiro. Ícone Wallet, cor cyan. |
| 30C.3 | Breadcrumbs nas páginas financeiras | MÉDIA | ⬚ | Ex: "Financeiro > Contas a Pagar". Ajuda orientação do usuário. |
| 30C.4 | Links rápidos entre módulos relacionados | BAIXA | ✅ | Em Repasses: links para Comissões e Salários. Cards de acesso rápido implementados. |

---

### Cronograma sugerido — Fase 30

| Ordem | Sub-fase | Prazo | Dependência | Prioridade |
|:-----:|----------|:-----:|:-----------:|:----------:|
| 1 | **30A — Separar Repasses** | 3-4 dias | — | 🔴 Crítica |
| 2 | **30B — Simplificar Financeiro** | 2-3 dias | 30A | 🔴 Crítica |
| 3 | **30C — Melhorar Navegação** | 1-2 dias | 30A, 30B | 🟠 Alta |

### Estimativa total: 1-2 semanas (1 dev full-time)

---

### Comparativo Antes/Depois

| Aspecto | Antes | Depois | Status |
|---------|-------|--------|:------:|
| **Abas no Financeiro** | 8 | 3 (Visão Geral, Transações, Projeção) | ✅ |
| **Comissões/Salários** | Misturado no financeiro | Módulo próprio "Repasses" (`/repasses/*`) | ✅ |
| **Contas a Pagar/Receber** | Abas no financeiro | Páginas separadas (`/contas-pagar`, `/contas-receber`) | ✅ |
| **Perdas de produtos** | No financeiro (errado) | No estoque (correto) | ✅ |
| **Navegação** | Confusa, tudo junto | Clara e hierárquica | ✅ |
| **Padrão de mercado** | Não segue | Segue Feegow/iClinic | ✅ |

---

### Arquivos criados/modificados — Fase 30

| Sub-fase | Arquivos | Status |
|----------|----------|:------:|
| **30A** | `src/pages/Repasses.tsx` ✅, `src/pages/RepassesComissoes.tsx` ✅, `src/pages/RepassesSalarios.tsx` ✅, `src/components/layout/Sidebar.tsx` ✅ | ✅ |
| **30B** | `src/pages/Financeiro.tsx` ✅, `src/pages/ContasPagar.tsx` ✅, `src/pages/ContasReceber.tsx` ✅ | ✅ |
| **30C** | `src/components/layout/Sidebar.tsx` ✅ | ✅ |

---

## FASE 31 — Sistema de Comissões e Repasses Avançado

> **Problema identificado:** O sistema atual de comissões é básico — apenas uma regra por profissional (% ou fixo). Não suporta cenários reais como: comissão diferenciada por convênio, por procedimento, repasse invertido (profissional paga à clínica), comissão por venda, escalonamento por produtividade.
>
> **Benchmark:** Feegow (múltiplas regras por profissional/convênio/procedimento, repasse invertido, comissão por venda), iClinic (repasse por procedimento), Dental Office (split de pagamento automático), App Health (escalonamento), Sinaxys Prime (NFS-e automática).
>
> **Impacto:** Sem isso, clínicas multiprofissionais e com convênios não conseguem usar o sistema de forma justa. Comissão de 50% em consulta particular (R$300) vs convênio (R$80) gera insatisfação.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Implementar TODAS as sub-fases. O sistema atual é "cafona" comparado aos concorrentes.
>
> **PRÉ-REQUISITO:** Fase 30 (Reorganização do Financeiro) deve estar concluída.

### Sub-fase 31A — Fundação: Múltiplas Regras de Comissão

> Base de dados para suportar regras granulares. Sem isso, nenhuma das fases seguintes funciona.
>
> ✅ **CONCLUÍDA:** Tabela `commission_rules` criada, migração de dados, RPCs implementadas.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 31A.1 | Tabela `commission_rules` | CRÍTICA | ✅ | Colunas: `professional_id`, `rule_type` (default/service/insurance/procedure/sale), `service_id`, `insurance_id`, `procedure_code`, `calculation_type` (percentage/fixed/tiered), `value`, `tier_config` JSONB, `priority`, `is_inverted`, `is_active`. UNIQUE constraints por combinação. |
| 31A.2 | Migration de dados existentes | CRÍTICA | ✅ | Migra registros de `professional_commissions` para `commission_rules` com `rule_type='default'`. Compatibilidade retroativa mantida. |
| 31A.3 | RPC `get_applicable_commission_rule(...)` | CRÍTICA | ✅ | Retorna regra mais específica (maior prioridade). Ordem: procedure > service > insurance > default. |
| 31A.4 | Atualizar RPC `complete_appointment_with_sale` | CRÍTICA | ✅ | Usa `get_applicable_commission_rule` + `calculate_commission_amount`. Suporta cálculo escalonado (tiers) e repasse invertido. |
| 31A.5 | Índices de performance | ALTA | ✅ | Índices em `(tenant_id, professional_id, rule_type)`, `(tenant_id, service_id)`, `(tenant_id, insurance_id)`. |
| 31A.6 | RLS para `commission_rules` | ALTA | ✅ | Admin: CRUD completo. Staff: SELECT apenas das próprias regras. |

---

### Sub-fase 31B — Regras por Convênio e Serviço

> Diferenciação de comissão por fonte pagadora e tipo de procedimento.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 31B.1 | UI: Gerenciador de regras de comissão | CRÍTICA | ✅ | Página `/repasses/regras` com lista de regras por profissional. Cards por regra com tipo, filtro, valor, prioridade. |
| 31B.2 | Formulário de regra por convênio | ALTA | ✅ | Select de convênio (ou "Particular"), tipo de cálculo, valor. Prioridade automática (convênio > default). |
| 31B.3 | Formulário de regra por serviço | ALTA | ✅ | Select de serviço, tipo de cálculo, valor. Prioridade automática (serviço > convênio > default). |
| 31B.4 | Formulário de regra por procedimento TUSS | MÉDIA | ✅ | Autocomplete TUSS via TussCombobox, tipo de cálculo, valor. Prioridade máxima. |
| 31B.5 | Preview de regras aplicáveis | ALTA | ✅ | Componente `CommissionPreview` com tooltip mostrando regra aplicável e estimativa de comissão. |
| 31B.6 | Simulador de comissão | MÉDIA | ✅ | Na aba "Simulador" da página de regras: selecionar serviço + convênio + valor → exibir comissão calculada. |

---

### Sub-fase 31C — Repasse Invertido e Comissão por Captação

> Cenários avançados: profissional que paga à clínica (locação de sala) e comissão para quem captou/indicou o paciente.
>
> ✅ **CONCLUÍDA:** Repasse invertido, campo `booked_by_id`, regra `referral`, UI de captação e relatório implementados.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 31C.1 | Flag `is_inverted` na regra | ALTA | ✅ | Quando true, profissional paga à clínica (ex: 30% do que recebeu do convênio). Gera receita em vez de despesa. |
| 31C.2 | UI para repasse invertido | ALTA | ✅ | Toggle "Repasse invertido" no formulário de regra. Tooltip explicando o cenário. |
| 31C.3 | Campo `booked_by_id` em appointments | MÉDIA | ✅ | UUID do funcionário que agendou/indicou o paciente. Migration `20260327300000_referral_commission_v1.sql`. |
| 31C.4 | Regra de comissão por captação | MÉDIA | ✅ | `rule_type='referral'` — comissão para quem captou/indicou, não o executor. Calculada sobre valor do serviço. |
| 31C.5 | UI para atribuir captador | MÉDIA | ✅ | Select opcional no agendamento: "Agendado/Indicado por". Lista funcionários do tenant. |
| 31C.6 | Relatório de Captação e Indicações | BAIXA | ✅ | Página `/repasses/captacao` com ranking de captadores, total de agendamentos, pacientes únicos, receita gerada e comissões. |

---

### Sub-fase 31D — Escalonamento e Metas de Comissão

> Incentivo por produtividade: comissão aumenta conforme volume.
>
> ✅ **CONCLUÍDA:** tier_config, cálculo escalonado, UI de faixas, indicador visual e notificação implementados.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 31D.1 | Campo `tier_config` JSONB | MÉDIA | ✅ | Array de faixas: `[{min: 0, max: 5000, value: 30}, {min: 5001, max: 10000, value: 35}, {min: 10001, max: null, value: 40}]`. Já existia em `commission_rules`. |
| 31D.2 | Cálculo escalonado na RPC | MÉDIA | ✅ | Função `calculate_commission_amount()` com suporte a `calculation_type='tiered'`. Calcula baseado no faturamento acumulado do mês. |
| 31D.3 | UI para configurar faixas | MÉDIA | ✅ | Builder de faixas no `CommissionRuleForm.tsx`. Adicionar/remover faixas com validação. |
| 31D.4 | Indicador de faixa atual | BAIXA | ✅ | Componente `CommissionTierIndicator.tsx` com barra de progresso, faixa atual, próxima faixa e valor faltante. Integrado em `DashboardMedico`, `DashboardDentista` e `MinhasComissoes`. |
| 31D.5 | Notificação de mudança de faixa | BAIXA | ✅ | Migration `20260327500000_tier_change_notification_v1.sql` com tabela `professional_tier_tracking`, função `check_and_notify_tier_change()` e trigger automático ao completar agendamento. |

---

### Sub-fase 31E — Infraestrutura Multi-Gateway para Split de Pagamento

> Divisão automática no momento da transação — elimina processo manual.
>
> ✅ **CONCLUÍDA:** Camada de abstração, tabelas, UI de configuração, Edge Functions e documentação implementados.
>
> **Como funciona nos grandes sistemas (Feegow, iClinic, Ninsaúde):**
> - O **software** fornece uma **camada de abstração** que suporta múltiplos gateways
> - A **clínica** escolhe qual gateway quer usar e configura suas próprias credenciais
> - O sistema detecta automaticamente qual gateway está configurado e usa a API correspondente
>
> **Arquitetura recomendada:** Gateway-Agnostic Abstraction Layer (padrão Strategy/Factory)

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 31E.1 | Camada de abstração de pagamentos | ALTA | ✅ | Interface `PaymentGateway` em `src/lib/payment-gateway/`. Implementações: `AsaasGateway`, `PagSeguroGateway`, `StoneGateway`. Factory `createPaymentGateway()`. |
| 31E.2 | Tabela `tenant_payment_gateways` | ALTA | ✅ | Migration `20260327600000_payment_gateway_infrastructure_v1.sql`. Campos: `provider`, `api_key_encrypted`, `environment`, `is_split_enabled`, `split_fee_payer`. |
| 31E.3 | UI para clínica configurar gateway | ALTA | ✅ | Componente `PaymentGatewayConfig.tsx` com seleção de gateway, ambiente, API key, toggle de split, teste de conexão. |
| 31E.4 | Tabela `professional_payment_accounts` | ALTA | ✅ | Na mesma migration. Campos: `recipient_id`, `wallet_id`, `account_id`, `pix_key`, `is_verified`. |
| 31E.5 | UI para configurar conta do profissional | ALTA | ✅ | Componente `ProfessionalPaymentAccountForm.tsx` (Sheet) com campos dinâmicos por gateway. |
| 31E.6 | Lógica de split na criação de cobrança | ALTA | ✅ | Edge Function `create-charge-with-split` que detecta gateway, busca regra de comissão e cria cobrança com split. |
| 31E.7 | Fallback para comissão manual | MÉDIA | ✅ | Se profissional sem conta ou split falhar, cria `commission_payments` pendente automaticamente. |
| 31E.8 | Webhook handler unificado | MÉDIA | ✅ | Edge Function `payment-webhook-handler` que detecta provider, atualiza `split_payment_logs` e `patient_invoices`. |
| 31E.9 | Documentação para clínicas | BAIXA | ✅ | `src/lib/payment-gateway/docs.ts` com guias por gateway, FAQ de split e troubleshooting. |

> **Gateways suportados:** Asaas (mais comum em clínicas), Stone (TEF integrado), PagSeguro. Outros podem ser adicionados conforme demanda.
>
> **Nota fiscal:** Com split, o profissional recebe direto do gateway e emite NF própria. A clínica não tributa sobre o repasse (elimina bitributação).

### Arquitetura da Camada de Abstração

```
┌─────────────────────────────────────────────────────────────┐
│                    PaymentService                            │
│  (detecta gateway configurado pelo tenant e roteia)          │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  AsaasGateway   │  │  StoneGateway   │  │ PagSeguroGateway│
│  implements     │  │  implements     │  │  implements     │
│  PaymentGateway │  │  PaymentGateway │  │  PaymentGateway │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    Asaas API            Stone API          PagSeguro API
```

---

### Sub-fase 31F — Relatórios de Repasse ✅

> Relatórios detalhados para gestão e auditoria.
>
> ✅ **CONCLUÍDA:** Página `/repasses/relatorios` com 4 relatórios, filtros por período e exportação CSV.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 31F.1 | Relatório de repasse por profissional | ALTA | ✅ | Período, profissional, total faturado, total comissão, % efetivo, detalhamento por atendimento. |
| 31F.2 | Relatório de repasse por convênio | ALTA | ✅ | Análise de rentabilidade: convênio X gera R$ Y de faturamento mas R$ Z de comissão (margem W%). |
| 31F.3 | Relatório de repasse por procedimento | MÉDIA | ✅ | Quais procedimentos geram mais comissão? Ranking por valor absoluto e percentual. |
| 31F.4 | Comparativo mensal de repasses | MÉDIA | ✅ | Evolução de repasses ao longo do tempo (últimos 6 meses). Cards com variação mês a mês. |
| 31F.5 | Projeção de repasses | BAIXA | ⬚ | Baseado em agendamentos futuros, estimar repasses do próximo mês. (Adiado) |
| 31F.6 | Exportação (PDF/Excel/CSV) | ALTA | ✅ | Exportação CSV implementada para todos os relatórios. |

---

### Cronograma sugerido — Fase 31

| Ordem | Sub-fase | Prazo | Dependência | Prioridade |
|:-----:|----------|:-----:|:-----------:|:----------:|
| 1 | **31A — Fundação** | 1-2 semanas | Fase 30 | 🔴 Crítica |
| 2 | **31B — Regras por Convênio/Serviço** | 1-2 semanas | 31A | 🔴 Crítica |
| 3 | **31C — Repasse Invertido/Venda** | 1 semana | 31A | 🟠 Alta |
| 4 | **31D — Escalonamento** | 1 semana | 31A | 🟠 Média |
| 5 | **31E — Split de Pagamento** | 2-3 semanas | 31A, gateway | 🟠 Alta |
| 6 | **31F — Relatórios** | 1 semana | 31A, 31B | 🟠 Alta |

### Estimativa total: 7-10 semanas (1 dev full-time)

---

### Comparativo com concorrentes (Comissões)

| Funcionalidade | ClinicaFlow (atual) | Feegow | iClinic | Dental Office | Após Fase 31 |
|----------------|:-------------------:|:------:|:-------:|:-------------:|:------------:|
| Comissão única por profissional | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Múltiplas regras por profissional** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Regra por convênio** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Regra por serviço/procedimento** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Repasse invertido** | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Comissão por venda** | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Escalonamento por produtividade** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Split de pagamento automático** | ❌ | ✅ (Stone) | ❌ | ✅ | ✅ (multi-gateway) |
| **Múltiplos gateways suportados** | ❌ | Stone + TEF | ❌ | ❌ | ✅ (Asaas/Stone/PagSeguro) |
| Simulador de comissão | ❌ | ✅ | ❌ | ❌ | ✅ |
| Relatório por convênio | ❌ | ✅ | ✅ | ✅ | ✅ |

> **Resultado esperado:** Após Fase 31, sistema de comissões será **superior** a todos os concorrentes, com funcionalidades exclusivas (escalonamento, suporte multi-gateway).

### Modelo de Responsabilidade (Padrão da Indústria)

| Camada | Responsável | O que faz |
|--------|-------------|-----------|
| **Infraestrutura** | ClinicaFlow (você) | Fornece camada de abstração que suporta múltiplos gateways |
| **Configuração** | Clínica (tenant) | Escolhe gateway, configura suas credenciais, cria subcontas |
| **Execução** | Gateway (Asaas/Stone/etc) | Processa pagamento, executa split, transfere valores |

> **Como Feegow faz:** Oferece integração com Stone (boleto, PIX, cartão) e TEF CAPPTA. A clínica precisa ter conta na Stone e configurar no sistema.
> **Como vamos fazer:** Mesma abordagem, mas com suporte a múltiplos gateways (Asaas, Stone, PagSeguro). Clínica escolhe o que preferir.

---

### Arquivos a criar/modificar — Fase 31

| Sub-fase | Arquivos |
|----------|----------|
| **31A** | `supabase/migrations/31A_commission_rules.sql`, `src/lib/supabase-typed-rpc.ts` (novas RPCs), `src/types/database.ts` |
| **31B** | `src/pages/repasses/ConfigurarRegras.tsx`, `src/components/commission/CommissionRuleCard.tsx`, `src/components/commission/CommissionRuleForm.tsx`, `src/components/commission/CommissionSimulator.tsx` |
| **31C** | `supabase/migrations/31C_inverted_commission.sql`, `src/components/agenda/SellerSelect.tsx` |
| **31D** | `src/components/commission/TierBuilder.tsx`, `src/components/dashboard/CommissionTierProgress.tsx` |
| **31E** | `src/lib/payment-gateway.ts`, `src/lib/gateways/asaas.ts`, `src/lib/gateways/stone.ts`, `supabase/functions/payment-webhook/`, `src/pages/ConfigurarPagamentos.tsx` |
| **31F** | `src/pages/repasses/Relatorios.tsx`, `src/utils/commissionReportPdf.ts` |

---

## FASE 32 — Portal Financeiro do Profissional

> **Contexto:** Profissionais já têm dashboards diferenciados (Fase 12E) e páginas básicas de comissões/salários. Porém, falta uma experiência financeira completa e profissional — extrato detalhado, gráficos de evolução, projeções, relatórios personalizados.
>
> **Benchmark:** Medical App (app com relatórios de produção), iClinic (extrato detalhado), Feegow (consolidação antes do pagamento), Sinaxys Prime (NFS-e automática, trilha de auditoria).
>
> **Diferença do Dashboard (Fase 12E):** Dashboard mostra KPIs do dia/mês. Portal Financeiro é uma área dedicada com histórico completo, análises e ferramentas de gestão pessoal.
>
> **PRÉ-REQUISITO:** Fase 30 (Reorganização) e Fase 31 (Comissões Avançadas) devem estar concluídas.
>
> ⚠️ **CRITÉRIO RIGOROSO:** Implementar TODAS as sub-fases para experiência profissional completa.

### Sub-fase 32A — Extrato Financeiro Detalhado ✅ CONCLUÍDA

> Substituir páginas básicas `/minhas-comissoes` e `/meus-salarios` por experiência unificada e rica.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 32A.1 | Página `/meu-financeiro` — Hub unificado | ALTA | ✅ | Criado `src/pages/MeuFinanceiro.tsx` com 5 abas: Resumo, Comissões, Salários, Histórico, Relatórios. Rotas antigas mantidas para compatibilidade. |
| 32A.2 | Aba "Resumo" — Dashboard financeiro pessoal | ALTA | ✅ | `MeuFinanceiroResumo.tsx`: Cards (A receber, Recebido mês, Projeção 30 dias, Média mensal) + Gráfico evolução 6 meses com Recharts. |
| 32A.3 | Aba "Comissões" — Extrato detalhado | ALTA | ✅ | `MeuFinanceiroComissoes.tsx`: Tabela com Data, Paciente, Serviço, Valor, Comissão, %, Status. Filtros por mês/status, busca, exportação CSV. |
| 32A.4 | Aba "Salários" — Histórico de pagamentos | ALTA | ✅ | `MeuFinanceiroSalarios.tsx`: Tabela com Período, Valor, Status, Método, Data Pagamento. Filtro por ano, exportação CSV. |
| 32A.5 | Aba "Histórico" — Timeline consolidada | MÉDIA | ✅ | `MeuFinanceiroHistorico.tsx`: Timeline unificada comissões + salários, filtros por tipo/status, cards visuais, exportação CSV. |
| 32A.6 | Aba "Relatórios" — Geração personalizada | MÉDIA | ✅ | `MeuFinanceiroRelatorios.tsx`: Seleção período, tipo (comissões/salários/ambos), formato (CSV/PDF). Geração imediata. |

---

### Sub-fase 32B — Gráficos e Análises ✅ CONCLUÍDA

> Visualização de tendências e insights para o profissional.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 32B.1 | Gráfico de evolução de ganhos | ALTA | ✅ | Implementado em `MeuFinanceiroResumo.tsx`: LineChart com comissões, salários e total (últimos 6 meses). |
| 32B.2 | Gráfico de composição | MÉDIA | ✅ | PieChart implementado mostrando distribuição comissões vs salários. |
| 32B.3 | Indicador de faixa de comissão | MÉDIA | ✅ | Já existe `CommissionTierIndicator` integrado na aba Resumo. |
| 32B.4 | Comparativo com média da clínica | BAIXA | ✅ | Implementado com configuração `show_clinic_average_to_staff` em tenant_settings. |
| 32B.5 | Projeção de ganhos | MÉDIA | ✅ | Card "Projeção (30 dias)" baseado em agendamentos futuros. |
| 32B.6 | Alertas e insights | BAIXA | ✅ | Sistema de alertas implementado: comissões pendentes >30 dias, variação mensal, comparativo com média. |

---

### Sub-fase 32C — Notificações e Transparência ✅ CONCLUÍDA

> Profissional informado em tempo real sobre seus ganhos. **Pop-ups de parabéns removidos** — substituídos por notificações discretas.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 32C.1 | Notificação de comissão gerada | ALTA | ✅ | Trigger `trg_notify_commission_generated` cria notificação in-app automática. Removidos pop-ups celebratórios. |
| 32C.2 | Notificação de pagamento realizado | ALTA | ✅ | Trigger `trg_notify_commission_paid` notifica quando admin marca como pago. |
| 32C.3 | Notificação de salário pago | ALTA | ✅ | Trigger `trg_notify_salary_paid` notifica com método de pagamento. |
| 32C.4 | Resumo semanal por email | MÉDIA | ✅ | Edge Function `send-weekly-financial-summary` implementada. Configurável via `weekly_financial_summary` em preferências. |
| 32C.5 | Detalhamento da regra aplicada | MÉDIA | ✅ | Tooltip com detalhes na aba Comissões (tipo, % aplicado). |
| 32C.6 | Contestação de comissão | BAIXA | ✅ | Tabela `commission_disputes` + UI para contestar comissões pendentes. Admin pode aprovar/rejeitar. |

**Arquivos removidos (pop-ups):**
- `CongratulationsCommissionDialog.tsx`
- `AdminProfitCongratulationsDialog.tsx`
- `AdminProfitRealtimeListener.tsx`

**Migration criada:** `20260327700000_financial_notifications_v1.sql`

---

### Sub-fase 32D — Relatórios e Exportações ✅ CONCLUÍDA

> Profissional gera seus próprios relatórios para controle pessoal e declaração de IR.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 32D.1 | Relatório mensal de rendimentos | ALTA | ✅ | Implementado em `MeuFinanceiroRelatorios.tsx`: PDF formatado com período, totais, detalhamento. |
| 32D.2 | Relatório anual para IR | ALTA | ✅ | Opção "Informe Anual (IR)" com seleção de ano-calendário. Gera CSV/PDF com rendimentos mensais e totais. |
| 32D.3 | Exportação CSV/Excel | MÉDIA | ✅ | Disponível em todas as abas + aba Relatórios com período customizado. |
| 32D.4 | Comprovante de pagamento | MÉDIA | ✅ | Botão de comprovante individual na aba Salários para pagamentos realizados. PDF formatado com dados do beneficiário e clínica. |
| 32D.5 | Histórico de relatórios gerados | BAIXA | ⏳ | Pode ser adicionado futuramente. |

---

### Sub-fase 32E — App Mobile do Profissional ✅ CONCLUÍDA

> Acesso rápido aos dados financeiros pelo celular.

| # | Item | Prioridade | Status | Observações |
|---|------|:----------:|:------:|-------------|
| 32E.1 | PWA otimizado para `/meu-financeiro` | ALTA | ✅ | `MeuFinanceiroMobile.tsx` com layout mobile-first, cards compactos, bottom sheet para detalhes. |
| 32E.2 | Widget de resumo no dashboard mobile | ALTA | ✅ | Cards "A Receber" e "Este Mês" com valores destacados. Alerta visual para pendências. |
| 32E.3 | Push notifications financeiras | ALTA | ✅ | Integrado com sistema de notificações existente (triggers de comissão/salário). |
| 32E.4 | Atalho "Meu Financeiro" no PWA | MÉDIA | ✅ | Já disponível via navegação do app. |
| 32E.5 | Modo offline básico | BAIXA | ⏳ | Pode ser adicionado futuramente com service worker. |

---

### Cronograma sugerido — Fase 32

| Ordem | Sub-fase | Prazo | Dependência | Prioridade |
|:-----:|----------|:-----:|:-----------:|:----------:|
| 1 | **32A — Extrato Detalhado** | 1-2 semanas | Fase 30, 31A | 🔴 Alta |
| 2 | **32B — Gráficos e Análises** | 1 semana | 32A | 🟠 Média |
| 3 | **32C — Notificações** | 1 semana | 32A, Fase 18 | 🟠 Alta |
| 4 | **32D — Relatórios** | 1 semana | 32A | 🟠 Alta |
| 5 | **32E — App Mobile** | 1 semana | 32A, Fase 18 | 🟠 Média |

### Estimativa total: 5-7 semanas (1 dev full-time)

---

### Comparativo: Dashboard (Fase 12E) vs Portal Financeiro (Fase 32)

| Aspecto | Dashboard (12E) | Portal Financeiro (32) |
|---------|:---------------:|:----------------------:|
| **Foco** | Operacional (dia-a-dia) | Financeiro (gestão pessoal) |
| **Dados** | KPIs do dia/mês | Histórico completo |
| **Gráficos** | Não | Evolução, composição, projeção |
| **Relatórios** | Não | PDF, Excel, CSV |
| **Notificações** | Básicas | Detalhadas + email semanal |
| **Mobile** | Responsivo | PWA otimizado + shortcuts |
| **Contestação** | Não | Sim |
| **IR** | Não | Relatório anual |

> **Conclusão:** Dashboard e Portal Financeiro são **complementares**, não substitutos. Dashboard = visão operacional. Portal = gestão financeira pessoal.

---

### Arquivos a criar/modificar — Fase 32

| Sub-fase | Arquivos |
|----------|----------|
| **32A** | `src/pages/MeuFinanceiro.tsx`, `src/components/professional/FinancialSummaryCard.tsx`, `src/components/professional/CommissionExtract.tsx`, `src/components/professional/SalaryTimeline.tsx` |
| **32B** | `src/components/professional/EarningsChart.tsx`, `src/components/professional/CompositionChart.tsx`, `src/components/professional/TierProgressCard.tsx` |
| **32C** | `src/lib/professional-notifications.ts`, `supabase/functions/send-weekly-summary/` |
| **32D** | `src/utils/professionalReportPdf.ts`, `src/components/professional/ReportGenerator.tsx` |
| **32E** | Atualização de `public/manifest.json`, `src/components/professional/MobileFinancialWidget.tsx` |

---

## Resumo das Novas Fases (Financeiro e Comissões)

| Fase | Descrição | Dependência | Estimativa |
|:----:|-----------|:-----------:|:----------:|
| **30** | Reorganização do Módulo Financeiro | — | 1-2 semanas |
| **31** | Sistema de Comissões e Repasses Avançado | Fase 30 | 7-10 semanas |
| **32** | Portal Financeiro do Profissional | Fase 30, 31A | 5-7 semanas |

### Ordem de Execução Recomendada

1. **Fase 30** (obrigatória primeiro) — Reorganização do financeiro, separar módulo Repasses
2. **Fase 31A-31B** (após Fase 30) — Fundação e regras de comissão
3. **Fase 32A** (pode iniciar após 31A) — Extrato detalhado do profissional
4. **Fase 31C-31D** (paralelo com 32) — Funcionalidades avançadas de comissão
5. **Fase 31E** (requer integração com gateway) — Split de pagamento
6. **Fase 31F + 32B-32E** (finalização) — Relatórios e mobile

### Estimativa Total: 13-19 semanas (1 dev full-time)

---

### Métricas de sucesso — Fases 30-32

| Métrica | Atual | Meta pós-Fases 30-32 |
|---------|:-----:|:--------------------:|
| Abas no módulo financeiro | 8 | 4-5 (ou páginas separadas) |
| Regras de comissão por profissional | 1 | Ilimitadas |
| Tempo para configurar comissões | ~5 min/profissional | ~2 min/profissional |
| Satisfação dos profissionais (NPS) | Não medido | > 50 |
| Contestações de comissão | Manual (WhatsApp) | Sistema integrado |
| Relatórios financeiros pessoais | 0 | > 2/mês/profissional |
| Adoção do portal financeiro | 0% | > 70% dos profissionais |
| Split automático | 0% | > 50% dos pagamentos (se gateway integrado)
