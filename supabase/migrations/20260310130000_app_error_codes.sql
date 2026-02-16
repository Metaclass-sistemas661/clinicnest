-- P2.1: Standardize application errors for RPCs using DETAIL as a machine-readable code

CREATE OR REPLACE FUNCTION public.raise_app_error(
  p_code text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '%', COALESCE(p_message, 'Erro')
    USING ERRCODE = 'P0001',
          DETAIL = COALESCE(NULLIF(btrim(p_code), ''), 'unknown');
END;
$$;

REVOKE ALL ON FUNCTION public.raise_app_error(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.raise_app_error(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.raise_app_error(text, text) TO service_role;
