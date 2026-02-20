import { Link } from "react-router-dom";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { FileText } from "lucide-react";

export default function TermosDeUso() {
  return (
    <LandingLayout>
      <div className="pb-16">
        <section className="relative py-16 overflow-hidden">
          <div
            className="absolute inset-0 opacity-90"
            style={{
              background: "linear-gradient(135deg, #0f766e 0%, #0d9488 40%, #0891b2 100%)",
            }}
          />
          <div className="absolute inset-0 bg-black/10" />
          <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 text-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <FileText className="h-7 w-7" />
              </div>
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold">Termos de Uso</h1>
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
              Bem-vindo ao ClinicNest. Ao acessar ou utilizar nossa plataforma, você concorda com os
              presentes Termos de Uso. Recomendamos a leitura atenta antes de utilizar nossos
              serviços.
            </p>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                1. Aceitação dos termos
              </h2>
              <p className="text-base leading-relaxed">
                O uso do sistema ClinicNest (“Plataforma”) implica a aceitação integral destes
                Termos. Caso não concorde com qualquer disposição, solicitamos que não utilize a
                Plataforma. A continuação do uso após alterações constitui aceitação das novas
                condições.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                2. Descrição do serviço
              </h2>
              <p className="text-base leading-relaxed">
                O ClinicNest é uma solução de gestão para clínicas e consultórios médicos,
                oferecendo recursos como agenda, prontuário eletrônico, controle financeiro,
                serviços, convênios e relatórios. O escopo exato do serviço depende do plano
                contratado.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                3. Cadastro e responsabilidade
              </h2>
              <p className="text-base leading-relaxed">
                O usuário é responsável pela veracidade dos dados informados no cadastro e por
                manter a confidencialidade de sua senha. O uso da conta é de sua exclusiva
                responsabilidade. O ClinicNest não se responsabiliza por uso indevido em caso de
                negligência do usuário.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                4. Uso aceitável
              </h2>
              <p className="text-base leading-relaxed">
                É vedado utilizar a Plataforma para fins ilícitos, ofensivos ou que prejudiquem
                terceiros. O usuário compromete-se a não violar leis aplicáveis, não difundir
                malware, não tentar acessar áreas restritas do sistema sem autorização e a respeitar
                a propriedade intelectual do ClinicNest e de terceiros.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                5. Propriedade intelectual
              </h2>
              <p className="text-base leading-relaxed">
                Todo o conteúdo da Plataforma (interface, textos, marcas, lógica de negócio e
                demais elementos) é de propriedade do ClinicNest ou de seus licenciadores. Nenhuma
                licença ou direito de uso é concedido além do acesso à Plataforma nos termos
                contratados.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                6. Pagamento e cancelamento
              </h2>
              <p className="text-base leading-relaxed">
                Os valores e condições de pagamento constam no plano escolhido e em materiais
                promocionais aplicáveis. O cancelamento pode ser realizado conforme as condições
                do plano. Reembolsos estão sujeitos à política de reembolso vigente no momento da
                contratação.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                7. Limitação de responsabilidade
              </h2>
              <p className="text-base leading-relaxed">
                O ClinicNest se empenha em manter a Plataforma estável e segura, porém não se
                responsabiliza por danos indiretos, lucros cessantes ou perda de dados decorrentes
                do uso ou da impossibilidade de uso do serviço, dentro dos limites permitidos pela
                lei.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                8. Alterações
              </h2>
              <p className="text-base leading-relaxed">
                Podemos alterar estes Termos de Uso a qualquer momento. Alterações relevantes
                serão comunicadas por e-mail ou por aviso na Plataforma. O uso continuado após
                a divulgação constitui aceitação das alterações.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                9. Lei aplicável e foro
              </h2>
              <p className="text-base leading-relaxed">
                Estes Termos são regidos pelas leis da República Federativa do Brasil. Eventuais
                disputas serão submetidas ao foro da comarca do domicílio do usuário, com
                renúncia a qualquer outro, por mais privilegiado que seja.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                10. Contato
              </h2>
              <p className="text-base leading-relaxed">
                Para dúvidas sobre estes Termos de Uso, entre em contato através da nossa página
                de <Link to="/contato" className="text-teal-600 hover:text-teal-700 font-medium underline underline-offset-2">Contato</Link>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </LandingLayout>
  );
}
