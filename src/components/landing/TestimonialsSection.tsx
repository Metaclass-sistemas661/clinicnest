import { Star, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "./ScrollReveal";

const testimonials = [
  {
    name: "Dra. Mariana Costa",
    role: "Médica Dermatologista",
    clinic: "Clínica Derma Care",
    location: "São Paulo, SP",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face",
    rating: 5,
    text: "Migrei de um sistema que usava há 8 anos e não me arrependo. O prontuário SOAP é muito mais organizado, a agenda inteligente reduziu faltas em 40% e o portal do paciente diminuiu ligações na recepção. Recomendo demais!",
    highlight: "Reduziu faltas em 40%",
  },
  {
    name: "Dr. Ricardo Mendes",
    role: "Cirurgião-Dentista",
    clinic: "Odonto Excellence",
    location: "Rio de Janeiro, RJ",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face",
    rating: 5,
    text: "Finalmente um sistema que entende odontologia de verdade! O odontograma é intuitivo, o periograma calcula os índices automaticamente e os planos de tratamento com orçamento facilitaram muito a aprovação dos pacientes.",
    highlight: "Odontograma intuitivo",
  },
  {
    name: "Fernanda Oliveira",
    role: "Gestora Administrativa",
    clinic: "Centro Médico Vida",
    location: "Belo Horizonte, MG",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face",
    rating: 5,
    text: "Gerencio uma clínica com 12 profissionais de diferentes especialidades. O RBAC do ClinicNest é perfeito - cada um vê só o que precisa. O faturamento TISS reduziu nossas glosas em 45% e o financeiro é muito completo.",
    highlight: "Glosas reduziram 45%",
  },
  {
    name: "Dr. Paulo Henrique",
    role: "Médico Cardiologista",
    clinic: "CardioCenter",
    location: "Curitiba, PR",
    image: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&h=150&fit=crop&crop=face",
    rating: 5,
    text: "O suporte a assinatura digital foi decisivo na minha escolha. Posso assinar meus prontuários digitalmente e a auditoria de acessos me dá tranquilidade quanto à LGPD. O suporte é excelente, sempre respondem rápido.",
    highlight: "Assinatura Digital",
  },
  {
    name: "Dra. Camila Santos",
    role: "Fisioterapeuta",
    clinic: "FisioVida",
    location: "Porto Alegre, RS",
    image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=150&h=150&fit=crop&crop=face",
    rating: 5,
    text: "Trabalho com reabilitação e preciso de evoluções detalhadas. O sistema tem templates específicos para fisioterapia e o histórico do paciente fica todo organizado. A teleconsulta integrada também ajuda muito no acompanhamento.",
    highlight: "Templates específicos",
  },
  {
    name: "Dr. André Luiz",
    role: "Ortodontista",
    clinic: "Orto Smile",
    location: "Brasília, DF",
    image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&h=150&fit=crop&crop=face",
    rating: 5,
    text: "O módulo odontológico é completo de verdade. Uso o odontograma diariamente, os planos de tratamento com fotos ajudam na comunicação com o paciente e o TISS GTO funciona perfeitamente com os convênios.",
    highlight: "TISS GTO perfeito",
  },
];

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 sm:py-32 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-teal-500/20 to-transparent" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 border border-amber-200 mb-6">
              <Star className="h-4 w-4 text-amber-600 fill-amber-600" aria-hidden="true" />
              <span className="text-sm font-medium text-amber-700">+500 clínicas confiam no ClinicNest</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              O que nossos{" "}
              <span className="bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">
                clientes dizem
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Profissionais de saúde de todo o Brasil já transformaram suas clínicas com o ClinicNest.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <ScrollReveal key={testimonial.name} animation="up" stagger={(index % 3) + 1}>
              <div
                className={cn(
                  "group relative p-6 rounded-3xl border bg-card hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col h-full",
                  index === 0 && "lg:col-span-1 lg:row-span-1"
                )}
            >
              <div className="absolute top-6 right-6">
                <Quote className="h-8 w-8 text-teal-100" />
              </div>

              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              <p className="text-muted-foreground mb-6 flex-1 leading-relaxed">
                "{testimonial.text}"
              </p>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-sm font-medium mb-6 w-fit">
                {testimonial.highlight}
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-teal-100"
                />
                <div>
                  <p className="font-semibold text-sm">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.clinic} · {testimonial.location}</p>
                </div>
              </div>
            </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal animation="up">
          <div className="mt-16 grid sm:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            {[
            { value: "500+", label: "Clínicas ativas" },
            { value: "4.9", label: "Avaliação média", suffix: "/5" },
            { value: "98%", label: "Taxa de renovação" },
            { value: "45%", label: "Redução média de glosas" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-4xl font-bold text-teal-600">
                {stat.value}
                {stat.suffix && <span className="text-xl text-muted-foreground">{stat.suffix}</span>}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
