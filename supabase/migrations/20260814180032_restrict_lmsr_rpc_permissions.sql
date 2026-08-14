revoke all on function public.execute_lmsr_buy(uuid, uuid, numeric, uuid)
from public, anon, service_role;

grant execute on function public.execute_lmsr_buy(uuid, uuid, numeric, uuid)
to authenticated;
