# ROADMAP — Modernização UX/UI ClinicNest

> **Criado em:** 16/03/2026  
> **Baseado em:** [RELATORIO-UX-UI-CLINICNEST.md](RELATORIO-UX-UI-CLINICNEST.md)  
> **Meta:** Eliminar carga cognitiva, remover redundâncias, alcançar padrão visual Ultra-Premium  
> **Regra:** Cada fase só inicia após **todos** os itens da fase anterior estarem ✅. Ao concluir, marcar `[x]` e registrar data.

---

## Legenda de Status

| Marcador | Significado |
|----------|------------|
| `[ ]` | Pendente — não iniciado |
| `[~]` | Em andamento — trabalho iniciado |
| `[x]` | Concluído — verificado e funcionando |
| `[!]` | Bloqueado — impedimento registrado |

---

# FASE 0 — Fundação do Design System (Pré-requisito)

> **Objetivo:** Criar a infraestrutura que as fases seguintes vão consumir.  
> **Critério de conclusão:** Todos os tokens, classes e componentes utilitários existem e o build compila sem erros.

**Status da Fase:** `✅ CONCLUÍDA em 16/03/2026`  
**Data de conclusão:** 16/03/2026

### Tarefas

- [x] **0.1** Criar variável CSS `--sidebar-body` em `src/index.css` (`:root` e `.dark`)
  - `:root` → `174 25% 94%`
  - `.dark` → `200 25% 9%`
  - **Critério:** Variável resolve corretamente em Light, Dark e System.

- [x] **0.2** Criar classe `.seamless-tab-active` em `src/index.css` (`@layer components`)
  - Incluir `::before` (curva côncava superior) e `::after` (curva côncava inferior)
  - Usar `box-shadow` com `hsl(var(--background))` — zero hardcode de cor
  - **Critério:** A classe renderiza corretamente nos 3 modos de tema sem artefatos visuais.

- [x] **0.3** Criar classes de tipografia em `src/index.css` (`@layer base`)
  - `.page-title` → `text-2xl md:text-3xl font-display font-bold tracking-tight`
  - `.section-title` → `text-xl md:text-2xl font-display font-semibold`
  - `.sub-title` → `text-lg font-display font-semibold`
  - `.card-title` → `text-base font-semibold`
  - **Critério:** Classes injetadas no build. Nenhum conflito com classes existentes.

- [x] **0.4** Criar classes semânticas de status em `src/index.css` (`@layer components`)
  - `.status-success` → `bg-success/10 text-success border-success/20`
  - `.status-error` → `bg-destructive/10 text-destructive border-destructive/20`
  - `.status-warning` → `bg-warning/10 text-warning border-warning/20`
  - `.status-info` → `bg-info/10 text-info border-info/20`
  - **Critério:** Classes usáveis via Tailwind. Resolvem corretamente em Light e Dark.

- [x] **0.5** Adicionar variant `"gradient"` ao componente `src/components/ui/button.tsx`
  - Valor: `"gradient-primary text-primary-foreground shadow-md hover:shadow-lg hover:opacity-95 transition-all"`
  - **Critério:** `<Button variant="gradient">` renderiza idêntico ao antigo `className="gradient-primary text-primary-foreground"`.

- [x] **0.6** Criar componente `<Spinner size="sm" | "md" | "lg" />` em `src/components/ui/spinner.tsx`
  - Encapsula `<Loader2>` com tamanhos padronizados: sm=`h-4 w-4`, md=`h-6 w-6`, lg=`h-8 w-8`
  - Inclui `animate-spin` e aceita `className` adicional
  - **Critério:** Componente exportado, importável, sem erros de tipo.

- [x] **0.7** Rodar `npx tsc --noEmit` — build compila sem erros
  - **Critério:** Exit code 0. Zero erros de tipo.

---

# FASE 1 — Limpeza Crítica: Páginas Redundantes

