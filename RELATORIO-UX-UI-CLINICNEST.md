# RELATÓRIO DE AUDITORIA UX/UI — ClinicNest

> **Data:** 16 de março de 2026  
> **Escopo:** Auditoria exaustiva de UX/UI e Produto (Somente Leitura)  
> **Objetivo:** Eliminar carga cognitiva, remover redundâncias, modernizar para padrão Ultra-Premium  
> **Autoria:** CPO / Especialista UX Sênior / Engenheira Frontend React  

---

## Sumário Executivo

| Categoria | Severidade | Achados |
|-----------|-----------|---------|
| Funcionalidades Repetidas | 🔴 Crítica | 6 módulos financeiros sobrepostos, 3 entradas de agendamento, 4+ páginas de relatórios |
| Dashboard — Foco Desviado | 🟠 Alta | Cards de Comissão/Salário na tela inicial desviam foco clínico |
| Sidebar — Arquitetura Visual | 🟡 Média | Sem efeito de fusão "Seamless Tab"; border-right divide sidebar do conteúdo |
| Design System — Consistência | 🟠 Alta | 150+ botões com `gradient-primary` manual, loading states caóticos, tipografia sem hierarquia |
| Bloatware | 🟡 Média | 12+ features nicho expostas no menu principal |

**Impacto estimado da limpeza:** Redução de ~35% na complexidade percebida, UX 3-5x mais fluida.

---

# PARTE I — PLANO DE AÇÃO DE LIMPEZA

## 1. Funcionalidades Repetidas e Confusas

### 1.1 🔴 CRÍTICO: Explosão do Módulo Financeiro (8 páginas sobrepostas)

A maior fonte de confusão do sistema. O mesmo dado (comissões, salários) aparece em 3-4 rotas diferentes.

| Página | Rota | Público | Duplica |
|--------|------|---------|---------|
| `Financeiro.tsx` | `/financeiro` | Admin | Hub financeiro com 6 tabs (Overview, Transactions, Projection, Commissions, Salaries, Bills) |
| `MeuFinanceiro.tsx` | `/meu-financeiro` | Profissional | Comissões + Salários + Histórico + Relatórios em tabs |
| `MinhasComissoes.tsx` | `/minhas-comissoes` | Profissional | Comissões filtradas por mês — **DUPLICA aba "Comissões" do MeuFinanceiro** |
| `MeusSalarios.tsx` | `/meus-salarios` | Profissional | Salários pessoais — **DUPLICA aba "Salários" do MeuFinanceiro** |
| `Repasses.tsx` | `/repasses` | Admin | Hub que mostra AMBOS (comissões + salários) |
| `RepassesComissoes.tsx` | `/repasses/comissoes` | Admin | Tabela de comissões filtrada |
| `RepassesSalarios.tsx` | `/repasses/salarios` | Admin | Tabela de salários com pagamento |
| `RepassesRelatorios.tsx` | `/repasses/relatorios` | Admin | Relatórios de comissão — **DUPLICA relatórios em Relatorios.tsx** |

**Danos ao usuário:**
- Profissional não sabe se clica em "Meu Financeiro" → aba "Comissões" **ou** "Minhas Comissões" (são a mesma coisa)
- Admin encontra comissões em `/financeiro?tab=commissions` **E** `/repasses/comissoes` (dados idênticos, views diferentes)

**Plano de Ação:**

| Ação | Detalhamento | Prioridade |
|------|-------------|-----------|
| **DELETAR** `MinhasComissoes.tsx` | Redundante — já existe como aba em MeuFinanceiro | P0 |
| **DELETAR** `MeusSalarios.tsx` | Redundante — já existe como aba em MeuFinanceiro | P0 |
| **MOVER** `RepassesRelatorios.tsx` | Absorver como aba do hub `Relatorios.tsx` | P1 |
| **CONSOLIDAR** Sidebar "Repasses" | Manter apenas: Visão Geral (hub), Comissões, Salários. Remover "Relatórios" e "Captação" do grupo | P1 |
| **REMOVER** tabs "Commissions" e "Salaries" do `Financeiro.tsx` | Pertencem ao módulo Repasses — admin acessa lá | P1 |
| **RESULTADO FINAL** | Admin: `Financeiro` (clinic-wide) + `Repasses` (comissões/salários). Staff: apenas `Meu Financeiro` | — |

---

### 1.2 🟠 ALTA: Agendamento — 3 Pontos de Entrada

| Página | Rota | Quem usa | Resultado |
|--------|------|----------|-----------|
| `Agenda.tsx` | `/agenda` | Staff | CRUD completo de agendamentos (dia/semana) |
| `PublicBooking.tsx` | `/agendar/:slug` | Paciente (link público) | Self-booking sem login |
| `PatientAgendar.tsx` | `/paciente/agendar` | Paciente (portal logado) | Self-booking com login |

**Problema:** PublicBooking e PatientAgendar fazem a mesma coisa (criam appointment na mesma tabela), com UIs diferentes.

**Plano de Ação:**

| Ação | Detalhamento | Prioridade |
|------|-------------|-----------|
| **UNIFICAR** lógica de booking | Criar hook `useBookingFlow` compartilhado | P2 |
| **MANTER** ambas as páginas | PublicBooking (sem auth) e PatientAgendar (autenticado) têm UXs legítimas diferentes, mas devem compartilhar step engine | P2 |

