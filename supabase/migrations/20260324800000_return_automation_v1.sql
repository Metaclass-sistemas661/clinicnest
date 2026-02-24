-- ============================================================================
-- FASE 24A: Automação de Retorno
-- Sistema de lembretes e pré-agendamento de retornos
-- ============================================================================

-- ─── Tabela de lembretes de retorno ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS return_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Origem
  medical_record_id UUID REFERENCES medical_records(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Paciente e profissional
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  
  -- Configuração do retorno
  return_days INTEGER NOT NULL, -- Dias para retorno (7, 15, 30, 60, 90, etc)
  return_date DATE NOT NULL, -- Data calculada do retorno
  reason TEXT, -- Motivo do retorno
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Aguardando retorno
    'notified',     -- Paciente notificado
    'scheduled',    -- Agendamento criado
    'completed',    -- Retorno realizado
    'cancelled',    -- Cancelado
    'expired'       -- Expirado (paciente não retornou)
  )),
  
  -- Agendamento vinculado (se pré-agendado)
  scheduled_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  
  -- Notificações
  notify_patient BOOLEAN NOT NULL DEFAULT TRUE,
  notify_days_before INTEGER DEFAULT 3, -- Notificar X dias antes
  last_notification_at TIMESTAMPTZ,
  notification_count INTEGER DEFAULT 0,
  
  -- Contato preferencial
  preferred_contact TEXT CHECK (preferred_contact IN ('whatsapp', 'email', 'sms', 'phone')),
  
  -- Auditoria
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_return_reminders_tenant ON return_reminders(tenant_id);
CREATE INDEX idx_return_reminders_client ON return_reminders(client_id);
CREATE INDEX idx_return_reminders_status ON return_reminders(tenant_id, status);
CREATE INDEX idx_return_reminders_date ON return_reminders(tenant_id, return_date);
CREATE INDEX idx_return_reminders_pending ON return_reminders(tenant_id, return_date) 
  WHERE status IN ('pending', 'notified');

-- RLS
ALTER TABLE return_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "return_reminders_tenant_isolation" ON return_reminders
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- ─── Adicionar campo de retorno no prontuário ─────────────────────────────────

ALTER TABLE medical_records 
ADD COLUMN IF NOT EXISTS return_days INTEGER;

ALTER TABLE medical_records 
ADD COLUMN IF NOT EXISTS return_reason TEXT;

ALTER TABLE medical_records 
ADD COLUMN IF NOT EXISTS return_reminder_id UUID REFERENCES return_reminders(id) ON DELETE SET NULL;

COMMENT ON COLUMN medical_records.return_days IS 'Dias para retorno sugerido pelo profissional';
COMMENT ON COLUMN medical_records.return_reason IS 'Motivo do retorno';

-- ─── Função para criar lembrete de retorno ────────────────────────────────────

