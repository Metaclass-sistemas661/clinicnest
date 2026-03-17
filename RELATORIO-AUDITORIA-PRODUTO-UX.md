# RELATÓRIO DE AUDITORIA — PRODUTO, UX/UI & RBAC

**Projeto:** ClinicNest  
**Data:** 17 de março de 2026  
**Auditora:** Head de Produto (CPO), UX/UI Sênior & Arquiteta de Segurança (RBAC)  
**Modo:** Somente Leitura — nenhum arquivo foi alterado  

---

## Sumário Executivo

| Dimensão | Score | Veredicto |
|---|---|---|
| Redundância de Funcionalidades (IA) | 4/10 | 5 sobreposições críticas, 1 componente morto |
| Granularidade RBAC por Especialidade | 3/10 | Prontuário idêntico para todos; 4 profissões com nota D |
| Adaptabilidade de Nicho (Estética) | 2/10 | 3 gaps bloqueantes (P0), landing page promete features inexistentes |
| Carga Cognitiva & Fadiga Visual | 4/10 | 73 modais, 12 famílias de cores, formulário de 26+ campos sem collapse |

> **Diagnóstico geral:** O ClinicNest possui motor técnico potente (14 recursos de IA, RBAC granular, sistema de consentimento robusto) mas sofre de **obesidade de interface**: componentes demais visíveis ao mesmo tempo, funcionalidades duplicadas competindo por atenção, e ausência de personalização por especialidade profissional. Para quem usa 8h/dia, é uma receita para fadiga.

---

## Índice