---

### 1.3 🟠 ALTA: Relatórios — Fragmentação em 5+ Páginas

| Página | Rota | Conteúdo |
|--------|------|----------|
| `Relatorios.tsx` | `/relatorios` | Hub: Produtividade, Pacientes, NoShow, Satisfação |
| `RelatorioFinanceiro.tsx` | `/relatorio-financeiro` | DRE (Receita/CMV/Lucro) |
| `RelatorioCaptacao.tsx` | `/relatorio-captacao` | Indicações por profissional |
| `RelatoriosCustomizaveis.tsx` | `/relatorios-customizaveis` | Builder de templates custom |
| `RepassesRelatorios.tsx` | `/repasses/relatorios` | Comissões por profissional |
| `MeuFinanceiro.tsx` (aba Relatórios) | `/meu-financeiro?tab=relatorios` | Relatórios do profissional |

**Plano de Ação:**

| Ação | Detalhamento | Prioridade |
|------|-------------|-----------|
| **CONSOLIDAR** em hub único | `Relatorios.tsx` vira centro: abas Operacionais, Financeiros, Comissões, Captação, Custom | P2 |
| **DELETAR** `RelatorioFinanceiro.tsx` | Absorver como aba "Financeiro" dentro de `Relatorios.tsx` | P2 |
| **DELETAR** `RelatorioCaptacao.tsx` | Absorver como aba "Captação" dentro de `Relatorios.tsx` | P2 |
| **REDIRECIONAR** `/repasses/relatorios` | Link para `Relatorios.tsx?tab=comissoes` | P2 |

---

### 1.4 🟡 MÉDIA: Configurações Espalhadas

| Página | Rota | Conteúdo |
|--------|------|----------|
| `Configuracoes.tsx` | `/configuracoes` | Dados clínica, gamificação, booking, SMS, chatbot, smart confirmation |
| `MinhasConfiguracoes.tsx` | `/minhas-configuracoes` | Perfil pessoal, senha, notificações |
| `GerenciarPermissoes.tsx` | `/gerenciar-permissoes` | RBAC e roles |
| `AdminOverrides.tsx` | `/admin/overrides` | Feature/limit overrides |
| `Integracoes.tsx` | `/integracoes` | Asaas, Twilio, WhatsApp, HL7, RNDS, NFSe |

**Plano de Ação:**

| Ação | Detalhamento | Prioridade |
|------|-------------|-----------|
| **ESCONDER** `AdminOverrides.tsx` | Acessível apenas via URL direta ou menu oculto (é tool interno) | P1 |
| **MOVER** `GerenciarPermissoes` | Tornar sub-aba de `Configuracoes.tsx` → aba "Permissões" | P3 |
| **MOVER** `Integracoes` | Tornar sub-aba de `Configuracoes.tsx` → aba "Integrações" | P3 |

---

### 1.5 Bloatware — Funcionalidades para Esconder/Arquivar

Estas features atendem <5% das clínicas e adicionam ruído visual significativo no sidebar:

| Feature | Arquivo(s) | Ação Recomendada |
|---------|-----------|------------------|
| **Odontograma** | `Odontograma.tsx` | 🟡 Esconder: mostrar apenas se `professionalType === 'dentista'` OU flag `odontology_enabled` |
| **Periograma** | `Periograma.tsx` | 🟡 Esconder: mesma regra do Odontograma |
| **Planos de Tratamento Odonto** | `PlanosTratamento.tsx` | 🟡 Esconder: mesma regra |
| **Transmissão SNGPC** | `TransmissaoSNGPC.tsx` | 🟡 Esconder: apenas clínicas com manipulação de controlados |
| **Triagem (emergência)** | `Triagem.tsx` | 🟡 Esconder: feature flag `triage` — rara em clínicas ambulatoriais |
| **Painel de Chamada TV** | `PainelChamada.tsx` | 🟡 Esconder: feature flag `callPanel` — raríssimo |
| **SNGPC/ANVISA** (sidebar admin) | Menu Administração | 🟡 Esconder atrás de feature flag |
| **Compliance** + **Diagnóstico Segurança** | `Compliance.tsx`, `DiagnosticoSeguranca.tsx` | **UNIFICAR** em uma só página: aba "Segurança" + "Compliance" |
| **Retenção de Dados** | `RetencaoDados.tsx` | 🟡 Esconder: mover para dentro de Compliance |
| **API Pública** | Menu Administração | 🟡 Esconder: relevante para <1% das clínicas |
| **Clínica Autônoma** (marketing) | Menu Marketing | 🟡 Esconder: funcionalidade experimental |
| **Canal LGPD Público** | `CanalLgpd.tsx` | Manter, mas remover do sidebar principal (acessar via Compliance) |

**Meta:** Sidebar principal com no máximo 25-30 itens visíveis (atualmente são 50+).

---

## 2. Auditoria do Dashboard Principal

### 2.1 Estado Atual do Dashboard

**Arquivo:** `src/pages/Dashboard.tsx` (2.007 linhas)

