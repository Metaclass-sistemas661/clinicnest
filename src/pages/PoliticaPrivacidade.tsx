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
                  Última atualização: 18 de abril de 2026
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
              <ul className="list-disc pl-6 space-y-1 text-base mb-4">
                <li>Logs de acesso e navegação</li>
                <li>Endereço IP e informações do dispositivo</li>
                <li>Dados de geolocalização (quando autorizado)</li>
                <li>Métricas de uso da plataforma</li>
              </ul>

              <h3 className="font-semibold text-lg mb-2 text-foreground">2.4 Dados da Integração WhatsApp Business</h3>
              <p className="text-base leading-relaxed mb-3">
                Quando a clínica opta por conectar sua conta WhatsApp Business à plataforma através do Cadastro Incorporado (Embedded Signup) da Meta, coletamos e armazenamos:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-base mb-4">
                <li>Identificação da Conta WhatsApp Business (WABA ID) e número de telefone comercial</li>
                <li>Token de acesso empresarial emitido pela Meta (armazenado de forma criptografada)</li>
                <li>Nome de exibição e informações do perfil comercial do WhatsApp</li>
                <li>Metadados de mensagens enviadas e recebidas (remetente, destinatário, data/hora, status de entrega)</li>
                <li>Conteúdo de mensagens trocadas entre a clínica e seus pacientes via WhatsApp</li>
                <li>Dados de autenticação do Login do Facebook para Empresas (código de autorização, identificação empresarial)</li>
              </ul>

              <h3 className="font-semibold text-lg mb-2 text-foreground">2.5 Dados de Autenticação via Meta</h3>
              <p className="text-base leading-relaxed">
                Durante o processo de conexão via Login do Facebook para Empresas, a Meta compartilha conosco um código de autorização que é trocado por um token de acesso no servidor. Não coletamos nem armazenamos sua senha do Facebook. O token é utilizado exclusivamente para operar a integração WhatsApp Business e é renovado periodicamente conforme a política de expiração da Meta.
              </p>
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
                <li>Habilitar a integração WhatsApp Business para comunicação com pacientes (envio de lembretes de consulta, confirmações, atendimento via chatbot)</li>
                <li>Registrar e gerenciar o número de telefone comercial da clínica na Plataforma WhatsApp Business da Meta</li>
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
                <li><strong>Provedores de infraestrutura:</strong> Google Cloud Platform (banco de dados e API), Firebase Hosting (hospedagem)</li>
                <li><strong>Meta Platforms, Inc. (WhatsApp Business Platform):</strong> Para envio e recebimento de mensagens via WhatsApp Cloud API, incluindo registro de número telefônico, gerenciamento de modelos de mensagem e webhooks. Os dados compartilhados incluem o conteúdo de mensagens, número do remetente/destinatário e metadados de entrega. O tratamento pela Meta está sujeito à <a href="https://www.whatsapp.com/legal/business-policy" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Política Comercial do WhatsApp</a> e aos <a href="https://www.whatsapp.com/legal/business-terms" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Termos de Serviço do WhatsApp Business</a></li>
                <li><strong>Provedores de e-mail:</strong> Resend, para envio de e-mails transacionais e comunicações</li>
                <li><strong>Autoridades:</strong> Quando exigido por lei ou ordem judicial</li>
                <li><strong>Operadoras de saúde:</strong> Para faturamento TISS, mediante autorização</li>
                <li><strong>ANVISA:</strong> Para transmissão SNGPC de medicamentos controlados</li>
              </ul>
              <p className="text-base leading-relaxed">
                Todos os terceiros são contratualmente obrigados a manter a confidencialidade e segurança dos dados. O compartilhamento de dados com a Meta Platforms é regido pelos Termos da Plataforma Meta e pela Política de Dados do WhatsApp Business.
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
                <li><strong>Dados do WhatsApp Business:</strong> Tokens de acesso são retidos enquanto a integração estiver ativa; metadados de mensagens são retidos por 12 meses; conteúdo de mensagens segue a política de retenção de prontuários quando vinculado a atendimentos clínicos</li>
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
                10. Integração WhatsApp Business Platform (Meta)
              </h2>
              <p className="text-base leading-relaxed mb-3">
                O ClinicNest oferece integração com a Plataforma WhatsApp Business da Meta Platforms, Inc., permitindo que clínicas conectem seu número de telefone comercial para comunicação com pacientes. Esta seção detalha especificamente o tratamento de dados relacionado a esta integração.
              </p>

              <h3 className="font-semibold text-lg mb-2 text-foreground">10.1 Cadastro Incorporado (Embedded Signup)</h3>
              <p className="text-base leading-relaxed mb-3">
                Para conectar o WhatsApp Business, utilizamos o Cadastro Incorporado da Meta, que emprega o Login do Facebook para Empresas. Durante este processo:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-base mb-4">
                <li>O usuário autentica-se diretamente com a Meta através de uma janela segura — o ClinicNest não tem acesso às credenciais do Facebook</li>
                <li>A Meta retorna um código de autorização que é trocado por um token de acesso empresarial em nosso servidor via comunicação criptografada (HTTPS)</li>
                <li>O token é armazenado de forma criptografada em nosso banco de dados e utilizado exclusivamente para operar a integração WhatsApp</li>
                <li>Os ativos do WhatsApp (conta WABA, número de telefone) permanecem de propriedade do cliente empresarial</li>
              </ul>

              <h3 className="font-semibold text-lg mb-2 text-foreground">10.2 Dados de Mensagens</h3>
              <p className="text-base leading-relaxed mb-3">
                As mensagens trocadas via WhatsApp são processadas da seguinte forma:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-base mb-4">
                <li>Mensagens são transmitidas pela infraestrutura da Meta (WhatsApp Cloud API) e entregues ao nosso servidor via webhooks</li>
                <li>Metadados (remetente, destinatário, horário, status) são armazenados para fins de auditoria e operação do serviço</li>
                <li>Conteúdo de mensagens relevantes ao atendimento clínico pode ser vinculado ao prontuário do paciente</li>
                <li>Mensagens automatizadas (chatbot de agendamento, lembretes) são geradas pelo sistema conforme configurações da clínica</li>
              </ul>

              <h3 className="font-semibold text-lg mb-2 text-foreground">10.3 Segurança da Integração</h3>
              <ul className="list-disc pl-6 space-y-1 text-base mb-4">
                <li>Tokens de acesso são armazenados criptografados e nunca expostos no frontend</li>
                <li>Webhooks são verificados por token secreto para garantir autenticidade</li>
                <li>Toda comunicação com a API da Meta utiliza HTTPS/TLS</li>
                <li>Acesso aos dados da integração é restrito por RBAC (controle de acesso baseado em funções)</li>
              </ul>

              <h3 className="font-semibold text-lg mb-2 text-foreground">10.4 Desconexão e Exclusão</h3>
              <p className="text-base leading-relaxed mb-3">
                A clínica pode desconectar a integração WhatsApp a qualquer momento. Ao desconectar:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-base mb-4">
                <li>O token de acesso é revogado e excluído do nosso banco de dados</li>
                <li>Os webhooks são cancelados na conta WhatsApp Business</li>
                <li>Mensagens históricas são mantidas conforme a política de retenção, mas nenhuma nova mensagem é processada</li>
                <li>Os ativos do WhatsApp (WABA, número de telefone) permanecem sob propriedade do cliente</li>
              </ul>

              <h3 className="font-semibold text-lg mb-2 text-foreground">10.5 Conformidade com Políticas da Meta</h3>
              <p className="text-base leading-relaxed">
                O uso da Plataforma WhatsApp Business pelo ClinicNest está em conformidade com os{" "}
                <a href="https://developers.facebook.com/terms" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Termos da Plataforma Meta</a>,{" "}
                a <a href="https://www.whatsapp.com/legal/business-policy" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Política Comercial do WhatsApp</a>{" "}
                e as <a href="https://developers.facebook.com/devpolicy/" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Políticas de Desenvolvedor da Meta</a>.
                Dados obtidos através da API WhatsApp não são vendidos, compartilhados para fins publicitários ou utilizados para qualquer finalidade além da prestação do serviço de comunicação clínica. 
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                11. Transferência Internacional
              </h2>
              <p className="text-base leading-relaxed">
                Alguns de nossos provedores de infraestrutura podem processar dados fora do Brasil. Nesses casos, garantimos que existam salvaguardas adequadas, como cláusulas contratuais padrão ou certificações de adequação, conforme exigido pela LGPD.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                12. Dados de Menores
              </h2>
              <p className="text-base leading-relaxed">
                O ClinicNest não é direcionado a menores de 18 anos. Dados de pacientes menores são inseridos e gerenciados pelos profissionais de saúde, que devem obter consentimento dos responsáveis legais conforme exigido pela legislação.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                13. Alterações nesta Política
              </h2>
              <p className="text-base leading-relaxed">
                Podemos atualizar esta política periodicamente. Notificaremos sobre alterações significativas por e-mail ou através da plataforma. Recomendamos revisar esta página regularmente.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                14. Contato
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
                15. Autoridade Nacional
              </h2>
              <p className="text-base leading-relaxed">
                Caso entenda que o tratamento de seus dados viola a LGPD, você pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD) através do site{" "}
                <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">www.gov.br/anpd</a>.
              </p>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-3 border-b border-teal-200 pb-2">
                16. Exclusão de Dados e Retorno de Chamada
              </h2>
              <p className="text-base leading-relaxed mb-3">
                Se você deseja solicitar a exclusão dos dados associados à sua conta ou à integração com a Plataforma WhatsApp Business / Login do Facebook para Empresas, pode fazê-lo por qualquer dos seguintes meios:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-base mb-3">
                <li>Através da página <Link to="/canal-lgpd" className="text-teal-600 hover:text-teal-700 font-medium underline underline-offset-2">Canal LGPD</Link> selecionando "Eliminação de dados"</li>
                <li>Enviando e-mail para <a href="mailto:dpo@clinicnest.com.br" className="text-teal-600 hover:underline">dpo@clinicnest.com.br</a> com o assunto "Solicitação de exclusão de dados"</li>
                <li>Desconectando a integração WhatsApp Business nas Configurações de Integrações da plataforma (exclui tokens e desativa webhooks imediatamente)</li>
              </ul>
              <p className="text-base leading-relaxed">
                Após receber uma solicitação válida, processaremos a exclusão em até 15 dias úteis, conforme os prazos estabelecidos pela LGPD. Dados sujeitos a obrigações legais de retenção (prontuários médicos, dados fiscais) serão mantidos pelos períodos legais aplicáveis e isolados de qualquer processamento adicional.
              </p>
            </div>
          </div>
        </section>
      </div>
    </LandingLayout>
  );
}
