import { useState, useCallback, useMemo } from "react";

export type FormDrawerMode = "create" | "edit" | "view";

export interface UseFormDrawerOptions<T> {
  defaultValues?: Partial<T>;
  onOpen?: (mode: FormDrawerMode, item?: T) => void;
  onClose?: () => void;
}

export interface UseFormDrawerReturn<T> {
  isOpen: boolean;
  mode: FormDrawerMode;
  editingItem: T | null;
  formData: Partial<T>;
  open: (mode?: FormDrawerMode, item?: T) => void;
  close: () => void;
  setFormData: React.Dispatch<React.SetStateAction<Partial<T>>>;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  reset: () => void;
  isEditing: boolean;
  isCreating: boolean;
  isViewing: boolean;
}

/**
 * useFormDrawer — Hook para gerenciar estado de drawers de formulário.
 * 
 * Substitui os múltiplos states manuais (isDialogOpen, editingId, formData)
 * por um único hook com API limpa.
 * 
 * @example
 * ```tsx
 * interface Receita {
 *   id: string;
 *   paciente: string;
 *   medicamentos: string[];
 * }
 * 
 * const drawer = useFormDrawer<Receita>({
 *   defaultValues: { medicamentos: [] },
 * });
 * 
 * // Abrir para criar
 * <Button onClick={() => drawer.open("create")}>Nova Receita</Button>
 * 
 * // Abrir para editar
 * <Button onClick={() => drawer.open("edit", receita)}>Editar</Button>
 * 
 * // No drawer
 * <FormDrawer
 *   open={drawer.isOpen}
 *   onOpenChange={(open) => !open && drawer.close()}
 *   title={drawer.isCreating ? "Nova Receita" : "Editar Receita"}
 *   onSubmit={handleSubmit}
 * >
 *   <Input
 *     value={drawer.formData.paciente ?? ""}
 *     onChange={(e) => drawer.updateField("paciente", e.target.value)}
 *   />
 * </FormDrawer>
 * ```
 */
export function useFormDrawer<T extends Record<string, any>>(
  options: UseFormDrawerOptions<T> = {}
): UseFormDrawerReturn<T> {
  const { defaultValues = {}, onOpen, onClose } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<FormDrawerMode>("create");
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [formData, setFormData] = useState<Partial<T>>(defaultValues);

  const open = useCallback(
    (openMode: FormDrawerMode = "create", item?: T) => {
      setMode(openMode);
      setEditingItem(item ?? null);
      
      if (openMode === "edit" && item) {
        setFormData({ ...item });
      } else if (openMode === "create") {
        setFormData({ ...defaultValues });
      } else if (openMode === "view" && item) {
        setFormData({ ...item });
      }
      
      setIsOpen(true);
      onOpen?.(openMode, item);
    },
    [defaultValues, onOpen]
  );

  const close = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const reset = useCallback(() => {
    setFormData({ ...defaultValues });
    setEditingItem(null);
    setMode("create");
  }, [defaultValues]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const isEditing = mode === "edit";
  const isCreating = mode === "create";
  const isViewing = mode === "view";

  return useMemo(
    () => ({
      isOpen,
      mode,
      editingItem,
      formData,
      open,
      close,
      setFormData,
      updateField,
      reset,
      isEditing,
      isCreating,
      isViewing,
    }),
    [isOpen, mode, editingItem, formData, open, close, updateField, reset, isEditing, isCreating, isViewing]
  );
}

/**
 * useFormPage — Hook similar para páginas de formulário com navegação.
 * 
 * Útil quando o formulário é uma página dedicada e precisa de
 * gerenciamento de estado de edição.
 */
export interface UseFormPageOptions<T> {
  defaultValues?: Partial<T>;
  initialData?: T | null;
  onSave?: (data: Partial<T>) => Promise<void>;
}

export interface UseFormPageReturn<T> {
  formData: Partial<T>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<T>>>;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  isDirty: boolean;
  reset: () => void;
  resetToInitial: () => void;
}

export function useFormPage<T extends Record<string, any>>(
  options: UseFormPageOptions<T> = {}
): UseFormPageReturn<T> {
  const { defaultValues = {}, initialData } = options;

  const initial = initialData ?? defaultValues;
  const [formData, setFormData] = useState<Partial<T>>(initial as Partial<T>);
  const [originalData] = useState<Partial<T>>(initial as Partial<T>);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const reset = useCallback(() => {
    setFormData({ ...defaultValues });
  }, [defaultValues]);

  const resetToInitial = useCallback(() => {
    setFormData({ ...originalData });
  }, [originalData]);

  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  }, [formData, originalData]);

  return useMemo(
    () => ({
      formData,
      setFormData,
      updateField,
      isDirty,
      reset,
      resetToInitial,
    }),
    [formData, updateField, isDirty, reset, resetToInitial]
  );
}
