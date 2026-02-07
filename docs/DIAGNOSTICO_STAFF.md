# Diagnóstico Exaustivo – Experiência do Profissional/Colaborador (Staff)

## Resumo Executivo

Este documento lista todas as melhorias possíveis para a experiência do profissional/colaborador (staff) no VynloBella, ordenadas por prioridade e impacto.

---

## ✅ Já Implementado

| Item | Status |
|------|--------|
| Minhas Comissões – página dedicada para staff | ✅ |
| Agenda – filtro padrão "Meus agendamentos" | ✅ |
| Dashboard – "Meus agendamentos hoje" + "Meu desempenho" + "Próximo atendimento" | ✅ |
| Produtos – acesso somente leitura | ✅ |
| Serviços – acesso somente leitura | ✅ |
| Venda de produto ao concluir agendamento (via RPC) | ✅ |
| Profissional no modal – staff só pode escolher a si mesmo | ✅ |

---

## Prioridade Alta

### 1. **Clientes – Histórico de consumo simplificado**
- **Atual:** Staff vê lista completa de clientes com todas as informações.
- **Sugestão:** Card/histórico focado em **clientes que eu atendi**, com serviços e valor gerado por período.
- **Benefício:** Profissional enxerga o que já fez para cada cliente, sem visão administrativa.

### 2. **Agenda – Ocultat botão "Novo Agendamento" para staff em horário bloqueado**
- **Atual:** Staff sempre vê botão "Novo Agendamento".
- **Sugestão:** Se o salão tiver conceito de "horário bloqueado" ou "intervalo", ocultar ou desabilitar o botão nesses períodos.
- **Depende:** Modelo de negócio do salão (ex.: intervalo de almoço).

### 3. **Notificações de agendamento**
- **Atual:** Nenhuma notificação in-app ou push.
- **Sugestão:** Aviso quando um novo agendamento for criado para o profissional, ou quando um cliente confirmar/cancelar.
- **Benefício:** Profissional fica ciente das mudanças sem precisar consultar a agenda o tempo todo.

---

## Prioridade Média

### 4. **Dashboard – Gráfico "Meu desempenho"**
- **Atual:** Card com serviço realizado e valor gerado no mês.
- **Sugestão:** Gráfico (linha ou barra) dos últimos 6 meses com serviços e valor gerado.
- **Benefício:** Visão de evolução do desempenho.

### 5. **Minhas Comissões – Detalhamento por serviço**
- **Atual:** Lista com data, valor do serviço, comissão e status.
- **Sugestão:** Campo com nome do serviço e, se possível, do cliente.
- **Benefício:** Melhor rastreabilidade das comissões.

### 6. **Clientes – Acesso restrito**
- **Atual:** Staff vê todos os clientes do tenant.
- **Sugestão:** Listar apenas clientes que o profissional já atendeu (baseado em agendamentos concluídos).
- **Benefício:** Foco nos clientes relevantes e maior privacidade.

### 7. **Agenda – Bloqueio de horário (intervalo)**
- **Atual:** Sem conceito de intervalo ou bloqueio.
- **Sugestão:** Staff pode bloquear horários como "almoço", "pausa", etc., sem criar agendamento.
- **Depende:** Nova entidade de "bloqueios" ou "intervalos".

---

## Prioridade Baixa

### 8. **Assinatura / Plano – Indicador para staff**
- **Atual:** Staff não vê informações de assinatura.
- **Sugestão:** Badge discreto tipo "Plano Pro ativo" ou "Atualize o plano" (sem acesso à tela de assinatura).
- **Benefício:** Sensação de contexto do produto, sem expor dados sensíveis.

### 9. **Relatório em PDF – "Meu mês"**
- **Atual:** Sem relatório específico para staff.
- **Sugestão:** Botão "Baixar meu relatório do mês" (serviços, valor gerado, comissões).
- **Benefício:** Uso para prestação de contas ou declaração de imposto.

### 10. **Tema / Aparência**
- **Atual:** Mesmo tema para admin e staff.
- **Sugestão:** Opção de tema mais compacto ou simplificado para staff.
- **Benefício:** UX mais leve em uso frequente.

---

## Ajustes de Permissão / Segurança

### 11. **Deleção de agendamentos**
- **Atual:** Staff pode deletar agendamentos (se a RLS permitir).
- **Sugestão:** Ocultar botão "Excluir" para staff ou permitir apenas cancelar (status = cancelled).
- **Benefício:** Menos risco de exclusão acidental.

### 12. **Edição de agendamentos de outros**
- **Atual:** Staff filtra "Meus agendamentos", mas pode haver edge case.
- **Sugestão:** Garantir RLS e lógica de UI para que staff só edite agendamentos onde ele é o profissional.
- **Benefício:** Consistência de permissões.

---

## Sugestões de UX / Copy

| Tela | Atual | Sugestão |
|------|-------|----------|
| Dashboard | "Agendamentos Hoje" | "Meus agendamentos hoje" |
| Agenda | "Gerencie os agendamentos do salão" | "Sua agenda de atendimentos" |
| Serviços | "Consulte os serviços do salão" | "Serviços que você realiza" |
| Produtos | "Consulte produtos e estoque" | "Produtos disponíveis para uso" |

---

## Checklist de Implementação Futura

- [ ] Histórico de consumo simplificado em Clientes (staff)
- [ ] Notificações de agendamento
- [ ] Gráfico "Meu desempenho" no Dashboard
- [ ] Detalhamento por serviço em Minhas Comissões
- [ ] Staff só vê clientes que já atendeu
- [ ] Bloqueio de horário (intervalo) na Agenda
- [ ] Relatório PDF "Meu mês" para staff
- [ ] Ocultar/desabilitar excluir agendamento para staff
- [ ] Copy/UX específicos para staff

---

*Documento gerado em 05/02/2025. Atualize conforme novas funcionalidades forem implementadas.*
