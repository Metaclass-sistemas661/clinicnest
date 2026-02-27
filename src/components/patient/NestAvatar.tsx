import { cn } from "@/lib/utils";

interface NestAvatarProps {
  /** Tamanho em pixels (largura e altura) */
  size?: number;
  className?: string;
  /** Variante circular (padrão) ou quadrada */
  rounded?: boolean;
}

const NEST_AVATAR_SRC = "/nest-avatar.png";

/**
 * Avatar da Nest — assistente de IA do ClinicNest.
 * Usa a imagem ilustrada da personagem Nest (doutora).
 * Tamanhos recomendados:
 *   - Banner hero: 140-180px
 *   - Banner dashboard: 88-100px
 *   - Chat header: 28px
 *   - Chat mensagem: 32px
 *   - Chat botão flutuante: 40px
 *   - Chat estado vazio: 56px
 */
export function NestAvatar({ size = 80, className, rounded = true }: NestAvatarProps) {
  return (
    <img
      src={NEST_AVATAR_SRC}
      alt="Nest — Assistente de IA"
      width={size}
      height={size}
      loading="lazy"
      className={cn(
        "object-cover select-none pointer-events-none",
        rounded && "rounded-full",
        className,
      )}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    />
  );
}
