# Fluxo de Comissões – VynloBella

## Estrutura das tabelas

| Tabela | Função |
|--------|--------|
| **professional_commissions** | Configuração de comissão por profissional (tipo %, valor fixo) – 1 linha por profissional/tenant |
| **commission_payments** | Registros de comissões geradas – 1 linha por atendimento concluído |

---

## Fluxo esperado

1. **Serviço concluído** → Agenda chama `complete_appointment_with_sale`
2. **RPC** → Atualiza `appointments.status = 'completed'` e cria registro em `commission_payments`
3. **Cards** → Dashboard usa `get_dashboard_commission_totals` (RPC com fallback para query direta)
4. **Admin** → Em Financeiro > Comissões clica em "Pagar comissão"
5. **UPDATE** → `commission_payments.status = 'paid'`
6. **Trigger** → Cria despesa em `financial_transactions`
7. **Atualização** → Cards e tabela refazem o fetch

---

## Cálculo da comissão

- **Percentual:** `valor_serviço × (value / 100)`
- **Fixo:** usa `value` da config

Ordem de prioridade:
1. `appointments.commission_amount` (valor fixo no agendamento)
2. `professional_commissions` (config em Equipe — percentual ou valor fixo)

**Não há comissão padrão.** Se o profissional não tiver config em Equipe e o agendamento não tiver valor explícito, a comissão não é criada.

---

## Identificadores

- `appointments.professional_id` = `profiles.id` (PK do perfil)
- `commission_payments.professional_id` = `profiles.user_id` (auth.uid do profissional)
- `professional_commissions.user_id` = `profiles.user_id` (auth.uid do profissional)

---

## Migrations essenciais

- `20260223000000_commission_system_reset.sql` – RLS, RPC get_dashboard_commission_totals e complete_appointment_with_sale consolidados

---

## Diagnóstico rápido

1. Aplicar migration: `npx supabase db push` ou `npx supabase migration up`
2. Conferir em Equipe se o profissional tem comissão cadastrada
3. Concluir atendimento e verificar em Supabase se existe registro em `commission_payments`
4. Se existir no banco mas não nos cards: verificar se a migration foi aplicada