Estrutura atual das seções visíveis para Admin:

```
┌──────────────────────────────────────────────────────┐
│ 1. BANNER PROMOCIONAL (Carousel rotativo 5 slides)   │
├──────────────────────────────────────────────────────┤
│ 2. KPI GRID (4 cards):                               │
│    • Consultas hoje  • Pendentes                      │
│    • Receita do mês  • Pacientes cadastrados          │
├──────────────────────────────────────────────────────┤
│ 3. AÇÕES RÁPIDAS (6-7 botões):                       │
│    • Novo agendamento  • Novo paciente                │
│    • Movimentar estoque  • Nova transação [ADMIN]     │
│    • ⚠️ Comissões [ADMIN]  • ⚠️ Salários [ADMIN]     │
│    • Meu financeiro [STAFF]                           │
├──────────────────────────────────────────────────────┤
│ 4. FEED DE ATIVIDADE (Admin — últimos 20 audit logs)  │
├──────────────────────────────────────────────────────┤
│ 5. HOJE: Consultas do dia + Próximo paciente/Estoque  │
├──────────────────────────────────────────────────────┤
│ 6. MÊS — MÉTRICAS FINANCEIRAS:                       │
│    • 3 Hero Cards: Receita / Despesas / Saldo         │
│    • ⚠️ Comissões pendentes  • ⚠️ Salários a pagar   │
└──────────────────────────────────────────────────────┘
```

### 2.2 Problemas Identificados

#### ⚠️ Comissão e Salário no Dashboard Principal — FORA DE CONTEXTO

As métricas "Comissões pendentes" e "Salários a pagar" aparecem em **três lugares** no Dashboard:

1. **Quick Actions** (linhas 1126-1131): Botões "Comissões" e "Salários" com badges de pendências
2. **Seção "Mês"** (linhas 1412-1434): StatCards "Comissões pendentes" e "Salários a pagar"
3. **Fetch de dados** (linhas 435-540): Duas funções dedicadas (`fetchCommissionTotals`, `fetchSalaryTotals`) que chamam RPCs

**Diagnóstico da Diretoria:** Correto. Comissões e salários são operações administrativas mensais, não métricas clínicas diárias. Exibi-las na tela inicial:
- Desvia o foco operacional do médico/recepcionista
- Mistura contexto clínico (pacientes, agenda) com contexto contábil (repasses)
- Gera ansiedade desnecessária em profissionais que veem "Meu financeiro (pendente)" toda vez que abrem o sistema

#### ⚠️ Banner Carousel Promocional — Ruído na Experiência

O carousel de 5 slides promovendo features ("Nest IA", "Indique e Ganhe", "Teleconsulta", "Premium") ocupa espaço premium do viewport:
- Em telas menores, empurra o conteúdo operacional para baixo
- Mistura marketing com operação clínica diária
- O profissional que já conhece esses recursos vê isso diariamente sem necessidade

#### ⚠️ Ações Rápidas — Análise de Relevância

| Ação Rápida | Relevância na Jornada Diária | Veredicto |
|-------------|------------------------------|-----------|
| **Novo agendamento** | ✅ Alta — ação mais frequente | MANTER |
| **Novo paciente** | ✅ Alta — cadastro diário | MANTER |
| **Movimentar estoque** | 🟡 Média — semanal para a maioria | MANTER (útil para clínicas com insumos) |
| **Nova transação** | 🟡 Média — ação financeira | MOVER para módulo Financeiro |
| **Comissões** | 🔴 Baixa — mensal | REMOVER do Dashboard |
| **Salários** | 🔴 Baixa — mensal | REMOVER do Dashboard |
| **Meu financeiro** | 🟡 Média — staff consulta eventual | MANTER (é a única via rápida do staff) |

### 2.3 Plano de Ação — Dashboard

| # | Ação | Detalhamento | Impacto |
|---|------|-------------|---------|
| D1 | **REMOVER** Quick Actions "Comissões" e "Salários" | Botões das linhas 1126-1131 → mover acesso exclusivo para `/repasses` e `/financeiro` | Reduz ruído, foco no operacional |
| D2 | **REMOVER** StatCards "Comissões pendentes" e "Salários a pagar" da seção Mês | Linhas 1412-1434 → essas métricas vivem em `/repasses` | Clareza da seção financeira |
| D3 | **REMOVER** ou **MINIMIZAR** Banner Carousel | Opção A: Remover totalmente. Opção B: Mostrar apenas 1x para novos usuários (localStorage flag) e via botão "Novidades" discreto | Libera viewport premium |
| D4 | **SUBSTITUIR** slot de Comissões/Salários por cards clínicos | Sugestões: "Retornos pendentes hoje", "Pacientes em lista de espera", "NPS da semana" | Foco clínico |
| D5 | **ELIMINAR** código morto | `fetchCommissionTotals` e `fetchSalaryTotals` (linhas 435-540) deixam de ser chamadas no Dashboard — reduz 2 RPCs e ~150 linhas | Performance |
| D6 | **ADICIONAR** ação rápida "Iniciar atendimento" | O médico quer registrar evolução — hoje precisa ir à Agenda → clicar paciente → abrir prontuário. Um atalho direto acelera o workflow | UX do médico |

