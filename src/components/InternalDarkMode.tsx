import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const PROTECTED_PATHS = [
  "/dashboard",
  "/agenda",
  "/financeiro",
  "/produtos",
  "/servicos",
  "/clientes",
  "/equipe",
  "/configuracoes",
  "/assinatura",
];

/** Aplica dark mode no html apenas quando o usuário está em rota protegida */
export function InternalDarkMode() {
  const { pathname } = useLocation();

  useEffect(() => {
    const isProtected = PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
    const shouldBeDark = isProtected;

    const root = document.documentElement;
    if (shouldBeDark) {
      root.classList.remove("light");
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [pathname]);

  return null;
}
