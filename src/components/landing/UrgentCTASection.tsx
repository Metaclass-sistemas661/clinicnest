import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Gift, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { ScrollReveal } from "./ScrollReveal";

export function UrgentCTASection() {
  // Calculate time until end of day (23:59:59)
  const getTimeUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(23, 59, 59, 999);

    const diff = midnight.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { hours: Math.max(0, hours), minutes: Math.max(0, minutes), seconds: Math.max(0, seconds) };
  };

  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeUntilMidnight());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatNumber = (num: number) => num.toString().padStart(2, '0');

  return (
    <section className="py-20 sm:py-32 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(135deg, #0f4c4c 0%, #0d6e6e 30%, #0891b2 60%, #0c4a6e 100%)"
              }}
            />
            {/* Subtle overlay */}
            <div className="absolute inset-0 bg-white/3" />

            {/* Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                backgroundSize: "32px 32px"
              }} />
            </div>
          </div>

          <div className="relative z-10 py-16 sm:py-24 px-6 sm:px-12">
            <ScrollReveal animation="scale">
            {/* Badge */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 border border-white/30 text-white font-semibold text-sm">
                <Zap className="h-4 w-4 text-cyan-300" />
                <span>5 dias grátis para começar</span>
              </div>
            </div>

            <div className="text-center max-w-3xl mx-auto">
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 drop-shadow-lg">
                Comece agora e{" "}
                <span className="text-cyan-300">tudo organizado desde o primeiro dia.</span>
              </h2>

              <p className="text-lg sm:text-xl text-white/90 mb-8">
                Cadastre-se nas próximas 24 horas e aproveite 5 dias grátis + benefícios especiais
                para sua clínica começar com o pé direito!
              </p>

              {/* Countdown Timer */}
              <div className="flex justify-center gap-4 mb-10" role="timer" aria-live="polite" aria-label="Contador regressivo até o fim do dia">
                {[
                  { value: timeLeft.hours, label: "Horas" },
                  { value: timeLeft.minutes, label: "Min" },
                  { value: timeLeft.seconds, label: "Seg" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                      <span className="font-display text-2xl sm:text-3xl font-bold text-white" aria-label={`${item.value} ${item.label}`}>
                        {formatNumber(item.value)}
                      </span>
                    </div>
                    <span className="text-white/80 text-sm mt-2">{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Bonuses */}
              <div className="flex flex-wrap justify-center gap-4 mb-10">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
                  <Gift className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                  <span className="text-sm font-medium text-white">5 dias grátis</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
                  <Clock className="h-5 w-5 text-teal-300" aria-hidden="true" />
                  <span className="text-sm font-medium text-white">Setup prioritário</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
                  <Users className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                  <span className="text-sm font-medium text-white">Suporte VIP</span>
                </div>
              </div>

              {/* CTA Button */}
              <Link to="/cadastro">
                <Button
                  size="lg"
                  className="bg-white text-teal-700 hover:bg-white/90 text-lg px-10 py-7 h-auto shadow-2xl group font-bold"
                >
                  Começar gratuitamente
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>

              <p className="mt-6 text-white/70 text-sm">
                🔒 Sem cartão de crédito • Cancele quando quiser
              </p>
            </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
