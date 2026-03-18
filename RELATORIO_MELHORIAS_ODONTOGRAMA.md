# RELATÓRIO EXAUSTIVO — Módulo Odontograma

> **Data:** 2026-07-18  
> **Escopo:** Todos os arquivos do módulo odontológico (Odontograma, Periograma, Planos de Tratamento)  
> **Objetivo:** Identificar melhorias, bugs, features faltantes e oportunidades de robustez

---

## ✅ O QUE JÁ FUNCIONA BEM

| Feature | Arquivo | Observação |
|---------|---------|------------|
| Diagrama interativo com 5 faces por dente (ISO/FDI) | `OdontogramChart.tsx`, `ToothDiagram.tsx` | Padrão profissional |
| 33 condições categorizadas (status, patologia, tratamento, protético, anomalia) | `odontogramConstants.ts` | Boa cobertura clínica |
| Toggle dentição Adulto / Decídua / Mista | `OdontogramChart.tsx` | Raro em softwares concorrentes |
| Grau de mobilidade (0-III), prioridade (normal/baixa/alta/urgente) | `ToothEditDialog.tsx` | Profissional |
| Navegação pelo histórico de odontogramas | `Odontograma.tsx` | Setas prev/next |
| Modo de comparação entre versões | `Odontograma.tsx` | Side-by-side |
| Periograma com 6 sítios por dente (MV, V, DV, ML, L, DL) | `Periograma.tsx` | Padrão clínico |
| Sangramento, placa, supuração, mobilidade e furca por sítio | `Periograma.tsx` | Completo |
| Planos de tratamento com progresso por item | `PlanosTratamento.tsx` | Orçamento detalhado |
| Geração de PDF profissional para odontograma, periograma e plano | `odontogramPdf.ts`, `periogramPdf.ts`, `treatment-plan-pdf.ts` | Com mapa dental colorido |
| Sugestão automática de procedimentos por condição | `Odontograma.tsx` (CONDITION_PROCEDURE_MAP) | 13 mapeamentos |
| Estatísticas rápidas (cáries, ausentes, restaurados, urgentes) | `OdontogramChart.tsx` | Badges visuais |
| Material de restauração configurável | `ToothEditDialog.tsx` | 8 materiais |
| Legenda por condição com cores por categoria | `OdontogramChart.tsx` | Filtrada por condições usadas |

---

## 🔴 BUGS E PROBLEMAS CRÍTICOS

### B1 — Nome do paciente não aparece no PDF do Odontograma
- **Arquivo:** `Odontograma.tsx` → chamada de `generateOdontogramPdf()`
- **Problema:** Após a refatoração do PatientCombobox, a variável `patients` (que era um array) foi removida. Se o código ainda referencia `patients.find(...)` para obter o nome, o PDF vai exibir string vazia ou "Paciente".
- **Severidade:** Alta
- **Fix:** Armazenar o nome do paciente no state `selectedPatientName` ao selecionar via `PatientCombobox`, ou buscar o nome diretamente do Supabase antes de gerar o PDF.

### B2 — RPCs com `as any` — Zero type-safety
- **Arquivo:** `Odontograma.tsx` (linhas ~165), `Periograma.tsx`
- **Problema:** `(supabase.rpc as any)("get_client_odontograms", ...)` — Se a assinatura da RPC mudar, não haverá erro em build, apenas falha silenciosa em runtime.
- **Severidade:** Média
- **Fix:** Gerar types do Supabase com `supabase gen types typescript` e tipar corretamente.

### B3 — Validações lógicas ausentes no ToothEditDialog
- **Arquivo:** `ToothEditDialog.tsx`
- **Problema:** Permite combinações ilógicas como dente "extraído" + condição "coroa", ou dente "ausente" com superfícies selecionadas.
- **Severidade:** Média
- **Fix:** Adicionar regras de exclusão mútua (ex: se `missing` ou `extraction`, desabilitar faces/materiais).

