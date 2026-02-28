import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Room {
  id: string;
  name: string;
  room_type: string;
  capacity: number;
  is_active: boolean;
  tenant_id: string;
}

export function useRooms() {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["rooms", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_rooms")
        .select("id, name, room_type, capacity, is_active, tenant_id")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Room[];
    },
    enabled: !!tenantId,
  });
}
