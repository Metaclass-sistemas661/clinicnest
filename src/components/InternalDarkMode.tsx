import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";

const PROTECTED_PATHS = [
  "/dashboard",
  "/agenda",
  "/financeiro",
  "/minhas-comissoes",
  "/produtos",
  "/servicos",
  "/clientes",
  "/equipe",
  "/configuracoes",
  "/assinatura",
];

/** Força tema claro em rotas públicas. Em rotas protegidas, aplica o tema escolhido (ThemeProvider). */
export function InternalDarkMode() {
  const { pathname } = useLocation();
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    const isProtected = PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

    const root = document.documentElement;
    if (!isProtected) {
      // Rotas públicas (landing, login, etc.): sempre claro
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      // Rotas protegidas: aplica o tema do usuário (light/dark/system)
      root.classList.remove("light", "dark");
      root.classList.add(resolvedTheme);
    }
  }, [pathname, theme, resolvedTheme]);

  return null;
}
