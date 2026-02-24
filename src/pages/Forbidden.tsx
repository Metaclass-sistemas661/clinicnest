import { ShieldOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/MainLayout";

export default function Forbidden() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-24">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10">
          <ShieldOff className="h-12 w-12 text-destructive" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Acesso Negado</h1>
          <p className="text-muted-foreground max-w-md">
            Você não tem permissão para acessar esta página. Caso acredite que isso
            seja um erro, entre em contato com o administrador da clínica.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => navigate("/dashboard", { replace: true })}
          className="gap-2"
        >
          Voltar ao Dashboard
        </Button>
      </div>
    </MainLayout>
  );
}