> **Objetivo:** Eliminar duplicações que confundem o usuário. Reduzir 8 páginas financeiras para 3.  
> **Critério de conclusão:** Rotas antiguas redirecionam, nenhum link quebrado, sidebar atualizado, build limpo.  
> **Pré-requisito:** FASE 0 concluída.

**Status da Fase:** `[ ] NÃO INICIADA`  
**Data de conclusão:** ___/___/______

### Tarefas

- [ ] **1.1** Deletar `src/pages/MinhasComissoes.tsx`
  - Criar redirect: `/minhas-comissoes` → `/meu-financeiro?tab=comissoes`
  - Remover rota do `App.tsx`
  - Remover do sidebar (item "Minhas Comissões" no grupo Repasses)
  - **Critério:** URL `/minhas-comissoes` redireciona corretamente. Nenhum import quebrado.

- [ ] **1.2** Deletar `src/pages/MeusSalarios.tsx`
  - Criar redirect: `/meus-salarios` → `/meu-financeiro?tab=salarios`
  - Remover rota do `App.tsx`
  - Remover do sidebar
  - **Critério:** URL `/meus-salarios` redireciona corretamente. Nenhum import quebrado.

- [ ] **1.3** Remover tabs "Commissions" e "Salaries" do `src/pages/Financeiro.tsx`
  - Essas abas pertencem ao módulo Repasses, não ao Financeiro geral
  - Manter tabs: Overview, Transactions, Projection, Bills Payable, Bills Receivable
  - **Critério:** Financeiro.tsx renderiza sem as tabs. Admin acessa comissões via `/repasses`.

- [ ] **1.4** Simplificar sidebar "Repasses" — remover itens redundantes
  - Manter: Visão Geral, Comissões, Salários, Regras de Comissão
  - Remover do menu: "Relatórios" (será absorvido na FASE 3) e "Captação e Indicações" (raramente usado)
  - **Critério:** Sidebar grupo "Repasses" tem no máximo 4 itens.

- [ ] **1.5** Esconder `AdminOverrides.tsx` do sidebar
  - Remover item do menu Administração
  - Manter rota `/admin/overrides` funcional (acesso direto por URL)
  - **Critério:** Página funciona via URL. Não aparece no sidebar.

- [ ] **1.6** Rodar `npx tsc --noEmit` — build compila sem erros
  - **Critério:** Exit code 0.

- [ ] **1.7** Teste manual: navegar por todas as rotas afetadas e confirmar redirects
  - `/minhas-comissoes` → redireciona ok
  - `/meus-salarios` → redireciona ok
  - `/financeiro` → sem tabs de comissão/salário
  - `/repasses` → menu simplificado
  - **Critério:** Zero links quebrados. Zero console errors.

---

# FASE 2 — Dashboard: Foco Clínico

> **Objetivo:** Remover métricas financeiras de repasse do Dashboard. Refocar na operação diária.  
> **Critério de conclusão:** Dashboard renderiza sem comissões/salários, banner removido ou minimizado, ação rápida "Iniciar atendimento" funcional.  
> **Pré-requisito:** FASE 1 concluída.

**Status da Fase:** `[ ] NÃO INICIADA`  
**Data de conclusão:** ___/___/______

### Tarefas

- [ ] **2.1** Remover Quick Actions "Comissões" e "Salários" do Dashboard
  - Arquivo: `src/pages/Dashboard.tsx` (linhas ~1126-1131)
  - Remover botões + badges associados
  - **Critério:** Quick Actions não exibe "Comissões" nem "Salários" para admin.

- [ ] **2.2** Remover StatCards "Comissões pendentes" e "Salários a pagar" da seção Mês
  - Arquivo: `src/pages/Dashboard.tsx` (linhas ~1412-1434)
  - Remover os StatCards e o bloco condicional. Admin vê apenas: Receita, Despesas, Saldo.
  - **Critério:** Seção "Mês" exibe exatamente 3 hero cards (Receita/Despesas/Saldo) e nenhum card secundário de comissão/salário.

