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

  const promoText = "7 dias grátis + benefícios exclusivos!";
  const timerText = `${formatNumber(timeLeft.hours)}h:${formatNumber(timeLeft.minutes)}m:${formatNumber(timeLeft.seconds)}s`;

  return (
    <div
      className="fixed top-[72px] sm:top-[88px] left-0 right-0 z-40 border-b border-teal-600/30 shadow-md overflow-hidden text-white"
      style={{ background: "linear-gradient(90deg, #0f766e 0%, #0d9488 50%, #0e7490 100%)" }}
    >
      <div className="flex items-center py-2 sm:py-3 overflow-hidden">
        {/* Marquee */}
        <div className="flex items-center gap-6 animate-marquee whitespace-nowrap flex-shrink-0">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 flex-shrink-0">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-cyan-200" aria-hidden="true" />
              <span className="text-sm sm:text-base font-semibold">
                {promoText}
              </span>
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-cyan-200" aria-hidden="true" />
              <span className="font-bold text-sm sm:text-base" role="timer" aria-live="polite">
                {timerText}
              </span>
              <span className="text-lg font-bold opacity-50">•</span>
              <Link
                to="/cadastro"
                className="px-3 py-1 rounded-md text-xs sm:text-sm font-semibold bg-white/20 hover:bg-white/30 border border-white/30 transition-all whitespace-nowrap"
              >
                Começar grátis →
              </Link>
              <span className="text-lg font-bold opacity-50">•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
