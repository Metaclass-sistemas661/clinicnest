import { useState } from "react";
import { Link } from "react-router-dom";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, FileText, Clock3, Send, CheckCircle } from "lucide-react";

type LgpdRequestType =
  | "access"
  | "correction"
  | "deletion"
  | "portability"
  | "consent_revocation"
  | "opposition";

const lgpdTypeLabel: Record<LgpdRequestType, string> = {
  access: "Acesso aos dados",
  correction: "Correção de dados",
  deletion: "Eliminação de dados",
  portability: "Portabilidade",
  consent_revocation: "Revogação de consentimento",
  opposition: "Oposição ao tratamento",
};

export default function CanalLgpd() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestType, setRequestType] = useState<LgpdRequestType>("access");
  const [consentAccepted, setConsentAccepted] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const details = String(formData.get("details") || "").trim();

    if (!name || !email || !details) {
      toast.error("Preencha nome, e-mail e detalhes da solicitação.");
      return;
    }

    if (!consentAccepted) {
      toast.error("Você precisa aceitar os Termos de Uso e a Política de Privacidade.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-contact-message", {
        body: {
          name,
          email,
          message: details,
          channel: "lgpd",
          requestType,
          termsAccepted: consentAccepted,
          privacyAccepted: consentAccepted,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || data?.message || "Erro ao enviar solicitação LGPD.");
      }

      setSubmitted(true);
      setConsentAccepted(false);
      form.reset();
      setRequestType("access");
      if (data?.notificationSent === false) {
        toast.success("Solicitação LGPD registrada com sucesso!", {
          description: "A notificação por e-mail está temporariamente indisponível.",
        });
      } else {
        toast.success("Solicitação LGPD enviada com sucesso.");
      }
    } catch (err) {
      logger.error("Erro ao enviar solicitação do Canal LGPD:", err);
      toast.error("Erro ao enviar solicitação. Tente novamente em alguns instantes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LandingLayout>
      <div className="pb-16">
        <section className="relative overflow-hidden py-16">
          <div
            className="absolute inset-0 opacity-90"
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 40%, #f093fb 100%)",
            }}
          />
          <div className="absolute inset-0 bg-black/10" />
          <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 text-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <h1 className="font-display text-3xl font-bold sm:text-4xl">Canal LGPD</h1>
                <p className="mt-1 text-sm text-white/90 sm:text-base">
                  Solicite seus direitos de privacidade de forma dedicada e segura.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                  <FileText className="h-6 w-6" />
                </div>
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Quando usar este canal
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>• Confirmar se tratamos seus dados pessoais</li>
                  <li>• Solicitar acesso, correção, portabilidade ou eliminação</li>
                  <li>• Revogar consentimento ou se opor ao tratamento</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                  <Clock3 className="h-6 w-6" />
                </div>
                <h2 className="font-display text-lg font-semibold text-foreground">Como respondemos</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Nosso time analisa cada solicitação e responde pelos canais oficiais cadastrados,
                  observando os prazos legais aplicáveis.
                </p>
              </div>

              <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
                <p className="text-sm text-muted-foreground">
                  Se você já é cliente e está logado, também pode registrar e acompanhar suas
                  solicitações na área{" "}
                  <Link
                    to="/minhas-configuracoes"
                    className="font-medium text-violet-700 underline underline-offset-2 hover:text-fuchsia-600"
                  >
                    Minhas Configurações
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm sm:p-8">
                {submitted ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                      <CheckCircle className="h-8 w-8" />
                    </div>
                    <h3 className="font-display text-xl font-semibold text-foreground">
                      Solicitação enviada
                    </h3>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Recebemos sua solicitação LGPD. Retornaremos pelos dados de contato informados.
                    </p>
                    <Button
                      className="mt-6"
                      variant="outline"
                      onClick={() => setSubmitted(false)}
                    >
                      Nova solicitação
                    </Button>
                  </div>
                ) : (
                  <>
                    <h2 className="font-display text-xl font-semibold text-foreground">
                      Enviar solicitação LGPD
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Preencha os dados abaixo para registrarmos seu pedido com rastreabilidade.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="lgpd-name">Nome</Label>
                          <Input
                            id="lgpd-name"
                            name="name"
                            placeholder="Seu nome"
                            required
                            className="border-violet-100 focus:ring-violet-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lgpd-email">E-mail</Label>
                          <Input
                            id="lgpd-email"
                            name="email"
                            type="email"
                            placeholder="seu@email.com"
                            required
                            className="border-violet-100 focus:ring-violet-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lgpd-type">Tipo de solicitação</Label>
                        <select
                          id="lgpd-type"
                          value={requestType}
                          onChange={(e) => setRequestType(e.target.value as LgpdRequestType)}
                          className="flex h-10 w-full rounded-md border border-violet-100 bg-background px-3 py-2 text-sm"
                          required
                        >
                          {Object.entries(lgpdTypeLabel).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lgpd-details">Detalhes da solicitação</Label>
                        <Textarea
                          id="lgpd-details"
                          name="details"
                          placeholder="Descreva claramente o que você deseja solicitar."
                          required
                          rows={6}
                          className="resize-none border-violet-100 focus:ring-violet-500"
                        />
                      </div>

                      <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-3">
                        <label
                          htmlFor="lgpd-consent"
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <input
                            id="lgpd-consent"
                            type="checkbox"
                            checked={consentAccepted}
                            onChange={(e) => setConsentAccepted(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-violet-200"
                            required
                          />
                          <span>
                            Concordo com os{" "}
                            <Link
                              to="/termos-de-uso"
                              className="font-medium text-violet-700 underline underline-offset-2 hover:text-fuchsia-600"
                            >
                              Termos de Uso
                            </Link>
                            {" "}e a{" "}
                            <Link
                              to="/politica-de-privacidade"
                              className="font-medium text-violet-700 underline underline-offset-2 hover:text-fuchsia-600"
                            >
                              Política de Privacidade
                            </Link>
                            .
                          </span>
                        </label>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 shadow-lg shadow-violet-500/30"
                      >
                        {loading ? (
                          "Enviando..."
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Enviar solicitação
                          </>
                        )}
                      </Button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </LandingLayout>
  );
}