- [ ] **2.3** Remover Quick Action "Nova transação" do Dashboard
  - Mover acesso exclusivo para módulo `/financeiro`
  - **Critério:** Botão removido do Dashboard. Acessível apenas em Financeiro.

- [ ] **2.4** Eliminar código morto de fetch de comissões/salários no Dashboard
  - Remover `fetchCommissionTotals` e `fetchSalaryTotals` (linhas ~435-540)
  - Remover states: `commissionsPending`, `commissionsPaid`, `salariesToPay`, `salariesPaid`
  - Remover chamadas no `Promise.all` (entries ~6 e ~9)
  - **Critério:** Dashboard não faz mais RPCs de comissão/salário. ~150 linhas removidas.

- [ ] **2.5** Remover ou minimizar Banner Carousel promocional
  - Opção recomendada: exibir apenas para usuários novos (< 7 dias) via `localStorage`
  - Para usuários existentes: esconder completamente ou mostrar via botão "Novidades" discreto no header
  - **Critério:** Banner não aparece por padrão para usuários existentes.

- [ ] **2.6** Adicionar ação rápida "Iniciar atendimento"
  - Ícone: `Stethoscope` ou `ClipboardList`
  - Ação: navegar para `/agenda` com filtro "hoje" ou abrir seletor rápido do próximo paciente
  - **Critério:** Botão funcional, com ícone, navega para fluxo de atendimento.

- [ ] **2.7** Substituir slots vagos por cards clínicos (opcional, mas recomendado)
  - Sugestões: "Retornos pendentes", "Lista de espera", "NPS da semana"
  - **Critério:** Pelo menos 1 novo card clínico substitui o espaço das comissões.

- [ ] **2.8** Rodar `npx tsc --noEmit` — build compila sem erros
  - **Critério:** Exit code 0.

---

# FASE 3 — Consolidação de Relatórios

> **Objetivo:** Unificar 5+ páginas de relatórios em hub único com abas.  
> **Critério de conclusão:** Existe um único hub `/relatorios` com todas as sub-seções como abas. Páginas antigas redirecionam.  
> **Pré-requisito:** FASE 2 concluída.

**Status da Fase:** `[ ] NÃO INICIADA`  
**Data de conclusão:** ___/___/______

### Tarefas

- [ ] **3.1** Refatorar `src/pages/Relatorios.tsx` para aceitar novas abas
  - Abas finais: Operacionais, Financeiro (DRE), Comissões, Captação, Customizáveis
  - Usar tabs ou route params para alternar
  - **Critério:** Hub funcional com 5 abas, cada uma carregando o conteúdo correto.

- [ ] **3.2** Absorver `RelatorioFinanceiro.tsx` como aba "Financeiro" do hub
  - Extrair conteúdo de DRE para componente `RelatorioDRETab.tsx`
  - Importar no hub como lazy component
  - **Critério:** `/relatorios?tab=financeiro` renderiza o DRE completo.

- [ ] **3.3** Absorver `RelatorioCaptacao.tsx` como aba "Captação" do hub
  - Extrair conteúdo para componente `RelatorioCaptacaoTab.tsx`
  - **Critério:** `/relatorios?tab=captacao` renderiza indicações.

- [ ] **3.4** Absorver `RepassesRelatorios.tsx` como aba "Comissões" do hub
  - Extrair conteúdo para componente `RelatorioComissoesTab.tsx`
  - **Critério:** `/relatorios?tab=comissoes` renderiza relatórios de comissão.

- [ ] **3.5** Configurar redirects das rotas antigas
  - `/relatorio-financeiro` → `/relatorios?tab=financeiro`
  - `/relatorio-captacao` → `/relatorios?tab=captacao`
  - `/repasses/relatorios` → `/relatorios?tab=comissoes`
  - **Critério:** Todas as URLs antigas redirecionam. Nenhum 404.

