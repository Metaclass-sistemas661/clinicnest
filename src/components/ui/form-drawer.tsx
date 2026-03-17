import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FormDrawerWidth = "sm" | "md" | "lg" | "xl" | "full";

const WIDTH_CLASSES: Record<FormDrawerWidth, string> = {
  sm: "sm:max-w-[420px]",
  md: "sm:max-w-[540px]",
  lg: "sm:max-w-[640px]",
  xl: "sm:max-w-[720px]",
  full: "sm:max-w-[90vw]",
};

export interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  width?: FormDrawerWidth;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showDefaultFooter?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit?: () => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  className?: string;
}

/**
 * FormDrawer — Drawer lateral para formulários de 5-10 campos.
 * 
 * Características:
 * - Abre da direita com overlay leve (bg-black/20)
 * - Full-width no mobile, largura configurável no desktop
 * - Header fixo com título e descrição
 * - Body com scroll
 * - Footer sticky com botões Salvar/Cancelar
 * 
 * @example
 * ```tsx
 * <FormDrawer
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Nova Receita"
 *   description="Preencha os dados da receita"
 *   width="md"
 *   onSubmit={handleSubmit}
 *   isSubmitting={isSaving}
 * >
 *   <form className="space-y-4">
 *     <Input ... />
 *   </form>
 * </FormDrawer>
 * ```
 */
export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  width = "md",
  children,
  footer,
  showDefaultFooter = true,
  submitLabel = "Salvar",
  cancelLabel = "Cancelar",
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitDisabled = false,
  className,
}: FormDrawerProps) {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (onSubmit) {
      await onSubmit();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex h-full w-full flex-col p-0",
          WIDTH_CLASSES[width],
          className
        )}
        onInteractOutside={(e) => {
          if (isSubmitting) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) {
            e.preventDefault();
          }
        }}
      >
        {/* Header fixo */}
        <div className="flex-shrink-0 border-b px-6 py-4">
          <SheetHeader className="space-y-1">
            <SheetTitle>{title}</SheetTitle>
            {description && (
              <SheetDescription>{description}</SheetDescription>
            )}
          </SheetHeader>
        </div>

        {/* Body com scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* Footer sticky */}
        {(footer || showDefaultFooter) && (
          <div className="flex-shrink-0 border-t bg-background px-6 py-4">
            {footer ?? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  {cancelLabel}
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || submitDisabled}
                  variant="gradient"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    submitLabel
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * FormDrawerSection — Seção dentro do drawer com título opcional.
 */
export function FormDrawerSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

/**
 * FormDrawerDivider — Divisor visual entre seções.
 */
export function FormDrawerDivider() {
  return <hr className="my-6 border-border" />;
}
