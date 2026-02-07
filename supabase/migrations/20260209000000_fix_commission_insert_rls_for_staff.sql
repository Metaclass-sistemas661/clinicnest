-- Migration: Permitir que o trigger crie comissão quando staff conclui seu próprio atendimento
-- O trigger roda no contexto da sessão do usuário; quando staff conclui, auth.uid() = staff.
-- A política anterior exigia admin, bloqueando o INSERT do trigger.

DROP POLICY IF EXISTS "Sistema e admins podem criar pagamentos de comissão" ON public.commission_payments;

CREATE POLICY "Sistema e admins podem criar pagamentos de comissão"
    ON public.commission_payments FOR INSERT
    WITH CHECK (
        auth.uid() IS NULL
        OR professional_id = auth.uid()  -- Staff concluindo seu próprio atendimento (trigger cria comissão)
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = commission_payments.tenant_id
            AND ur.role = 'admin'
        )
    );
