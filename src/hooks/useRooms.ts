import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Room {
  id: string;
  name: string;
  is_active: boolean;
  tenant_id: string;
}

export function useRooms() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["rooms", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, name, is_active, tenant_id")
        .order("name");

      if (error) throw error;
      return data as Room[];
    },
    enabled: !!tenantId,
  });
}
