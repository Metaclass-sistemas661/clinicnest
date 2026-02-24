import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface FormPageProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  backHref?: string;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showDefaultFooter?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit?: () => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  actions?: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

const MAX_WIDTH_CLASSES: Record<NonNullable<FormPageProps["maxWidth"]>, string> = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

/**
 * FormPage — Layout padrão para páginas de formulário com 10+ campos ou abas.
 * 
 * Características:
 * - Header com breadcrumb, título e botão voltar
 * - Body com scroll e largura máxima configurável
 * - Footer sticky com botões Salvar/Cancelar
 * - Suporte a abas via FormPageTabs
 * 
 * @example
 * ```tsx
 * <FormPage
 *   title="Editar Paciente"
 *   subtitle="João Silva"
 *   breadcrumbs={[
 *     { label: "Pacientes", href: "/clientes" },
 *     { label: "João Silva" },
 *   ]}
 *   backHref="/clientes"
 *   onSubmit={handleSubmit}
 *   isSubmitting={isSaving}
 * >
 *   <FormPageSection title="Dados Pessoais">
 *     <Input ... />
 *   </FormPageSection>
 * </FormPage>
 * ```
 */
export function FormPage({
  title,
  subtitle,
  breadcrumbs,
  backHref,
  onBack,
  children,
  footer,
  showDefaultFooter = true,
  submitLabel = "Salvar",
  cancelLabel = "Cancelar",
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitDisabled = false,
  actions,
  className,
  maxWidth = "xl",
}: FormPageProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      navigate(backHref);
    } else {
      navigate(-1);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      handleBack();
    }
  };

  const handleSubmit = async () => {
    if (onSubmit) {
      await onSubmit();
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header fixo */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className={cn("mx-auto px-4 py-4 sm:px-6", MAX_WIDTH_CLASSES[maxWidth])}>
          {/* Breadcrumb */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <ChevronRight className="h-4 w-4" />}
                  {item.href ? (
                    <Link
                      to={item.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium">{item.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          {/* Title row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Voltar</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </div>
      </header>

      {/* Body com scroll */}
      <main className={cn("flex-1 px-4 py-6 sm:px-6", MAX_WIDTH_CLASSES[maxWidth], "mx-auto w-full", className)}>
        {children}
      </main>

      {/* Footer sticky */}
      {(footer || showDefaultFooter) && (
        <footer className="sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className={cn("mx-auto px-4 py-4 sm:px-6", MAX_WIDTH_CLASSES[maxWidth])}>
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
                  className="gradient-primary text-primary-foreground"
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
        </footer>
      )}
    </div>
  );
}

/**
 * FormPageSection — Seção dentro da página com título e card opcional.
 */
export function FormPageSection({
  title,
  description,
  children,
  className,
  asCard = true,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  asCard?: boolean;
}) {
  const content = (
    <div className={cn("space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h2 className="text-lg font-semibold">{title}</h2>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );

  if (asCard) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-6">{content}</CardContent>
      </Card>
    );
  }

  return <div className="mb-6">{content}</div>;
}

/**
 * FormPageTabs — Wrapper para páginas com abas.
 */
export interface FormPageTab {
  value: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

export function FormPageTabs({
  tabs,
  defaultValue,
  value,
  onValueChange,
  className,
}: {
  tabs: FormPageTab[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}) {
  return (
    <Tabs
      defaultValue={defaultValue ?? tabs[0]?.value}
      value={value}
      onValueChange={onValueChange}
      className={className}
    >
      <TabsList className="mb-6 flex h-auto flex-wrap gap-1">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className="px-4 py-2"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * FormPageGrid — Grid responsivo para campos de formulário.
 */
export function FormPageGrid({
  children,
  cols = 2,
  className,
}: {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const colsClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", colsClass[cols], className)}>
      {children}
    </div>
  );
}