- [ ] **3.6** Deletar páginas originais (após confirmar redirects)
  - `RelatorioFinanceiro.tsx`, `RelatorioCaptacao.tsx`, `RepassesRelatorios.tsx`
  - **Critério:** Arquivos removidos. Nenhum import quebrado.

- [ ] **3.7** Atualizar sidebar
  - Grupo "Repasses": remover "Relatórios" (já feito na Fase 1.4 se aplicável)
  - Grupo "Financeiro" ou novo grupo: manter link único "Relatórios" → `/relatorios`
  - **Critério:** Um único ponto de entrada para relatórios no sidebar.

- [ ] **3.8** Rodar `npx tsc --noEmit` — build compila sem erros
  - **Critério:** Exit code 0.

---

# FASE 4 — Sidebar Seamless Tab (Arquitetura Visual)

> **Objetivo:** Implementar o efeito de "aba contínua" no sidebar, com fusão visual entre item ativo e conteúdo principal. Theme-aware (Light/Dark/System).  
> **Critério de conclusão:** Item ativo do sidebar se funde perfeitamente com a main area nos 3 modos de tema. Sem border-right, sem shadow separando.  
> **Pré-requisito:** FASE 0 concluída (variáveis CSS criadas).

**Status da Fase:** `[ ] NÃO INICIADA`  
**Data de conclusão:** ___/___/______

### Tarefas

- [ ] **4.1** Refatorar container `<aside>` do Sidebar desktop
  - Arquivo: `src/components/layout/Sidebar.tsx` (linha ~884)
  - Remover: `border-r border-border/50`, `shadow-xl`, `backdrop-blur-xl`, `bg-background/95`
  - Adicionar: `bg-[hsl(var(--sidebar-body))]`
  - **Critério:** Sidebar tem fundo sólido sem borda direita, sem sombra, sem blur.

- [ ] **4.2** Refatorar estilo do item ATIVO (sidebar expandido)
  - Substituir `bg-primary/10 text-primary before:...left-bar` por classe `seamless-tab-active`
  - Adicionar: `text-foreground font-semibold`
  - Garantir: `rounded-l-xl rounded-r-none mr-[-1px] relative z-10`
  - **Critério:** Item ativo se funde visualmente com bg-background da main area.

- [ ] **4.3** Ajustar estilo do item INATIVO
  - Remover pseudo-elemento `before:` (left bar indicator)
  - Manter: `text-muted-foreground hover:bg-accent/50 hover:text-foreground rounded-lg`
  - **Critério:** Itens inativos são discretos. Hover é sutil.

- [ ] **4.4** Manter estilo collapsed inalterado
  - Modo collapsed (w-20, ícones) mantém gradiente por categoria
  - **Critério:** Sidebar collapsed não foi alterado. Sem regressão.

- [ ] **4.5** Testar fusão visual nos 3 modos de tema
  - [ ] Light mode: item ativo = fundo teal claro, funde com content area teal claro
  - [ ] Dark mode: item ativo = fundo escuro, funde com content area escura
  - [ ] System mode: respeita preferência do OS, sem artefatos
  - **Critério:** Screenshot visual confirmando fusão em cada modo. Zero artefatos.

- [ ] **4.6** Testar curvas côncavas (::before e ::after)
  - Verificar que as curvas invertidas acima/abaixo do item ativo renderizam corretamente
  - Verificar que não há glitches ao trocar de item ativo (transição)
  - **Critério:** Curvas limpas, sem flickering, em todos os modos de tema.

- [ ] **4.7** Testar sidebar em mobile (Sheet)
  - O efeito seamless NÃO se aplica ao mobile (usa Sheet/Drawer)
  - Garantir que nenhum estilo novo quebra o mobile
  - **Critério:** Mobile sidebar funciona sem regressão.

- [ ] **4.8** Rodar `npx tsc --noEmit` — build compila sem erros
  - **Critério:** Exit code 0.

---

# FASE 5 — Design System: Botões e Loading States

