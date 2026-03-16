# Análise Estratégica ClinicNest — Roadmap 10x

## O que o ClinicNest já tem (base sólida)

O projeto já é **surpreendentemente completo**: 100+ páginas, 45 edge functions, 28 hooks, 7 capacidades de IA, portal do paciente com 16 telas, odontograma, periograma, HL7/RNDS/FHIR, assinatura digital ICP-Brasil, TISS, SNGPC, compliance LGPD, gamificação, chat interno, teleconsulta Twilio, automações 14 triggers, offline sync, multi-unidade, RBAC granular, 4 tiers de assinatura. **A fundação está pronta.**

O que falta é o que separa um software bom de um **indispensável**.

---

## Inventário Completo de Funcionalidades Existentes

### Páginas Públicas / Landing
| Página | Rota | Descrição |
|--------|------|-----------|
| LandingPage | `/` | Site institucional com hero, features, pricing, depoimentos, FAQ |
| SolucoesPage | `/solucoes` | Detalhes das soluções oferecidas |
| SobreNosPage | `/sobre` | Sobre a empresa |
| AgendarDemonstracaoPage | `/agendar-demonstracao` | Formulário de agendamento de demo |
| TermosDeUso | `/termos-de-uso` | Termos de uso legais |
| PoliticaPrivacidade | `/politica-de-privacidade` | Política de privacidade LGPD |
| Contato | `/contato` | Formulário de contato |
| CanalLgpd | `/canal-lgpd` | Canal do titular para LGPD/ANPD |
| PublicBooking | `/agendar/:slug` | Agendamento online público por slug da clínica |
| NpsPublico | `/nps/:token` | Pesquisa NPS pública via token |
| ConfirmarAgendamento | `/confirmar/:token` | Confirmação de agendamento via link |
| ConfirmarRetornoPublico | `/confirmar-retorno/:token` | Confirmação de retorno via link |
| TeleconsultaPublica | `/teleconsulta-publica/:token` | Sala de teleconsulta pública |
| AssinarTermosPublico | `/assinar-termos/:token` | Assinatura de termos via link |
| VerificarDocumento | `/verificar/:hash` | Verificação de autenticidade de documentos |
| PainelChamada | `/painel-chamada` | TV/Painel de chamada de senhas (sala de espera) |

### Autenticação
| Página | Rota | Descrição |
|--------|------|-----------|
| Login | `/login` | Login de profissionais (com Turnstile captcha) |
| Register | `/cadastro` | Cadastro de nova clínica (3 etapas) |
| ForgotPassword | `/forgot-password` | Recuperação de senha |
| ResetPassword | `/reset-password` | Redefinição de senha |
| BirdIdCallback | `/auth/birdid/callback` | Callback OAuth BirdID (certificado digital) |

### Dashboard & Recepção
| Página | Rota | Descrição |
|--------|------|-----------|
| Dashboard | `/dashboard` | Dashboard principal com cards por perfil (médico, dentista, enfermeiro, secretária, faturista, clínico) |
| DashboardRecepcao | `/recepcao` | Dashboard da recepção com fila de atendimento integrada |
| DashboardONA | `/dashboard-ona` | Dashboard de indicadores de acreditação ONA |

### Agenda & Atendimento
| Página | Rota | Descrição |
|--------|------|-----------|
| Agenda | `/agenda` | Agenda de compromissos (dia/semana/mês) com filtros |
| Disponibilidade | `/disponibilidade` | Blocos de disponibilidade dos profissionais |
| RetornosPendentes | `/retornos-pendentes` | Gestão de retornos pendentes |
| Triagem | `/triagem` | Triagem/classificação de risco dos pacientes |
| Teleconsulta | `/teleconsulta` | Sala de teleconsulta (Twilio Video) |
| ListaEspera | `/lista-espera` | Lista de espera para agendamento |

### Pacientes
| Página | Rota | Descrição |
|--------|------|-----------|
| Pacientes | `/pacientes` | Listagem de pacientes com busca e filtros |
| PacienteDetalhe | `/pacientes/:id` | Ficha completa do paciente |
| MensagensPacientes | `/mensagens-pacientes` | Mensagens/comunicação com pacientes |
| ExamesRecebidos | `/exames-recebidos` | Exames recebidos de pacientes |
| FaturasPacientes | `/faturas-pacientes` | Faturas de pacientes |

