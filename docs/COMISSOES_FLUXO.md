# Fluxo de Comissões – VynloBella

## Estrutura das tabelas

| Tabela | Função |
|--------|--------|
| **professional_commissions** | Configuração de comissão por profissional (tipo %, valor fixo) – 1 linha por profissional/tenant |
| **commission_payments** | Registros de comissões geradas – 1 linha por atendimento concluído |

Não é recomendado unificar em uma única tabela: `professional_commissions` guarda regras, `commission_payments` é o histórico. São papéis diferentes.

---

## Fluxo esperado

1. **Serviço concluído** → Agenda chama `complete_appointment_with_sale`
2. **RPC** → Atualiza `appointments.status = 'completed'` e cria registro em `commission_payments`
3. **Cards** → Dashboard usa `commission_payments` (a pagar / pagas / a receber / recebidas)
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
2. `professional_commissions` (config em Equipe)
3. `tenants.default_commission_percent` (config em Configurações do salão)

Se nenhum existir, a comissão não é criada.

---

## Pontos de atenção

1. **Migration aplicada?** A migration `20260210000000_create_commission_in_rpc.sql` precisa estar aplicada (SQL Editor ou `supabase db push`).
2. **Comissão por profissional:** Conferir em Equipe se o profissional tem comissão cadastrada.
3. **FK:** `commission_payments.professional_id` = `profiles.user_id` (auth), não `profiles.id`.
4. **Período:** Financeiro filtra por mês (`filterMonth`). Comissões fora desse mês não aparecem.

---

## Diagnóstico rápido

1. Concluir um atendimento de um profissional com comissão configurada.
2. Verificar em Supabase se existe registro em `commission_payments` para esse `appointment_id`.
3. Se existir no banco mas não na tela: conferir filtro de mês e se o usuário é admin (admin vê todas; staff só as próprias).
