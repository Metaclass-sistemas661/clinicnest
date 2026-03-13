import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

type AnimationType = "up" | "left" | "right" | "scale";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  animation?: AnimationType;
  delay?: number;
  /** Índice para stagger automático (0-8) */
  stagger?: number;
}

const ANIMATION_CLASS: Record<AnimationType, string> = {
  up: "scroll-hidden",
  left: "scroll-hidden-left",
  right: "scroll-hidden-right",
  scale: "scroll-hidden-scale",
};

/**
 * Wrapper que revela seus filhos com animação ao entrar na viewport.
 * Zero dependências externas — usa IntersectionObserver + CSS.
 */
export function ScrollReveal({
  children,
  className,
  animation = "up",
  delay,
  stagger,
}: ScrollRevealProps) {
  const { ref, isVisible } = useScrollReveal();

  const staggerClass = stagger != null && stagger >= 1 && stagger <= 8
    ? `stagger-${stagger}`
    : "";

  return (
    <div
      ref={ref}
      className={cn(
        ANIMATION_CLASS[animation],
        isVisible && "scroll-visible",
        staggerClass,
        className
      )}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
