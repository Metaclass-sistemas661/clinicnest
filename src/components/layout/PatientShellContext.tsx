/**
 * Context shared between PatientShellRoute and PatientLayout.
 * Extracted to avoid circular dependency.
 */
import { createContext, useContext } from "react";

export interface PatientShellContextValue {
  inShell: boolean;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
}

export const PatientShellContext = createContext<PatientShellContextValue>({
  inShell: false,
  searchOpen: false,
  setSearchOpen: () => {},
});

export function usePatientShell() {
  return useContext(PatientShellContext);
}
