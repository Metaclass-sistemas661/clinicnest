import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-white/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 sm:h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl sm:text-2xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
              VynloBella
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="/#features" className="text-gray-600 hover:text-gray-900 transition-colors">
              Recursos
            </a>
            <a href="/#testimonials" className="text-gray-600 hover:text-gray-900 transition-colors">
              Depoimentos
            </a>
            <a href="/#faq" className="text-gray-600 hover:text-gray-900 transition-colors">
              FAQ
            </a>
            <a href="/#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
              Preços
            </a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Entrar</Button>
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
          <div className="md:hidden py-4 border-t border-gray-200" role="menu">
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors py-2" onClick={(e) => {
                e.preventDefault();
                setIsOpen(false);
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                Recursos
              </a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900 transition-colors py-2" onClick={(e) => {
                e.preventDefault();
                setIsOpen(false);
                document.getElementById('testimonials')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                Depoimentos
              </a>
              <a href="#faq" className="text-gray-600 hover:text-gray-900 transition-colors py-2" onClick={(e) => {
                e.preventDefault();
                setIsOpen(false);
                document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                FAQ
              </a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors py-2" onClick={(e) => {
                e.preventDefault();
                setIsOpen(false);
                document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                Preços
              </a>
              <div className="flex flex-col gap-2 pt-4 border-t border-gray-200">
                <Link to="/login">
                  <Button variant="ghost" className="w-full">Entrar</Button>
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
  return (
    <footer className="py-12 border-t bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold">VynloBella</span>
          </Link>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <Link to="/termos-de-uso" className="hover:text-foreground transition-colors">Termos de Uso</Link>
            <Link to="/politica-de-privacidade" className="hover:text-foreground transition-colors">Política de Privacidade</Link>
            <Link to="/contato" className="hover:text-foreground transition-colors">Contato</Link>
          </div>

          <p className="text-sm text-muted-foreground">
            © 2025 VynloBella. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}
