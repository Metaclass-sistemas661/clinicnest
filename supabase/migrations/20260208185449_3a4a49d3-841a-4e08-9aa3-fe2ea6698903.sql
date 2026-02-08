-- Tabela para configuração de comissão por profissional
CREATE TABLE public.professional_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- user_id do profissional (profiles.user_id)
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')) DEFAULT 'percentage',
  value NUMERIC NOT NULL DEFAULT 0, -- valor percentual (0-100) ou valor fixo em R$
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Enable RLS
ALTER TABLE public.professional_commissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view commissions in their tenant"
  ON public.professional_commissions FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins can create commissions in their tenant"
  ON public.professional_commissions FOR INSERT
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update commissions in their tenant"
  ON public.professional_commissions FOR UPDATE
  USING (is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete commissions in their tenant"
  ON public.professional_commissions FOR DELETE
  USING (is_tenant_admin(auth.uid(), tenant_id));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_professional_commissions_updated_at
  BEFORE UPDATE ON public.professional_commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();