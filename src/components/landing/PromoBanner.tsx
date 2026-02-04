import { Link } from "react-router-dom";
import { Zap, Clock } from "lucide-react";
import { useEffect, useState } from "react";

export function PromoBanner() {
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
    <div 
      className="fixed top-16 sm:top-20 left-0 right-0 z-40 bg-yellow-400 text-black border-b-2 border-yellow-500 shadow-lg"
      style={{ backgroundColor: "#FFEB3B" }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 py-2 sm:py-3">
          {/* Promoção */}
          <div className="flex items-center gap-2 text-sm sm:text-base font-semibold">
            <Zap className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            <span>5 dias grátis + benefícios exclusivos!</span>
          </div>

          {/* Separador */}
          <div className="hidden sm:block w-px h-6 bg-black/20" />

          {/* Cronômetro */}
          <div className="flex items-center gap-2 sm:gap-4" role="timer" aria-live="polite" aria-label="Contador regressivo até o fim do dia">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm sm:text-base" aria-label={`${timeLeft.hours} horas`}>
                  {formatNumber(timeLeft.hours)}
                </span>
                <span className="text-xs sm:text-sm">h</span>
              </div>
              <span className="font-bold">:</span>
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm sm:text-base" aria-label={`${timeLeft.minutes} minutos`}>
                  {formatNumber(timeLeft.minutes)}
                </span>
                <span className="text-xs sm:text-sm">m</span>
              </div>
              <span className="font-bold">:</span>
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm sm:text-base" aria-label={`${timeLeft.seconds} segundos`}>
                  {formatNumber(timeLeft.seconds)}
                </span>
                <span className="text-xs sm:text-sm">s</span>
              </div>
            </div>
          </div>

          {/* CTA Link */}
          <Link 
            to="/cadastro" 
            className="ml-auto text-xs sm:text-sm font-bold underline hover:no-underline transition-all whitespace-nowrap"
          >
            Aproveitar agora →
          </Link>
        </div>
      </div>
    </div>
  );
}
