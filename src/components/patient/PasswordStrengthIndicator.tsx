import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

interface StrengthResult {
  score: number; // 0-4
  label: string;
  color: string;
  feedback: string[];
}

export function getPasswordStrength(password: string): StrengthResult {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push("Mínimo 8 caracteres");

  if (password.length >= 12) score++;

  if (/[A-Z]/.test(password)) score++;
  else feedback.push("1 letra maiúscula");

  if (/[0-9]/.test(password)) score++;
  else feedback.push("1 número");

  const labels: Record<number, { label: string; color: string }> = {
    0: { label: "Muito fraca", color: "bg-red-500" },
    1: { label: "Fraca", color: "bg-orange-500" },
    2: { label: "Razoável", color: "bg-yellow-500" },
    3: { label: "Boa", color: "bg-teal-500" },
    4: { label: "Forte", color: "bg-green-500" },
  };

  const { label, color } = labels[score] ?? labels[0];

  return { score, label, color, feedback };
}

export function isPasswordValid(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

export function PasswordStrengthIndicator({ password, className }: PasswordStrengthProps) {
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  if (!password) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Bars */}
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              i < strength.score ? strength.color : "bg-gray-200 dark:bg-gray-700"
            )}
          />
        ))}
      </div>

      {/* Label + feedback */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{strength.label}</span>
        {strength.feedback.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            Falta: {strength.feedback.join(", ")}
          </span>
        )}
      </div>
    </div>
  );
}
