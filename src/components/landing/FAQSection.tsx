import { useState } from "react";
import { HelpCircle, ChevronDown, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "./ScrollReveal";

const faqs = [
  {
    category: "Geral",
    questions: [
      {
        q: "O que é o ClinicNest?",
        a: "O ClinicNest é o único sistema híbrido do Brasil que atende clínicas médicas, odontológicas e multiprofissionais em uma só plataforma. Com mais de 60 funcionalidades, oferecemos prontuário eletrônico SOAP, odontograma, periograma, faturamento TISS, portal do paciente, gestão financeira completa e muito mais.",
      },
      {
        q: "O que significa 'sistema híbrido'?",
        a: "Significa que o ClinicNest foi desenvolvido desde o início para atender tanto clínicas médicas quanto odontológicas. Não é um sistema médico com 'módulo odonto' adaptado, nem vice-versa. Cada especialidade tem funcionalidades nativas e completas, como odontograma FDI, periograma com 6 sítios, TISS médico e GTO odontológico.",
      },
      {
        q: "Posso testar antes de assinar?",
        a: "Sim! Oferecemos 5 dias de teste grátis com acesso completo a todas as funcionalidades do plano escolhido. Não pedimos cartão de crédito para o trial. Você pode cancelar a qualquer momento sem compromisso.",
      },
      {
        q: "O sistema funciona offline?",
        a: "O ClinicNest é um PWA (Progressive Web App) otimizado para funcionar mesmo com conexões instáveis. Funcionalidades críticas como visualização de agenda e prontuários ficam disponíveis offline, sincronizando automaticamente quando a conexão retorna.",
      },
    ],
  },
  {
    category: "Funcionalidades",
    questions: [
      {
        q: "Quais tipos de profissionais o sistema atende?",
        a: "O ClinicNest possui 11 perfis profissionais com dashboards e permissões diferenciadas: Médico, Dentista, Enfermeiro, Fisioterapeuta, Nutricionista, Psicólogo, Fonoaudiólogo, Secretária, Faturista, Gestor e Administrador. Cada perfil vê apenas o que precisa.",
      },
      {
        q: "O sistema faz faturamento TISS?",
        a: "Sim! Geramos os 4 tipos de guia TISS (Consulta, SP/SADT, Honorários e GTO odontológico) no padrão ANS 3.05. O sistema também processa retornos XML automaticamente, identifica glosas e possui workflow completo para recurso de glosas.",
      },
      {
        q: "Tem módulo odontológico completo?",
        a: "Sim! Nosso módulo odonto inclui: Odontograma interativo FDI com 10 condições, Periograma com 6 sítios por dente e índices automáticos, Planos de tratamento com orçamento por dente/procedimento, Galeria de imagens por dente, TISS GTO e receituários específicos.",
      },
      {
        q: "O paciente pode agendar sozinho?",
        a: "Sim! O Portal do Paciente permite agendamento self-service 24/7 com visualização de slots em tempo real, escolha de profissional e confirmação automática. O paciente também acessa documentos, acompanha financeiro e pode fazer teleconsulta.",
      },
      {
        q: "O sistema tem Inteligência Artificial?",
        a: "Sim! O ClinicNest possui IA integrada em diversas funcionalidades: Agente IA (Nest) que busca pacientes, consulta prontuários e agenda via chat; Chat IA no portal do paciente com atendimento 24/7; Triagem inteligente por chatbot com classificação de urgência; Sugestão automática de CID-10; Resumo clínico gerado por IA; Transcrição de áudio médico; e Predição de no-show para reduzir faltas.",
      },
      {
        q: "Vocês têm integração com WhatsApp?",
        a: "Sim! Integramos com a API oficial do WhatsApp Business para confirmação de consultas, lembretes, notificações de documentos prontos e comunicação com pacientes. Tudo automatizado e rastreável.",
      },
    ],
  },
  {
    category: "Segurança e Compliance",
    questions: [
      {
        q: "O sistema é compatível com LGPD?",
        a: "Sim! O ClinicNest foi desenvolvido com LGPD em mente. Temos RIPD documentado, DPO configurável, gestão de consentimentos, direitos do titular (acesso, retificação, exclusão), auditoria de acessos e criptografia de dados sensíveis.",
      },
      {
        q: "Vocês têm assinatura digital?",
        a: "Sim! O sistema suporta três tipos de certificado digital ICP-Brasil: A1 (arquivo .pfx/.p12), A3 (token ou cartão inteligente via WebPKI) e Certificado em Nuvem (BirdID/RemoteID). Você pode assinar prontuários, receituários, atestados, laudos e qualquer documento clínico com validade jurídica.",
      },
      {
        q: "O sistema atende requisitos de segurança?",
        a: "Sim! O ClinicNest implementa diversas funcionalidades de segurança: criptografia de dados, controle de acesso granular (RBAC), auditoria de acessos, backup automático e conformidade com a LGPD. Trabalhamos continuamente para melhorar a segurança.",
      },
      {
        q: "Por quanto tempo os dados ficam armazenados?",
        a: "Seguimos a resolução CFM que exige retenção de prontuários por 20 anos. O sistema gerencia automaticamente a política de retenção, com alertas antes da expiração e processo seguro de descarte quando aplicável.",
      },
      {
        q: "Vocês têm integração com SNGPC?",
        a: "Sim! Para clínicas que trabalham com medicamentos controlados, oferecemos integração completa com o SNGPC da ANVISA: livro de registro digital, geração de XML para transmissão, rastreabilidade de lotes e alertas de vencimento.",
      },
    ],
  },
  {
    category: "Planos e Pagamento",
    questions: [
      {
        q: "Qual a diferença entre os planos?",
        a: "Os planos diferem em: quantidade de profissionais, limite de pacientes, funcionalidades disponíveis (TISS, RBAC, API, etc.) e nível de suporte. O plano Starter é para iniciantes, Solo para autônomos, Clínica para equipes e Premium para policlínicas com necessidades avançadas.",
      },
      {
        q: "Posso mudar de plano depois?",
        a: "Sim! Você pode fazer upgrade ou downgrade a qualquer momento. No upgrade, a diferença é cobrada proporcionalmente. No downgrade, o crédito é aplicado nas próximas faturas. Não há multa por mudança de plano.",
      },
      {
        q: "Quais formas de pagamento vocês aceitam?",
        a: "Aceitamos cartão de crédito (todas as bandeiras), boleto bancário e Pix. Para planos anuais, oferecemos parcelamento em até 12x no cartão. Empresas podem solicitar faturamento com nota fiscal.",
      },
      {
        q: "Tem desconto para pagamento anual?",
        a: "Sim! O pagamento anual oferece 25% de desconto, equivalente a 3 meses grátis. É a opção mais econômica para quem já conhece e confia no sistema.",
      },
    ],
  },
  {
    category: "Suporte e Migração",
    questions: [
      {
        q: "Como funciona o suporte?",
        a: "O nível de suporte varia por plano: Starter tem suporte por e-mail, Solo e Clínica têm chat (Seg-Sáb), e Premium tem suporte prioritário via WhatsApp com SLA de resposta. Todos os planos incluem acesso à central de ajuda e tutoriais em vídeo.",
      },
      {
        q: "Vocês ajudam na migração de outro sistema?",
        a: "Sim! Oferecemos suporte para migração de dados de outros sistemas. Nossa equipe analisa a estrutura dos seus dados atuais e importa pacientes, histórico de atendimentos e informações financeiras. O processo é acompanhado por um especialista.",
      },
      {
        q: "Tem treinamento para a equipe?",
        a: "Sim! Oferecemos onboarding guiado para novos usuários, tutoriais em vídeo para cada funcionalidade e webinars mensais de boas práticas. Planos Premium incluem treinamento personalizado para a equipe.",
      },
    ],
  },
];

export function FAQSection() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section id="faq" className="py-20 sm:py-32 bg-muted/30 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-100 border border-teal-200 mb-6">
              <HelpCircle className="h-4 w-4 text-teal-600" aria-hidden="true" />
              <span className="text-sm font-medium text-teal-600">Perguntas Frequentes</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              Tire suas{" "}
              <span className="bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">
                dúvidas
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Reunimos as perguntas mais comuns sobre o ClinicNest. Não encontrou o que procura? Fale conosco!
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="max-w-4xl mx-auto space-y-8">
          {faqs.map((category) => (
            <div key={category.category}>
              <h3 className="font-display text-xl font-bold mb-4 text-teal-700">
                {category.category}
              </h3>
              <div className="space-y-3">
                {category.questions.map((faq, index) => {
                  const id = `${category.category}-${index}`;
                  const isOpen = openItems.has(id);
                  return (
                    <div
                      key={id}
                      className="rounded-2xl border bg-card overflow-hidden transition-all duration-200 hover:shadow-md"
                    >
                      <button
                        onClick={() => toggleItem(id)}
                        className="w-full flex items-center justify-between p-5 text-left"
                        aria-expanded={isOpen}
                      >
                        <span className="font-semibold pr-4">{faq.q}</span>
                        <ChevronDown
                          className={cn(
                            "h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform duration-200",
                            isOpen && "rotate-180"
                          )}
                        />
                      </button>
                      <div
                        className={cn(
                          "overflow-hidden transition-all duration-200",
                          isOpen ? "max-h-96" : "max-h-0"
                        )}
                      >
                        <div className="px-5 pb-5 text-muted-foreground">
                          {faq.a}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          </div>
        </ScrollReveal>

        <ScrollReveal animation="scale">
          <div className="mt-16 max-w-2xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-r from-teal-600 to-cyan-500 p-8 text-center text-white">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-80" />
            <h3 className="font-display text-2xl font-bold mb-2">
              Ainda tem dúvidas?
            </h3>
            <p className="text-white/80 mb-6">
              Nossa equipe está pronta para ajudar. Fale conosco por WhatsApp ou agende uma demonstração personalizada.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white text-teal-700 font-semibold hover:bg-teal-50 transition-colors"
              >
                Falar no WhatsApp
              </a>
              <a
                href="/demonstracao"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white/20 text-white font-semibold hover:bg-white/30 transition-colors border border-white/30"
              >
                Agendar demonstração
              </a>
            </div>
          </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
