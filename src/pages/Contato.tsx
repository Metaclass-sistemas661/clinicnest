import { useState } from "react";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MessageSquare, MapPin, Send, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export default function Contato() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [subject, setSubject] = useState<string>("support");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const phoneDigits = phone.replace(/\D/g, "");

    if (!name || !phone || !email || !message) {
      toast.error("Preencha nome, telefone, e-mail e mensagem.");
      return;
    }

    if (!subject) {
      toast.error("Selecione um assunto.");
      return;
    }

    if (phoneDigits.length < 10) {
      toast.error("Informe um telefone válido.");
      return;
    }

    if (!consentAccepted) {
      toast.error("Você precisa aceitar os Termos de Uso e a Política de Privacidade.");
      return;
    }

    setLoading(true);
    try {
      let notificationSent = true;
      try {
        const { data, error } = await supabase.functions.invoke("submit-contact-message", {
          body: {
            name,
            phone,
            email,
            subject,
            message,
            channel: "contact",
            termsAccepted: consentAccepted,
            privacyAccepted: consentAccepted,
          },
        });

        if (error) throw error;
        if (!data?.success) {
          throw new Error(data?.error || data?.message || "Erro ao enviar mensagem.");
        }

        notificationSent = data?.notificationSent !== false;
      } catch (invokeError) {
        logger.warn("Falha no envio por Edge Function. Aplicando fallback para gravação direta.", invokeError);
        const { error: fallbackError } = await supabase.from("contact_messages").insert({
          name,
          email,
          subject,
          message: `Telefone: ${phone}\n\n${message}`,
          terms_accepted: true,
          privacy_accepted: true,
          consented_at: new Date().toISOString(),
        });
        if (fallbackError) throw fallbackError;
        notificationSent = false;
      }

      setSubmitted(true);
      setConsentAccepted(false);
      form.reset();
      if (!notificationSent) {
        toast.success("Mensagem registrada com sucesso!", {
          description: "A notificação por e-mail está temporariamente indisponível.",
        });
      } else {
        toast.success("Mensagem enviada com sucesso!");
      }
    } catch (err) {
      logger.error("Erro ao enviar contato:", err);
      toast.error("Erro ao enviar mensagem. Tente novamente ou envie para contato@vynlobella.com");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LandingLayout>
      <div className="pb-16">
        {/* Hero */}
        <section className="relative py-16 overflow-hidden">
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
                <MessageSquare className="h-7 w-7" />
              </div>
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold">Contato</h1>
                <p className="mt-1 text-white/90 text-sm sm:text-base">
                  Estamos prontos para ajudar você
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mx-auto max-w-4xl">
            <div className="grid gap-10 lg:grid-cols-5">
              {/* Info cards */}
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white mb-4">
                    <Mail className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-semibold text-foreground mb-1">E-mail</h3>
                  <a
                    href="mailto:contato@vynlobella.com"
                    className="text-violet-600 hover:text-fuchsia-600 font-medium"
                  >
                    contato@vynlobella.com
                  </a>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white mb-4">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-semibold text-foreground mb-1">Suporte</h3>
                  <p className="text-sm text-muted-foreground">
                    Resposta em até 24 horas úteis.
                  </p>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white mb-4">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-semibold text-foreground mb-1">Atendimento</h3>
                  <p className="text-sm text-muted-foreground">
                    Atendimento 100% online. Brasil.
                  </p>
                </div>
              </div>

              {/* Form */}
              <div className="lg:col-span-3">
                <div className="rounded-2xl border border-violet-100 bg-white p-6 sm:p-8 shadow-sm">
                  {submitted ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mb-4">
                        <CheckCircle className="h-8 w-8" />
                      </div>
                      <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                        Mensagem enviada!
                      </h3>
                      <p className="text-muted-foreground max-w-sm">
                        Obrigado pelo contato. Retornaremos em até 24 horas úteis.
                      </p>
                    </div>
                  ) : (
                    <>
                      <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                        Envie sua mensagem
                      </h2>
                      <p className="text-sm text-muted-foreground mb-6">
                        Dúvidas, sugestões ou parcerias? Preencha o formulário abaixo.
                      </p>
                      <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid gap-5 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="name">Nome</Label>
                            <Input
                              id="name"
                              name="name"
                              placeholder="Seu nome"
                              required
                              className="border-violet-100 focus:ring-violet-500"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">E-mail</Label>
                            <Input
                              id="email"
                              name="email"
                              type="email"
                              placeholder="seu@email.com"
                              required
                              className="border-violet-100 focus:ring-violet-500"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Telefone / Celular</Label>
                          <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            inputMode="tel"
                            placeholder="(11) 99999-9999"
                            required
                            onInput={(e) => {
                              const input = e.currentTarget;
                              input.value = input.value.replace(/[^0-9()\-\s+]/g, "");
                            }}
                            className="border-violet-100 focus:ring-violet-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subject">Assunto</Label>
                          <input type="hidden" name="subject" value={subject} />
                          <Select value={subject} onValueChange={setSubject}>
                            <SelectTrigger
                              id="subject"
                              className="border-violet-100 focus:ring-violet-500"
                            >
                              <SelectValue placeholder="Selecione um assunto" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="support">Suporte técnico</SelectItem>
                              <SelectItem value="commercial">Dúvidas comerciais / Planos</SelectItem>
                              <SelectItem value="billing">Cobrança / Pagamentos</SelectItem>
                              <SelectItem value="partnership">Parcerias</SelectItem>
                              <SelectItem value="feedback">Sugestões / Feedback</SelectItem>
                              <SelectItem value="bug">Reportar um problema</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="message">Mensagem</Label>
                          <Textarea
                            id="message"
                            name="message"
                            placeholder="Como podemos ajudar?"
                            required
                            rows={5}
                            className="resize-none border-violet-100 focus:ring-violet-500"
                          />
                        </div>
                        <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-3">
                          <label htmlFor="contact-consent" className="flex items-start gap-2 text-sm text-muted-foreground">
                            <input
                              id="contact-consent"
                              type="checkbox"
                              checked={consentAccepted}
                              onChange={(e) => setConsentAccepted(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-violet-200"
                              required
                            />
                            <span>
                              Concordo com os{" "}
                              <Link to="/termos-de-uso" className="font-medium text-violet-700 underline underline-offset-2 hover:text-fuchsia-600">
                                Termos de Uso
                              </Link>
                              {" "}e a{" "}
                              <Link to="/politica-de-privacidade" className="font-medium text-violet-700 underline underline-offset-2 hover:text-fuchsia-600">
                                Política de Privacidade
                              </Link>
                              .
                            </span>
                          </label>
                        </div>
                        <Button
                          type="submit"
                          disabled={loading || !consentAccepted}
                          className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 shadow-lg shadow-violet-500/30"
                        >
                          {loading ? (
                            "Enviando..."
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Enviar mensagem
                            </>
                          )}
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </LandingLayout>
  );
}
