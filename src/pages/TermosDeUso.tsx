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
                  Última atualização: 24 de fevereiro de 2026
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-3xl">
          <div className="max-w-none space-y-8 text-muted-foreground">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                1. Aceitação dos Termos
              </h2>
              <p className="text-base leading-relaxed mb-3">
                Ao acessar ou utilizar a plataforma ClinicNest ("Plataforma", "Serviço"), você ("Usuário", "Cliente") concorda em cumprir e estar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não poderá acessar ou utilizar o Serviço.
              </p>
              <p className="text-base leading-relaxed">
                Estes Termos constituem um contrato legal entre você e a Metaclass Tecnologia Ltda. ("ClinicNest", "Empresa", "nós").
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                2. Descrição do Serviço
              </h2>
              <p className="text-base leading-relaxed mb-3">
                O ClinicNest é uma plataforma de gestão para clínicas de saúde que oferece:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-base">
                <li>Gestão de agenda e agendamentos</li>
                <li>Prontuário eletrônico do paciente (SOAP)</li>
                <li>Módulo odontológico completo (odontograma, periograma, planos de tratamento)</li>
                <li>Faturamento TISS para convênios (médico e odontológico)</li>
                <li>Gestão financeira (contas a pagar/receber, comissões, repasses)</li>
                <li>Portal do paciente com agendamento online</li>
                <li>Teleconsulta integrada</li>
                <li>Integrações com sistemas externos (WhatsApp, gateways de pagamento, etc.)</li>
                <li>Relatórios e dashboards personalizados</li>
                <li>RBAC com 11 perfis profissionais</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                3. Elegibilidade
              </h2>
              <p className="text-base leading-relaxed mb-3">Para utilizar o ClinicNest, você deve:</p>
              <ul className="list-disc pl-6 space-y-1 text-base">
                <li>Ter pelo menos 18 anos de idade</li>
                <li>Ter capacidade legal para celebrar contratos</li>
                <li>Ser profissional de saúde devidamente registrado em seu conselho de classe (quando aplicável)</li>
                <li>Fornecer informações verdadeiras e completas no cadastro</li>
                <li>Manter suas informações de cadastro atualizadas</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                4. Cadastro e Conta
              </h2>
              
              <h3 className="font-semibold text-lg mb-2 text-foreground">4.1 Criação de Conta</h3>
              <p className="text-base leading-relaxed mb-4">
                Para acessar o Serviço, você deve criar uma conta fornecendo informações precisas e completas. Você é responsável por manter a confidencialidade de suas credenciais de acesso.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">4.2 Responsabilidade pela Conta</h3>
              <p className="text-base leading-relaxed mb-4">
                Você é responsável por todas as atividades realizadas em sua conta. Notifique-nos imediatamente sobre qualquer uso não autorizado ou violação de segurança.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">4.3 Contas de Equipe</h3>
              <p className="text-base leading-relaxed">
                O administrador da conta é responsável por gerenciar os acessos de sua equipe e garantir que todos os usuários cumpram estes Termos.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                5. Planos e Pagamento
              </h2>
              
              <h3 className="font-semibold text-lg mb-2 text-foreground">5.1 Planos Disponíveis</h3>
              <p className="text-base leading-relaxed mb-4">
                Oferecemos diferentes planos (Starter, Solo, Clínica, Premium) com funcionalidades e limites específicos. Os detalhes de cada plano estão disponíveis em nossa página de preços.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">5.2 Período de Teste</h3>
              <p className="text-base leading-relaxed mb-4">
                Novos usuários têm direito a 5 dias de teste gratuito com acesso completo às funcionalidades do plano escolhido. Não é necessário cartão de crédito para o período de teste.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">5.3 Cobrança</h3>
              <p className="text-base leading-relaxed mb-4">
                Após o período de teste, a cobrança será realizada conforme o plano e ciclo de faturamento escolhidos (mensal ou anual). Aceitamos cartão de crédito, boleto bancário e Pix.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">5.4 Renovação Automática</h3>
              <p className="text-base leading-relaxed mb-4">
                As assinaturas são renovadas automaticamente ao final de cada período, salvo cancelamento prévio pelo usuário.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">5.5 Alteração de Plano</h3>
              <p className="text-base leading-relaxed mb-4">
                Você pode fazer upgrade ou downgrade de plano a qualquer momento. No upgrade, a diferença será cobrada proporcionalmente. No downgrade, o crédito será aplicado nas próximas faturas.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">5.6 Reajuste de Preços</h3>
              <p className="text-base leading-relaxed">
                Os preços podem ser reajustados anualmente. Notificaremos com 30 dias de antecedência sobre qualquer alteração de preço.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                6. Uso Aceitável
              </h2>
              <p className="text-base leading-relaxed mb-3">Ao utilizar o ClinicNest, você concorda em:</p>
              <ul className="list-disc pl-6 space-y-1 text-base">
                <li>Utilizar o Serviço apenas para fins legais e de acordo com sua finalidade</li>
                <li>Não compartilhar suas credenciais de acesso com terceiros</li>
                <li>Não tentar acessar áreas restritas ou sistemas não autorizados</li>
                <li>Não realizar engenharia reversa, descompilar ou modificar o software</li>
                <li>Não utilizar o Serviço para armazenar ou transmitir conteúdo ilegal</li>
                <li>Não sobrecarregar intencionalmente os servidores ou infraestrutura</li>
                <li>Cumprir todas as leis e regulamentações aplicáveis à sua atividade profissional</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                7. Responsabilidades do Usuário
              </h2>
              
              <h3 className="font-semibold text-lg mb-2 text-foreground">7.1 Dados de Pacientes</h3>
              <p className="text-base leading-relaxed mb-3">
                Você é o controlador dos dados de pacientes inseridos na plataforma e é responsável por:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-base mb-4">
                <li>Obter consentimento adequado dos pacientes para tratamento de dados</li>
                <li>Garantir a precisão e atualização dos dados</li>
                <li>Cumprir as obrigações da LGPD como controlador</li>
                <li>Manter sigilo profissional conforme seu código de ética</li>
              </ul>

              <h3 className="font-semibold text-lg mb-2 text-foreground">7.2 Backup de Dados</h3>
              <p className="text-base leading-relaxed mb-4">
                Embora realizemos backups automáticos, recomendamos que você mantenha cópias de segurança de dados críticos através das funcionalidades de exportação disponíveis.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">7.3 Conformidade Regulatória</h3>
              <p className="text-base leading-relaxed">
                Você é responsável por garantir que o uso da plataforma esteja em conformidade com as regulamentações de seu conselho profissional (CFM, CFO, CREFITO, etc.) e demais órgãos reguladores.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                8. Propriedade Intelectual
              </h2>
              
              <h3 className="font-semibold text-lg mb-2 text-foreground">8.1 Direitos do ClinicNest</h3>
              <p className="text-base leading-relaxed mb-4">
                A plataforma, incluindo software, design, marca, logotipos e conteúdo, são propriedade exclusiva da Metaclass Tecnologia Ltda. ou de seus licenciadores. Nenhum direito de propriedade intelectual é transferido ao usuário.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">8.2 Seus Dados</h3>
              <p className="text-base leading-relaxed">
                Você mantém todos os direitos sobre os dados que insere na plataforma. Concede-nos licença limitada para processar esses dados exclusivamente para prestação do Serviço.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                9. Disponibilidade e Suporte
              </h2>
              
              <h3 className="font-semibold text-lg mb-2 text-foreground">9.1 Disponibilidade</h3>
              <p className="text-base leading-relaxed mb-4">
                Nos esforçamos para manter o Serviço disponível 24/7, mas não garantimos disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">9.2 Suporte Técnico</h3>
              <p className="text-base leading-relaxed">
                O nível de suporte varia conforme o plano contratado. Detalhes sobre canais e horários de atendimento estão disponíveis em nossa central de ajuda.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                10. Limitação de Responsabilidade
              </h2>
              <p className="text-base leading-relaxed mb-3">Na máxima extensão permitida por lei:</p>
              <ul className="list-disc pl-6 space-y-1 text-base">
                <li>O Serviço é fornecido "como está", sem garantias de qualquer tipo</li>
                <li>Não nos responsabilizamos por decisões clínicas tomadas com base em informações do sistema</li>
                <li>Não nos responsabilizamos por perdas indiretas, incidentais ou consequenciais</li>
                <li>Nossa responsabilidade total está limitada ao valor pago pelo Serviço nos últimos 12 meses</li>
                <li>Não nos responsabilizamos por falhas causadas por terceiros, força maior ou caso fortuito</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                11. Indenização
              </h2>
              <p className="text-base leading-relaxed">
                Você concorda em indenizar e isentar o ClinicNest de quaisquer reclamações, danos, perdas ou despesas decorrentes de: (a) seu uso do Serviço; (b) violação destes Termos; (c) violação de direitos de terceiros; (d) dados inseridos por você na plataforma.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                12. Cancelamento e Rescisão
              </h2>
              
              <h3 className="font-semibold text-lg mb-2 text-foreground">12.1 Cancelamento pelo Usuário</h3>
              <p className="text-base leading-relaxed mb-4">
                Você pode cancelar sua assinatura a qualquer momento através das configurações da conta. O acesso permanece ativo até o final do período já pago. Não há reembolso proporcional para cancelamentos.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">12.2 Rescisão pelo ClinicNest</h3>
              <p className="text-base leading-relaxed mb-3">Podemos suspender ou encerrar sua conta em caso de:</p>
              <ul className="list-disc pl-6 space-y-1 text-base mb-4">
                <li>Violação destes Termos</li>
                <li>Inadimplência por mais de 30 dias</li>
                <li>Uso fraudulento ou abusivo</li>
                <li>Determinação legal ou judicial</li>
              </ul>

              <h3 className="font-semibold text-lg mb-2 text-foreground">12.3 Efeitos do Cancelamento</h3>
              <p className="text-base leading-relaxed">
                Após o cancelamento, você terá 30 dias para exportar seus dados. Após esse período, os dados serão excluídos, exceto quando a retenção for exigida por lei.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                13. Alterações nos Termos
              </h2>
              <p className="text-base leading-relaxed">
                Podemos modificar estes Termos a qualquer momento. Alterações significativas serão comunicadas por e-mail ou através da plataforma com 30 dias de antecedência. O uso continuado do Serviço após as alterações constitui aceitação dos novos Termos.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                14. Disposições Gerais
              </h2>
              
              <h3 className="font-semibold text-lg mb-2 text-foreground">14.1 Lei Aplicável</h3>
              <p className="text-base leading-relaxed mb-4">
                Estes Termos são regidos pelas leis da República Federativa do Brasil.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">14.2 Foro</h3>
              <p className="text-base leading-relaxed mb-4">
                Fica eleito o foro da Comarca de São Paulo, SP, para dirimir quaisquer controvérsias decorrentes destes Termos.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">14.3 Integralidade</h3>
              <p className="text-base leading-relaxed mb-4">
                Estes Termos, juntamente com a <Link to="/politica-de-privacidade" className="text-teal-600 hover:text-teal-700 font-medium underline underline-offset-2">Política de Privacidade</Link>, constituem o acordo integral entre as partes.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">14.4 Cessão</h3>
              <p className="text-base leading-relaxed mb-4">
                Você não pode ceder ou transferir seus direitos sob estes Termos sem nosso consentimento prévio por escrito.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">14.5 Renúncia</h3>
              <p className="text-base leading-relaxed">
                A falha em exercer qualquer direito previsto nestes Termos não constitui renúncia a esse direito.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                15. Contato
              </h2>
              <p className="text-base leading-relaxed mb-3">Para questões sobre estes Termos:</p>
              <div className="bg-muted/50 rounded-xl p-6">
                <p className="font-semibold mb-2 text-foreground">Metaclass Tecnologia Ltda.</p>
                <p className="text-sm">CNPJ: 00.000.000/0001-00</p>
                <p className="text-sm">Endereço: Av. Paulista, 1000 - São Paulo, SP</p>
                <p className="text-sm">E-mail: <a href="mailto:juridico@clinicnest.com.br" className="text-teal-600 hover:underline">juridico@clinicnest.com.br</a></p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <p className="text-amber-800 font-medium">
                Ao clicar em "Criar conta" ou utilizar o Serviço, você declara ter lido, compreendido e concordado com estes Termos de Uso e com nossa <Link to="/politica-de-privacidade" className="text-teal-600 hover:text-teal-700 font-medium underline underline-offset-2">Política de Privacidade</Link>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </LandingLayout>
  );
}