> **Objetivo:** Padronizar Button variant gradient (150+ substituições) e loading states (80+ arquivos).  
> **Critério de conclusão:** Zero instâncias de `className="gradient-primary text-primary-foreground"` manuais. Loading states com Spinner padronizado.  
> **Pré-requisito:** FASE 0 concluída (variant e Spinner criados).

**Status da Fase:** `[ ] NÃO INICIADA`  
**Data de conclusão:** ___/___/______

### Tarefas

- [ ] **5.1** Substituir `gradient-primary text-primary-foreground` por `variant="gradient"` em todas as páginas
  - Find/replace global: `className="gradient-primary text-primary-foreground"` → `variant="gradient"`
  - Tratar casos com classes extras: mover classes adicionais para `className` separado do variant
  - **Critério:** `grep -r "gradient-primary text-primary-foreground"` em `src/` retorna 0 resultados (exceto button.tsx definição).

- [ ] **5.2** Substituir `<Loader2 className="h-X w-X animate-spin" />` por `<Spinner size="..." />`
  - Priorizar arquivos com tamanhos inconsistentes
  - Manter Loader2 em botões com `disabled` state (usar Spinner internamente)
  - **Critério:** Pelo menos 80% das instâncias de Loader2 manual substituídas. Tamanhos consistentes.

- [ ] **5.3** Substituir textos "Carregando..." legacy por `<Spinner />`
  - Buscar `Carregando` em strings de UI
  - Substituir por componente visual
  - **Critério:** Nenhum loading exibindo apenas texto sem indicador visual.

- [ ] **5.4** Rodar `npx tsc --noEmit` — build compila sem erros
  - **Critério:** Exit code 0.

---

# FASE 6 — Design System: Tipografia e Cores

> **Objetivo:** Padronizar hierarquia tipográfica e migrar cores hardcoded para tokens semânticos.  
> **Critério de conclusão:** Headings seguem hierarquia definida. Cores de status usam tokens, não valores Tailwind diretos.  
> **Pré-requisito:** FASE 0 concluída (classes de tipografia e status criadas).

**Status da Fase:** `[ ] NÃO INICIADA`  
**Data de conclusão:** ___/___/______

### Tarefas

- [ ] **6.1** Aplicar classes de tipografia nos títulos de seção das páginas principais
  - `<h2>` de seções → `section-title`
  - `<h3>` de sub-seções → `sub-title`
  - CardHeader/CardTitle → manter ShadCN default (já consistente)
  - **Critério:** Páginas com mais tráfego (Dashboard, Agenda, Pacientes, Financeiro) usam classes padrão.

- [ ] **6.2** Migrar cores hardcoded para tokens semânticos — Arquivo: `PatientContractsDrawer.tsx`
  - `text-green-600` → `text-success`
  - `bg-green-100` → `bg-success/10`
  - `text-red-600` → `text-destructive`
  - `border-red-300` → `border-destructive/30`
  - `text-amber-700` → `text-warning`
  - **Critério:** Zero cores hardcoded de status neste arquivo.

- [ ] **6.3** Migrar cores hardcoded — Arquivo: `OfflineSettings.tsx`
  - `bg-green-100` → `bg-success/10`
  - `text-green-600` → `text-success`
  - `bg-green-500` → `bg-success`
  - **Critério:** Zero cores hardcoded de status neste arquivo.

- [ ] **6.4** Migrar cores hardcoded — Arquivo: `ContractStatusBadge.tsx`
  - `bg-green-50 text-green-700 border-green-200` → `status-success`
  - **Critério:** Usa classe semântica.

- [ ] **6.5** Migrar cores hardcoded — Arquivo: `NextPatientDashboard.tsx`
  - `bg-red-50 border-red-200 text-red-700` → `status-error`
  - **Critério:** Usa classe semântica.

- [ ] **6.6** Migrar cores hardcoded — Arquivo: `SmartConfirmationSettings.tsx`
  - `bg-blue-500/10 text-blue-600` → `bg-info/10 text-info`
  - **Critério:** Usa tokens.

