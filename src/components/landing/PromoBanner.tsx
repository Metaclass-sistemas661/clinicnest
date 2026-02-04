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

  const promoText = "5 dias grátis + benefícios exclusivos!";
  const timerText = `${formatNumber(timeLeft.hours)}h:${formatNumber(timeLeft.minutes)}m:${formatNumber(timeLeft.seconds)}s`;

  return (
    <div 
      className="fixed top-16 sm:top-20 left-0 right-0 z-40 bg-yellow-400 text-black border-b-2 border-yellow-500 shadow-lg overflow-hidden"
      style={{ backgroundColor: "#FFEB3B" }}
    >
      <div className="relative flex items-center py-2 sm:py-3">
        {/* Marquee - Texto Correndo */}
        <div className="flex items-center gap-6 animate-marquee whitespace-nowrap flex-shrink-0 pr-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 flex-shrink-0">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />
              <span className="text-sm sm:text-base font-semibold">
                {promoText}
              </span>
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" aria-hidden="true" />
              <span className="font-bold text-sm sm:text-base" role="timer" aria-live="polite">
                {timerText}
              </span>
              <span className="text-lg font-bold">•</span>
            </div>
          ))}
        </div>

        {/* CTA Link - Fixo à direita */}
        <Link 
          to="/cadastro" 
          className="absolute right-4 sm:right-6 z-10 bg-yellow-400 px-3 py-1 rounded-md text-xs sm:text-sm font-bold underline hover:no-underline transition-all whitespace-nowrap backdrop-blur-sm shadow-sm"
          style={{ backgroundColor: "#FFEB3B" }}
        >
          Aproveitar agora →
        </Link>
      </div>
    </div>
  );
}
