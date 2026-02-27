import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
  /** Nome do módulo para log (ex: "Dashboard", "Agenda") */
  moduleName?: string;
  /** Renderiza fallback customizado em vez do padrão */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary por módulo/feature.
 * Isola falhas para que um crash em um módulo não derrube a página inteira.
 * Mostra UI de fallback local com opção de retry.
 */
export class ModuleErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { moduleName = "Module" } = this.props;
    logger.error(`[${moduleName}] ErrorBoundary caught:`, error, errorInfo);
    Sentry.captureException(error, {
      tags: { module: moduleName },
      extra: { componentStack: errorInfo.componentStack },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 gap-4 rounded-lg border border-dashed border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-destructive">
              Erro ao carregar {this.props.moduleName || "este módulo"}
            </p>
            <p className="text-xs text-muted-foreground max-w-md">
              Ocorreu um erro inesperado. Tente novamente ou recarregue a página.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Tentar novamente
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Recarregar página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