- [ ] **6.7** Migrar cores hardcoded — Arquivo: `CommissionTierIndicator.tsx`
  - `bg-yellow-50 text-yellow-700` → `bg-warning/10 text-warning`
  - **Critério:** Usa tokens.

- [ ] **6.8** Varrer restantes com grep e corrigir
  - `grep -r "text-green-\|bg-green-\|text-red-\|bg-red-\|text-amber-\|bg-amber-\|text-yellow-\|bg-yellow-\|text-blue-\|bg-blue-" src/components/ src/pages/`
  - Avaliar cada caso: se é status/feedback → migrar para token. Se é decorativo/design deliberado → manter.
  - **Critério:** Todas as cores de status/feedback usam tokens semânticos.

- [ ] **6.9** Rodar `npx tsc --noEmit` — build compila sem erros
  - **Critério:** Exit code 0.

---

# FASE 7 — Esconder Bloatware do Sidebar

> **Objetivo:** Reduzir itens visíveis no sidebar de 50+ para ~30. Features nicho ficam ocultas por feature flags.  
> **Critério de conclusão:** Sidebar mostra apenas features relevantes para o perfil da clínica. Itens ocultos continuam acessíveis via URL.  
> **Pré-requisito:** FASE 4 concluída (sidebar visual finalizado).

**Status da Fase:** `[ ] NÃO INICIADA`  
**Data de conclusão:** ___/___/______

### Tarefas

- [ ] **7.1** Esconder grupo "Odontologia" (Odontograma, Periograma, Planos de Tratamento)
  - Condição: exibir apenas se `professionalType === 'dentista'` OU `tenant.features.odontology === true`
  - **Critério:** Grupo invisível em clínicas sem dentista. Visível em consultórios odontológicos.

- [ ] **7.2** Esconder "Transmissão SNGPC" do sidebar
  - Condição: exibir apenas se `tenant.features.sngpc === true`
  - **Critério:** Item invisível por padrão. Acessível via Configurações → Integrações.

- [ ] **7.3** Esconder "Triagem" do sidebar
  - Condição: exibir apenas se feature flag `triage` estiver ativa
  - **Critério:** Item invisível para clínicas ambulatoriais.

- [ ] **7.4** Esconder "Painel de Chamada TV" do sidebar
  - Condição: exibir apenas se feature flag `callPanel` estiver ativa
  - **Critério:** Item invisível por padrão.

- [ ] **7.5** Esconder "API Pública" do sidebar
  - Condição: exibir apenas se feature flag `apiAccess` estiver ativa
  - **Critério:** Item invisível para >99% das clínicas.

- [ ] **7.6** Unificar "Compliance" + "Diagnóstico de Segurança" + "Retenção de Dados"
  - Criar página consolidada com 3 abas: Compliance, Segurança, Retenção
  - Remover `DiagnosticoSeguranca.tsx` e `RetencaoDados.tsx` como páginas separadas
  - Mover "Canal LGPD" para dentro da aba Compliance
  - **Critério:** Uma única entrada "Compliance & Segurança" no sidebar em vez de 3-4.

- [ ] **7.7** Esconder "Clínica Autônoma" do sidebar Marketing
  - Condição: exibir apenas se feature flag experimental estiver ativa
  - **Critério:** Item invisível por padrão.

- [ ] **7.8** Validar contagem final de itens no sidebar
  - **Critério:** Sidebar padrão (clínica genérica, sem odonto, sem SNGPC) exibe no máximo 30 itens.

- [ ] **7.9** Rodar `npx tsc --noEmit` — build compila sem erros
  - **Critério:** Exit code 0.

---

# FASE 8 — Consolidação de Configurações e Polimento Final

