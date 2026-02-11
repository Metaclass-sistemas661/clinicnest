import { HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Preciso de conhecimento técnico para usar?",
    answer: "Absolutamente não! O VynloBella foi criado para ser simples e intuitivo. Se você sabe usar um celular, consegue usar nossa plataforma. Além disso, oferecemos fluxos guiados no sistema e suporte humanizado para tirar dúvidas."
  },
  {
    question: "Posso usar no celular?",
    answer: "Sim! O VynloBella funciona perfeitamente em qualquer dispositivo: computador, tablet ou celular. Você pode gerenciar seu salão de qualquer lugar, a qualquer hora."
  },
  {
    question: "Como funciona o período de teste?",
    answer: "Você tem 5 dias grátis para testar todas as funcionalidades sem precisar informar cartão de crédito. Se gostar, escolhe o plano que melhor atende suas necessidades."
  },
  {
    question: "Como cancelo minha assinatura?",
    answer: "Cancelar é simples e rápido. Basta acessar as configurações da sua conta e clicar em 'Cancelar assinatura'. Sem burocracia, sem perguntas, sem multas."
  },
  {
    question: "Meus dados estão seguros?",
    answer: "Totalmente! Utilizamos criptografia de ponta a ponta e servidores seguros. Seus dados e os dados dos seus clientes estão protegidos com a mesma tecnologia usada por grandes bancos."
  },
  {
    question: "Vocês oferecem suporte?",
    answer: "Sim! Oferecemos suporte por e-mail de segunda a sábado. Nossa equipe é treinada para resolver dúvidas com agilidade, e planos trimestral e anual contam com prioridade no atendimento."
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="py-20 sm:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 border border-blue-200 mb-6">
            <HelpCircle className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span className="text-sm font-medium text-blue-600">Perguntas Frequentes</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Tire suas{" "}
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
              dúvidas
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Respostas para as perguntas mais comuns sobre o VynloBella.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-white rounded-2xl border shadow-sm px-6 data-[state=open]:shadow-lg transition-shadow"
              >
                <AccordionTrigger className="text-left font-semibold text-base sm:text-lg py-5 hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
