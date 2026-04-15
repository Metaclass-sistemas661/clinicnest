import { useQuery } from "@tanstack/react-query";
import { api } from "@/integrations/gcp/client";
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
      const { data, error } = await api
        .from("clinic_rooms")
        .select("id, name, room_type, capacity, is_active, tenant_id")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Room[];
    },
    enabled: !!tenantId,
  });
}
