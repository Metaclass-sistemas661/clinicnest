-- Backfill: cria commission_payments para agendamentos concluídos que tinham professional_commissions
-- mas não tinham comissão criada (bug anterior). Executa automaticamente na aplicação da migration.

INSERT INTO public.commission_payments (
  tenant_id,
  professional_id,
  appointment_id,
  commission_config_id,
  amount,
  service_price,
  commission_type,
  commission_value,
  status
)
SELECT
  a.tenant_id,
  p.user_id AS professional_id,
  a.id AS appointment_id,
  pc.id AS commission_config_id,
  CASE
    WHEN a.commission_amount IS NOT NULL AND a.commission_amount > 0
      THEN a.commission_amount
    WHEN pc.type = 'percentage'
      THEN COALESCE(a.price, s.price, 0) * (pc.value / 100)
    ELSE pc.value
  END AS amount,
  COALESCE(a.price, s.price, 0) AS service_price,
  CASE
    WHEN a.commission_amount IS NOT NULL AND a.commission_amount > 0 THEN 'fixed'
    ELSE pc.type
  END AS commission_type,
  COALESCE(a.commission_amount, pc.value) AS commission_value,
  'pending' AS status
FROM public.appointments a
INNER JOIN public.profiles p ON p.id = a.professional_id
INNER JOIN public.professional_commissions pc
  ON pc.user_id = p.user_id AND pc.tenant_id = a.tenant_id
LEFT JOIN public.services s ON s.id = a.service_id
WHERE a.status = 'completed'
  AND a.professional_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.commission_payments cp
    WHERE cp.appointment_id = a.id
  )
  AND (
    (a.commission_amount IS NOT NULL AND a.commission_amount > 0)
    OR (pc.type = 'percentage' AND COALESCE(a.price, s.price, 0) > 0)
    OR (pc.type = 'fixed' AND pc.value > 0)
  );
