import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Gift, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";

export function UrgentCTASection() {
  const [timeLeft, setTimeLeft] = useState({
    hours: 23,
    minutes: 59,
    seconds: 59
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else {
          // Reset to 24 hours
          return { hours: 23, minutes: 59, seconds: 59 };
        }
      });
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
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 30%, #f093fb 60%, #f5576c 100%)"
              }}
            />
            {/* Animated pulse overlay */}
            <div className="absolute inset-0 bg-white/5 animate-pulse" />
            
            {/* Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                backgroundSize: "32px 32px"
              }} />
            </div>
          </div>

          <div className="relative z-10 py-16 sm:py-24 px-6 sm:px-12">
            {/* Urgency Badge */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400 text-yellow-900 font-semibold text-sm animate-bounce">
                <Zap className="h-4 w-4" />
                <span>Oferta por Tempo Limitado!</span>
              </div>
            </div>

            <div className="text-center max-w-3xl mx-auto">
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 drop-shadow-lg">
                Comece agora e ganhe{" "}
                <span className="text-yellow-300">30 dias grátis!</span>
              </h2>
              
              <p className="text-lg sm:text-xl text-white/90 mb-8">
                Cadastre-se nas próximas 24 horas e dobre seu período de teste. 
                De 14 para 30 dias completamente grátis!
              </p>

              {/* Countdown Timer */}
              <div className="flex justify-center gap-4 mb-10">
                {[
                  { value: timeLeft.hours, label: "Horas" },
                  { value: timeLeft.minutes, label: "Min" },
                  { value: timeLeft.seconds, label: "Seg" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                      <span className="font-display text-2xl sm:text-3xl font-bold text-white">
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
                  <Gift className="h-5 w-5 text-yellow-300" />
                  <span className="text-sm font-medium text-white">+16 dias grátis</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
                  <Clock className="h-5 w-5 text-green-300" />
                  <span className="text-sm font-medium text-white">Setup prioritário</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
                  <Users className="h-5 w-5 text-blue-300" />
                  <span className="text-sm font-medium text-white">Suporte VIP</span>
                </div>
              </div>

              {/* CTA Button */}
              <Link to="/cadastro">
                <Button 
                  size="lg" 
                  className="bg-white text-violet-700 hover:bg-white/90 text-lg px-10 py-7 h-auto shadow-2xl group font-bold animate-pulse hover:animate-none"
                >
                  Quero Aproveitar a Oferta!
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>

              <p className="mt-6 text-white/70 text-sm">
                🔒 Sem cartão de crédito • Cancele quando quiser
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