### Prontuário & Documentos Clínicos
| Página | Rota | Descrição |
|--------|------|-----------|
| Prontuarios | `/prontuarios` | Listagem de prontuários |
| ProntuarioDetalhe | `/prontuarios/:id` | Prontuário detalhado com SOAP, sinais vitais, documentos |
| ModelosProntuario | `/modelos-prontuario` | Templates de prontuário customizáveis |
| ModeloProntuarioEditor | `/modelos-prontuario/:id` | Editor de modelo de prontuário |
| Receituarios | `/receituarios` | Receituários/prescrições |
| Laudos | `/laudos` | Laudos/relatórios médicos |
| Atestados | `/atestados` | Atestados médicos |
| Encaminhamentos | `/encaminhamentos` | Encaminhamentos para especialistas |
| Evolucoes | `/evolucoes` | Evoluções clínicas/de enfermagem (SOAP) |
| TermosConsentimento | `/termos-consentimento` | Gestão de termos de consentimento |
| TermoConsentimentoEditor | `/termos-consentimento/:id` | Editor WYSIWYG de termos |
| ContratosTermos | `/contratos-termos` | Contratos e termos jurídicos |
| ContratoTermoEditor | `/contratos-termos/:id` | Editor de contratos |

### Odontologia
| Página | Rota | Descrição |
|--------|------|-----------|
| Odontograma | `/odontograma` | Odontograma interativo (diagrama dental) |
| Periograma | `/periograma` | Periograma (avaliação periodontal) |
| PlanosTratamento | `/planos-tratamento` | Planos de tratamento odontológico |

### Financeiro
| Página | Rota | Descrição |
|--------|------|-----------|
| Financeiro | `/financeiro` | Módulo financeiro (contas a pagar/receber, fluxo de caixa, projeções) |
| RelatorioFinanceiro | `/relatorio-financeiro` | Relatório financeiro detalhado |
| FaturamentoTISS | `/faturamento-tiss` | Faturamento TISS para convênios |
| NovaGuiaTISS | `/faturamento-tiss/nova-guia` | Criação de guia TISS |
| Convenios | `/convenios` | Gestão de convênios/planos de saúde |
| MinhasComissoes | `/minhas-comissoes` | Visualização de comissões (staff) |
| MeusSalarios | `/meus-salarios` | Visualização de salários (staff) |
| MeuFinanceiro | `/meu-financeiro` | Painel financeiro pessoal do profissional |

### Repasses & Comissões
| Página | Rota | Descrição |
|--------|------|-----------|
| Repasses | `/repasses` | Hub de repasses |
| RepassesComissoes | `/repasses/comissoes` | Gestão de comissões |
| RepassesSalarios | `/repasses/salarios` | Gestão de salários |
| RepassesRelatorios | `/repasses/relatorios` | Relatórios de repasses |
| ConfigurarRegras | `/repasses/regras` | Regras de comissão (tiers, %, bônus) |
| RelatorioCaptacao | `/repasses/captacao` | Relatório de captação por indicação |

### Estoque & Compras
| Página | Rota | Descrição |
|--------|------|-----------|
| Produtos | `/produtos` | Gestão de produtos/estoque com categorias |
| Compras | `/compras` | Gestão de compras/ordens |
| NovaCompra | `/compras/nova` | Nova ordem de compra |
| Fornecedores | `/fornecedores` | Cadastro de fornecedores |

### Relatórios
| Página | Rota | Descrição |
|--------|------|-----------|
| Relatorios | `/relatorios` | Central de relatórios (no-show, pacientes, produtividade, satisfação) |
| RelatoriosCustomizaveis | `/relatorios-customizaveis` | Builder de relatórios customizáveis |

### Marketing & Campanhas
| Página | Rota | Descrição |
|--------|------|-----------|
| Campanhas | `/campanhas` | Gestão de campanhas de marketing |
| NovaCampanha | `/campanhas/nova` | Email builder + criativos para social media |
| Automacoes | `/automacoes` | Automações (WhatsApp, NPS, lembretes) |

### Administração
| Página | Rota | Descrição |
|--------|------|-----------|
| Equipe | `/equipe` | Gestão da equipe (profissionais) |
| GerenciarPermissoes | `/gerenciar-permissoes` | RBAC — gestão de permissões por perfil |
| Unidades | `/unidades` | Multi-unidade (filiais) |
| GestaoSalas | `/gestao-salas` | Gestão de salas/consultórios |
| Procedimentos | `/procedimentos` | Cadastro de procedimentos |
| Especialidades | `/especialidades` | Cadastro de especialidades |
| Configuracoes | `/configuracoes` | Configurações gerais da clínica |
| Integracoes | `/integracoes` | Integrações (gateways, WhatsApp, SMS, HL7, RNDS, NFSe) |
| ApiDocumentation | `/api-docs` | Documentação de API pública |
| AdminOverrides | `/admin/overrides` | Overrides de features/limites por tenant |