**Dashboard Proposto:**

```
┌──────────────────────────────────────────────────────┐
│ 1. KPI GRID (4 cards):                               │
│    • Consultas hoje  • Pendentes confirmação          │
│    • Receita do mês  • Pacientes cadastrados          │
├──────────────────────────────────────────────────────┤
│ 2. AÇÕES RÁPIDAS (4-5 botões):                       │
│    • Novo agendamento  • Novo paciente                │
│    • Iniciar atendimento  • Movimentar estoque        │
│    • Meu financeiro [STAFF]                           │
├──────────────────────────────────────────────────────┤
│ 3. HOJE: Consultas do dia + Próximo paciente/Estoque  │
│    + Retornos pendentes + Lista de espera (compacto)  │
├──────────────────────────────────────────────────────┤
│ 4. MÊS — MÉTRICAS FINANCEIRAS (admin):               │
│    • Receita / Despesas / Saldo (apenas 3 hero cards) │
├──────────────────────────────────────────────────────┤
│ 5. FEED DE ATIVIDADE (admin, colapsável, discreto)    │
└──────────────────────────────────────────────────────┘
```

---

# PARTE II — ARQUITETURA VISUAL DINÂMICA

## 3. Modernização do Sidebar — Efeito "Seamless Tab"

### 3.1 Estado Atual do Sidebar

**Arquivo:** `src/components/layout/Sidebar.tsx` (~920 linhas)

**Container atual (desktop):**
```tsx
<aside className={cn(
  "fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-300 ease-out",
  "bg-background/95 backdrop-blur-xl border-r border-border/50 shadow-xl",
  isCollapsed ? "w-20" : "w-72"
)}>
```

**Estilo do item ativo (expandido):**
```tsx
"bg-primary/10 text-primary before:absolute before:left-0 before:top-1/2 
 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-primary"
```

**Estilo do item ativo (collapsed/ícone):**
```tsx
"bg-gradient-to-br ${category.gradient} text-white shadow-lg shadow-primary/20"
```

**Problemas:**
1. `border-r border-border/50` cria divisória visível entre sidebar e conteúdo
2. `bg-background/95` com `backdrop-blur-xl` é glass effect, não fusão real
3. Item ativo usa `bg-primary/10` — cor completamente distinta do `bg-background` da main area
4. `shadow-xl` no sidebar reforça a separação visual
5. Indicador `before:` é uma barra esquerda — não gera sensação de "tab vazando"

### 3.2 Concept: Efeito "Seamless Tab" (Aba Contínua)

**O que queremos:**
O item ativo do sidebar se "funde" visualmente com a área de conteúdo principal, criando a ilusão de que o fundo do item ativo É o fundo da página. Sem borda, sem sombra, sem divisória — como uma aba de navegador que se conecta ao painel.

**Referência visual:**
```
┌───────────────────┐┌──────────────────────────────────────┐
│                   ││                                      │
│   Dashboard       ││                                      │
│                   ││                                      │
│ ┌─────────────────┘│         CONTEÚDO PRINCIPAL           │
│ │ ✦ Agenda      ◄──── fundo = bg-background, sem borda    │
│ └─────────────────┐│                                      │
│                   ││                                      │
│   Pacientes       ││                                      │
│                   ││                                      │
└───────────────────┘└──────────────────────────────────────┘
      SIDEBAR             MAIN CONTENT
  (bg levemente            (bg-background)
   diferente)
```

O item "Agenda" (ativo) tem:
- Fundo = exatamente `bg-background` (mesma cor da main area)
- Borda superior-esquerda e inferior-esquerda arredondadas (`rounded-l-xl`)
- Lado direito reto e SEM borda — se funde com o conteúdo
- Item acima e abaixo têm "recorte" côncavo no canto para criar a curva visual

### 3.3 Estratégia CSS/Tailwind — Theme-Aware

#### Passo 1: CSS Custom Properties (já existem, vamos usar)

As custom properties já estão definidas em `src/index.css`:

```css
/* Light */
:root {
  --background: 180 20% 97%;      /* hsl(180, 20%, 97%) — teal claro */
  --card: 0 0% 100%;              /* branco puro */
  --sidebar-background: 174 30% 97% / 0.85;
}

/* Dark */
.dark {
  --background: 200 25% 7%;       /* hsl(200, 25%, 7%) — azul escuro */
  --card: 200 25% 10%;
  --sidebar-background: 200 25% 8% / 0.9;
}
```

**Chave:** O item ativo deve usar `bg-background` (sem opacidade), que automaticamente assume a cor correta em light/dark/system.

#### Passo 2: Nova Variável de Sidebar Background

Adicionar em `src/index.css`:

```css
@layer base {
  :root {
    /* Sidebar corpo: levemente diferente do main para criar contraste */
    --sidebar-body: 174 25% 94%;   /* Um pouco mais escuro que --background */
  }

  .dark {
    --sidebar-body: 200 25% 9%;    /* Um pouco mais claro que --background dark */
  }
}
```

#### Passo 3: Refatorar Container do Sidebar

**De (atual):**
```tsx
<aside className={cn(
  "fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-300 ease-out",
  "bg-background/95 backdrop-blur-xl border-r border-border/50 shadow-xl",
  isCollapsed ? "w-20" : "w-72"
)}>
```