CREATE OR REPLACE FUNCTION create_return_reminder(
  p_medical_record_id UUID,
  p_return_days INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_notify_patient BOOLEAN DEFAULT TRUE,
  p_notify_days_before INTEGER DEFAULT 3,
  p_preferred_contact TEXT DEFAULT 'whatsapp',
  p_pre_schedule BOOLEAN DEFAULT FALSE,
  p_service_id UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_record RECORD;
  v_reminder_id UUID;
  v_return_date DATE;
  v_appointment_id UUID;
BEGIN
  -- Busca dados do prontuário
  SELECT 
    mr.tenant_id, mr.client_id, mr.professional_id, mr.appointment_id,
    a.service_id as appt_service_id
  INTO v_record
  FROM medical_records mr
  LEFT JOIN appointments a ON a.id = mr.appointment_id
  WHERE mr.id = p_medical_record_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prontuário não encontrado';
  END IF;
  
  -- Calcula data de retorno
  v_return_date := CURRENT_DATE + p_return_days;
  
  -- Cria o lembrete
  INSERT INTO return_reminders (
    tenant_id, medical_record_id, appointment_id, client_id, professional_id, service_id,
    return_days, return_date, reason, notify_patient, notify_days_before, preferred_contact,
    created_by
  ) VALUES (
    v_record.tenant_id, p_medical_record_id, v_record.appointment_id, v_record.client_id,
    v_record.professional_id, COALESCE(p_service_id, v_record.appt_service_id),
    p_return_days, v_return_date, p_reason, p_notify_patient, p_notify_days_before,
    p_preferred_contact, auth.uid()
  ) RETURNING id INTO v_reminder_id;
  
  -- Atualiza o prontuário
  UPDATE medical_records
  SET 
    return_days = p_return_days,
    return_reason = p_reason,
    return_reminder_id = v_reminder_id,
    updated_at = NOW()
  WHERE id = p_medical_record_id;
  
  -- Se solicitado pré-agendamento, cria appointment com status especial
  IF p_pre_schedule THEN
    INSERT INTO appointments (
      tenant_id, client_id, professional_id, service_id, date, status, notes
    ) VALUES (
      v_record.tenant_id, v_record.client_id, v_record.professional_id,
      COALESCE(p_service_id, v_record.appt_service_id), v_return_date,
      'pending', 'Retorno automático - ' || COALESCE(p_reason, 'Consulta de retorno')
    ) RETURNING id INTO v_appointment_id;
    
    -- Vincula ao lembrete
    UPDATE return_reminders
    SET 
      scheduled_appointment_id = v_appointment_id,
      status = 'scheduled'
    WHERE id = v_reminder_id;
  END IF;
  
  RETURN v_reminder_id;
END;
$$;

-- ─── Função para buscar retornos pendentes ────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pending_returns(
  p_tenant_id UUID,
  p_status TEXT DEFAULT NULL,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_professional_id UUID DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  client_id UUID,
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  professional_id UUID,
  professional_name TEXT,
  service_name TEXT,
  return_days INTEGER,
  return_date DATE,
  days_until_return INTEGER,
  days_overdue INTEGER,
  reason TEXT,
  status TEXT,
  notify_patient BOOLEAN,
  last_notification_at TIMESTAMPTZ,
  scheduled_appointment_id UUID,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rr.id,
    rr.client_id,
    c.name as client_name,
    c.phone as client_phone,
    c.email as client_email,
    rr.professional_id,
    p.name as professional_name,
    s.name as service_name,
    rr.return_days,
    rr.return_date,
    (rr.return_date - CURRENT_DATE)::INTEGER as days_until_return,
    CASE WHEN rr.return_date < CURRENT_DATE 
      THEN (CURRENT_DATE - rr.return_date)::INTEGER 
      ELSE 0 
    END as days_overdue,
    rr.reason,
    rr.status,
    rr.notify_patient,
    rr.last_notification_at,
    rr.scheduled_appointment_id,
    rr.created_at
  FROM return_reminders rr
  JOIN clients c ON c.id = rr.client_id
  LEFT JOIN profiles p ON p.id = rr.professional_id
  LEFT JOIN services s ON s.id = rr.service_id
  WHERE rr.tenant_id = p_tenant_id
    AND (p_status IS NULL OR rr.status = p_status)
    AND (p_from_date IS NULL OR rr.return_date >= p_from_date)
    AND (p_to_date IS NULL OR rr.return_date <= p_to_date)
    AND (p_professional_id IS NULL OR rr.professional_id = p_professional_id)
  ORDER BY 
    CASE WHEN rr.status = 'pending' AND rr.return_date < CURRENT_DATE THEN 0 ELSE 1 END,
    rr.return_date ASC;
END;
$$;

-- ─── Função para buscar retornos a notificar ──────────────────────────────────

CREATE OR REPLACE FUNCTION get_returns_to_notify(p_tenant_id UUID)
RETURNS TABLE (
  reminder_id UUID,
  client_id UUID,
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  professional_name TEXT,
  return_date DATE,
  days_until_return INTEGER,
  reason TEXT,
  preferred_contact TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rr.id as reminder_id,
    rr.client_id,
    c.name as client_name,
    c.phone as client_phone,
    c.email as client_email,
    p.name as professional_name,
    rr.return_date,
    (rr.return_date - CURRENT_DATE)::INTEGER as days_until_return,
    rr.reason,
    rr.preferred_contact
  FROM return_reminders rr
  JOIN clients c ON c.id = rr.client_id
  LEFT JOIN profiles p ON p.id = rr.professional_id
  WHERE rr.tenant_id = p_tenant_id
    AND rr.status = 'pending'
    AND rr.notify_patient = true
    AND rr.return_date - rr.notify_days_before <= CURRENT_DATE
    AND rr.return_date >= CURRENT_DATE
    AND (rr.last_notification_at IS NULL OR rr.last_notification_at < CURRENT_DATE - INTERVAL '1 day')
  ORDER BY rr.return_date ASC;
END;
$$;

-- ─── Função para marcar retorno como notificado ───────────────────────────────

CREATE OR REPLACE FUNCTION mark_return_notified(p_reminder_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE return_reminders
  SET 
    status = 'notified',
    last_notification_at = NOW(),
    notification_count = notification_count + 1,
    updated_at = NOW()
  WHERE id = p_reminder_id;
END;
$$;

-- ─── Função para vincular agendamento ao retorno ──────────────────────────────

CREATE OR REPLACE FUNCTION link_appointment_to_return(
  p_reminder_id UUID,
  p_appointment_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE return_reminders
  SET 
    scheduled_appointment_id = p_appointment_id,
    status = 'scheduled',
    updated_at = NOW()
  WHERE id = p_reminder_id;
END;
$$;

-- ─── Função para completar retorno ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION complete_return_reminder(p_reminder_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE return_reminders
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_reminder_id;
END;
$$;

-- ─── Trigger para completar retorno quando appointment é completado ───────────

CREATE OR REPLACE FUNCTION check_return_on_appointment_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Marca retornos vinculados como completados
    UPDATE return_reminders
    SET status = 'completed', updated_at = NOW()
    WHERE scheduled_appointment_id = NEW.id
      AND status IN ('pending', 'notified', 'scheduled');
    
    -- Também verifica se é um retorno do mesmo paciente/profissional
    UPDATE return_reminders
    SET status = 'completed', updated_at = NOW()
    WHERE client_id = NEW.client_id
      AND professional_id = NEW.professional_id
      AND status IN ('pending', 'notified')
      AND return_date BETWEEN NEW.date - INTERVAL '7 days' AND NEW.date + INTERVAL '7 days';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_return_on_appointment ON appointments;
CREATE TRIGGER trg_check_return_on_appointment
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION check_return_on_appointment_complete();

-- ─── Função para expirar retornos antigos ─────────────────────────────────────

CREATE OR REPLACE FUNCTION expire_old_returns(p_days_overdue INTEGER DEFAULT 30)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE return_reminders
  SET status = 'expired', updated_at = NOW()
  WHERE status IN ('pending', 'notified')
    AND return_date < CURRENT_DATE - p_days_overdue;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── Estatísticas de retornos ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_return_statistics(
  p_tenant_id UUID,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL
) RETURNS TABLE (
  total_reminders BIGINT,
  pending_count BIGINT,
  notified_count BIGINT,
  scheduled_count BIGINT,
  completed_count BIGINT,
  expired_count BIGINT,
  overdue_count BIGINT,
  completion_rate NUMERIC,
  avg_days_to_return NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_reminders,
    COUNT(*) FILTER (WHERE rr.status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE rr.status = 'notified') as notified_count,
    COUNT(*) FILTER (WHERE rr.status = 'scheduled') as scheduled_count,
    COUNT(*) FILTER (WHERE rr.status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE rr.status = 'expired') as expired_count,
    COUNT(*) FILTER (WHERE rr.status IN ('pending', 'notified') AND rr.return_date < CURRENT_DATE) as overdue_count,
    ROUND(
      COUNT(*) FILTER (WHERE rr.status = 'completed')::NUMERIC / 
      NULLIF(COUNT(*) FILTER (WHERE rr.status IN ('completed', 'expired')), 0) * 100, 
      1
    ) as completion_rate,
    ROUND(AVG(rr.return_days)::NUMERIC, 1) as avg_days_to_return
  FROM return_reminders rr
  WHERE rr.tenant_id = p_tenant_id
    AND (p_from_date IS NULL OR rr.created_at::DATE >= p_from_date)
    AND (p_to_date IS NULL OR rr.created_at::DATE <= p_to_date);
END;
$$;