### Compliance & segurança
| Página | Rota | Descrição |
|--------|------|-----------|
| Auditoria | `/auditoria` | Logs de auditoria completos |
| DiagnosticoSeguranca | `/diagnostico-seguranca` | Diagnóstico de segurança do sistema |
| Compliance | `/compliance` | Painel de compliance (TSA, RIPD, certificações) |
| RetencaoDados | `/retencao-dados` | Política de retenção CFM (20 anos) |
| TransmissaoSNGPC | `/sngpc` | Transmissão SNGPC para ANVISA |

### Assinatura
| Página | Rota | Descrição |
|--------|------|-----------|
| Assinatura | `/assinatura` | Planos e preços |
| GerenciarAssinatura | `/assinatura/gerenciar` | Gerenciar assinatura atual |

### Conta Pessoal
| Página | Rota | Descrição |
|--------|------|-----------|
| Notificacoes | `/notificacoes` | Central de notificações |
| MinhasConfiguracoes | `/minhas-configuracoes` | Configurações pessoais |
| Chat | `/chat` | Chat interno da equipe |
| Suporte | `/suporte` | Tickets de suporte |
| Ajuda | `/ajuda` | Central de ajuda (changelog, tutoriais, NPS, atalhos) |

### Portal do Paciente (16 páginas)
| Página | Rota | Descrição |
|--------|------|-----------|
| PatientLogin | `/paciente/login` | Login do paciente (via código de acesso) |
| PatientDashboard | `/paciente/dashboard` | Dashboard do paciente |
| PatientAgendar | `/paciente/agendar` | Agendamento online pelo paciente |
| PatientConsultas | `/paciente/consultas` | Histórico de consultas |
| PatientTeleconsulta | `/paciente/teleconsulta` | Teleconsulta do lado paciente |
| PatientFinanceiro | `/paciente/financeiro` | Financeiro (faturas, pagamentos) |
| PatientMensagens | `/paciente/mensagens` | Chat com a clínica |
| PatientSaude | `/paciente/saude` | Dados de saúde do paciente |
| PatientExames | `/paciente/exames` | Resultados de exames |
| PatientReceitas | `/paciente/receitas` | Receitas/prescrições |
| PatientAtestados | `/paciente/atestados` | Atestados |
| PatientLaudos | `/paciente/laudos` | Laudos médicos |
| PatientConsentSigning | `/paciente/termos` | Assinatura de termos obrigatórios |
| PatientProfile | `/paciente/perfil` | Perfil do paciente |
| PatientSettings | `/paciente/configuracoes` | Configurações do paciente |
| PatientDependentes | `/paciente/dependentes` | Gestão de dependentes |

---

## Módulos de Componentes

