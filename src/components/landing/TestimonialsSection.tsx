import { Star, MapPin } from "lucide-react";

const testimonials = [
  {
    name: "Carla Santos",
    role: "Proprietária do Studio Carla",
    location: "São Paulo, SP",
    content: "O VynloBella transformou a forma como gerencio meu salão. Reduzi 80% do tempo com agendamentos e meus clientes adoram a praticidade!",
    avatar: "CS"
  },
  {
    name: "Roberto Lima",
    role: "Barbearia Vintage",
    location: "Rio de Janeiro, RJ",
    content: "Antes eu perdia dinheiro sem saber onde. Agora tenho controle total das finanças e aumentei meu lucro em 40% em apenas 3 meses.",
    avatar: "RL"
  },
  {
    name: "Amanda Oliveira",
    role: "Espaço Beauty Amanda",
    location: "Belo Horizonte, MG",
    content: "A melhor decisão que tomei foi adotar o VynloBella. Minha equipe ficou mais organizada e meus clientes mais satisfeitos.",
    avatar: "AO"
  }
];

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 sm:py-32 bg-gradient-to-b from-violet-50 to-background relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 border border-violet-200 mb-6">
            <Star className="h-4 w-4 text-violet-600" aria-hidden="true" />
            <span className="text-sm font-medium text-violet-600">Depoimentos</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Quem usa,{" "}
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">recomenda</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Veja o que nossos clientes têm a dizer sobre a transformação dos seus negócios.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial) => (
            <article
              key={testimonial.name}
              className="relative p-6 sm:p-8 rounded-2xl bg-white border shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col"
            >
              {/* Quote */}
              <div className="absolute -top-4 -left-2 text-6xl text-violet-200 font-serif" aria-hidden="true">
                "
              </div>

              {/* Stars */}
              <div className="flex gap-1 mb-4 flex-shrink-0" aria-label="5 estrelas">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                ))}
              </div>

              <blockquote className="text-foreground mb-6 relative z-10 flex-1">
                "{testimonial.content}"
              </blockquote>

              <div className="flex items-center gap-4 flex-shrink-0 mt-auto">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center text-white font-semibold flex-shrink-0" aria-hidden="true">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    <p className="text-xs text-muted-foreground">{testimonial.location}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