### B4 — Data de procedimento aceita datas futuras
- **Arquivo:** `ToothEditDialog.tsx`
- **Problema:** O campo `<Input type="date">` para data do procedimento não tem `max={today}`, permitindo datas no futuro.
- **Severidade:** Baixa
- **Fix:** Adicionar `max={new Date().toISOString().split('T')[0]}` no input.

### B5 — Periograma aceita profundidade de sondagem sem limite
- **Arquivo:** `Periograma.tsx`
- **Problema:** Valores de probing_depth > 15mm são clinicamente impossíveis mas aceitos pelo sistema.
- **Severidade:** Baixa
- **Fix:** Adicionar `min={0}` e `max={15}` nos inputs numéricos.

---

## 🟡 MELHORIAS DE UX/UI

### U1 — Busca de paciente (CORRIGIDO)
- **Status:** ✅ Corrigido nesta sessão — substituído Input+Select por `PatientCombobox` inline com dropdown imediato.

### U2 — Tooltip nos dentes do diagrama
- **Arquivo:** `ToothDiagram.tsx`
- **Problema:** Ao passar o mouse sobre um dente, não há tooltip mostrando condição, faces afetadas e observações.
- **Impacto:** O dentista precisa clicar em cada dente para ver detalhes.
- **Sugestão:** Adicionar `<Tooltip>` (shadcn/ui) ao redor de cada dente exibindo: "Dente 16 — Cárie (Oclusal) — Prioridade: Urgente".

### U3 — Double-click para editar dente
- **Arquivo:** `ToothDiagram.tsx`
- **Problema:** Atualmente um clique abre o editor. Se o usuário quiser apenas ver informações sem editar, não há opção.
- **Sugestão:** Single-click = mostra tooltip/popover com info; Double-click = abre `ToothEditDialog`.

### U4 — Undo/Redo para mudanças de dentes
- **Arquivo:** `Odontograma.tsx`
- **Problema:** Não há como desfazer uma alteração acidental em um dente (ex: marcou como "extraído" por engano).
- **Sugestão:** Implementar stack de undo/redo com `Ctrl+Z` / `Ctrl+Y`.

### U5 — SVG dos dentes não é responsivo
- **Arquivo:** `ToothDiagram.tsx`
- **Problema:** Tamanho fixo do SVG (44-56px). Em telas de celular, os dentes ficam muito pequenos e difíceis de tocar.
- **Sugestão:** Usar `viewBox` com tamanho percentual ou implementar pinch-to-zoom em dispositivos touch.

### U6 — Navegação por teclado no Periograma
- **Arquivo:** `Periograma.tsx`
- **Problema:** Ao digitar profundidade de sondagem em um campo e pressionar Tab, o cursor deveria ir para o próximo sítio do mesmo dente. O comportamento atual pode ser imprevisível.
- **Sugestão:** Implementar `onKeyDown` com Tab → next site, Enter → next tooth.

### U7 — Indicador visual de dentes com alterações não salvas
- **Arquivo:** `OdontogramChart.tsx`
- **Problema:** O estado `isDirty` existe mas não há feedback visual individual por dente (quais dentes foram alterados desde o último save).
- **Sugestão:** Borda pulsante ou asterisco em dentes modificados.

### U8 — Filtro de dentes por condição/prioridade
- **Arquivo:** `OdontogramChart.tsx`
- **Problema:** Não há como filtrar/destacar dentes com uma condição específica (ex: "mostrar apenas dentes com cárie").
- **Sugestão:** Barra de filtro acima do diagrama: checkbox por condição → dentes não-filtrados ficam semitransparentes.

### U9 — Empty state mais informativo
- **Arquivo:** `Odontograma.tsx`
- **Problema:** Quando não há odontograma para o paciente, apenas mostra "Nenhum odontograma". Deveria guiar o dentista.
- **Sugestão:** CTA com "Criar primeiro odontograma" + dica sobre dentição.

### U10 — Dark mode nos diagramas
- **Arquivo:** `ToothDiagram.tsx`, `OdontogramChart.tsx`
- **Problema:** Cores hex hardcoded em `odontogramConstants.ts` não se adaptam ao dark mode.
- **Sugestão:** Usar variáveis CSS ou mapeamento condicional.

