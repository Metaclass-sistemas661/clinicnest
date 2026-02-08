-- Preferência do staff: exibir ou não a barra de progresso de metas no cabeçalho
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_goals_progress_in_header BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.show_goals_progress_in_header IS 'Se false, staff não vê a barra de metas no topo da página';
