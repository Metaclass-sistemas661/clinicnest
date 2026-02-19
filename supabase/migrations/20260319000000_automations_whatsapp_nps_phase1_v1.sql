-- FASE 1: Automações + WhatsApp settings (tenant) + NPS

-- 1) Tenant WhatsApp (Evolution API) settings
alter table public.tenants
  add column if not exists whatsapp_api_url text,
  add column if not exists whatsapp_api_key text,
  add column if not exists whatsapp_instance text;

-- 2) Automations
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  channel text not null,
  message_template text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint automations_trigger_type_check check (
    trigger_type in (
      'appointment_created',
      'appointment_reminder_24h',
      'appointment_reminder_2h',
      'appointment_completed',
      'birthday',
      'client_inactive_days'
    )
  ),
  constraint automations_channel_check check (channel in ('whatsapp','email'))
);

create index if not exists idx_automations_tenant_active
  on public.automations(tenant_id, is_active);

alter table public.automations enable row level security;

drop policy if exists "Admins can read automations in their tenant" on public.automations;
create policy "Admins can read automations in their tenant"
  on public.automations for select
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id(auth.uid())
    and public.is_tenant_admin(auth.uid(), tenant_id)
    and public.tenant_has_access(tenant_id)
  );

drop policy if exists "Admins can manage automations in their tenant" on public.automations;
create policy "Admins can manage automations in their tenant"
  on public.automations for all
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id(auth.uid())
    and public.is_tenant_admin(auth.uid(), tenant_id)
    and public.tenant_has_access(tenant_id)
  )
  with check (
    tenant_id = public.get_user_tenant_id(auth.uid())
    and public.is_tenant_admin(auth.uid(), tenant_id)
    and public.tenant_has_access(tenant_id)
  );

-- 2.2) Dispatch logs (idempotency for workers)
create table if not exists public.automation_dispatch_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  channel text not null,
  status text not null default 'sent',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint automation_dispatch_logs_entity_type_check check (entity_type in ('appointment','client')),
  constraint automation_dispatch_logs_channel_check check (channel in ('whatsapp','email')),
  constraint automation_dispatch_logs_status_check check (status in ('sent','skipped','failed'))
);

create unique index if not exists uq_automation_dispatch_once
  on public.automation_dispatch_logs(automation_id, entity_type, entity_id);

create index if not exists idx_automation_dispatch_tenant_created
  on public.automation_dispatch_logs(tenant_id, created_at desc);

alter table public.automation_dispatch_logs enable row level security;

-- Only service_role should read/write logs by default
revoke all on table public.automation_dispatch_logs from public;
revoke all on table public.automation_dispatch_logs from authenticated;
grant all on table public.automation_dispatch_logs to service_role;

-- 2.1) Seed templates (idempotent)
insert into public.automations(tenant_id, name, trigger_type, trigger_config, channel, message_template, is_active)
select
  t.id,
  seed.name,
  seed.trigger_type,
  seed.trigger_config,
  seed.channel,
  seed.message_template,
  true
from public.tenants t
cross join (
  values
    (
      'Confirmação imediata após agendamento',
      'appointment_created',
      '{}'::jsonb,
      'whatsapp',
      'Olá {{client_name}}! Seu agendamento para {{service_name}} foi registrado para {{date}} às {{time}} com {{professional_name}}. {{salon_name}}'
    ),
    (
      'Lembrete 24h antes do horário',
      'appointment_reminder_24h',
      '{}'::jsonb,
      'whatsapp',
      'Olá {{client_name}}! Lembrete: você tem {{service_name}} em {{date}} às {{time}}. {{salon_name}}'
    ),
    (
      'Lembrete 2h antes do horário',
      'appointment_reminder_2h',
      '{}'::jsonb,
      'whatsapp',
      'Olá {{client_name}}! Seu horário de {{service_name}} é hoje às {{time}}. Te esperamos! {{salon_name}}'
    ),
    (
      'Mensagem pós-atendimento (NPS + agradecimento)',
      'appointment_completed',
      '{}'::jsonb,
      'whatsapp',
      'Obrigado por vir, {{client_name}}! Como foi seu atendimento? Responda nosso NPS: {{nps_link}}'
    ),
    (
      'Parabéns no aniversário + cupom de desconto',
      'birthday',
      '{}'::jsonb,
      'whatsapp',
      'Feliz aniversário, {{client_name}}! 🎉 Para comemorar, aqui vai um cupom especial. {{salon_name}}'
    ),
    (
      'Reativação de cliente inativo (X dias sem visita)',
      'client_inactive_days',
      '{"days":60}'::jsonb,
      'whatsapp',
      'Oi {{client_name}}! Sentimos sua falta. Que tal agendar um novo horário? {{salon_name}}'
    )
) as seed(name, trigger_type, trigger_config, channel, message_template)
where not exists (
  select 1
  from public.automations a
  where a.tenant_id = t.id
    and a.name = seed.name
);