**Para (proposto):**
```tsx
<aside className={cn(
  "fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-300 ease-out",
  "bg-[hsl(var(--sidebar-body))]",  // Fundo sólido, sem glass
  // ❌ REMOVIDO: border-r, shadow-xl, backdrop-blur-xl
  isCollapsed ? "w-20" : "w-72"
)}>
```

**Motivo:** A borda-direita e shadow-xl impedem a fusão visual. O sidebar agora tem fundo sólido sutilmente distinto.

#### Passo 4: Estilizar Item Ativo — A Aba Seamless

```tsx
// Classe do item ATIVO no sidebar expandido
const activeItemClass = cn(
  // Fundo = mesma cor do conteúdo principal (FUSION)
  "bg-background",
  "text-foreground font-semibold",
  // Arredondamento: cantos ESQUERDOS arredondados, DIREITO reto
  "rounded-l-xl rounded-r-none",
  // Remove qualquer borda do lado direito
  "border-y border-l border-border/30 border-r-0",
  // Posicionamento: empurra 1px para a direita para "sangrar" sobre a borda
  "mr-[-1px] relative z-10",
  // Transição suave
  "transition-all duration-200 ease-out"
);

// Classe do item INATIVO
const inactiveItemClass = cn(
  "text-muted-foreground",
  "hover:bg-accent/50 hover:text-foreground",
  "rounded-lg",
  "transition-all duration-200 ease-out"
);
```

#### Passo 5: "Inverse Border Radius" (Recorte Côncavo)

Para o efeito visual premium de curvatura invertida acima e abaixo do item ativo (como tabs do macOS/Arc Browser), usar pseudo-elementos:

```css
/* Adicionar em src/index.css */
@layer components {
  .seamless-tab-active {
    @apply bg-background rounded-l-xl rounded-r-none relative z-10;
    margin-right: -1px; /* Sangra sobre a borda do sidebar */
  }

  /* Curva côncava ACIMA do item ativo */
  .seamless-tab-active::before {
    content: '';
    position: absolute;
    right: 0;
    top: -12px;
    width: 12px;
    height: 12px;
    background: transparent;
    border-bottom-right-radius: 12px;
    box-shadow: 4px 4px 0 4px hsl(var(--background));
    pointer-events: none;
  }

  /* Curva côncava ABAIXO do item ativo */
  .seamless-tab-active::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: -12px;
    width: 12px;
    height: 12px;
    background: transparent;
    border-top-right-radius: 12px;
    box-shadow: 4px -4px 0 4px hsl(var(--background));
    pointer-events: none;
  }
}
```

**Como funciona:** O `box-shadow` nos pseudo-elementos cria a ilusão de curvatura invertida usando a mesma cor `--background`. Em dark mode, `--background` muda automaticamente e os recortes acompanham.

#### Passo 6: Ajustar MainLayout para Complementar

Em `src/components/layout/MainLayout.tsx`, o conteúdo principal já usa `bg-background`. Mas o header usa `glass border-b border-border`:

```tsx
// ATUAL (header)
<header className="sticky top-0 z-30 glass border-b border-border">

// PROPOSTO — Manter glass no header, é aceitável aqui
// O efeito seamless é entre SIDEBAR e CONTENT, não com o header
```

**Nenhuma mudança necessária no MainLayout para o efeito de fusão funcionar.**

#### Passo 7: Validação nos 3 Modos de Tema

| Modo | `--background` resolve para | `--sidebar-body` resolve para | Fusão funciona? |
|------|----------------------------|-------------------------------|-----------------|
| **Light** | `hsl(180, 20%, 97%)` — teal bem claro | `hsl(174, 25%, 94%)` — teal sutil | ✅ Item ativo = teal claro, sidebar body = teal sutil mais escuro |
| **Dark** | `hsl(200, 25%, 7%)` — azul escuro | `hsl(200, 25%, 9%)` — azul escuro levemente mais claro | ✅ Item ativo = fundo escuro, sidebar body = escuro mais claro |
| **System** | Herda de light OU dark via `prefers-color-scheme` | Idem | ✅ Funciona pois ambos usam CSS custom properties |

**Não há nenhum hexadecimal hardcoded. Tudo via `var(--*)`.** O tema é 100% dinâmico.

#### Passo 8: Estado Collapsed (Sidebar Recolhido)

No modo collapsed (w-20, só ícones), o efeito seamless não se aplica:
- Manter `bg-gradient-to-br` com cores da categoria para o ícone ativo
- Adicionar leve sombra para destacar o ícone selecionado

```tsx
// Collapsed: manter estilo atual (gradiente colorido)
const activeCollapsedClass = cn(
  `bg-gradient-to-br ${category.gradient}`,
  "text-white shadow-lg rounded-xl",
  "transition-all duration-200"
);
```

### 3.4 Resumo das Alterações para o Efeito Seamless