| Módulo | Funcionalidade |
|--------|----------------|
| **ai/** | IA completa: chat agente, sugestão CID, predição no-show, chat paciente, resumo clínico, transcrição de áudio, triagem automatizada |
| **agenda/** | Agenda com filtros, cards, tabela, pagamento, seleção de horários |
| **auth/** | Proteção de rotas por role/recurso, captcha Cloudflare |
| **campanhas/** | Builder de email marketing + criativos para redes sociais |
| **chat/** | Chat interno com canais, anexos, menções |
| **commission/** | Sistema completo de comissões: preview, regras escalonadas, simulador, indicador de tier |
| **consent/** | LGPD: gate de consentimento, editor rich text, captura facial, geração de contratos, envio de link |
| **dashboard/** | Dashboards especializados por perfil profissional (6 tipos) |
| **financeiro/** | Fluxo de caixa, exportação PDF, gráficos financeiros |
| **goals/** | Metas: criação wizard, sugestões, achievements, gamificação |
| **header/** | Busca global e barra de progresso de metas |
| **landing/** | Landing page completa com chatbot de vendas |
| **odontograma/** | Odontograma interativo com edição por dente + Periograma |
| **patient/** | Portal do paciente: avaliação, DICOM viewer, tour, busca, nav mobile |
| **produtos/** | Gestão completa de estoque |
| **prontuario/** | Prontuário completo com sinais vitais, imagens dentais, documentos rápidos |
| **quality/** | Registro de eventos adversos (ONA) |
| **queue/** | Chamada de paciente na fila |
| **relatorios/** | 4 abas de relatórios (produtividade, pacientes, no-show, satisfação) |
| **settings/** | Configurações: certificados digitais, chatbot, gamificação, HL7, NFSe, notificações, offline, gateways, RNDS, SMS, tema |
| **signature/** | Assinatura digital com QR Code de verificação |
| **subscription/** | Feature gating completo por plano |
| **teleconsulta/** | Sala de vídeo Twilio |

---

## 28 Hooks

| Hook | Funcionalidade |
|------|---------------|
| `useAIAgentChat` | Chat com agente IA (Claude/Bedrock) com histórico de conversa |
| `useCertificateSign` | Assinatura digital com certificado ICP-Brasil/BirdID |
| `useClinicalAudit` | Log de auditoria de acesso a dados clínicos |
| `useClinicSubscriptionStatus` | Status da assinatura da clínica |
| `useCompliance` | Sistema de compliance (TSA, RIPD, exportação de prontuário) |
| `useDebounce` | Debounce genérico |
| `useDependents` | Gestão de dependentes de pacientes |
| `useExamResults` | CRUD de resultados de exames |
| `useFormDrawer` | Drawer de formulário reutilizável |
| `useGamificationEnabled` | Verifica se gamificação está habilitada |
| `useMobile` | Detecção de dispositivo mobile |
| `useOfflineSync` | Sincronização offline bidirecional |
| `useONAIndicators` | Indicadores de acreditação ONA |
| `usePatientPushNotifications` | Push notifications para pacientes |
| `usePatientQueue` | Fila de atendimento com realtime |
| `usePermissions` | RBAC granular |
| `usePlanFeatures` | Feature gating por plano |
| `useProfessionals` | Lista de profissionais da clínica |
| `usePushNotifications` | Push notifications (Firebase/Web Push) |
| `useReports` | Relatórios customizáveis (builder, filtros, agrupamentos, charts) |
| `useRetentionPolicy` | Política de retenção de dados CFM (20 anos) |
| `useReturnReminders` | Lembretes de retorno (WhatsApp, email, SMS) |
| `useRooms` | Gestão de salas/consultórios |
| `useScrollReveal` | Animação de scroll na landing |
| `useSNGPC` | Integração SNGPC/ANVISA |
| `useSubscription` | Status e parsing de plano/tier de assinatura |
| `useUnreadChatCount` | Contagem de mensagens não lidas |
| `useUsageStats` | Estatísticas de uso para billing |

---

## 45 Supabase Edge Functions

| Função | Descrição |
|--------|-----------|
| `ai-agent-chat` | Chat com agente IA (Claude/Bedrock) com 8 tools |
| `ai-patient-chat` | Chat IA para pacientes |
| `ai-cid-suggest` | Sugestão de CID-10 via IA |
| `ai-sentiment` | Análise de sentimento de texto |
| `ai-summary` | Resumo clínico por IA |
| `ai-transcribe` | Transcrição de áudio (AWS Transcribe Medical) |
| `ai-triage` | Triagem automatizada via IA |
| `asaas-pix` | Geração de QR Code PIX (Asaas) |
| `create-charge-with-split` | Cobrança com split de pagamento |
| `create-checkout` | Sessão de checkout (Asaas) |
| `create-patient-payment` | Pagamento de paciente |
| `payment-webhook-handler` | Handler de webhooks de pagamento |
| `notify-patient-appointment` | Notificação de agendamento |
| `notify-patient-events` | Notificações de eventos diversos |
| `notify-patient-invoice-due` | Notificação de fatura vencendo |
| `notify-patient-message` | Notificação de nova mensagem |
| `sms-sender` | Envio de SMS |
| `whatsapp-sender` | Envio de WhatsApp |
| `whatsapp-chatbot` | Chatbot WhatsApp para atendimento |
| `whatsapp-sales-chatbot` | Chatbot de vendas via WhatsApp |
| `evolution-proxy` | Proxy para Evolution API (WhatsApp) |
| `invite-team-member` | Convite de membro da equipe |
| `remove-team-member` | Remoção de membro |
| `reset-team-member-password` | Reset de senha do membro |
| `check-subscription` | Verificação de assinatura |
| `cancel-subscription` | Cancelamento de assinatura |
| `run-campaign` | Execução de campanha de marketing |
| `activate-patient-account` | Ativação de conta do paciente |

---

## Capacidades de IA (7 implementadas)

| Feature | Modelo | Status |
|---------|--------|--------|
| Agent Chat (staff) | Claude 3 Haiku (Bedrock) | ✅ Completo — 8 tools, multi-round (5 rounds), memória persistida |
| Patient Chat | Claude 3 Haiku (Bedrock) | ✅ Completo — 3 rounds, tools para ver agendamentos/serviços/contato |
| Triagem Virtual | Claude 3 Haiku (Bedrock) | ✅ Completo — Coleta sintomas, sugere especialidade + urgência |
| Resumo Prontuário | Claude 3 Haiku (Bedrock) | ✅ Completo — Markdown, opções configuráveis, role-gated |
| Sugestão CID-10 | Claude 3 Haiku (Bedrock) | ✅ Completo — 5 sugestões com confiança, integrado no ProntuarioForm |
| Transcrição médica | AWS Transcribe Medical | ✅ Completo — Com especialidade, gravação ou upload, polling |
| Análise de sentimento | Claude 3 Haiku (Bedrock) | ✅ Completo — 8 aspectos, `action_required` flag |
| No-Show Prediction | Modelo local (JS) | ✅ Completo — Não usa LLM |

### Segurança da IA
- Anti-prompt-injection em todos os system prompts
- Rate limiting por usuário (5-20 req/min)
- Plan gating no frontend e backend
- Role-based access (summary/transcribe/CID exigem perfil médico)
- Tenant isolation no system prompt + RLS

---

## Modelo de Assinatura

### Planos e Preços

| Plano | Mensal | Anual |
|-------|--------|-------|
| **Starter** | R$89,90 | R$809,00 (R$67,42/mês) |
| **Solo** | R$159,90 | R$1.439,10 (R$119,93/mês) |
| **Clínica** | R$289,90 | R$2.609,10 (R$217,43/mês) |
| **Premium** | R$399,90 | R$3.599,00 (R$299,92/mês) |

### Limites por Plano

| Recurso | Starter | Solo | Clínica | Premium |
|---------|---------|------|---------|---------|
| Profissionais | 1 | 2 | 6 | Ilimitado |
| Pacientes | 100 | 500 | 3.000 | Ilimitado |
| Agendamentos/mês | 200 | 500 | Ilimitado | Ilimitado |
| Teleconsultas/mês | 5 | 10 | 30 | Ilimitado |
| SMS/mês | 50 | 200 | 500 | Ilimitado |
| Storage | 1 GB | 5 GB | 20 GB | Ilimitado |
| Histórico | 6 meses | 12 meses | Ilimitado | Ilimitado |
| Automações | 0 | 3 | 10 | Ilimitado |
| Unidades | 1 | 1 | 1 | Ilimitado |
| IA req/dia | 10 | 25 | 60 | Ilimitado |
| Transcrição IA/mês | 0 min | 0 min | 60 min | Ilimitado |

---

## Integrações Existentes

| Integração | Status |
|------------|--------|
| HL7 | ✅ Receiver + Sender, connections inbound/outbound |
| RNDS (FHIR) | ✅ Submit FHIR bundles, certificado ICP-Brasil |
| WhatsApp (Evolution API) | ✅ Chatbot + state machine |
| WhatsApp (Meta Cloud API) | ✅ Cliente completo v18.0 |
| SMS | ✅ Edge function + config |
| NFSe | ✅ Config + emissão |
| Asaas (Pagamentos) | ✅ Pix, boleto, webhook handler, split |
| Twilio Video | ✅ Teleconsulta com tokens |
| Certificados digitais ICP-Brasil | ✅ PFX + BirdID OAuth |
| Firebase (Push) | ✅ Web Push notifications |
| Gamificação | ✅ Settings + metas + achievements |

---

## Infraestrutura

| Componente | Status |
|-----------|--------|
| Rate limiting | ✅ Upstash Redis + fallback in-memory |
| Webhook retry | ✅ Backoff exponencial, 8 tentativas, idempotência |
| Background jobs | ⚠️ GitHub Actions cron (sem queue durável) |
| Monitoring | ⚠️ Sentry nos endpoints de billing |
| Feature flags | ⚠️ DB-only (sem UI admin, sem rollout gradual) |
| Offline sync | ✅ Bidirecional com sync queue |
| Multi-tenant RLS | ✅ Todas as tabelas com FORCE ROW LEVEL SECURITY |

---

## Portal do Paciente — O que está ausente vs líderes de mercado

| Feature | Status |
|---------|--------|
| Check-in online (pre-appointment) | ❌ Não existe |
| Questionários pré-consulta digitais | ❌ Apenas consentimento |
| Compartilhamento com outros médicos | ❌ Sem export HL7/FHIR para paciente |
| Pedido de refill de receita | ❌ Só visualização |
| Mensagens por profissional (thread separado) | ❌ Thread única com clínica |
| Wearable/Health Kit sync | ❌ Completamente ausente |
| Cartão virtual de saúde (QR code) | ❌ Ausente |
| Proxy access (cuidador com acesso delegado) | ❌ Tem dependentes, mas sem delegation |
| Pagamento recorrente do paciente | ❌ Paga fatura individual |

---

## IA — O que está ausente

| Feature | Status |
|---------|--------|
| Sugestão de conduta/tratamento (CDS) | ❌ Só CID, sem clinical decision support |
| Resumo automático pós-consulta (auto-SOAP) | ❌ Transcrição existe, mas não gera SOAP |
| Detecção de interações medicamentosas | ❌ Completamente ausente |
| OCR de receitas/exames | ❌ Ausente |
| RAG com guidelines médicas | ❌ Sem base de conhecimento indexada |
| Tradução para pacientes (termos médicos → leigo) | ❌ Ausente |
| Geração de relatórios analíticos com IA | ❌ Ausente |

---

## Workflow Clínico — O que está ausente

| Feature | Status |
|---------|--------|
| Fluxo de aprovação de receita (4 olhos) | ❌ |
| E-prescribing (envio eletrônico para farmácia) | ❌ |
| Protocolo de Manchester (triagem estruturada) | ❌ Triagem é livre |
| Clinical pathways configuráveis | ❌ Sem protocolos predefinidos |
| Imagens radiográficas com anotação | ⚠️ Tem gallery, sem anotação |
| Cross-tenant referral (encaminhamento entre clínicas) | ❌ |
| Offline para prontuários | ❌ Offline cobre agenda/pacientes, mas não prontuários |
| Alertas de interação medicamentosa no ProntuarioForm | ❌ |
| TISS envio eletrônico real | ⚠️ Tem página mas sem envio real para operadoras |

---

# PROPOSTAS DE MELHORIA — 7 CATEGORIAS

---

## 1. Funcionalidades que estão faltando e seriam extremamente valiosas

| # | Funcionalidade | Impacto | Justificativa |
|---|---------------|---------|---------------|
| 1.1 | **Interação medicamentosa em tempo real** | CRÍTICO | Ao prescrever, cruzar com medicamentos ativos do paciente + database Anvisa. Nenhum concorrente BR faz isso bem. Salva vidas = indispensável. |
| 1.2 | **Check-in online pré-consulta** | ALTO | Paciente preenche anamnese/questionários antes de chegar. Economiza 10-15min por consulta. |
| 1.3 | **Auto-SOAP via transcrição** | ALTO | A transcrição já existe mas gera texto bruto. Deve gerar SOAP estruturado preenchendo os campos automaticamente. |
| 1.4 | **Protocolos clínicos configuráveis** | ALTO | Ao selecionar CID, sugerir checklist pré-definido (exames, medicamentos padrão, retorno). Ex: Diabetes → HbA1c + glicemia + retorno 90 dias. |
| 1.5 | **Importação de dados de outro sistema** | ALTO | Wizard de migração: importar pacientes via CSV/Excel. Barreira #1 de troca de software. |
| 1.6 | **Relatórios fiscais obrigatórios** | MÉDIO | DMED (declaração médica para Receita Federal), integração contábil. |
| 1.7 | **Plano gratuito permanente (Freemium)** | ALTO | Starter sem trial. 1 profissional, 30 pacientes, agenda básica. Funil de aquisição orgânico. |

---

## 2. Melhorias na experiência do médico/profissional

| # | Melhoria | Detalhes |
|---|---------|----------|
| 2.1 | **Preenchimento inteligente de prontuário** | IA sugere anamnese, exame físico e plano baseado em CID + histórico do paciente. Expandir o AiCidSuggest para sugestão de conduta completa. |
| 2.2 | **Dashboard com "próximo paciente" contextual** | Mostrar: último prontuário, alertas (alergia, interação), exames pendentes, motivo da consulta — tudo antes do paciente entrar na sala. |
| 2.3 | **Atalhos de teclado no prontuário** | Frases rápidas (snippets) tipo `.hda` → expande para template de anamnese. Caso de uso: médico digita muito. |
| 2.4 | **Templates inteligentes por CID** | Ao selecionar CID, auto-preencher campos com template padrão para aquela condição. Diferente dos templates atuais que são por especialidade. |
| 2.5 | **Dictation mode contínuo** | Microfone sempre ativo no prontuário — integrar como input direto nos campos SOAP. Modo voz primeiro. |
| 2.6 | **Anotação em imagens radiográficas** | Canvas de anotação (setas, círculos, texto) para marcar achados em imagens. |

---

## 3. Melhorias no portal do paciente

| # | Melhoria | Detalhes |
|---|---------|----------|
| 3.1 | **Check-in online** | 24h antes: confirmar dados, preencher questionário pré-consulta, anexar exames, aceitar termos. Reduz tempo de espera. |
| 3.2 | **Cartão virtual de saúde** | QR code no celular com dados essenciais (alergias, tipo sanguíneo, medicamentos, convênio). Em emergência é vital. |
| 3.3 | **Pedido de renovação de receita** | Paciente solicita "refill" pelo portal → médico aprova ou agenda retorno. Hoje só visualiza. |
| 3.4 | **Monitoramento de saúde (wearables)** | Integrar Google Health Connect / Apple HealthKit → glicemia, pressão, passos aparecem no prontuário. |
| 3.5 | **Avaliação pós-consulta gamificada** | NPS contextual + pontos de fidelidade → desconto na clínica. Aumenta retenção. |
| 3.6 | **Chat direto com profissional** | Permitir conversar diretamente com o médico que atendeu, como WhatsApp threads. |
| 3.7 | **Compartilhar prontuário** | Exportar PDF/FHIR do prontuário para levar a outro médico. Direito do paciente pela LGPD. |

---

## 4. IA avançada — onde o ClinicNest pode liderar

| # | Funcionalidade | Como implementar |
|---|---------------|-----------------|
| 4.1 | **Clinical Decision Support (CDS)** | Ao finalizar prontuário, IA analisa diagnóstico + medicamentos + exames e sugere condutas. Usar RAG com guidelines brasileiras (SBC, SBD). |
| 4.2 | **Auto-SOAP completo** | Gravar consulta → transcrever → nova função `ai-generate-soap` que popula S/O/A/P automaticamente → médico revisa e aprova. Elimina 70% da digitação. |
| 4.3 | **Predição de cancelamento proativa** | Evoluir o `AiNoShowPrediction` para enviar SMS preventivo 2h antes quando risco > 60%. |
| 4.4 | **Alerta de deterioração clínica** | Analisar série temporal de sinais vitais — alertar se tendência de piora (ex: pressão subindo em 3 consultas consecutivas). |
| 4.5 | **RAG com protocolos médicos** | Indexar guidelines (UpToDate summaries, Protocolos MS, PCDT) → IA consulta durante atendimento. Nenhum software BR tem isso integrado. |
| 4.6 | **OCR de exames e receitas** | Paciente fotografa exame/receita → IA extrai dados estruturados → popula no prontuário. AWS Textract já está no ecossistema. |
| 4.7 | **Resumo executivo semanal para gestores** | IA gera: "Esta semana: 45 atendimentos (+12%), 3 no-shows (-50%), receita R$23k (+8%). Recomendação: abrir horários às quartas (demanda reprimida)." |
| 4.8 | **Tradução médico→paciente** | Botão "Explicar ao paciente" → traduz diagnóstico técnico para linguagem leiga → gera PDF educativo ou envia por WhatsApp. |

---

## 5. Automações que reduziriam trabalho administrativo

| # | Automação | Economia estimada |
|---|----------|------------------|
| 5.1 | **Confirmação inteligente de agenda** | Se não confirmou em 4h → WhatsApp. Se não em 1h → SMS. Se não em 30min → liga automaticamente. Libera vaga se não confirma. Economia: 5-10h/semana secretária. |
| 5.2 | **Fila de espera automática** | Ao cancelamento, notificar automaticamente o próximo da fila com link de auto-booking. Economia: 2-3h/semana. |
| 5.3 | **Fluxo de cobrança automatizado** | Sequência progressiva: D-3 lembrete → D+1 cobrança → D+7 urgente → D+30 negativação. Economia: 5h/semana financeiro. |
| 5.4 | **Reconciliação convênio automatizada** | TISS enviado → rastrear glosas automaticamente → gerar recurso com justificativas pré-preenchidas. |
| 5.5 | **Relatório semanal automático por e-mail** | Enviar todo domingo: resumo da semana (atendimentos, faturamento, no-shows, NPS). Os dados já existem — falta o cron + email. |
| 5.6 | **Workflow de documentos multi-step** | Automações condicionais: se paciente assinou termo → agendar → enviar orientações → D-1 lembrete → D+1 feedback → D+7 retorno. |

---

## 6. Diferenciais competitivos vs sistemas maiores

### O que o ClinicNest JÁ tem que concorrentes NÃO têm

| Diferencial | vs iClinic | vs Doctoralia | vs Feegow |
|------------|-----------|--------------|----------|
| IA integrada nativamente (7 capacidades) | Não tem IA | Não tem IA | Tem básico |
| Portal do paciente completo (16 telas) | Portal básico | Sim, forte | Básico |
| Odontograma + Periograma nativo | Não tem | Não tem | Não tem |
| Assinatura digital ICP-Brasil | Não tem | Não tem | Parcial |
| Offline sync real | Não tem | Não tem | Não tem |
| Gamificação de equipe | Não tem | Não tem | Não tem |
| Painel chamada TV | Não tem | Não tem | Parcial |
| Dashboard ONA (acreditação) | Não tem | Não tem | Não tem |
| WhatsApp chatbot + sales bot | Parcial | Sim | Parcial |

### O que falta para competir com os maiores

| # | O que falta | Prioridade |
|---|------------|-----------|
| 6.A | **App mobile nativo** (iOS/Android) | CRÍTICO — médicos usam celular. PWA existe mas não é App Store. |
| 6.B | **Marketplace de integrações** | ALTO — plugins de contabilidade, estoque avançado, DICOM. |
| 6.C | **API pública com sandbox** | ALTO — ApiDocumentation existe mas sem sandbox real. |
| 6.D | **SSO/SAML para hospitais** | MÉDIO — hospitais exigem SSO corporativo. |
| 6.E | **White-label** | MÉDIO — permitir rebranding para redes (logo+cores+domínio). |

---

## 7. Ideias inovadoras que quase nenhum software de gestão clínica possui

| # | Ideia | Por que é game-changer |
|---|------|----------------------|
| 7.1 | **"Copilot Clínico"** — IA sempre presente durante a consulta | Transcrição em tempo real + sugestões contextuais na lateral. Enquanto o médico fala, a IA sugere CID, prescrição, exames, alertas de interação. Nenhum software BR faz isso. |
| 7.2 | **Benchmarking anônimo cross-clínicas** | "Sua taxa de no-show (12%) está acima da média regional (8%). Clínicas que usam confirmação por WhatsApp 24h+2h têm 4% de no-show." Dados agregados do ClinicNest. |
| 7.3 | **Revenue Intelligence** | IA analisa padrão de agendamentos e sugere: "Abrir horários sábado manhã geraria ~R$8k/mês (baseado em demanda reprimida de 23 pacientes que pediram sábado)." |
| 7.4 | **Prontuário por voz end-to-end** | Médico não toca no teclado. Entra na sala → diz "iniciar consulta" → grava tudo → auto-SOAP → confirma por voz → assina digitalmente. Zero digitação. |
| 7.5 | **Paciente como sensor (PROMs)** | Portal coleta Patient Reported Outcome Measures entre consultas. Alertas automáticos se score piora. Ex: paciente pós-cirúrgico reporta dor 8/10 → alerta no celular do médico. |
| 7.6 | **Rede de encaminhamento inteligente** | Ao encaminhar, mostrar profissionais parceiros com agenda disponível + avaliação dos pacientes. Match automático. Gera receita de indicação. |
| 7.7 | **"Clínica Autônoma" mode** | Paciente agenda online → check-in automático → preenche anamnese → IA prepara prontuário → médico só revisa. Receita sai automaticamente pós-consulta. Zero trabalho administrativo. |
| 7.8 | **Créditos de saúde** | Paciente acumula pontos (consultas, vacinas, check-ups) → troca por descontos. Aumenta retenção. |

---

## Funcionalidades que tornariam o produto INDISPENSÁVEL

As 5 que fariam a clínica **não conseguir viver sem** o ClinicNest:

1. **Copilot Clínico com Auto-SOAP** (7.1 + 4.2) — médico economiza 40-60min/dia de digitação. Uma vez que experimenta, não volta atrás.

2. **Interação medicamentosa em tempo real** (1.1) — responsabilidade legal. Clínica que não tem, corre risco. CRM pode exigir.

3. **Confirmação inteligente + fila de espera automática** (5.1 + 5.2) — reduz no-show de 15% para 3-4%, recupera R$5-15k/mês em receita perdida.

4. **Check-in online + questionário pré-consulta** (3.1) — paciente chega pronto, consulta começa imediato. Atender 2-3 pacientes a mais por dia.

5. **App mobile nativo** (6.A) — médico consulta agenda, recebe alertas, aprova receitas do celular. PWA não aparece na App Store e perde push notifications em iOS.

---

## Priorização (impacto x esforço)

| Prioridade | Feature | Esforço | Impacto |
|-----------|---------|---------|---------|
| **P0** | Auto-SOAP via transcrição | Médio (base existe) | Enorme |
| **P0** | Check-in online pré-consulta | Médio | Alto |
| **P0** | Confirmação inteligente de agenda | Baixo (infra pronta) | Alto |
| **P1** | Interação medicamentosa | Alto (precisa DB Anvisa) | Crítico |
| **P1** | Importação de dados CSV | Baixo | Alto (conversão) |
| **P1** | Plano freemium permanente | Baixo | Alto (aquisição) |
| **P1** | Fila de espera automática | Baixo (base existe) | Médio |
| **P2** | Copilot Clínico real-time | Alto | Game-changer |
| **P2** | App mobile (React Native) | Alto | Retenção |
| **P2** | Revenue Intelligence | Médio | Diferencial |
| **P3** | Benchmarking cross-clínicas | Alto (precisa massa) | Lock-in |
| **P3** | Wearable integration | Alto | Diferencial |