---

## 🔵 FEATURES FALTANTES (Prioridade Alta)

### F1 — Integração Odontograma ↔ Radiografia
- **Descrição:** Permitir anexar radiografias (periapical, panorâmica, bite-wing) a cada dente ou ao odontograma completo.
- **Valor clínico:** Essencial para documentação legal e diagnóstico.
- **Implementação:** Upload via Supabase Storage por dente, thumbnail ao lado do diagrama, modal para ampliar.

### F2 — Histórico de mudanças por dente (Audit Trail)
- **Descrição:** Registrar quem alterou o quê em cada dente, com data/hora.
- **Valor clínico:** Rastreabilidade legal (CFO exige prontuário completo).
- **Implementação:** Tabela `odontogram_tooth_history` com trigger de auditoria.

### F3 — Nível de Inserção Clínica (NIC/CAL)
- **Descrição:** O periograma deveria calcular e exibir automaticamente o NIC = profundidade de sondagem + recessão.
- **Valor clínico:** Métrica fundamental em periodontia.
- **Implementação:** Cálculo derivado (PS + R) exibido como terceira linha na tabela do periograma.

### F4 — Gráfico de evolução periodontal
- **Descrição:** Gráfico de linha mostrando a evolução de profundidade média, índice de placa e sangramento ao longo do tempo.
- **Valor clínico:** Permite visualizar se o tratamento está funcionando.
- **Implementação:** Componente Recharts usando dados do `historyEntries`.

### F5 — Plano de tratamento vinculado ao dente
- **Descrição:** Ao marcar um dente com condição tratável, o sistema sugere automaticamente criar um item no plano de tratamento. O plano deveria ter link direto para o dente no odontograma.
- **Valor clínico:** Rastreabilidade e orçamento automático.
- **Implementação:** Foreign key `treatment_plan_items.tooth_number → odontogram_teeth.tooth_number`. Já existe CONDITION_PROCEDURE_MAP mas não é bidirecional.

### F6 — Comparação visual lado-a-lado com diff
- **Descrição:** O modo de comparação atual (`compareMode`) mostra dois diagramas, mas não destaca visualmente as diferenças (quais dentes mudaram).
- **Valor clínico:** Facilita avaliação de progresso.
- **Implementação:** Adicionar highlight colorido em dentes com condição diferente entre versões.

### F7 — Assinatura digital no PDF
- **Descrição:** Campo para assinatura digital do profissional com CRO/CRM.
- **Valor clínico:** Validade legal do documento.
- **Implementação:** Integração com certificado A1/A3 ou assinatura desenhada em canvas.

### F8 — Exportação em formatos clínicos (HL7/FHIR)
- **Descrição:** Exportar dados do odontograma no formato FHIR (Fast Healthcare Interoperability Resources).
- **Valor clínico:** Interoperabilidade com outros sistemas de saúde.
- **Implementação:** Serialização dos dados em JSON-FHIR (Condition, Observation, CarePlan).

---

## 🟢 FEATURES FALTANTES (Prioridade Média)

### F9 — Anotações gráficas no dente (Canvas/Drawing)
- Permitir desenhar marcações livres sobre cada dente (ex: trincas, linhas de fratura).

### F10 — Protocolo de tratamento automático
- Baseado nas condições encontradas, sugerir sequência de procedimentos (ex: "Dente 26 com cárie e pulpite → Tratamento endodôntico → Pino → Coroa").

### F11 — Suporte a dentes supranumerários na arcada
- Atualmente `supernumerary` é uma condição, mas não há espaço visual no diagrama para posicionar um dente extra.

### F12 — Anamnese odontológica integrada
- Questionário pré-avaliação: hábitos (bruxismo, tabagismo), medicamentos, alergias, última visita ao dentista.

### F13 — Cálculo automático de orçamento total
- Ao criar plano de tratamento a partir do odontograma, calcular automaticamente o valor total com base em tabela de preços (TUSS) da clínica.

### F14 — Dashboard odontológico
- Tela de KPIs: dentes tratados este mês, taxa de conclusão de planos, índice de retorno, receita por tipo de procedimento.

