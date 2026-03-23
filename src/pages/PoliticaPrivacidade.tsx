import { Link } from "react-router-dom";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Shield } from "lucide-react";
import { openCookieConsentPreferences } from "@/lib/cookieConsent";

export default function PoliticaPrivacidade() {
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
                <Shield className="h-7 w-7" />
              </div>
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold">Política de Privacidade</h1>
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
                1. Introdução
              </h2>
              <p className="text-base leading-relaxed mb-3">
                A Metaclass Tecnologia Ltda. ("ClinicNest", "nós", "nosso") está comprometida em proteger a privacidade e os dados pessoais de nossos usuários. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações quando você utiliza nossa plataforma de gestão de clínicas de saúde.
              </p>
              <p className="text-base leading-relaxed">
                Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018), o Marco Civil da Internet (Lei nº 12.965/2014) e demais legislações aplicáveis.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                2. Dados que Coletamos
              </h2>
              
              <h3 className="font-semibold text-lg mb-2 text-foreground">2.1 Dados de Cadastro</h3>
              <ul className="list-disc pl-6 space-y-1 text-base mb-4">
                <li>Nome completo e dados de identificação</li>
                <li>E-mail e telefone de contato</li>
                <li>CPF/CNPJ para fins fiscais</li>
                <li>Endereço da clínica</li>
                <li>Dados profissionais (CRM, CRO, CREFITO, etc.)</li>
              </ul>

              <h3 className="font-semibold text-lg mb-2 text-foreground">2.2 Dados de Pacientes</h3>
              <p className="text-base leading-relaxed mb-3">
                Os dados de pacientes são inseridos e gerenciados exclusivamente pelos profissionais de saúde usuários da plataforma. O ClinicNest atua como operador desses dados, sendo a clínica o controlador. Esses dados podem incluir:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-base mb-4">
                <li>Dados de identificação do paciente</li>
                <li>Histórico médico e prontuários</li>
                <li>Dados de saúde sensíveis (conforme Art. 5º, II da LGPD)</li>
                <li>Imagens clínicas e exames</li>
                <li>Informações financeiras relacionadas a tratamentos</li>
              </ul>

              <h3 className="font-semibold text-lg mb-2 text-foreground">2.3 Dados de Uso</h3>
              <ul className="list-disc pl-6 space-y-1 text-base">
                <li>Logs de acesso e navegação</li>
                <li>Endereço IP e informações do dispositivo</li>
                <li>Dados de geolocalização (quando autorizado)</li>
                <li>Métricas de uso da plataforma</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                3. Finalidades do Tratamento
              </h2>
              <p className="text-base leading-relaxed mb-3">Utilizamos seus dados para:</p>
              <ul className="list-disc pl-6 space-y-1 text-base">
                <li>Fornecer e manter os serviços da plataforma</li>
                <li>Processar pagamentos e emitir notas fiscais</li>
                <li>Enviar comunicações sobre o serviço</li>
                <li>Melhorar a experiência do usuário</li>
                <li>Cumprir obrigações legais e regulatórias</li>
                <li>Garantir a segurança da plataforma</li>
                <li>Realizar auditoria e compliance</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                4. Base Legal para Tratamento
              </h2>
              <p className="text-base leading-relaxed mb-3">O tratamento de dados pessoais é realizado com base nas seguintes hipóteses legais (Art. 7º da LGPD):</p>
              <ul className="list-disc pl-6 space-y-1 text-base">
                <li><strong>Execução de contrato:</strong> Para prestação dos serviços contratados</li>
                <li><strong>Consentimento:</strong> Para comunicações de marketing e funcionalidades opcionais</li>
                <li><strong>Obrigação legal:</strong> Para cumprimento de exigências fiscais e regulatórias</li>
                <li><strong>Legítimo interesse:</strong> Para melhorias na plataforma e segurança</li>
                <li><strong>Tutela da saúde:</strong> Para dados sensíveis de pacientes (Art. 11, II, f)</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                5. Compartilhamento de Dados
              </h2>
              <p className="text-base leading-relaxed mb-3">Podemos compartilhar dados com:</p>
              <ul className="list-disc pl-6 space-y-1 text-base mb-3">
                <li><strong>Processadores de pagamento:</strong> Asaas, para processamento de cobranças</li>
                <li><strong>Provedores de infraestrutura:</strong> Supabase (banco de dados), Firebase Hosting (hospedagem)</li>
                <li><strong>Serviços de comunicação:</strong> WhatsApp Business API, provedores de e-mail</li>
                <li><strong>Autoridades:</strong> Quando exigido por lei ou ordem judicial</li>
                <li><strong>Operadoras de saúde:</strong> Para faturamento TISS, mediante autorização</li>
                <li><strong>ANVISA:</strong> Para transmissão SNGPC de medicamentos controlados</li>
              </ul>
              <p className="text-base leading-relaxed">
                Todos os terceiros são contratualmente obrigados a manter a confidencialidade e segurança dos dados.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                6. Retenção de Dados
              </h2>
              <p className="text-base leading-relaxed mb-3">Os dados são retidos pelos seguintes períodos:</p>
              <ul className="list-disc pl-6 space-y-1 text-base">
                <li><strong>Prontuários médicos:</strong> 20 anos após o último atendimento (Resolução CFM nº 1.821/2007)</li>
                <li><strong>Dados fiscais:</strong> 5 anos (legislação tributária)</li>
                <li><strong>Logs de acesso:</strong> 6 meses (Marco Civil da Internet)</li>
                <li><strong>Dados de conta:</strong> Enquanto a conta estiver ativa + 5 anos após encerramento</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                7. Segurança dos Dados
              </h2>
              <p className="text-base leading-relaxed mb-3">Implementamos medidas técnicas e organizacionais para proteger seus dados:</p>
              <ul className="list-disc pl-6 space-y-1 text-base">
                <li>Criptografia em trânsito (TLS) e em repouso</li>
                <li>Autenticação segura</li>
                <li>Controle de acesso baseado em funções (RBAC)</li>
                <li>Segurança no banco de dados</li>
                <li>Auditoria de acessos a dados sensíveis</li>
                <li>Backups automáticos</li>
                <li>Monitoramento de segurança</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                8. Direitos do Titular
              </h2>
              <p className="text-base leading-relaxed mb-3">Conforme a LGPD, você tem direito a:</p>
              <ul className="list-disc pl-6 space-y-1 text-base mb-3">
                <li><strong>Confirmação e acesso:</strong> Saber se tratamos seus dados e acessá-los</li>
                <li><strong>Correção:</strong> Corrigir dados incompletos ou desatualizados</li>
                <li><strong>Anonimização ou eliminação:</strong> Solicitar quando os dados forem desnecessários</li>
                <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                <li><strong>Revogação do consentimento:</strong> Retirar consentimento a qualquer momento</li>
                <li><strong>Oposição:</strong> Opor-se a tratamento em determinadas situações</li>
                <li><strong>Informação:</strong> Saber com quem compartilhamos seus dados</li>
              </ul>
              <p className="text-base leading-relaxed">
                Para exercer seus direitos, entre em contato através da nossa página de{" "}
                <Link to="/canal-lgpd" className="text-teal-600 hover:text-teal-700 font-medium underline underline-offset-2">Canal LGPD</Link>{" "}
                ou pelo e-mail: dpo@clinicnest.com.br
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                9. Cookies e Tecnologias Similares
              </h2>
              <p className="text-base leading-relaxed mb-3">Utilizamos cookies para:</p>
              <ul className="list-disc pl-6 space-y-1 text-base mb-3">
                <li><strong>Cookies essenciais:</strong> Necessários para funcionamento da plataforma</li>
                <li><strong>Cookies de preferências:</strong> Lembrar suas configurações</li>
                <li><strong>Cookies analíticos:</strong> Entender como você usa a plataforma</li>
              </ul>
              <p className="text-base leading-relaxed">
                Você pode gerenciar cookies nas configurações do seu navegador ou através das{" "}
                <button
                  type="button"
                  onClick={openCookieConsentPreferences}
                  className="font-medium text-teal-600 hover:text-teal-700 underline underline-offset-2"
                >
                  Preferências de Cookies
                </button>.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                10. Transferência Internacional
              </h2>
              <p className="text-base leading-relaxed">
                Alguns de nossos provedores de infraestrutura podem processar dados fora do Brasil. Nesses casos, garantimos que existam salvaguardas adequadas, como cláusulas contratuais padrão ou certificações de adequação, conforme exigido pela LGPD.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                11. Dados de Menores
              </h2>
              <p className="text-base leading-relaxed">
                O ClinicNest não é direcionado a menores de 18 anos. Dados de pacientes menores são inseridos e gerenciados pelos profissionais de saúde, que devem obter consentimento dos responsáveis legais conforme exigido pela legislação.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                12. Alterações nesta Política
              </h2>
              <p className="text-base leading-relaxed">
                Podemos atualizar esta política periodicamente. Notificaremos sobre alterações significativas por e-mail ou através da plataforma. Recomendamos revisar esta página regularmente.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                13. Contato
              </h2>
              <p className="text-base leading-relaxed mb-3">Para questões sobre privacidade:</p>
              <div className="bg-muted/50 rounded-xl p-6">
                <p className="font-semibold mb-2 text-foreground">Metaclass Tecnologia Ltda.</p>
                <p className="text-sm">CNPJ: 00.000.000/0001-00</p>
                <p className="text-sm">Endereço: Av. Paulista, 1000 - São Paulo, SP</p>
                <p className="text-sm">E-mail geral: <a href="mailto:contato@clinicnest.com.br" className="text-teal-600 hover:underline">contato@clinicnest.com.br</a></p>
                <p className="text-sm">DPO: <a href="mailto:dpo@clinicnest.com.br" className="text-teal-600 hover:underline">dpo@clinicnest.com.br</a></p>
              </div>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                14. Autoridade Nacional
              </h2>
              <p className="text-base leading-relaxed">
                Caso entenda que o tratamento de seus dados viola a LGPD, você pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD) através do site{" "}
                <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">www.gov.br/anpd</a>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </LandingLayout>
  );
}
