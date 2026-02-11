import { Link } from "react-router-dom";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Shield } from "lucide-react";
import { openCookieConsentPreferences } from "@/lib/cookieConsent";

export default function PoliticaPrivacidade() {
  return (
    <LandingLayout>
      <div className="pt-24 pb-16">
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
                <Shield className="h-7 w-7" />
              </div>
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold">Política de Privacidade</h1>
                <p className="mt-1 text-white/90 text-sm sm:text-base">
                  Última atualização: fevereiro de 2025
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-3xl">
          <div className="max-w-none space-y-8 text-muted-foreground">
            <p className="text-base leading-relaxed">
              O VynloBella está comprometido com a proteção da sua privacidade. Esta Política
              descreve como coletamos, usamos, armazenamos e protegemos suas informações quando
              você utiliza nossa plataforma.
            </p>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-violet-200 pb-2">
                1. Dados que coletamos
              </h2>
              <p className="text-base leading-relaxed mb-3">Podemos coletar:</p>
              <ul className="list-disc pl-6 space-y-1 text-base">
                <li>Dados de cadastro (nome, e-mail, telefone, endereço quando aplicável)</li>
                <li>Dados de uso da plataforma (acessos, funcionalidades utilizadas)</li>
                <li>Dados de clientes e agendamentos inseridos por você no sistema</li>
                <li>Informações técnicas (IP, tipo de navegador, dispositivo) para segurança e melhoria do serviço</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-violet-200 pb-2">
                2. Finalidade do tratamento
              </h2>
              <p className="text-base leading-relaxed">
                Utilizamos os dados para: prestar e melhorar o serviço VynloBella, processar
                pagamentos, enviar comunicações relevantes (incluindo suporte), garantir
                segurança e cumprimento de obrigações legais, e realizar análises agregadas e
                anônimas para melhorar nossa oferta.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-violet-200 pb-2">
                3. Base legal
              </h2>
              <p className="text-base leading-relaxed">
                O tratamento é realizado com base na execução do contrato, no seu consentimento
                quando aplicável, no legítimo interesse do VynloBella e no cumprimento de
                obrigações legais, em conformidade com a Lei Geral de Proteção de Dados (LGPD).
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-violet-200 pb-2">
                4. Compartilhamento de dados
              </h2>
              <p className="text-base leading-relaxed">
                Seus dados podem ser compartilhados com prestadores de serviços essenciais
                (hospedagem, pagamento, e-mail, suporte), sempre com obrigação de confidencialidade
                e em conformidade com a lei. Não vendemos seus dados pessoais. Podemos divulgar
                dados quando exigido por lei ou autoridade competente.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-violet-200 pb-2">
                5. Retenção e segurança
              </h2>
              <p className="text-base leading-relaxed">
                Mantemos os dados pelo tempo necessário para as finalidades descritas e para
                cumprimento de obrigações legais. Aplicamos medidas técnicas e organizacionais
                para proteger seus dados contra acesso não autorizado, perda ou alteração
                indevida.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-violet-200 pb-2">
                6. Seus direitos (LGPD)
              </h2>
              <p className="text-base leading-relaxed mb-3">
                Você tem direito a: confirmação da existência de tratamento, acesso aos dados,
                correção de dados incompletos ou desatualizados, anonimização, bloqueio ou
                eliminação de dados desnecessários, portabilidade, revogação do consentimento e
                informação sobre compartilhamento. Para exercer esses direitos, entre em contato
                conosco pela página de <Link to="/contato" className="text-violet-600 hover:text-fuchsia-600 font-medium underline underline-offset-2">Contato</Link>.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-violet-200 pb-2">
                7. Cookies e tecnologias similares
              </h2>
              <p className="text-base leading-relaxed">
                Utilizamos cookies e tecnologias similares para: (i) viabilizar o funcionamento
                essencial da plataforma; (ii) registrar preferências; e, mediante consentimento
                quando aplicável, (iii) realizar análises estatísticas de uso para melhoria
                contínua dos serviços. Você pode limitar ou recusar cookies analíticos, ciente de
                que determinadas experiências podem ser impactadas.
              </p>
              <p className="mt-3 text-sm">
                Você também pode revisar sua escolha de cookies a qualquer momento usando{" "}
                <button
                  type="button"
                  onClick={openCookieConsentPreferences}
                  className="font-medium text-violet-600 hover:text-fuchsia-600 underline underline-offset-2"
                >
                  Preferências de Cookies
                </button>
                {" "}no rodapé do site.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-violet-200 pb-2">
                8. Alterações
              </h2>
              <p className="text-base leading-relaxed">
                Esta Política pode ser atualizada. Alterações relevantes serão comunicadas por
                e-mail ou aviso na plataforma. A continuação do uso após a divulgação constitui
                aceitação da nova versão.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-violet-200 pb-2">
                9. Contato
              </h2>
              <p className="text-base leading-relaxed">
                Para questões sobre privacidade ou para exercer seus direitos, utilize nossa
                página de <Link to="/contato" className="text-violet-600 hover:text-fuchsia-600 font-medium underline underline-offset-2">Contato</Link>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </LandingLayout>
  );
}
