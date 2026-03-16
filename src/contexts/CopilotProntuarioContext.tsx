import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { CopilotInput } from "@/components/ai/AiCopilotPanel";

interface CopilotCallbacks {
  onSelectCid?: (code: string, description: string) => void;
  onAppendPrescription?: (text: string) => void;
  onAppendExam?: (text: string) => void;
  onAppendPlan?: (text: string) => void;
}

interface CopilotProntuarioState {
  /** Whether the prontuario form is currently mounted */
  active: boolean;
  /** Current prontuario fields for the Copilot to analyze */
  input: CopilotInput | null;
  /** Callbacks to insert suggestions into the form */
  callbacks: CopilotCallbacks;
}

interface CopilotProntuarioContextValue extends CopilotProntuarioState {
  /** Called by ProntuarioForm to register itself */
  register: (input: CopilotInput, callbacks: CopilotCallbacks) => void;
  /** Called by ProntuarioForm to update the input as fields change */
  updateInput: (input: CopilotInput) => void;
  /** Called by ProntuarioForm on unmount */
  unregister: () => void;
}

const initialState: CopilotProntuarioState = {
  active: false,
  input: null,
  callbacks: {},
};

const CopilotProntuarioContext = createContext<CopilotProntuarioContextValue>({
  ...initialState,
  register: () => {},
  updateInput: () => {},
  unregister: () => {},
});

export function CopilotProntuarioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CopilotProntuarioState>(initialState);

  const register = useCallback((input: CopilotInput, callbacks: CopilotCallbacks) => {
    setState({ active: true, input, callbacks });
  }, []);

  const updateInput = useCallback((input: CopilotInput) => {
    setState((prev) => (prev.active ? { ...prev, input } : prev));
  }, []);

  const unregister = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <CopilotProntuarioContext.Provider value={{ ...state, register, updateInput, unregister }}>
      {children}
    </CopilotProntuarioContext.Provider>
  );
}

export function useCopilotProntuario() {
  return useContext(CopilotProntuarioContext);
}