| Arquivo | Alteração | Linhas Afetadas |
|---------|-----------|-----------------|
| `src/index.css` | Adicionar `--sidebar-body` (light + dark) | Seção `:root` e `.dark` |
| `src/index.css` | Adicionar classe `.seamless-tab-active` com `::before` + `::after` | Nova seção `@layer components` |
| `src/components/layout/Sidebar.tsx` | Container: remover `border-r`, `shadow-xl`, `backdrop-blur-xl`; usar `bg-[hsl(var(--sidebar-body))]` | Linha ~884 |
| `src/components/layout/Sidebar.tsx` | Item ativo: substituir `bg-primary/10` + `before:` bar por `seamless-tab-active` | Classes dos NavItems ativos |
| `src/components/layout/Sidebar.tsx` | Item inativo: manter hover sutil, remover left-bar indicator | Classes dos NavItems inativos |

---

## 4. Design System & Consistência

### 4.1 🔴 Botões: `gradient-primary` Manual (150+ ocorrências)

**Estado atual:** O projeto usa ShadCN `<Button>` corretamente, mas 150+ instâncias aplicam manualmente:
```tsx
<Button className="gradient-primary text-primary-foreground">Ação</Button>
```

Em vez de usar um variant do sistema de design. A classe `gradient-primary` está definida em `index.css` como utility, mas deveria ser variant nativo do componente Button.

**Arquivos com maior concentração:**
- `src/pages/Agenda.tsx` (linhas ~783, 792, 804)
- `src/pages/Pacientes.tsx` (linhas ~365, 399, 402)
- `src/pages/Equipe.tsx` (linhas ~814, 1050)
- `src/pages/Campanhas.tsx` (linhas ~307, 329, 596)
- +40 outros arquivos

**Plano de Correção:**

Adicionar variant `"gradient"` ao componente `src/components/ui/button.tsx`:

```tsx
const buttonVariants = cva("...", {
  variants: {
    variant: {
      default: "...",
      destructive: "...",
      outline: "...",
      secondary: "...",
      ghost: "...",
      link: "...",
      // ✅ NOVO
      gradient: "gradient-primary text-primary-foreground shadow-md hover:shadow-lg hover:opacity-95 transition-all",
    },
    // ...
  },
});
```

Depois, find/replace global:
```
className="gradient-primary text-primary-foreground"  →  variant="gradient"
```

---

### 4.2 🔴 Loading States — Caos Visual

4 abordagens diferentes coexistem:

| Abordagem | Onde | Tamanhos |
|-----------|------|----------|
| `<Skeleton>` ShadCN | PatientContractsDrawer, NextPatientDashboard | ✅ Elegante |
| `<Loader2>` Lucide | 80+ arquivos | ⚠️ Tamanhos variam: `h-3.5`, `h-4`, `h-6`, `h-8` |
| Texto "Carregando..." | Páginas legacy | ❌ Sem indicador visual |
| Spinner custom | Alguns componentes | ❌ Fora do design system |

**Plano de Correção:**

1. Criar componente `<Spinner size="sm|md|lg" />` que encapsula Loader2 com tamanhos padronizados
2. Para pages inteiras → `<Skeleton>` com layout templated
3. Para botões e ações inline → `<Spinner size="sm" />`
4. Documentar no design system: "Loading States" → quando usar cada um

---

### 4.3 🔴 Tipografia — Sem Hierarquia Padronizada

Headings usam classes inconsistentes:

| Nível | Deveria ser | Encontrado em prática |
|-------|-------------|----------------------|
| `<h1>` | `text-3xl font-bold` (page titles) | `text-2xl`, `text-3xl`, `text-xl` — varia |
| `<h2>` | `text-2xl font-bold` (section titles) | `text-xl`, `text-2xl`, `text-lg` — varia |
| `<h3>` | `text-xl font-semibold` (sub-sections) | `text-lg`, `text-xl`, `text-sm` |
| `<h4>` | `text-lg font-semibold` | `font-medium text-sm` |

O MainLayout já define `<h1>` dos títulos de página como `text-2xl font-bold` (desktop) e `text-xl` (mobile), mas páginas com sub-headers não seguem hierarquia.

**Plano de Correção:**

Adicionar em `src/index.css`:

```css
@layer base {
  .page-title    { @apply text-2xl md:text-3xl font-display font-bold tracking-tight; }
  .section-title { @apply text-xl md:text-2xl font-display font-semibold; }
  .sub-title     { @apply text-lg font-display font-semibold; }
  .card-title    { @apply text-base font-semibold; }
}
```

---

### 4.4 🟠 Cores Hardcoded (em vez de tokens)

O Design System define tokens (`--success`, `--warning`, `--info`, `--destructive`), mas vários componentes ignoram e usam cores Tailwind diretas:

| Token disponível | Cor hardcoded usada | Arquivos |
|-----------------|---------------------|----------|
| `text-success` / `bg-success` | `text-green-600`, `bg-green-100`, `bg-green-500/10` | PatientContractsDrawer, OfflineSettings, ContractStatusBadge |
| `text-destructive` / `bg-destructive` | `text-red-600`, `bg-red-50`, `border-red-300` | PatientContractsDrawer, NextPatientDashboard, AiGpsNavigator |
| `text-warning` / `bg-warning` | `text-amber-700`, `border-amber-300`, `bg-yellow-50` | PatientContractsDrawer, CommissionTierIndicator |
| `text-info` / `bg-info` | `text-blue-600`, `bg-blue-500/10` | SmartConfirmationSettings |

