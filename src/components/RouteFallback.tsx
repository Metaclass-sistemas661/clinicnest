import { Loader2 } from "lucide-react";

/**
 * Fallback exibido enquanto um chunk de rota lazy está carregando.
 * Mantém consistência visual com o loader do ProtectedRoute.
 */
export function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