### F15 — Prescrição periodontal integrada
- Após diagnóstico no periograma, sugerir prescrição de medicamentos (clorexidina, antibiótico) com posologia padrão.

### F16 — Timer de procedimento
- Cronômetro durante atendimento para registro de tempo por procedimento.

### F17 — Fotos intraorais
- Captura de fotos da câmera (webcam ou celular) direto pelo sistema, vinculadas ao dente.

### F18 — Notificações de retorno
- Baseado no periograma, agendar automaticamente retorno em 30/60/90 dias para reavaliação.

### F19 — Prontuário odontológico unificado
- View consolidando odontograma + periograma + planos + fotos + radiografias em uma única timeline do paciente.

### F20 — Templates de condição pré-configurados
- "Prótese total superior" = marcar 14 dentes como ausentes de uma vez. "Classe III de Black" = pré-selecionar faces.

---

## 🟠 PROBLEMAS DE PERFORMANCE

### P1 — Re-renderização do diagrama completo
- **Arquivo:** `OdontogramChart.tsx`
- **Problema:** Qualquer mudança em um dente re-renderiza os 32 dentes. React.memo não é usado em `ToothDiagram`.
- **Fix:** Envolver `ToothDiagram` em `React.memo` com comparação shallow de props.

### P2 — Periograma: Map → Array em cada alteração
- **Arquivo:** `Periograma.tsx`
- **Problema:** `updateMeasurement()` cria um novo `Map` inteiro ao alterar um único sítio (192 sítios no total).
- **Fix:** Usar `useImmer` ou imutabilidade granular.

### P3 — PDF gerado no thread principal
- **Arquivo:** `odontogramPdf.ts`, `periogramPdf.ts`
- **Problema:** Geração de PDF bloqueia a UI. Em dispositivos lentos pode congelar por 2-3 segundos.
- **Fix:** Mover para Web Worker ou usar `requestIdleCallback`.

### P4 — Busca de pacientes sem paginação
- **Problema:** `.limit(20)` na busca é ok para autocomplete, mas se o usuário quiser navegar entre muitos resultados, não há "carregar mais".
- **Fix:** Implementar scroll infinito no `PatientCombobox` com `.range()`.

---

## 🔒 SEGURANÇA E VALIDAÇÃO

### S1 — RLS policies para odontogram_teeth
- **Problema:** Verificar se existe policy impedindo que profissional A veja odontogramas de paciente do profissional B em outro tenant.
- **Fix:** Confirmar que todas as queries passam `tenant_id` e que RLS está habilitado.

### S2 — Sanitização de `notes` field
- **Arquivo:** `ToothEditDialog.tsx`
- **Problema:** O campo de observações é um `<textarea>` cujo valor é salvo direto no banco. Se renderizado como HTML em algum lugar, pode causar XSS.
- **Fix:** Já é renderizado como texto puro, mas confirmar que nenhum `dangerouslySetInnerHTML` é usado.

### S3 — Validação no backend (RPCs)
- **Problema:** As RPCs como `save_odontogram_with_teeth` devem validar que `tooth_number` está na faixa válida (11-48 permanentes, 51-85 decíduos) e que `condition` é um dos 33 valores permitidos.
- **Fix:** Adicionar `CHECK` constraints no PostgreSQL.

### S4 — Rate limiting na busca de pacientes
- **Problema:** O PatientCombobox faz queries a cada 250ms durante digitação. Um atacante poderia enviar muitas requisições.
- **Fix:** O debounce já mitiga parcialmente, mas considerar rate limiting server-side.

---

## 📊 GAPS NO MODELO DE DADOS

### D1 — Tabela `odontogram_tooth_history` (não existe)
- Audit trail de alterações por dente.

### D2 — Coluna `attachment_urls` em `odontogram_teeth` (não existe)
- Para radiografias e fotos vinculadas ao dente.

### D3 — Coluna `cal` (Clinical Attachment Level) em periogram_measurements
- Cálculo derivado PS + R, mas deveria ser materializado para queries rápidas.

