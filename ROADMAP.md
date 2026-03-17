# ROADMAP — Implementação das Recomendações da Auditoria UX/RBAC

> **Criado em:** 17/03/2026
> **Baseado em:** [RELATORIO-AUDITORIA-PRODUTO-UX.md](RELATORIO-AUDITORIA-PRODUTO-UX.md)
> **Meta:** Eliminar redundâncias de IA, adaptar prontuário por especialidade, reduzir carga cognitiva, implementar módulo estética
> **Regra:** Cada sprint só inicia após todos os itens do anterior estarem concluídos. Marcar status ao concluir.

---

## Legenda

| Marcador | Significado |
|----------|------------|
| ⬜ | Pendente |
| 🔄 | Em andamento |
| ✅ | Concluído |

---

## Sprint 1 — Limpeza Cirúrgica (Quick Wins)
**Status:** ⬜ Pendente

| # | Ação | Status |
|---|---|---|
| R1 | Eliminar pipeline duplicado de voz (remover AiTranscribe inline + botão Auto-SOAP do ProntuarioForm, manter VoiceFirstDictation) | ⬜ |
| R2 | Unificar ai-generate-soap em 1 hook (useGenerateSoap) | ⬜ |
| R4 | Deletar AiCidSuggest (componente morto + remover do index.ts) | ⬜ |
| R7 | Gate de isPrescriber na página Receituários | ⬜ |
| R8 | Filtrar templates de prontuário por specialty_id do profissional | ⬜ |
| R26 | Mínimo 11px em badges do PatientTable | ⬜ |
| R27 | AI sidebar toggleable em <=1536px | ⬜ |

---

## Sprint 2 — Prontuário Adaptativo
**Status:** ⬜ Pendente

| # | Ação | Status |
|---|---|---|
| R6 | ProntuarioForm adaptativo por professionalType — ocultar prescrição para não-prescritores, exame físico para psicólogo, sinais vitais simplificados | ⬜ |
| R20 | ProntuarioForm em accordion colapsável (max 8 campos por seção visível) | ⬜ |
| R21 | Tabs do ProntuarioDetalhe: máximo 5 visíveis + dropdown overflow | ⬜ |
| R10 | Expandir PermissionGate inline em seções do prontuário | ⬜ |
| R9 | Templates built-in para Fisioterapia, Nutrição, Psicologia, Fonoaudiologia | ⬜ |

---

## Sprint 3 — Desintoxicação de Interface
**Status:** ⬜ Pendente

| # | Ação | Status |
|---|---|---|
| R22 | Migrar PatientFormDialog e PatientDetailModal para subpages (rotas) | ⬜ |
| R23 | Eliminar Dialog-in-Sheet (ComandaDetail, CommissionRulesDrawer) | ⬜ |
| R24 | Consolidar paleta de cores para <=6 famílias semânticas | ⬜ |
| R25 | Padronizar tokens CSS de cor (eliminar hardcoded) | ⬜ |
| R3 | Consolidar AiClinicalProtocols dentro do AiCopilotPanel sidebar | ⬜ |
| R5 | AiActivityContext — estado coordenado de loading de IA | ⬜ |

---

## Sprint 4 — Evolução por Profissão + Dashboards
**Status:** ⬜ Pendente

| # | Ação | Status |
|---|---|---|
| R11 | Dashboards dedicados para fisio/nutri/psico/fono | ⬜ |
| R12 | Evolução por profissão (Nota de Sessão para psicólogo, campos cinéticos para fisio, recordatório para nutri) | ⬜ |
| R28 | Atalhos de teclado para tabs clínicos (Ctrl+1..5) | ⬜ |
| R29 | Virtualizar ScrollAreas longas (DashboardRecepcao, etc.) | ⬜ |

---

## Sprint 5 — Módulo Estética
**Status:** ⬜ Pendente

| # | Ação | Status |
|---|---|---|
| R13 | Face/Body Mapping interativo (SVG com zonas clicáveis + quantidades) | ⬜ |
| R14 | Galeria Antes/Depois com comparação visual (slider/side-by-side) | ⬜ |
| R15 | Vincular produto → paciente → sessão com lote/validade | ⬜ |
| R16 | Template estético dedicado (unidades, volume, marca, zonas, calibre, Glogau) | ⬜ |
| R17 | Termos de consentimento adicionais (bioestimulador, fios PDO, laser, microagulhamento) | ⬜ |
| R18 | Template Builder UI (admin cria templates sem código) | ⬜ |
| R19 | Dashboard estético (ml preenchimento/mês, U toxina/mês, ticket médio) | ⬜ |

---

## Métricas de Acompanhamento

| Métrica | Antes | Meta | Atual |
|---|---|---|---|
| Overlays totais | 73 | <=35 | — |
| Modais empilhados | 5 | 0 | — |
| Max modais/página | 7 | <=2 | — |
| Famílias de cores | 12 | <=6 | — |
| Campos visíveis ProntuarioForm | 26+ | <=8/seção | — |
| Tabs ProntuarioDetalhe | 8 | <=5+overflow | — |
| Profissionais nota D | 4/11 | 0/11 | — |
| IA sobrepostas | 5 | 0 | — |
| Templates ausentes | 4 | 0 | — |
| Features estéticas bloqueantes | 3 | 0 | — |
