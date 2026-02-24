import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface Dependent {
  dependent_id: string;
  dependent_name: string;
  relationship: string;
}

interface DependentsContextType {
  dependents: Dependent[];
  isLoading: boolean;
  error: string | null;
  activeDependent: Dependent | null;
  setActiveDependent: (dependent: Dependent | null) => void;
  isViewingDependent: boolean;
  refresh: () => Promise<void>;
}

const DependentsContext = createContext<DependentsContextType | null>(null);

export function DependentsProvider({ children }: { children: ReactNode }) {
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDependent, setActiveDependent] = useState<Dependent | null>(null);

  const loadDependents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabasePatient as any).rpc("get_patient_dependents");
      
      if (rpcError) {
        throw rpcError;
      }
      
      setDependents((data as Dependent[]) || []);
    } catch (err: any) {
      logger.error("[useDependents] Error loading dependents:", err);
      setError(err?.message || "Erro ao carregar dependentes");
      setDependents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDependents();
  }, [loadDependents]);

  const value: DependentsContextType = {
    dependents,
    isLoading,
    error,
    activeDependent,
    setActiveDependent,
    isViewingDependent: activeDependent !== null,
    refresh: loadDependents,
  };

  return (
    <DependentsContext.Provider value={value}>
      {children}
    </DependentsContext.Provider>
  );
}

export function useDependents() {
  const context = useContext(DependentsContext);
  if (!context) {
    throw new Error("useDependents must be used within a DependentsProvider");
  }
  return context;
}

export function useDependentsOptional() {
  return useContext(DependentsContext);
}

export const RELATIONSHIP_LABELS: Record<string, string> = {
  filho: "Filho",
  filha: "Filha",
  pai: "Pai",
  mae: "Mãe",
  conjuge: "Cônjuge",
  outro: "Outro",
};

export function getRelationshipLabel(relationship: string): string {
  return RELATIONSHIP_LABELS[relationship] || relationship;
}