-- 3) NPS responses
create table if not exists public.nps_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  token uuid unique not null default gen_random_uuid(),
  score integer check (score between 0 and 10),
  comment text,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_nps_responses_tenant_created
  on public.nps_responses(tenant_id, created_at desc);

create index if not exists idx_nps_responses_appointment
  on public.nps_responses(appointment_id);

alter table public.nps_responses enable row level security;

-- Admins can view NPS responses
drop policy if exists "Admins can read nps responses in their tenant" on public.nps_responses;
create policy "Admins can read nps responses in their tenant"
  on public.nps_responses for select
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id(auth.uid())
    and public.is_tenant_admin(auth.uid(), tenant_id)
    and public.tenant_has_access(tenant_id)
  );

-- Public NPS access via RPC (security definer). Table stays protected.

create or replace function public.get_nps_public_v1(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.nps_responses%rowtype;
  v_tenant_name text;
begin
  select * into v_row
  from public.nps_responses r
  where r.token = p_token
  limit 1;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  select t.name into v_tenant_name
  from public.tenants t
  where t.id = v_row.tenant_id
  limit 1;

  return jsonb_build_object(
    'found', true,
    'tenant_id', v_row.tenant_id,
    'tenant_name', coalesce(v_tenant_name, 'BeautyGest'),
    'appointment_id', v_row.appointment_id,
    'client_id', v_row.client_id,
    'score', v_row.score,
    'comment', v_row.comment,
    'responded_at', v_row.responded_at,
    'created_at', v_row.created_at
  );
end;
$$;

revoke all on function public.get_nps_public_v1(uuid) from public;
grant execute on function public.get_nps_public_v1(uuid) to anon;
grant execute on function public.get_nps_public_v1(uuid) to authenticated;

create or replace function public.submit_nps_public_v1(
  p_token uuid,
  p_score integer,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.nps_responses%rowtype;
begin
  if p_score is null or p_score < 0 or p_score > 10 then
    perform public.raise_app_error('VALIDATION_ERROR', 'Score inválido');
  end if;

  select * into v_row
  from public.nps_responses r
  where r.token = p_token
  limit 1;

  if not found then
    perform public.raise_app_error('NOT_FOUND', 'Token inválido');
  end if;

  if v_row.responded_at is not null then
    return jsonb_build_object('success', true, 'already_responded', true);
  end if;

  update public.nps_responses
    set score = p_score,
        comment = nullif(btrim(coalesce(p_comment,'')),''),
        responded_at = now()
  where token = p_token
    and responded_at is null;

  return jsonb_build_object('success', true, 'already_responded', false);
end;
$$;

revoke all on function public.submit_nps_public_v1(uuid, integer, text) from public;
grant execute on function public.submit_nps_public_v1(uuid, integer, text) to anon;
grant execute on function public.submit_nps_public_v1(uuid, integer, text) to authenticated;

-- 3.1) Create NPS record when an appointment is completed (idempotent)
create or replace function public.create_nps_response_for_completed_appointment_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    insert into public.nps_responses(tenant_id, appointment_id, client_id)
    values (new.tenant_id, new.id, new.client_id)
    on conflict (appointment_id) do nothing;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'uq_nps_responses_appointment'
  ) then
    execute 'create unique index uq_nps_responses_appointment on public.nps_responses(appointment_id) where appointment_id is not null';
  end if;
end $$;

-- ensure trigger exists
DROP TRIGGER IF EXISTS trg_appointments_create_nps_on_complete ON public.appointments;
CREATE TRIGGER trg_appointments_create_nps_on_complete
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.create_nps_response_for_completed_appointment_v1();
