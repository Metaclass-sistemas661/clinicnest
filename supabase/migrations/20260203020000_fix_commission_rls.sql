-- Migration: Corrigir RLS para permitir inserção de comissões via trigger
-- O trigger SECURITY DEFINER precisa poder inserir mesmo sem auth.uid()

-- Remover TODAS as políticas de commission_payments se existirem e recriar
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Profissionais podem ver suas próprias comissões" ON public.commission_payments;
    DROP POLICY IF EXISTS "Sistema e admins podem criar pagamentos de comissão" ON public.commission_payments;
    DROP POLICY IF EXISTS "Apenas admins podem atualizar pagamentos" ON public.commission_payments;
    DROP POLICY IF EXISTS "Apenas admins podem deletar pagamentos" ON public.commission_payments;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Recriar todas as políticas com as correções

-- SELECT: Profissionais veem suas próprias comissões, admins veem todas do tenant
CREATE POLICY "Profissionais podem ver suas próprias comissões"
    ON public.commission_payments FOR SELECT
    USING (
        auth.uid() = professional_id
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_payments.tenant_id
            AND ur.role = 'admin'
        )
    );

-- INSERT: Sistema pode criar automaticamente quando agendamento é completado (via trigger SECURITY DEFINER)
-- Nova política que permite inserção via trigger (SECURITY DEFINER) ou por admin
CREATE POLICY "Sistema e admins podem criar pagamentos de comissão"
    ON public.commission_payments FOR INSERT
    WITH CHECK (
        -- Permitir inserção quando executado por função SECURITY DEFINER
        -- (quando não há JWT no contexto, significa que é trigger)
        -- Ou quando o usuário atual é admin do tenant
        auth.uid() IS NULL OR
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_payments.tenant_id
            AND ur.role = 'admin'
        )
    );

-- UPDATE: Apenas admins podem atualizar (marcar como pago, etc)
CREATE POLICY "Apenas admins podem atualizar pagamentos"
    ON public.commission_payments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_payments.tenant_id
            AND ur.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_payments.tenant_id
            AND ur.role = 'admin'
        )
    );

-- DELETE: Apenas admins
CREATE POLICY "Apenas admins podem deletar pagamentos"
    ON public.commission_payments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_payments.tenant_id
            AND ur.role = 'admin'
        )
    );