### D4 — Foreign key `treatment_plan_items.odontogram_tooth_id`
- Vinculação direta entre item do plano e registro do dente.

### D5 — Tabela `dental_prescriptions` (não existe)
- Para prescrições vinculadas ao periograma/odontograma.

### D6 — View materializada para estatísticas de dentes
- Aggregações como "total cáries por paciente" são recalculadas a cada acesso.

---

## 🔗 OPORTUNIDADES DE INTEGRAÇÃO

| Integração | Módulo Existente | Como Vincular |
|------------|-----------------|---------------|
| Agenda | `src/pages/Agenda.tsx` | Criar consulta odontológica a partir do odontograma → já marca o procedimento na agenda |
| Prontuário | `src/pages/Prontuarios.tsx` | Tab "Odontograma" no prontuário do paciente (embed `OdontogramChart` readonly) |
| Financeiro | `src/pages/Financeiro.tsx` | Plano de tratamento aprovado → gera parcelas automaticamente no financeiro |
| Anamnese | `src/components/consent/` | Antes do primeiro odontograma, exigir assinatura do termo de consentimento odontológico |
| Comissões | `src/components/commission/` | Procedimentos concluídos no plano → gerar comissão para o profissional |
| Chat/Notificação | `src/components/chat/` | Lembrete automático de retorno baseado no periograma |
| Dashboard | `src/components/dashboard/` | Widget com "dentes tratados hoje", "planos pendentes", "periogramas vencidos" |
| IA/AI | `src/components/ai/` | Sugestão de diagnóstico baseada nos achados do odontograma (ex: "paciente com 8+ cáries → Alto risco cariogênico") |

---

## 📋 PRIORIZAÇÃO SUGERIDA

### Sprint Imediato (Quick Wins)
1. ~~Corrigir PatientCombobox~~ ✅ (feito)
2. Tooltip nos dentes com condição/info (U2)
3. React.memo no ToothDiagram (P1)
4. Validação de datas futuras (B4)
5. Limite de probing_depth no Periograma (B5)

### Sprint Curto Prazo
6. Histórico de mudanças / Audit Trail (F2)
7. NIC/CAL automático no Periograma (F3)
8. Comparação visual com diff de cores (F6)
9. Vínculo plano ↔ dente (F5)
10. Gráfico de evolução periodontal (F4)

### Sprint Médio Prazo
11. Integração com radiografias (F1)
12. Dashboard odontológico (F14)
13. Prontuário unificado (F19)
14. Templates de condição (F20)
15. Assinatura digital PDF (F7)

### Sprint Longo Prazo
16. HL7/FHIR export (F8)
17. Anotações gráficas (F9)
18. Anamnese odontológica (F12)
19. IA para diagnóstico (integração)
20. Prescrição periodontal (F15)

---

## 📁 ARQUIVOS AUDITADOS

| Arquivo | Linhas | Categoria |
|---------|--------|-----------|
| `src/pages/Odontograma.tsx` | ~650 | Página principal |
| `src/pages/Periograma.tsx` | ~607 | Ficha periodontal |
| `src/pages/PlanosTratamento.tsx` | ~180 | Orçamento/plano |
| `src/components/odontograma/OdontogramChart.tsx` | 258 | Diagrama visual |
| `src/components/odontograma/ToothDiagram.tsx` | 279 | SVG dos dentes |
| `src/components/odontograma/ToothEditDialog.tsx` | 323 | Editor de dente |
| `src/components/odontograma/odontogramConstants.ts` | 162 | Constantes/cores |
| `src/utils/odontogramPdf.ts` | 251 | PDF odontograma |
| `src/utils/periogramPdf.ts` | 195 | PDF periograma |
| `src/lib/treatment-plan-pdf.ts` | 87 | PDF plano/orçamento |
| `src/components/ui/patient-combobox.tsx` | 162 | Combobox paciente (NOVO) |

**Total auditado:** ~3.134 linhas em 11 arquivos

---

*Relatório gerado automaticamente durante auditoria do módulo odontológico do ClinicaFlow.*