1. [Caça a Redundâncias — Foco em IA e Prontuário](#1-caça-a-redundâncias--foco-em-ia-e-prontuário)
2. [Granularidade de Acessos — Segregação por Especialidade](#2-granularidade-de-acessos--segregação-por-especialidade)
3. [Adaptabilidade de Nicho — Clínicas de Estética Avançada](#3-adaptabilidade-de-nicho--clínicas-de-estética-avançada)
4. [Auditoria de Carga Cognitiva e Fadiga Visual](#4-auditoria-de-carga-cognitiva-e-fadiga-visual)
5. [Plano de Ação Consolidado](#5-plano-de-ação-consolidado)

---

## 1. Caça a Redundâncias — Foco em IA e Prontuário

### 1.1. Inventário Completo de IA no Prontuário

Foram identificados **14 componentes de IA ativos** + **1 componente morto** distribuídos em 3 superfícies:

#### A) Dentro do ProntuarioForm (formulário de criação/edição) — 9 widgets

| # | Componente | Trigger | Edge Function | Cliques |
|---|---|---|---|---|
| 1 | **VoiceFirstDictation** | Botão "Modo Voz" → gravar → parar | `ai-transcribe` + `ai-generate-soap` | 2 |
| 2 | **AiTranscribe** (toggle) | Botão "Ditar com IA" / "Fechar Ditado" | `ai-transcribe` | 2-3 |
| 3 | **Auto-SOAP** (pós-transcrição) | Botão "Auto-SOAP" (após AiTranscribe) | `ai-generate-soap` | +1 |
| 4 | **AiDeteriorationAlert** | Botão "Analisar" | `ai-deterioration-alert` | 1 |
| 5 | **AiClinicalProtocols** | Botão "Protocolo Clínico" (CID preenchido) | `ai-clinical-protocols` | 1 |
| 6 | **AiSmartReferral** | Botão "Sugerir Encaminhamento" | `ai-smart-referral` | 1 |
| 7 | **AiDrugInteractionAlert** | Botão "Verificar Interações" | `ai-drug-interactions` | 1 |
| 8 | **ExamOcrAnalyzer** | Upload/drop de imagem de exame | `ai-ocr-exam` | 1-2 |
| 9 | **PROMs Viewer** | Automático (se houver dados) | — | 0 |

#### B) Sidebar Direita (RightSidebar) — 2 widgets auto-fire

| # | Componente | Trigger | Edge Function |
|---|---|---|---|
| 10 | **AiGpsNavigator** | Auto (debounce 3s) + botão "Avaliar" | `ai-gps-evaluate` |
| 11 | **AiCopilotPanel** | Auto (debounce 2s) + botão refresh ⟳ | `ai-copilot` |

#### C) Tela de Detalhe (ProntuarioDetalhe) — 4 widgets de leitura

| # | Componente | Trigger | Edge Function |
|---|---|---|---|
| 12 | **AiExplainToPatient** (diagnóstico) | Botão "Explicar ao paciente" | `ai-explain-patient` |
| 13 | **AiExplainToPatient** (plano) | Botão "Explicar ao paciente" | `ai-explain-patient` |
| 14 | **AiExplainToPatient** (prescrição) | Botão "Explicar ao paciente" | `ai-explain-patient` |
| 15 | **AiPatientSummary** | Botão "Gerar Resumo com IA" (aba IA) | `ai-summary` |

#### D) Componente morto

| # | Componente | Arquivo | Status |
|---|---|---|---|
| 16 | **AiCidSuggest** | `src/components/ai/AiCidSuggest.tsx` | Exportado no index.ts, **importado por ninguém** |

**Total: 12 Edge Functions de IA** (11 ativas + 1 órfã `ai-cid-suggest`).

---

### 1.2. Mapa de Sobreposição Funcional

#### 🔴 CRÍTICO #1 — Sugestão de CID: 3 caminhos simultâneos

| Caminho | Mecanismo | Onde |
|---|---|---|
| AiCopilotPanel (sidebar) | Auto-fire → `ai-copilot` → seção "CID-10" com click-to-insert | Sidebar direita |
| Cid10Combobox | Busca manual textual (não-IA) | Inline no formulário |
| AiCidSuggest | Input → `ai-cid-suggest` → lista com score de confiança | **Não renderizado — código morto** |

**Impacto:** Médico recebe CID automaticamente do sidebar E pode buscar manualmente. `AiCidSuggest` é dead code.

#### 🔴 CRÍTICO #2 — Transcrição + SOAP: 2 pipelines paralelos para o mesmo resultado

| Pipeline | Componentes | Cliques | Resultado |
|---|---|---|---|
| **"Modo Voz"** (VoiceFirstDictation) | 1 componente, pipeline automatizado | 2 (gravar → parar) | Transcreve + SOAP + preenche campos |
| **"Ditar com IA"** (AiTranscribe + Auto-SOAP) | 2 componentes, pipeline manual | 3-4 (abrir → gravar → parar → clicar Auto-SOAP) | Transcreve → mostra texto → pergunta → gera SOAP |

**Impacto:** Dois botões de voz no mesmo formulário. O "Modo Voz" é estritamente superior.

> **Agravante técnico:** `ai-generate-soap` é chamada de **2 locais independentes** com parsing de resultado ligeiramente diferente (VoiceFirstDictation.tsx L96 vs ProntuarioForm.tsx L663).

#### 🟠 ALTO #3 — Sugestão de Medicamentos: 2 fontes não-coordenadas

| Fonte | Trigger | Output |
|---|---|---|
| AiCopilotPanel → seção "Medicamentos" | Auto (debounce 2s) | Nome + posologia + indicação |
| AiClinicalProtocols → "Medicações de 1ª Linha" | Manual (1 clique) | Nome + posologia + duração |

**Impacto:** Mesma sugestão pode aparecer em 2 locais sem deduplicação.

#### 🟠 ALTO #4 — Sugestão de Exames: 2 fontes não-coordenadas

| Fonte | Trigger |
|---|---|
| AiCopilotPanel → seção "Exames" | Auto (debounce 2s) |
| AiClinicalProtocols → "Exames Iniciais" | Manual (1 clique) |

**Impacto:** Idêntico ao #3.

#### 🟡 MODERADO #5 — Sugestão de Conduta/Encaminhamento: 2 fontes

| Fonte | Trigger | Profundidade |
|---|---|---|
| AiCopilotPanel → seção "Conduta" | Auto (debounce 2s) | Genérica |
| AiSmartReferral | Manual (1 clique) | Estruturado (especialidade, urgência, resumo, perguntas) |

---

### 1.3. Métricas de Redundância de IA

| Métrica | Valor |
|---|---|
| Componentes de IA ativos na tela do prontuário | **14** |
| Widgets AI visíveis simultaneamente no form | **9** |
| Edge Functions distintas | 12 (11 ativas + 1 órfã) |
| Funcionalidades com sobreposição | **5** |
| Chamadas duplicadas à mesma edge function | **2** (`ai-transcribe`, `ai-generate-soap`) |
| Componentes de código morto | **1** (`AiCidSuggest`) |

---

### 1.4. Recomendações — Redundância IA

| # | Ação | Severidade | Esforço |
|---|---|---|---|
| R1 | **Eliminar pipeline duplicado de voz:** Remover `AiTranscribe` inline + botão "Auto-SOAP"; manter exclusivamente `VoiceFirstDictation` | 🔴 Crítica | Baixo |
| R2 | **Unificar `ai-generate-soap` em 1 hook:** Criar `useGenerateSoap()` consumido por ambos os pontos de chamada | 🔴 Crítica | Baixo |
| R3 | **Consolidar sugestões de med/exame/conduta:** `AiClinicalProtocols` deve ser uma seção/tab DENTRO do `AiCopilotPanel` no sidebar, não um widget inline separado | 🟠 Alta | Médio |
| R4 | **Deletar `AiCidSuggest`** (componente + edge function `ai-cid-suggest`) — a funcionalidade já existe no Copilot sidebar | 🟡 Média | Baixo |
| R5 | **Estado coordenado de IA:** Criar um `AiActivityContext` que centraliza loading states e evita 3 spinners simultâneos | 🟡 Média | Médio |

---

## 2. Granularidade de Acessos — Segregação por Especialidade

### 2.1. Tipos Profissionais no Sistema

| Valor | Label | Conselho | Categorização |
|---|---|---|---|
| `admin` | Administrador | — | Administrativo |
| `medico` | Médico(a) | CRM | Clínico + Prescritor |
| `dentista` | Dentista | CRO | Clínico + Prescritor |
| `enfermeiro` | Enfermeiro(a) | COREN | Clínico |
| `tec_enfermagem` | Téc. Enfermagem | COREN | Clínico (parcial) |
| `fisioterapeuta` | Fisioterapeuta | CREFITO | Clínico |
| `nutricionista` | Nutricionista | CRN | Clínico |
| `psicologo` | Psicólogo(a) | CRP | Clínico |
| `fonoaudiologo` | Fonoaudiólogo(a) | CRFa | Clínico |
| `secretaria` | Secretária/Recepcionista | — | Administrativo |
| `faturista` | Faturista | — | Administrativo |

**Agrupamentos existentes em `usePermissions.ts`:**
- **CLINICAL_TYPES:** medico, dentista, enfermeiro, fisioterapeuta, nutricionista, psicologo, fonoaudiologo
- **PRESCRIBER_TYPES:** medico, dentista **apenas**

---

### 2.2. Mecanismos de Controle de Acesso (3 Camadas)

| Camada | Mecanismo | Onde | Granularidade |
|---|---|---|---|
| **Rota** | `ProtectedRoute` com `requireAdmin`, `resource`, `allowedTypes` | `App.tsx` routes | Por profissão ou recurso RBAC |
| **Componente** | `PermissionGate` com `resource`, `action`, `allowedTypes` | Inline em páginas | Por profissão ou recurso RBAC |
| **Banco** | RLS policies com `is_tenant_admin`, `is_clinical_professional`, `is_prescriber` | PostgreSQL | Por grupo funcional |

> **⚠️ Achado Crítico:** O componente `PermissionGate` está **praticamente sem uso** no codebase — apenas ~2 referências além da própria definição. Quase toda filtragem acontece somente no nível de rota.

---

### 2.3. Adaptação da Interface por Tipo Profissional — Scorecard

| Profissional | Dashboard | Sidebar | Prontuário | Evoluções | Templates | **NOTA** |
|---|---|---|---|---|---|---|
| **admin** | Completo c/ KPIs financeiros | Tudo | Completo | Ambos | Todos | **A+** |
| **medico** | Dedicado (triagem, prontuários) | RBAC | Genérico (ok) | SOAP + Nursing | 12 especialidades | **A** |
| **dentista** | Dedicado (planos, procedimentos) | RBAC | Tab Odontograma extra | SOAP | Template odonto | **A** |
| **enfermeiro** | Dedicado (triagem, salas, Manchester) | RBAC | Genérico | Nursing NANDA‑NIC‑NOC | Não adaptado | **B** |
| **secretaria** | Dedicado (agenda, confirmações) | RBAC | N/A | N/A | N/A | **A** |
| **faturista** | Dedicado (TISS, glosas, convênios) | RBAC | N/A | N/A | N/A | **A** |
| **fisioterapeuta** | DashboardClinico genérico | RBAC | ⛔ Idêntico ao médico | Somente SOAP | Nenhum | **D** |
| **nutricionista** | DashboardClinico genérico | RBAC | ⛔ Idêntico ao médico | Somente SOAP | Nenhum | **D** |
| **psicologo** | DashboardClinico genérico | RBAC | ⛔ Idêntico ao médico | Somente SOAP | Psiquiatria ≠ Psicologia | **D** |
| **fonoaudiologo** | DashboardClinico genérico | RBAC | ⛔ Idêntico ao médico | Somente SOAP | Nenhum | **D** |

---

### 2.4. Cenários Problemáticos Concretos

#### Cenário A — Psicólogo vê UI de prescrição médica

Um psicólogo logado no prontuário enxerga:

1. ❌ Campo **"Prescrições"** com placeholder "Medicamentos, posologia..." — psicólogos NÃO prescrevem
2. ❌ Widget **AiDrugInteractionAlert** — "Verificar Interações Medicamentosas" — completamente irrelevante
3. ❌ Campo **"Exame Físico"** com "PA, FC, achados..." — psicólogos não fazem exame físico
4. ❌ **8 sinais vitais** (PA, FC, Temp, SpO₂, FR, Peso, Altura, Dor) — tipicamente não coletados
5. ⚠️ **AiClinicalProtocols** mostra protocolos médicos baseados em evidência — parcialmente irrelevante
6. ❌ Dropdown de templates mostra **Cardiologia, Ortopedia, Oncologia** — ruído total

#### Cenário B — Fisioterapeuta vê UI médica

1. ❌ Campos de prescrição medicamentosa
2. ❌ AiDrugInteractionAlert
3. ❌ Sem campos específicos: goniometria, cinesioterapia, testes funcionais
4. ❌ Sem template built-in de fisioterapia
5. ❌ Dashboard genérico (vs. médico/dentista com dashboards dedicados)

#### Cenário C — Enfermeiro pode acessar Receituários

Se o admin configurar permissão RBAC `receituarios.view = true` para enfermeiros, eles acessam a página de receituários **sem qualquer validação de `isPrescriber`** — o hook existe mas não é usado na renderização da página.

#### Cenário D — ProntuarioForm não recebe `professionalType`

O `ProntuarioForm.tsx` **não importa `usePermissions()`** e **não recebe `professionalType` como prop**. Todas as seções são renderizadas incondicionalmente para todos os tipos profissionais.

---

### 2.5. Achados sobre Templates de Prontuário

Templates built-in em `prontuario-templates.ts`:

| Template | Especialidade |
|---|---|
| Consulta Geral | Genérico |
| Cardiologia | Médica |
| Ortopedia | Médica |
| Oncologia | Médica |
| Pediatria | Médica |
| Ginecologia/Obstetrícia | Médica |
| Dermatologia | Médica |
| Neurologia | Médica |
| Psiquiatria | Médica (⚠️ Psiquiatria ≠ Psicologia) |
| Oftalmologia | Médica |
| Endocrinologia | Médica |
| Odontologia | Odonto |

**Ausentes:** Fisioterapia, Nutrição, Psicologia (sessão terapêutica), Fonoaudiologia, Estética, Enfermagem.

O fetch de templates customizados (banco) **não filtra por `specialty_id`** do profissional logado — todos os templates são carregados para todos.

---

### 2.6. Recomendações — Granularidade RBAC

| # | Ação | Severidade | Esforço |
|---|---|---|---|
| R6 | **ProntuarioForm adaptar por `professionalType`:** Receber como prop ou usar `usePermissions()`. Ocultar "Prescrições" + `AiDrugInteractionAlert` para `!isPrescriber`. Ocultar "Exame Físico" para `psicologo`. Simplificar sinais vitais para psicólogo (só peso/altura). | 🔴 Crítica | Médio |
| R7 | **Usar `isPrescriber` na página Receituários:** Gate de criação com `PermissionGate allowedTypes={PRESCRIBER_TYPES}` | 🔴 Crítica | Baixo |
| R8 | **Filtrar templates por especialidade:** No fetch, adicionar `.or('specialty_id.is.null,specialty_id.eq.${profileSpecialtyId}')` | 🟠 Alta | Baixo |
| R9 | **Criar templates built-in para 4 profissões com nota D:** Fisioterapia (goniometria, cinesioterapia), Nutrição (antropometria, recordatório 24h), Psicologia (notas de sessão, técnica, objetivos), Fonoaudiologia (avaliação audiológica, terapia de linguagem) | 🟠 Alta | Médio |
| R10 | **Expandir uso de `PermissionGate` inline:** Envolver seções do prontuário em `<PermissionGate allowedTypes={['medico','dentista']}>` | 🟠 Alta | Médio |
| R11 | **Dashboards específicos para fisio/nutri/psico/fono:** Mesmo que simples — sessões do dia, evoluções pendentes, indicadores da área | 🟡 Média | Médio |
| R12 | **Evolução por profissão:** Psicólogo → "Nota de Sessão" (não SOAP). Fisio → campos de exercício + amplitude. Nutri → recordatório + plano alimentar | 🟡 Média | Alto |

---

## 3. Adaptabilidade de Nicho — Clínicas de Estética Avançada

### 3.1. O que o Sistema Promete vs. O que Entrega

A landing page (`SolucoesPage.tsx`) promete para "Estética e Bem-estar":
> Galeria de fotos antes/depois, controle de procedimentos, gestão de insumos, termos digitais, pacotes.

| Feature Prometida | Status Real |
|---|---|
| Galeria antes/depois | ❌ **Não implementada** |
| Controle de procedimentos | ⚠️ Parcial (template Dermatologia) |
| Gestão de insumos | ⚠️ Parcial (sem lote/validade) |
| Termos digitais | ✅ **Robusto** (toxina, preenchimento, peeling, uso de imagem) |
| Pacotes | ✅ **Funcional** (multi-sessão com expiração) |

---

### 3.2. Gap #1 — Mapeamento Facial/Corporal (BLOQUEANTE)

**Status:** ❌ Completamente inexistente.

Nenhum SVG de face humana, corpo ou região corporal. Nenhum modelo de dados para `injection_points`, `zones`, `application_areas` ou `units_applied`. Nenhum tracking de unidades de toxina (ex: 20U frontal, 10U periorbital) nem ml de preenchimento por região.

**Impacto:** Toda clínica de estética avançada precisa documentar pontos de aplicação sobre diagrama facial/corporal com quantidades por zona. Sem isso, o sistema não atende o padrão mínimo de documentação estética.

**Blueprint existente — O Odontograma é 100% transposto:**

| Componente Odonto Existente | Equivalente Estético a Criar |
|---|---|
| `ToothDiagram.tsx` — SVG com 5 faces clicáveis por dente | `FaceZoneDiagram.tsx` — SVG de rosto com zonas clicáveis |
| `OdontogramChart.tsx` — Grid de 32 dentes + legenda | `BodyChart.tsx` — Diagrama corpo/rosto + legenda |
| `odontogramConstants.ts` — 33 condições tipadas com cores | `aestheticConstants.ts` — Procedimentos com cores e unidades |
| `ToothEditDialog.tsx` — Modal com material, grau | `ZoneEditDialog.tsx` — Modal com produto, lote, unidades/ml |
| `Periograma.tsx` — Gráfico periodontal | `TreatmentTimeline.tsx` — Histórico por zona |

A arquitetura (SVG interativo + mapa de condições tipado + dados por região + comparação de versões) é **diretamente reutilizável**.

---

### 3.3. Gap #2 — Galeria Antes/Depois (BLOQUEANTE)

**Status:** ❌ Prometida mas não implementada.

Existe `DentalImagesGallery.tsx` com upload, viewer com zoom/rotação — mas tipos são 100% odontológicos (`intraoral_frontal`, `rx_panoramica`). Não há:

| Feature | Status |
|---|---|
| Upload de foto "antes" com data/procedimento | ❌ |
| Upload de foto "depois" vinculada à sessão | ❌ |
| Comparação lado-a-lado (slider) | ❌ |
| Timeline de evolução fotográfica | ❌ |
| Tipos de foto estética (frontal, 45°, perfil, submentoniana) | ❌ |

---

### 3.4. Gap #3 — Vinculação Produto → Paciente → Sessão (REGULATÓRIO)

O módulo de Produtos (`Produtos.tsx`) gerencia estoque com categorias, mas **não tem lote nem validade**. O módulo SNGPC tem lote/validade, mas é restrito a medicamentos controlados.

| Feature | Módulo Produtos | Módulo SNGPC |
|---|---|---|
| Cadastro com preço | ✅ | ✅ |
| Lote | ❌ | ✅ |
| Validade | ❌ | ✅ |
| Rastreamento produto → paciente → sessão | ❌ | ❌ |
| Baixa automática ao registrar procedimento | ❌ | ❌ |
| Alerta de expiração | ❌ | ✅ |

---

### 3.5. O que já Serve para Estética

| Feature | Componente | Status |
|---|---|---|
| Termos de consentimento (Toxina, Preenchimento, Peeling) | `consent-templates-library.ts` | ✅ Pronto |
| Termo de uso de imagem LGPD | `consent-templates-default.ts` | ✅ Pronto |
| Assinatura biométrica com webcam | `FacialCapture.tsx` + `seal-consent-pdf` | ✅ Pronto |
| Pacotes multi-sessão com expiração | `PatientPackageDialog.tsx` | ✅ Funcional |
| Template Dermatologia (Fitzpatrick, procedimentos) | `prontuario-templates.ts` | ⚠️ Base expansível |
| IA: protocolos, copilot, transcrição | Módulo AI | ✅ Funcional |

---

### 3.6. O que Falta no Template Estético

O template de Dermatologia já inclui Fitzpatrick e tipo de procedimento (incluindo Laser, Peeling, Preenchimento, Toxina). **Faltam:**

| Campo | Status |
|---|---|
| Quantidade de unidades (toxina) | ❌ |
| Volume em ml (preenchimento) | ❌ |
| Marca/produto utilizado | ❌ |
| Lote do produto | ❌ |
| Zonas de aplicação (múltiplas) | ❌ |
| Profundidade de injeção | ❌ |
| Calibre agulha/cânula | ❌ |
| Anestesia utilizada | ❌ |
| Escala de Glogau | ❌ |
| Intercorrências imediatas | ❌ |
| Foto antes/depois vinculada | ❌ |

---

### 3.7. Recomendações — Adaptabilidade Estética

| # | Ação | Severidade | Esforço |
|---|---|---|---|
| R13 | **Face/Body Mapping interativo** (SVG com zonas + quantidades) — reusar arquitetura do odontograma | 🔴 Bloqueante | Alto |
| R14 | **Galeria Antes/Depois** com comparação visual (slider/side‑by‑side) e tipos de foto estética | 🔴 Bloqueante | Médio |
| R15 | **Vincular produto → paciente → sessão** com lote, validade, rastreabilidade. Generalizar modelo SNGPC para o módulo Produtos | 🔴 Bloqueante | Médio |
| R16 | **Template estético dedicado** (unidades, volume, marca, zonas, calibre, Glogau) | 🟠 Alta | Baixo |
| R17 | **Termos adicionais:** Bioestimuladores (Sculptra, Radiesse), Fios PDO, Laser, Microagulhamento | 🟡 Média | Baixo |
| R18 | **Template Builder UI** para admin da clínica criar templates sem código | 🟡 Média | Alto |
| R19 | **Dashboard estético:** ml preenchimento/mês, U toxina/mês, ticket médio, fotos pendentes | 🟡 Média | Médio |

---

## 4. Auditoria de Carga Cognitiva e Fadiga Visual

### 4.1. Modal Hell — Inventário de Overlays

| Tipo | Instâncias |
|---|---|
| `<Dialog>` (modal central) | ~42 |
| `<AlertDialog>` (confirmação) | ~15 |
| `<Sheet>` (drawer lateral) | ~16 |
| **TOTAL** | **~73 overlays** |

> Benchmark aceitável para SaaS clínico: **≤30 overlays**.

#### Modais por Página (Top 5)

| Página | Modais Possíveis | State Variables de Modal |
|---|---|---|
| **Pacientes.tsx** | 7 | 8 `useState` só para abrir/fechar |
| **Agenda.tsx** | ~6 | 5+ entre página e subcomponentes |
| **Prontuarios.tsx** | 3 + 5 inner tabs no modal | 4 |
| **FinanceiroBillsReceivableTab** | 3 empilháveis | 3 |
| **ComandaDetail** | Sheet + 2 Dialog internos | 3 |

#### Modal Stacking Detectado (Dialog dentro de Dialog/Sheet)

| Localização | Problema | Severidade |
|---|---|---|
| `ComandaDetail.tsx` | `<Sheet>` contém 2 `<Dialog>` internos | 🔴 Alta |
| `CommissionRulesDrawer.tsx` | `<Sheet>` contém `<Dialog>` para form de regra | 🔴 Alta |
| `GenerateContractsDialog.tsx` | Dialog + Dialog de preview (swap com flag) | 🟡 Média |
| `DentalImagesGallery.tsx` | 2 Dialogs no mesmo componente (upload + viewer) | 🟡 Média |
| `ChannelManager.tsx` | 2 Dialogs sequenciais (gerenciar + criar) | 🟡 Média |

---

### 4.2. Densidade Visual — Hotspots Críticos

#### 🔴 ProntuarioForm — O Formulário Monstro

| Seção | Campos/Widgets |
|---|---|
| Header | 3 selects (paciente, tipo, modelo) |
| Sinais Vitais (grid 4 cols) | PA Sis, PA Dia, FC, Temp, SpO₂, FR, Peso, Altura, Dor |
| Histórico (grid 3 cols) | Alergias, Medicamentos em Uso, Histórico Médico |
| IA: VoiceFirstDictation | Widget |
| IA: PROMs Viewer | Widget |
| IA: AiDeteriorationAlert | Widget |
| Queixa Principal | Input |
| Anamnese + AiTranscribe toggle | Textarea + widget IA |
| Exame Físico | Textarea |
| Diagnóstico + CID-10 | Input + Combobox |
| IA: AiClinicalProtocols | Widget condicional |
| Plano Terapêutico | Textarea |
| IA: AiSmartReferral | Widget condicional |
| Prescrições + AiDrugInteraction | Textarea + widget IA |
| Observações | Textarea |
| IA: ExamOcrAnalyzer | Widget |
| Retorno do Paciente | Seção com sugestão AI + inputs |

> **~20 campos de input + 6 widgets AI = 26+ elementos visíveis em scroll infinito**. Sem accordion, sem collapse, sem seções retráteis. O médico precisa scrollar ~1500px.
>
> **Benchmark:** Formulários clínicos premium (Epic, Tasy) usam **≤8 campos visíveis por seção** com collapse automático.

#### 🔴 ProntuarioDetalhe — 8 tabs comprimidas

7 tabs (não-dentista) / 8 tabs (dentista) em `grid-cols-7` ou `grid-cols-8` com `text-xs py-2`.

Em tela de 1366px, cada tab tem **~130px**. Texto trunca, ícones de 12px são mal discerníveis.

#### 🟠 Sinais Vitais — 8+ inputs comprimidos

Seção em `grid-cols-4` com `gap-3` — espreme 8 inputs com labels `text-xs` em espaço limitado.

#### 🟠 PatientTable — Badges de 10px

Badges de status usam `text-[10px]` — no limite da legibilidade (WCAG recomenda mínimo 12px para texto funcional).

---

### 4.3. Explosão Cromática

**12 famílias de cores** usadas como indicadores semânticos:

| Cor | Usos | Frequência |
|---|---|---|
| red / destructive | Erros, alergias, cancelados, emergências | Muito Alta |
| amber / yellow / warning | Pendente, aviso, urgente | Muito Alta |
| green / emerald / success | Concluído, ativo, confirmado | Muito Alta |
| blue | Informativo, confirmado, normal | Alta |
| violet / purple | Aguardando, premium, reaberto | Média |
| orange | Muito urgente, fisioterapia, grave | Média |
| pink / rose | Enfermagem, estética | Baixa |
| teal / cyan | Branding | Baixa |
| indigo | Ícone isolado | Mínima |

> **Benchmark WCAG para cognição:** máximo de **5-7 cores semânticas** antes de causar sobrecarga.

#### Inconsistências Cromáticas

| Semântica | Variações Encontradas | Problema |
|---|---|---|
| Pendente | `bg-yellow-100 text-yellow-800` vs `text-amber-600` | yellow vs amber |
| Sucesso | `text-success` (CSS var) vs `text-green-600` vs `text-emerald-600` | 3 verdes |
| Erro | `text-destructive` (CSS var) vs `text-red-600` vs `text-red-700` | token vs hardcoded |
| Warning | `text-warning` (CSS var) vs `text-amber-700` | token vs hardcoded |

---

### 4.4. Responsividade em 1366px (Tela mais comum em consultórios)

| Componente | Largura |
|---|---|
| Sidebar (expandido) | 288px (`w-72`) |
| Sidebar (collapsed) | 80px (`w-20`) |
| AI Sidebar (quando visível) | 280px (`w-[280px]`) |

**Pior caso (sidebar expandido + AI sidebar):** 1366 - 288 - 280 = **798px para conteúdo**

> 798px é insuficiente para tabelas clínicas de 6+ colunas. Em 1366px, o CalendarView fica apertado e a AppointmentsTable requer scroll horizontal.

**Achado adicional:** Páginas clínicas têm pouquíssimos breakpoints responsivos — `Prontuarios.tsx` usa apenas 3 em 1000+ linhas. Nenhuma adaptação para tablets de 1024px (uso comum em consultórios).

---

### 4.5. Nested ScrollAreas

| Localização | Problema |
|---|---|
| `DashboardRecepcao.tsx` | 3 ScrollAreas (`h-[420px]`, `h-[400px]`, `h-[420px]`) na mesma página |
| `Chat.tsx` | 2 ScrollAreas lado a lado |
| `ChannelManager.tsx` | ScrollArea `h-[300px]` dentro de Dialog + ScrollArea `h-[150px]` em Dialog aninhado |
| `CsvImportDialog.tsx` | 3 ScrollAreas no mesmo wizard |

---

### 4.6. Recomendações — Carga Cognitiva & Visual

| # | Ação | Severidade | Esforço |
|---|---|---|---|
| R20 | **ProntuarioForm em accordion colapsável:** Dividir em seções (Sinais Vitais → colapsado por default exceto enfermeiro, Campos clínicos → expandido, IA → sidebar ou toggle, Prescrição → colapsado para não-prescritores). Máximo 8 campos visíveis sem scroll | 🔴 Crítica | Médio |
| R21 | **Tabs do ProntuarioDetalhe: máximo 5 visíveis** + dropdown "Mais…" para Versões/IA. Usar `text-sm` mínimo ao invés de `text-xs` | 🔴 Crítica | Baixo |
| R22 | **Migrar modais pesados para subpages:** `PatientFormDialog` e `PatientDetailModal` (Pacientes.tsx) devem ser rotas, não modals. Reduz de 7 para ~3 modais na página | 🔴 Crítica | Médio |
| R23 | **Eliminar Dialog-in-Sheet:** `ComandaDetail.tsx` e `CommissionRulesDrawer.tsx` — converter Dialogs internos em seções inline dentro do Sheet | 🟠 Alta | Médio |
| R24 | **Consolidar paleta de cores para ≤6 famílias:** primary, success, warning, destructive, info, neutral. Usar **ícones** como diferenciador secundário, não mais cores | 🟠 Alta | Médio |
| R25 | **Padronizar tokens de cor:** Usar exclusivamente `text-success`/`text-destructive`/`text-warning` etc. Eliminar `text-green-600`, `text-red-600`, `text-amber-700` hardcoded | 🟠 Alta | Médio |
| R26 | **Mínimo 11px para badges clínicos.** Substituir `text-[10px]` em PatientTable. Preferir ícones semânticos onde texto é ≤3 letras | 🟡 Média | Baixo |
| R27 | **AI sidebar toggleable por default em ≤1536px:** Mudar de `hidden xl:flex` para `hidden 2xl:flex` ou toggle manual | 🟡 Média | Baixo |
| R28 | **Atalhos de teclado para tabs clínicos** (Ctrl+1..5 para troca rápida) — reduz necessidade de cursor em uso intensivo | 🟡 Média | Baixo |
| R29 | **Virtualizar ScrollAreas longas** (DashboardRecepcao) com `react-virtual` ou paginação inline | 🟡 Média | Médio |

---

## 5. Plano de Ação Consolidado

### Legenda de Severidade

| Badge | Significado |
|---|---|
| 🔴 | Crítica — Impacto direto na produtividade ou compliance |
| 🟠 | Alta — Degradação significativa de experiência |
| 🟡 | Média — Melhoria desejável, não bloqueante |

---

### Sprint 1 — Limpeza Cirúrgica (Quick Wins, 1-2 dias)

| # | Ação | Severidade | Esforço |
|---|---|---|---|
| R1 | Eliminar pipeline duplicado de voz (remover AiTranscribe inline) | 🔴 | Baixo |
| R2 | Unificar `ai-generate-soap` em 1 hook (`useGenerateSoap`) | 🔴 | Baixo |
| R4 | Deletar `AiCidSuggest` (componente morto + edge function órfã) | 🟡 | Baixo |
| R7 | Gate de `isPrescriber` na página Receituários | 🔴 | Baixo |
| R8 | Filtrar templates de prontuário por `specialty_id` do profissional | 🟠 | Baixo |
| R26 | Mínimo 11px em badges do PatientTable | 🟡 | Baixo |
| R27 | AI sidebar toggleable em ≤1536px | 🟡 | Baixo |

---

### Sprint 2 — Prontuário Adaptativo (3-5 dias)

| # | Ação | Severidade | Esforço |
|---|---|---|---|
| R6 | ProntuarioForm adaptativo por `professionalType` — ocultar prescrição, exame físico, sinais vitais conforme especialidade | 🔴 | Médio |
| R20 | ProntuarioForm em accordion colapsável (≤8 campos por seção visível) | 🔴 | Médio |
| R21 | Tabs do ProntuarioDetalhe: máximo 5 visíveis + overflow | 🔴 | Baixo |
| R10 | Expandir `PermissionGate` inline em seções do prontuário | 🟠 | Médio |
| R9 | Templates built-in para Fisioterapia, Nutrição, Psicologia, Fonoaudiologia | 🟠 | Médio |

---

### Sprint 3 — Desintoxicação de Interface (3-5 dias)

| # | Ação | Severidade | Esforço |
|---|---|---|---|
| R22 | Migrar PatientFormDialog e PatientDetailModal para subpages (Pacientes.tsx) | 🔴 | Médio |
| R23 | Eliminar Dialog-in-Sheet (ComandaDetail, CommissionRulesDrawer) | 🟠 | Médio |
| R24 | Consolidar paleta de cores para ≤6 famílias semânticas | 🟠 | Médio |
| R25 | Padronizar tokens CSS de cor (eliminar hardcoded) | 🟠 | Médio |
| R3 | Consolidar AiClinicalProtocols dentro do AiCopilotPanel sidebar | 🟠 | Médio |
| R5 | AiActivityContext — estado coordenado de loading de IA | 🟡 | Médio |

---

### Sprint 4 — Evolução por Profissão + Dashboards (5-7 dias)

| # | Ação | Severidade | Esforço |
|---|---|---|---|
| R11 | Dashboards dedicados para fisio/nutri/psico/fono | 🟡 | Médio |
| R12 | Evolução por profissão (Nota de Sessão para psicólogo, campo cinético para fisio) | 🟡 | Alto |
| R28 | Atalhos de teclado para tabs clínicos | 🟡 | Baixo |
| R29 | Virtualizar ScrollAreas longas | 🟡 | Médio |

---

### Sprint 5 — Módulo Estética (5-10 dias)

| # | Ação | Severidade | Esforço |
|---|---|---|---|
| R13 | Face/Body Mapping interativo (reusar arquitetura odontograma) | 🔴 | Alto |
| R14 | Galeria Antes/Depois com comparação visual | 🔴 | Médio |
| R15 | Vincular produto → paciente → sessão com lote/validade | 🔴 | Médio |
| R16 | Template estético dedicado | 🟠 | Baixo |
| R17 | Termos de consentimento adicionais (bioestimulador, fios, laser) | 🟡 | Baixo |
| R18 | Template Builder UI (admin cria templates sem código) | 🟡 | Alto |
| R19 | Dashboard estético | 🟡 | Médio |

---

## Métricas Atuais vs. Metas

| Métrica | Atual | Meta (pós-sprints) |
|---|---|---|
| Overlays totais no sistema | 73 | ≤35 |
| Modais empilhados (Dialog-in-Dialog) | 5 ocorrências | 0 |
| Max modais por página | 7 (Pacientes) | ≤2 |
| Famílias de cores semânticas | 12 | ≤6 |
| Campos visíveis sem scroll no ProntuarioForm | 26+ | ≤8 por seção |
| Tabs visíveis no ProntuarioDetalhe | 8 | ≤5 + overflow |
| Profissionais com nota D na adaptação | 4/11 | 0/11 |
| Funcionalidades IA sobrepostas | 5 | 0 |
| Templates built-in por especialidade ausente | 4 | 0 |
| Features estéticas bloqueantes | 3 | 0 |
| Largura útil mínima em 1366px | 798px | ≥950px |

---

*Relatório gerado em modo somente leitura. Nenhum arquivo do workspace foi alterado.*
