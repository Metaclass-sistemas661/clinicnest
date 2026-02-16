import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { PromoBanner } from "./PromoBanner";
import { openCookieConsentPreferences } from "@/lib/cookieConsent";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-violet-950 via-fuchsia-900 to-violet-950 backdrop-blur-xl border-b border-white/10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 sm:h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/beautygest.logo.png"
              alt="BeautyGest"
              className="h-16 w-16 sm:h-20 sm:w-20"
              loading="eager"
            />
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
            <Link to="/login">
              <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">
                Entrar
              </Button>
            </Link>
            <Link to="/cadastro">
              <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 shadow-lg shadow-violet-500/30">
                Começar Grátis
              </Button>
            </Link>
          </div>

          <button
            className="md:hidden p-2"
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
                <Link to="/login">
                  <Button variant="ghost" className="w-full text-white hover:text-white hover:bg-white/10">Entrar</Button>
                </Link>
                <Link to="/cadastro">
                  <Button className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-500">Começar Grátis</Button>
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
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/beautygest-logo.png"
                alt="BeautyGest"
                className="h-10 w-10 rounded-lg bg-white/80 p-1"
                loading="lazy"
              />
              <span className="font-display text-xl font-bold">BeautyGest</span>
            </Link>

            <p className="max-w-sm text-sm text-muted-foreground">
              Plataforma completa para agenda, equipe, financeiro e crescimento de salões de beleza.
            </p>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-violet-200 bg-white/80 px-2.5 py-1 text-xs text-muted-foreground">
                LGPD
              </span>
              <span className="rounded-full border border-violet-200 bg-white/80 px-2.5 py-1 text-xs text-muted-foreground">
                Infraestrutura segura
              </span>
              <span className="rounded-full border border-violet-200 bg-white/80 px-2.5 py-1 text-xs text-muted-foreground">
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
          <p>© {currentYear} BeautyGest. Todos os direitos reservados.</p>
          <p>Feito para salões e profissionais da beleza no Brasil.</p>
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
      <div className="pt-28 sm:pt-32">
        {children}
      </div>
      <Footer />
    </div>
  );
}
