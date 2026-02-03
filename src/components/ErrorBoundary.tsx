import { Component, ErrorInfo, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message?.includes("Failed to fetch dynamically imported module");
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-4">
          <div className="max-w-md text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Algo deu errado
              </h1>
              <p className="text-muted-foreground">
                {isChunkError
                  ? "O site foi atualizado. Pressione Ctrl+F5 (ou Cmd+Shift+R no Mac) para recarregar completamente."
                  : "Ocorreu um erro inesperado. Tente recarregar a página ou voltar ao início."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="default">
                <Link to="/">Voltar ao início</Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Recarregar página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
