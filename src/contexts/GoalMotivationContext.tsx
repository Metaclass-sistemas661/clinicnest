import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface GoalProgress {
  id: string;
  name: string;
  goal_type: string;
  target_value: number;
  current_value: number;
  progress_pct: number;
  days_remaining?: number;
}

export interface GoalMotivationData {
  commissionAmount: number;
  goals: GoalProgress[];
}

interface GoalMotivationContextType {
  showGoalMotivation: (data: GoalMotivationData) => void;
  motivationOpen: boolean;
  motivationData: GoalMotivationData | null;
  closeMotivation: () => void;
}

const GoalMotivationContext = createContext<GoalMotivationContextType | undefined>(undefined);

export function useGoalMotivation() {
  const ctx = useContext(GoalMotivationContext);
  return ctx;
}

interface GoalMotivationProviderProps {
  children: ReactNode;
}

export function GoalMotivationProvider({ children }: GoalMotivationProviderProps) {
  const [data, setData] = useState<GoalMotivationData | null>(null);
  const [open, setOpen] = useState(false);

  const showGoalMotivation = useCallback((d: GoalMotivationData) => {
    setData(d);
    setOpen(true);
  }, []);

  const closeMotivation = useCallback(() => {
    setOpen(false);
    setData(null);
  }, []);

  return (
    <GoalMotivationContext.Provider
      value={{
        showGoalMotivation,
        motivationOpen: open,
        motivationData: data,
        closeMotivation,
      }}
    >
      {children}
    </GoalMotivationContext.Provider>
  );
}
