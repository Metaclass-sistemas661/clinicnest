import { useEffect, useState, useRef } from "react";
import { Building2, CalendarCheck, Heart, DollarSign } from "lucide-react";

interface StatItemProps {
  icon: React.ElementType;
  value: number;
  suffix: string;
  label: string;
  color: string;
}

function StatItem({ icon: Icon, value, suffix, label, color }: StatItemProps) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isVisible, value]);

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    teal: { bg: "bg-teal-100", text: "text-teal-600", border: "border-teal-200" },
    green: { bg: "bg-green-100", text: "text-green-600", border: "border-green-200" },
    blue: { bg: "bg-blue-100", text: "text-blue-600", border: "border-blue-200" },
    cyan: { bg: "bg-cyan-100", text: "text-cyan-600", border: "border-cyan-200" },
  };
  const colors = colorClasses[color] || colorClasses.teal;

  return (
    <div
      ref={ref}
      className="relative group p-6 sm:p-8 rounded-2xl bg-white border shadow-sm hover:shadow-xl transition-all duration-300 h-full flex flex-col"
    >
      <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4 flex-shrink-0 ${colors.bg}`}>
        <Icon className={`h-7 w-7 ${colors.text}`} aria-hidden="true" />
      </div>
      <div className="space-y-1 flex-1">
        <div className="font-display text-3xl sm:text-4xl font-bold bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">
          {count.toLocaleString("pt-BR")}{suffix}
        </div>
        <p className="text-muted-foreground font-medium text-sm sm:text-base">{label}</p>
      </div>
    </div>
  );
}

export function StatsSection() {
  const stats = [
    { icon: Building2, value: 500, suffix: "+", label: "Clínicas Atendidas", color: "teal" },
    { icon: CalendarCheck, value: 50000, suffix: "+", label: "Consultas/Mês", color: "green" },
    { icon: Heart, value: 98, suffix: "%", label: "De Satisfação", color: "cyan" },
    { icon: DollarSign, value: 2, suffix: "M+", label: "Gerenciados (R$)", color: "blue" },
  ];

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-background to-teal-50/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-lg text-muted-foreground">
            Números que comprovam nossa excelência
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {stats.map((stat) => (
            <StatItem key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
}
