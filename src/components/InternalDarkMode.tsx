import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/cadastro",
  "/forgot-password",
  "/reset-password",
  "/termos-de-uso",
  "/politica-de-privacidade",
  "/contato",
  "/canal-lgpd",
  "/agendar",
];

/** Força tema claro em rotas públicas. Em rotas protegidas, aplica o tema escolhido (ThemeProvider). */
export function InternalDarkMode() {
  const { pathname } = useLocation();
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

    const root = document.documentElement;
    if (isPublic) {
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
