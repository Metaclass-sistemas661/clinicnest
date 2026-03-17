import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
} as const;

interface SpinnerProps {
  size?: keyof typeof SIZES;
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return <Loader2 className={cn(SIZES[size], "animate-spin", className)} />;
}
