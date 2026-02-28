import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getBirdIdOAuthCallbackHandler } from "@/lib/birdid-integration";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

type Status = "processing" | "success" | "error";

export default function BirdIdCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("processing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handle = async () => {
      try {
        const handler = getBirdIdOAuthCallbackHandler();
        const result = await handler(searchParams);

        if (result) {
          setStatus("success");
          toast.success("BirdID conectado com sucesso!");
          setTimeout(() => navigate("/configuracoes", { replace: true }), 1500);
        } else {
          setStatus("error");
          setErrorMsg("Nenhum código de autorização recebido.");
        }
      } catch (err) {
        logger.error("BirdID callback error:", err);
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Erro ao autenticar com BirdID");
      }
    };

    handle();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md px-4">
        {status === "processing" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h1 className="text-xl font-semibold">Conectando BirdID...</h1>
            <p className="text-muted-foreground text-sm">Aguarde enquanto processamos a autenticação.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-semibold text-green-700 dark:text-green-400">Conectado!</h1>
            <p className="text-muted-foreground text-sm">Redirecionando para configurações...</p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h1 className="text-xl font-semibold text-red-700 dark:text-red-400">Erro na autenticação</h1>
            <p className="text-muted-foreground text-sm">{errorMsg}</p>
            <button
              onClick={() => navigate("/configuracoes", { replace: true })}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
            >
              Voltar para Configurações
            </button>
          </>
        )}
      </div>
    </div>
  );
}
