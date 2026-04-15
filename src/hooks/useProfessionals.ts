import { useState, useEffect, useCallback } from "react";
import { api } from "@/integrations/gcp/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

interface Professional {
  user_id: string;
  full_name: string | null;
  email: string | null;
  professional_type: string | null;
}

export function useProfessionals() {
  const { profile } = useAuth();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfessionals = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setIsLoading(true);
    try {
      const { data, error } = await api
        .from("profiles")
        .select("user_id, full_name, email, professional_type")
        .eq("tenant_id", profile.tenant_id)
        .not("professional_type", "is", null)
        .order("full_name");

      if (error) throw error;
      setProfessionals(data || []);
    } catch (error) {
      logger.error("Error fetching professionals:", error);
      setProfessionals([]);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetchProfessionals();
  }, [fetchProfessionals]);

  return { professionals, isLoading, refetch: fetchProfessionals };
}
