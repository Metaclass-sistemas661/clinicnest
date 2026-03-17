import { useState, useEffect } from "react";
import { Camera, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";

export type SignatureMethod = "facial" | "manual";

interface SignatureMethodSelectorProps {
  onSelect: (method: SignatureMethod) => void;
  disabled?: boolean;
}

export function SignatureMethodSelector({ onSelect, disabled }: SignatureMethodSelectorProps) {
  const [hasCamera, setHasCamera] = useState(true);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      setHasCamera(devices.some((d) => d.kind === "videoinput"));
    }).catch(() => setHasCamera(false));
  }, []);

  const options: Array<{
    method: SignatureMethod;
    icon: typeof Camera;
    title: string;
    description: string;
    available: boolean;
    unavailableReason?: string;
    accentClass: string;
    iconBgClass: string;
  }> = [
    {
      method: "facial",
      icon: Camera,
      title: "Reconhecimento Facial",
      description: "Capture uma foto do seu rosto como prova de identidade",
      available: hasCamera,
      unavailableReason: "Câmera não detectada neste dispositivo",
      accentClass: "border-teal-200 hover:border-teal-400 hover:shadow-teal-100 dark:border-teal-800 dark:hover:border-teal-600 dark:hover:shadow-teal-950",
      iconBgClass: "bg-teal-100 text-teal-600 dark:bg-teal-900 dark:text-teal-400",
    },
    {
      method: "manual",
      icon: PenTool,
      title: "Assinatura Manual",
      description: "Desenhe sua assinatura com o dedo ou mouse",
      available: true,
      accentClass: "border-indigo-200 hover:border-indigo-400 hover:shadow-indigo-100 dark:border-indigo-800 dark:hover:border-indigo-600 dark:hover:shadow-indigo-950",
      iconBgClass: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400",
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-center text-muted-foreground">
        Escolha o método de assinatura
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isDisabled = disabled || !opt.available;
          return (
            <button
              key={opt.method}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(opt.method)}
              className={cn(
                "group relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all duration-200",
                isDisabled
                  ? "cursor-not-allowed border-muted bg-muted/30 opacity-50"
                  : cn("cursor-pointer bg-card hover:shadow-md hover:-translate-y-0.5", opt.accentClass),
              )}
            >
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-200",
                  isDisabled ? "bg-muted text-muted-foreground" : cn("group-hover:scale-110", opt.iconBgClass),
                )}
              >
                <Icon className="h-7 w-7" />
              </div>
              <div>
                <p className="font-semibold text-sm">{opt.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {!opt.available ? opt.unavailableReason : opt.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