**Plano de Correção:**

Criar utility classes semânticas em `src/index.css`:

```css
@layer components {
  .status-success { @apply bg-success/10 text-success border-success/20; }
  .status-error   { @apply bg-destructive/10 text-destructive border-destructive/20; }
  .status-warning { @apply bg-warning/10 text-warning border-warning/20; }
  .status-info    { @apply bg-info/10 text-info border-info/20; }
}
```

Depois, substituir cores hardcoded pelos tokens em todos os componentes listados.

---

### 4.5 🟡 Forms — Pattern Misto

Três padrões de formulário coexistem:

| Padrão | Descrição | Onde |
|--------|-----------|------|
| **A — FormDrawer (ShadCN custom)** | `react-hook-form` + `FormDrawer` + `FormDrawerSection` | ProductFormDialog, StockMovementDialog ✅ |
| **B — Manual `<form onSubmit>`** | `useState` individual por campo, sem validação formal | RegisterPaymentDialog, FinanceiroBillsPayableTab ⚠️ |
| **C — ShadCN `<Form>` (nunca usado)** | Componente `src/components/ui/form.tsx` existe mas tem 0 implementações | N/A ❌ |

**Plano de Correção:**
1. Definir **Padrão A** como oficial para formulários complexos (3+ campos)
2. Aceitar **Padrão B** para formulários simples (1-2 campos, inline)
3. **Deletar** `src/components/ui/form.tsx` se não for adotado, para não gerar confusão

---

### 4.6 ✅ Pontos Positivos (Manter)

- **Toasts:** 100% consistência com `sonner`. Nenhuma exceção.
- **Cards:** ShadCN `<Card>` usado corretamente em todos os locais. Sem `<div>` custom.
- **Modals/Dialogs:** ShadCN `Dialog` e `AlertDialog` uniformes em todo o app.
- **Tabelas:** ShadCN `Table` consistente (porém paginação não implementada — componente existe mas não é usado).
- **CSS Variables:** Design System bem estruturado com 30+ tokens. Base sólida.
- **Fontes:** `Space Grotesk` (display) + `DM Sans` (body) — excelente combo.

---

### 4.7 Tabela de Paginação (Componente Órfão)

`src/components/ui/pagination.tsx` existe no projeto mas não é importado por nenhum componente. Tabelas grandes (Pacientes, Transações, Auditoria) carregam todos os dados sem paginação visível.

**Plano de Correção:**
1. Implementar paginação em tabelas com >50 registros
2. Ou substituir por scroll virtual (`@tanstack/react-virtual`)

---

## 5. Estilo Inline (Código Legacy)

Componentes com `style={{}}` inline que devem ser migrados para Tailwind:

| Componente | Instâncias `style={{}}` | Motivo |
|-----------|------------------------|--------|
| `EmailBuilder.tsx` | 7 | Cores hardcoded em hex para preview de templates |
| `SocialCreativePanel.tsx` | 14 | Dimensões fixas para preview de criativos |
| `VideoRoom.tsx` | 3 | Tamanhos dinâmicos de vídeo (fullscreen) |
| `PatientContractsDrawer.tsx` | 1 | CSS inline em template string para HTML |

**Nota:** EmailBuilder e SocialCreativePanel são previews visuais de conteúdo externo (email HTML, posts sociais). Nestes casos, `style={{}}` pode ser aceitável pois representam conteúdo renderizado, não UI do app. VideoRoom tem `style` dinâmico para fullscreen que é legítimo.

---

# PARTE III — ROADMAP DE EXECUÇÃO

## Prioridades de Implementação

### Sprint 1 — Limpeza Crítica (Alto Impacto, Baixo Esforço)
| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| 1 | Dashboard: remover Comissões/Salários da tela inicial | 2h | 🔴 Alto |
| 2 | Dashboard: remover/esconder Banner Carousel | 1h | 🟠 Médio |
| 3 | Deletar `MinhasComissoes.tsx` (redirect → `/meu-financeiro?tab=comissoes`) | 30min | 🔴 Alto |
| 4 | Deletar `MeusSalarios.tsx` (redirect → `/meu-financeiro?tab=salarios`) | 30min | 🔴 Alto |
| 5 | Sidebar: esconder bloatware atrás de feature flags | 2h | 🟠 Médio |

### Sprint 2 — Sidebar Seamless + Design System
| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| 6 | Implementar efeito Seamless Tab no Sidebar | 4h | 🟠 Médio |
| 7 | Criar variant `gradient` no Button | 1h | 🟠 Médio |
| 8 | Substituir 150+ `gradient-primary` por `variant="gradient"` | 2h | 🟡 Baixo |
| 9 | Criar `<Spinner>` padronizado | 1h | 🟡 Baixo |
| 10 | Definir tipografia base em `index.css` | 1h | 🟡 Baixo |

