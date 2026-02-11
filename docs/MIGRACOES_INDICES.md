# Migrações e Índices (Seções 6.1 e 6.2)

## Índices existentes

Os índices abaixo estão definidos nas migrações e cobrem as recomendações do diagnóstico:

### tenant_id
- `profiles`, `user_roles`, `clients`, `services`, `products`, `appointments`, `financial_transactions`, `stock_movements`
- `subscriptions`, `product_categories`, `professional_commissions`, `commission_payments`
- `appointment_completion_summaries`, `goal_suggestions`, `goals`, `goal_templates`, `goal_achievements`
- `salary_payments`, `notifications`

### professional_id
- `commission_payments`, `salary_payments`, `goal_suggestions`, `goal_achievements`

### status
- `subscriptions`, `appointments`, `commission_payments`, `salary_payments`, `goal_suggestions`

### created_at / data
- `commission_payments`, `appointment_completion_summaries`, `notifications`
- `financial_transactions` (transaction_date), `appointments` (scheduled_at)
- `salary_payments` (payment_date, payment_year/month)

### Outros
- `product_id`: `financial_transactions`, `stock_movements`
- `user_id`: `profiles`, `user_roles`, `notifications`
- `appointment_id`: `commission_payments`
- Unique: `salary_payments` (tenant_id, professional_id, payment_year, payment_month) para evitar pagamentos duplicados

## Migrações relevantes

| Migração | Descrição |
|----------|-----------|
| `20260201...` | Base: profiles, tenants, appointments, financial_transactions, índices iniciais |
| `20260202...` | Subscriptions, índices |
| `20260203...` | Sistema de comissões |
| `20260204...` | Products sale_price, product_categories |
| `20260213...` | appointment_completion_summaries |
| `20260214...` | goals |
| `20260215...` | goal_enhancements |
| `20260217...` | goal_suggestions |
| `20260218...` | notifications |
| `20260224...` | fix commission_system |
| `20260225...` | Sistema de salários (salary_payments) |
| `20260301...` | Validação pay_salary (p_days_worked) |
| `20260302...` | Validação complete_appointment_with_sale (p_quantity) |

## Observações

- Algumas migrações de fix (ex: `20260224`) podem criar índices que já existiam em versões anteriores; o uso de `CREATE INDEX IF NOT EXISTS` evita falhas.
- Migrações antigas com `CREATE INDEX` sem `IF NOT EXISTS` podem falhar em ambientes já atualizados; para novos índices, prefira sempre `IF NOT EXISTS`.