> **Objetivo:** Centralizar configurações e fazer cleanup final (forms, paginação, componentes órfãos).  
> **Critério de conclusão:** Configurações acessíveis a partir de hub unificado. Componentes órfãos removidos. Paginação funcional em tabelas grandes.  
> **Pré-requisito:** FASE 7 concluída.

**Status da Fase:** `[ ] NÃO INICIADA`  
**Data de conclusão:** ___/___/______

### Tarefas

- [ ] **8.1** Mover "Gerenciar Permissões" como aba de `Configuracoes.tsx`
  - Adicionar aba "Permissões" ao hub de configurações
  - Redirect: `/gerenciar-permissoes` → `/configuracoes?tab=permissoes`
  - **Critério:** Permissões acessíveis via hub. Rota antiga redireciona.

- [ ] **8.2** Mover "Integrações" como aba de `Configuracoes.tsx`
  - Adicionar aba "Integrações" ao hub de configurações
  - Redirect: `/integracoes` → `/configuracoes?tab=integracoes`
  - **Critério:** Integrações acessíveis via hub. Rota antiga redireciona.

- [ ] **8.3** Unificar lógica de booking (PublicBooking + PatientAgendar)
  - Criar hook `useBookingFlow` compartilhado com step engine
  - Ambas as páginas consomem o hook, mantendo UIs diferentes
  - **Critério:** Lógica de criação de appointment compartilhada. Ambas as UIs funcionam.

- [ ] **8.4** Deletar `src/components/ui/form.tsx` se permanece sem uso
  - Verificar: `grep -r "from.*components/ui/form" src/`
  - Se 0 resultados → deletar
  - **Critério:** Componente removido ou adotado. Sem código morto.

- [ ] **8.5** Implementar paginação em tabelas com >50 registros
  - Páginas alvo: Pacientes, Transações, Auditoria, Comissões
  - Usar componente `src/components/ui/pagination.tsx` que já existe
  - **Critério:** Tabelas com >50 registros exibem paginação funcional.

- [ ] **8.6** Audit final: rodar grep em busca de padrões antigos
  - `gradient-primary text-primary-foreground` → deve retornar 0 (exceto definição)
  - `text-green-600` em contexto de status → deve retornar 0
  - `Carregando...` sem Spinner → deve retornar 0
  - `style={{` em componentes de UI (não email/preview) → avaliar caso a caso
  - **Critério:** Relatório de grep limpo para cada padrão verificado.

- [ ] **8.7** Rodar `npx tsc --noEmit` — build compila sem erros
  - **Critério:** Exit code 0.

- [ ] **8.8** Teste manual de regressão completo
  - Navegar por todas as rotas do sidebar
  - Verificar 3 modos de tema (Light/Dark/System)
  - Verificar mobile responsiveness
  - Verificar que nenhum link do sidebar leva a 404
  - **Critério:** Zero erros visuais, zero 404s, zero console errors.

---

# REGISTRO DE CONCLUSÃO DE FASES

| Fase | Nome | Status | Concluída em |
|------|------|--------|-------------|
| 0 | Fundação do Design System | `[x]` Concluída | 16/03/2026 |
| 1 | Limpeza: Páginas Redundantes | `[ ]` Pendente | — |
| 2 | Dashboard: Foco Clínico | `[ ]` Pendente | — |
| 3 | Consolidação de Relatórios | `[ ]` Pendente | — |
| 4 | Sidebar Seamless Tab | `[ ]` Pendente | — |
| 5 | Design System: Botões e Loading | `[ ]` Pendente | — |
| 6 | Design System: Tipografia e Cores | `[ ]` Pendente | — |
| 7 | Esconder Bloatware do Sidebar | `[ ]` Pendente | — |
| 8 | Consolidação e Polimento Final | `[ ]` Pendente | — |

---

> **Protocolo de marcação:** Ao concluir todos os itens de uma fase, alterar o status para `[x] Concluída`, preencher a data, e atualizar o `Status da Fase` no topo da seção correspondente para `✅ CONCLUÍDA em DD/MM/AAAA`.
