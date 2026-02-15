alter table public.tenants
  add column if not exists billing_cpf_cnpj text;

create index if not exists idx_tenants_billing_cpf_cnpj
  on public.tenants(billing_cpf_cnpj);
