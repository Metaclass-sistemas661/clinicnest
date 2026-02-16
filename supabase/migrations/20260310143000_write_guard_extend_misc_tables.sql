-- P7: Extend write-guard (RPC-only writes) to remaining tables after frontend migration

-- services
DROP TRIGGER IF EXISTS trg_enforce_rpc_only_writes_services ON public.services;
CREATE TRIGGER trg_enforce_rpc_only_writes_services
BEFORE INSERT OR UPDATE OR DELETE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();

-- clients
DROP TRIGGER IF EXISTS trg_enforce_rpc_only_writes_clients ON public.clients;
CREATE TRIGGER trg_enforce_rpc_only_writes_clients
BEFORE INSERT OR UPDATE OR DELETE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();

-- goals
DROP TRIGGER IF EXISTS trg_enforce_rpc_only_writes_goals ON public.goals;
CREATE TRIGGER trg_enforce_rpc_only_writes_goals
BEFORE INSERT OR UPDATE OR DELETE ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();

-- goal_templates
DROP TRIGGER IF EXISTS trg_enforce_rpc_only_writes_goal_templates ON public.goal_templates;
CREATE TRIGGER trg_enforce_rpc_only_writes_goal_templates
BEFORE INSERT OR UPDATE OR DELETE ON public.goal_templates
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();

-- product_categories
DROP TRIGGER IF EXISTS trg_enforce_rpc_only_writes_product_categories ON public.product_categories;
CREATE TRIGGER trg_enforce_rpc_only_writes_product_categories
BEFORE INSERT OR UPDATE OR DELETE ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();

-- products
DROP TRIGGER IF EXISTS trg_enforce_rpc_only_writes_products ON public.products;
CREATE TRIGGER trg_enforce_rpc_only_writes_products
BEFORE INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rpc_only_writes();
