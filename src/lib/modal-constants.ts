/**
 * Constantes de Tamanho de Modal — Fase 26A
 * Padronização de tamanhos para Dialog, AlertDialog e FormDrawer
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * REGRA DE DECISÃO DE TAMANHO
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * | Campos/Complexidade | Tamanho        | Classe Tailwind  | Uso                           |
 * |---------------------|----------------|------------------|-------------------------------|
 * | 0 (só texto)        | confirmation   | sm:max-w-md      | Confirmações, alertas, delete |
 * | 1-4 campos          | form_short     | sm:max-w-lg      | Formulários simples           |
 * | 5-8 campos          | form_medium    | sm:max-w-xl      | Formulários médios            |
 * | 9-12 campos         | form_long      | sm:max-w-2xl     | Formulários longos            |
 * | Wizard/Preview      | wizard_preview | sm:max-w-3xl     | Wizards, previews, comparação |
 * | Fullscreen          | fullscreen     | sm:max-w-4xl     | Tabelas, dashboards em modal  |
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * EXEMPLOS DE USO
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * AlertDialog de exclusão:
 *   <AlertDialogContent className={MODAL_SIZES.confirmation}>
 * 
 * Dialog de cadastro simples (nome, descrição):
 *   <DialogContent className={MODAL_SIZES.form_short}>
 * 
 * FormDrawer de agendamento (8 campos):
 *   <FormDrawer width="lg"> // equivale a form_medium
 * 
 * Wizard de configuração:
 *   <DialogContent className={MODAL_SIZES.wizard_preview}>
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export type ModalSize = 
  | "confirmation"
  | "form_short"
  | "form_medium"
  | "form_long"
  | "wizard_preview"
  | "fullscreen";

/**
 * Classes Tailwind para cada tamanho de modal
 */
export const MODAL_SIZES: Record<ModalSize, string> = {
  confirmation: "sm:max-w-md",
  form_short: "sm:max-w-lg",
  form_medium: "sm:max-w-xl",
  form_long: "sm:max-w-2xl",
  wizard_preview: "sm:max-w-3xl",
  fullscreen: "sm:max-w-4xl",
};

/**
 * Larguras em pixels (aproximadas) para referência
 */
export const MODAL_WIDTHS_PX: Record<ModalSize, number> = {
  confirmation: 448,    // max-w-md = 28rem = 448px
  form_short: 512,      // max-w-lg = 32rem = 512px
  form_medium: 576,     // max-w-xl = 36rem = 576px
  form_long: 672,       // max-w-2xl = 42rem = 672px
  wizard_preview: 768,  // max-w-3xl = 48rem = 768px
  fullscreen: 896,      // max-w-4xl = 56rem = 896px
};

/**
 * Mapeamento de tamanho para FormDrawer width prop
 */
export const MODAL_TO_DRAWER_WIDTH: Record<ModalSize, "sm" | "md" | "lg" | "xl" | "2xl" | "full"> = {
  confirmation: "sm",
  form_short: "md",
  form_medium: "lg",
  form_long: "xl",
  wizard_preview: "2xl",
  fullscreen: "full",
};

/**
 * Determina o tamanho ideal baseado no número de campos
 */
export function getModalSizeByFieldCount(fieldCount: number): ModalSize {
  if (fieldCount === 0) return "confirmation";
  if (fieldCount <= 4) return "form_short";
  if (fieldCount <= 8) return "form_medium";
  if (fieldCount <= 12) return "form_long";
  return "wizard_preview";
}

/**
 * Determina o tamanho ideal baseado no tipo de conteúdo
 */
export function getModalSizeByContentType(
  contentType: "alert" | "confirm" | "delete" | "form" | "wizard" | "preview" | "table" | "dashboard",
  fieldCount?: number
): ModalSize {
  switch (contentType) {
    case "alert":
    case "confirm":
    case "delete":
      return "confirmation";
    case "form":
      return fieldCount !== undefined ? getModalSizeByFieldCount(fieldCount) : "form_medium";
    case "wizard":
    case "preview":
      return "wizard_preview";
    case "table":
    case "dashboard":
      return "fullscreen";
    default:
      return "form_medium";
  }
}

/**
 * Labels descritivos para cada tamanho
 */
export const MODAL_SIZE_LABELS: Record<ModalSize, string> = {
  confirmation: "Pequeno (confirmação)",
  form_short: "Curto (1-4 campos)",
  form_medium: "Médio (5-8 campos)",
  form_long: "Longo (9-12 campos)",
  wizard_preview: "Grande (wizard/preview)",
  fullscreen: "Extra grande (fullscreen)",
};

/**
 * Descrições de uso para documentação
 */
export const MODAL_SIZE_DESCRIPTIONS: Record<ModalSize, string> = {
  confirmation: "Confirmações simples, alertas, diálogos de exclusão, mensagens de sucesso/erro",
  form_short: "Formulários simples: nome + descrição, configurações básicas, filtros",
  form_medium: "Formulários médios: cadastro de procedimento, agendamento, dados pessoais",
  form_long: "Formulários longos: cadastro completo de paciente, prontuário, configurações avançadas",
  wizard_preview: "Wizards multi-step, previews de documento, comparação lado a lado",
  fullscreen: "Tabelas de dados, dashboards em modal, visualização de relatórios",
};