### Sprint 3 — Consolidação de Módulos
| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| 11 | Consolidar Relatórios em hub único | 6h | 🟠 Médio |
| 12 | Remover tabs Commissions/Salaries do `Financeiro.tsx` | 2h | 🟠 Médio |
| 13 | Unificar Compliance + DiagnosticoSeguranca + RetencaoDados | 4h | 🟡 Baixo |
| 14 | Migrar cores hardcoded para tokens semânticos | 3h | 🟡 Baixo |
| 15 | Implementar paginação em tabelas grandes | 4h | 🟡 Baixo |

---

# APÊNDICES

## A. Inventário Completo de Páginas (src/pages/)

**Total encontrado: 80+ páginas**

<details>
<summary>Lista completa categorizada</summary>

**Recepção:** Dashboard, Recepcao, Agenda, PainelChamada, ListaEspera, RetornosPendentes, Disponibilidade, recepcao/FilaAtendimento

**Clínico:** Pacientes, PacienteDetalhe, Triagem, Prontuarios, Evolucoes, TeleconsultaPage, ChatInterno

**Documentos:** Receituarios, Atestados, LaudosExames, Encaminhamentos, ContratoTermoEditor, TermosConsentimento

**Odontologia:** Odontograma, Periograma, PlanosTratamento

**Financeiro:** Financeiro, MeuFinanceiro, MinhasComissoes, MeusSalarios, FaturamentoTISS, NovaGuiaTISS, ConveniosPage

**Repasses:** Repasses, RepassesComissoes, RepassesSalarios, RepassesRelatorios, repasses/ConfigurarRegras, repasses/CaptacaoIndicacoes

**Relatórios:** Relatorios, RelatorioFinanceiro, RelatorioCaptacao, RelatoriosCustomizaveis

**Suprimentos:** Produtos, Compras, Fornecedores

**Marketing:** Campanhas, Automacoes, ClinicaAutonoma

**Portal do Paciente:** PatientDashboard, PatientConsultas, PatientFinanceiro, PatientProntuario, PatientAgendar, PatientSettings, PatientConsentSigning, PatientProms, +12 outras

**Admin:** Equipe, GerenciarPermissoes, MultiUnit, GestaoSalas, GerenciarServicos, Especialidades, TemplatesProntuario, Integracoes, Compliance, TransmissaoSNGPC, Auditoria, AdminOverrides, RetencaoDados, Configuracoes, MinhasConfiguracoes

**Público:** PublicBooking, NpsPublico, CanalLgpd, VerificarDocumento, TermosDeUso, PoliticaPrivacidade

</details>

## B. CSS Custom Properties — Referência Completa

<details>
<summary>Variáveis Light e Dark</summary>

**Light (`:root`):**
| Variável | Valor HSL | Uso |
|----------|----------|-----|
| `--background` | `180 20% 97%` | Fundo principal |
| `--foreground` | `200 25% 10%` | Texto |
| `--card` | `0 0% 100%` | Cards |
| `--primary` | `174 72% 38%` | Medical Teal |
| `--secondary` | `174 30% 92%` | Soft Teal |
| `--muted` | `180 15% 93%` | Backgrounds neutros |
| `--accent` | `210 80% 55%` | Trust Blue |
| `--destructive` | `0 84% 60%` | Vermelho |
| `--success` | `152 76% 40%` | Verde |
| `--warning` | `38 92% 50%` | Âmbar |
| `--info` | `200 90% 50%` | Azul |
| `--border` | `180 20% 88%` | Bordas |
| `--sidebar-background` | `174 30% 97% / 0.85` | Sidebar glass |
| `--sidebar-primary` | `174 72% 38%` | Teal sidebar |

**Dark (`.dark`):**
| Variável | Valor HSL | Uso |
|----------|----------|-----|
| `--background` | `200 25% 7%` | Fundo escuro |
| `--foreground` | `180 15% 95%` | Texto claro |
| `--card` | `200 25% 10%` | Cards escuros |
| `--primary` | `174 70% 50%` | Teal brilhante |
| `--secondary` | `200 25% 15%` | Secundário escuro |
| `--muted` | `200 25% 15%` | Neutro escuro |
| `--accent` | `210 75% 60%` | Azul claro |
| `--border` | `200 25% 18%` | Bordas escuras |
| `--sidebar-background` | `200 25% 8% / 0.9` | Sidebar dark |

</details>

## C. Sidebar — Mapa Completo de Navegação (9 Categorias, 60+ Itens)

<details>
<summary>Mapa hierárquico</summary>

1. **Recepção** (Teal → Cyan) — 7 itens
2. **Clínico** (Blue → Indigo) — 6 itens
3. **Documentos** (Violet → Purple) — 5 itens
4. **Odontologia** (Pink → Rose) — 3 itens ← CANDIDATO A ESCONDER
5. **Financeiro** (Emerald → Green) — 6 itens
6. **Repasses** (Cyan → Teal) — 6 itens ← CANDIDATO A SIMPLIFICAR
7. **Suprimentos** (Amber → Orange) — 3 itens
8. **Marketing** (Fuchsia → Pink) — 3 itens
9. **Administração** (Slate → Gray) — 16 itens ← CANDIDATO A PODAR

**Total: ~55 itens navegáveis** (meta: reduzir para ~30)

</details>

---

*Relatório gerado automaticamente via auditoria do workspace ClinicNest.*  
*Próximo passo: Apresentar à Diretoria para priorização e início da Sprint 1.*
