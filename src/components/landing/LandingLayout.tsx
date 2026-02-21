import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, X, Stethoscope, ChevronDown, Building2, UserRound } from "lucide-react";
import { useState } from "react";
import { PromoBanner } from "./PromoBanner";
import { openCookieConsentPreferences } from "@/lib/cookieConsent";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-teal-950 via-teal-900 to-cyan-950 backdrop-blur-xl border-b border-white/10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-[72px] sm:h-[88px] items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-teal-500/20 border border-teal-400/30">
              <Stethoscope className="h-5 w-5 text-teal-300" />
            </div>
            <div className="flex flex-col leading-none">
              <div className="flex items-baseline gap-0">
                <span className="font-display text-xl sm:text-2xl font-bold text-teal-300 tracking-tight leading-none">
                  Clinic
                </span>
                <span className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight leading-none">
                  Nest
                </span>
              </div>
              <span className="text-[10px] text-white/55 tracking-[0.14em] self-end -mt-0.5 leading-none">
                by metaclass
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="/#features" className="text-white/80 hover:text-white transition-colors">
              Recursos
            </a>
            <a href="/#testimonials" className="text-white/80 hover:text-white transition-colors">
              Depoimentos
            </a>
            <a href="/#faq" className="text-white/80 hover:text-white transition-colors">
              FAQ
            </a>
            <a href="/#pricing" className="text-white/80 hover:text-white transition-colors">
              Preços
            </a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10 gap-1.5">
                  Entrar
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link to="/login" className="flex items-center gap-2 cursor-pointer">
                    <Building2 className="h-4 w-4" />
                    Sou Clínica
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/paciente/login" className="flex items-center gap-2 cursor-pointer">
                    <UserRound className="h-4 w-4" />
                    Sou Paciente
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/cadastro">
              <Button className="bg-gradient-to-r from-teal-500 to-cyan-400 hover:from-teal-600 hover:to-cyan-500 shadow-lg shadow-teal-500/30 text-white font-semibold">
                Começar Grátis
              </Button>
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-white"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={isOpen}
          >
            {isOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden py-4 border-t border-white/10" role="menu">
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-white/80 hover:text-white transition-colors py-2" onClick={(e) => {
                e.preventDefault();
                setIsOpen(false);
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                Recursos
              </a>
              <a href="#testimonials" className="text-white/80 hover:text-white transition-colors py-2" onClick={(e) => {
                e.preventDefault();
                setIsOpen(false);
                document.getElementById('testimonials')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                Depoimentos
              </a>
              <a href="#faq" className="text-white/80 hover:text-white transition-colors py-2" onClick={(e) => {
                e.preventDefault();
                setIsOpen(false);
                document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                FAQ
              </a>
              <a href="#pricing" className="text-white/80 hover:text-white transition-colors py-2" onClick={(e) => {
                e.preventDefault();
                setIsOpen(false);
                document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                Preços
              </a>
              <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
                <Link to="/login" onClick={() => setIsOpen(false)}>
                  <Button variant="ghost" className="w-full text-white hover:text-white hover:bg-white/10 justify-start gap-2">
                    <Building2 className="h-4 w-4" />
                    Entrar como Clínica
                  </Button>
                </Link>
                <Link to="/paciente/login" onClick={() => setIsOpen(false)}>
                  <Button variant="ghost" className="w-full text-white hover:text-white hover:bg-white/10 justify-start gap-2">
                    <UserRound className="h-4 w-4" />
                    Entrar como Paciente
                  </Button>
                </Link>
                <Link to="/cadastro" onClick={() => setIsOpen(false)}>
                  <Button className="w-full bg-gradient-to-r from-teal-500 to-cyan-400 text-white font-semibold">Começar Grátis</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-teal-100 border border-teal-200">
                <Stethoscope className="h-5 w-5 text-teal-600" />
              </div>
              <div className="flex flex-col leading-none">
                <div className="flex items-baseline gap-0">
                  <span className="font-display text-xl font-bold text-teal-700 tracking-tight leading-none">Clinic</span>
                  <span className="font-display text-xl font-bold text-foreground tracking-tight leading-none">Nest</span>
                </div>
                <span className="text-[8px] text-muted-foreground/70 tracking-[0.15em] self-end -mt-0.5 leading-none">
                  by metaclass
                </span>
              </div>
            </Link>

            <p className="max-w-sm text-sm text-muted-foreground">
              Plataforma completa para agenda, prontuários, equipe e financeiro de clínicas e consultórios.
            </p>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-teal-200 bg-white/80 px-2.5 py-1 text-xs text-muted-foreground">
                LGPD
              </span>
              <span className="rounded-full border border-teal-200 bg-white/80 px-2.5 py-1 text-xs text-muted-foreground">
                Infraestrutura segura
              </span>
              <span className="rounded-full border border-teal-200 bg-white/80 px-2.5 py-1 text-xs text-muted-foreground">
                Suporte humanizado
              </span>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Produto</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="/#features" className="transition-colors hover:text-foreground">
                    Recursos
                  </a>
                </li>
                <li>
                  <a href="/#pricing" className="transition-colors hover:text-foreground">
                    Preços
                  </a>
                </li>
                <li>
                  <a href="/#faq" className="transition-colors hover:text-foreground">
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="/#testimonials" className="transition-colors hover:text-foreground">
                    Depoimentos
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Suporte e empresa</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/contato" className="transition-colors hover:text-foreground">
                    Contato
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:contato@metaclass.com.br"
                    className="transition-colors hover:text-foreground"
                  >
                    contato@metaclass.com.br
                  </a>
                </li>
                <li className="text-muted-foreground/90">Atendimento Seg-Sáb</li>
                <li className="text-muted-foreground/90">Operação 100% online no Brasil</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Jurídico e privacidade</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/termos-de-uso" className="transition-colors hover:text-foreground">
                    Termos de Uso
                  </Link>
                </li>
                <li>
                  <Link
                    to="/politica-de-privacidade"
                    className="transition-colors hover:text-foreground"
                  >
                    Política de Privacidade
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={openCookieConsentPreferences}
                    className="transition-colors hover:text-foreground"
                  >
                    Preferências de Cookies
                  </button>
                </li>
                <li>
                  <Link to="/canal-lgpd" className="transition-colors hover:text-foreground">
                    Canal LGPD
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border/70 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} ClinicNest. Todos os direitos reservados.</p>
          <p>Feito para clínicas e consultórios no Brasil.</p>
        </div>
      </div>
    </footer>
  );
}

export function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <PromoBanner />
      <div className="pt-[124px] sm:pt-[140px]">
        {children}
      </div>
      <Footer />
    </div>
  );
}
