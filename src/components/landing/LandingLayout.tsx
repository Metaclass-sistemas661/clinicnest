import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Menu, X, Stethoscope, ChevronDown, Building2, UserRound, Smile, Shield, Brain, Activity, Sparkles, Users, Calendar, Info, ArrowRight } from "lucide-react";
import { useState } from "react";
import { PromoBanner } from "./PromoBanner";
import { openCookieConsentPreferences } from "@/lib/cookieConsent";
import { cn } from "@/lib/utils";

const specialties = [
  { title: "Clínicas Médicas", href: "/solucoes#clinicas-medicas", icon: Stethoscope, description: "Consultórios e policlínicas" },
  { title: "Odontologia", href: "/solucoes#clinicas-odontologicas", icon: Smile, description: "Consultórios e redes" },
  { title: "Psicologia", href: "/solucoes#psicologia-psiquiatria", icon: Brain, description: "Saúde mental" },
  { title: "Fisioterapia", href: "/solucoes#fisioterapia", icon: Activity, description: "Reabilitação" },
  { title: "Estética", href: "/solucoes#estetica", icon: Sparkles, description: "Bem-estar" },
  { title: "Multiprofissional", href: "/solucoes#multiprofissional", icon: Users, description: "Centros médicos" },
];

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

          <div className="hidden lg:flex items-center">
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent text-white/80 hover:text-white hover:bg-white/10 data-[state=open]:bg-white/10">
                    Soluções
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-[500px] p-4">
                      <div className="mb-3 px-2">
                        <h4 className="text-sm font-semibold text-foreground">Para cada especialidade</h4>
                        <p className="text-xs text-muted-foreground">Soluções sob medida para sua área</p>
                      </div>
                      <ul className="grid grid-cols-2 gap-2">
                        {specialties.map((item) => (
                          <li key={item.title}>
                            <NavigationMenuLink asChild>
                              <Link
                                to={item.href}
                                className="flex items-start gap-3 rounded-md p-3 hover:bg-muted transition-colors"
                              >
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 flex-shrink-0">
                                  <item.icon className="h-4 w-4 text-teal-600" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium">{item.title}</div>
                                  <div className="text-xs text-muted-foreground">{item.description}</div>
                                </div>
                              </Link>
                            </NavigationMenuLink>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 pt-3 border-t">
                        <Link to="/solucoes" className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium px-2">
                          Ver todas as soluções
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent text-white/80 hover:text-white hover:bg-white/10 data-[state=open]:bg-white/10">
                    Produto
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-[400px] p-4">
                      <ul className="space-y-1">
                        <li>
                          <NavigationMenuLink asChild>
                            <a href="/#diferenciais" className="block rounded-md p-3 hover:bg-muted transition-colors">
                              <div className="text-sm font-medium">Diferenciais</div>
                              <div className="text-xs text-muted-foreground">O que nos torna únicos</div>
                            </a>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <NavigationMenuLink asChild>
                            <a href="/#features" className="block rounded-md p-3 hover:bg-muted transition-colors">
                              <div className="text-sm font-medium">Recursos</div>
                              <div className="text-xs text-muted-foreground">Funcionalidades completas</div>
                            </a>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <NavigationMenuLink asChild>
                            <a href="/#integracoes" className="block rounded-md p-3 hover:bg-muted transition-colors">
                              <div className="text-sm font-medium">Integrações</div>
                              <div className="text-xs text-muted-foreground">Conecte com outras ferramentas</div>
                            </a>
                          </NavigationMenuLink>
                        </li>
                      </ul>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <a href="/#pricing" className="group inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors">
                      Preços
                    </a>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuTrigger className="bg-transparent text-white/80 hover:text-white hover:bg-white/10 data-[state=open]:bg-white/10">
                    Empresa
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-[300px] p-4">
                      <ul className="space-y-1">
                        <li>
                          <NavigationMenuLink asChild>
                            <Link to="/sobre" className="flex items-center gap-3 rounded-md p-3 hover:bg-muted transition-colors">
                              <Info className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="text-sm font-medium">Sobre Nós</div>
                                <div className="text-xs text-muted-foreground">Nossa história e equipe</div>
                              </div>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <NavigationMenuLink asChild>
                            <Link to="/contato" className="flex items-center gap-3 rounded-md p-3 hover:bg-muted transition-colors">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="text-sm font-medium">Contato</div>
                                <div className="text-xs text-muted-foreground">Fale conosco</div>
                              </div>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <NavigationMenuLink asChild>
                            <a href="/#faq" className="flex items-center gap-3 rounded-md p-3 hover:bg-muted transition-colors">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="text-sm font-medium">FAQ</div>
                                <div className="text-xs text-muted-foreground">Perguntas frequentes</div>
                              </div>
                            </a>
                          </NavigationMenuLink>
                        </li>
                      </ul>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link to="/agendar-demonstracao">
              <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 gap-1.5">
                <Calendar className="h-4 w-4" />
                Agendar Demo
              </Button>
            </Link>
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
            className="lg:hidden p-2 text-white"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={isOpen}
          >
            {isOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>

        {isOpen && (
          <div className="lg:hidden py-4 border-t border-white/10" role="menu">
            <div className="flex flex-col gap-2">
              <Link to="/solucoes" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors py-2 px-2 rounded hover:bg-white/5">
                Soluções
              </Link>
              <a href="/#diferenciais" className="text-white/80 hover:text-white transition-colors py-2 px-2 rounded hover:bg-white/5" onClick={(e) => { e.preventDefault(); setIsOpen(false); document.getElementById('diferenciais')?.scrollIntoView({ behavior: 'smooth' }); }}>
                Diferenciais
              </a>
              <a href="/#features" className="text-white/80 hover:text-white transition-colors py-2 px-2 rounded hover:bg-white/5" onClick={(e) => { e.preventDefault(); setIsOpen(false); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }}>
                Recursos
              </a>
              <a href="/#pricing" className="text-white/80 hover:text-white transition-colors py-2 px-2 rounded hover:bg-white/5" onClick={(e) => { e.preventDefault(); setIsOpen(false); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }}>
                Preços
              </a>
              <Link to="/sobre" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors py-2 px-2 rounded hover:bg-white/5">
                Sobre Nós
              </Link>
              <Link to="/agendar-demonstracao" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors py-2 px-2 rounded hover:bg-white/5">
                Agendar Demo
              </Link>
              <div className="flex flex-col gap-2 pt-4 mt-2 border-t border-white/10">
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
              O único sistema híbrido do Brasil: médico + odontológico + multiprofissional em uma só plataforma. Agenda, prontuário SOAP, odontograma, TISS, portal do paciente e muito mais.
            </p>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-teal-200 bg-white/80 px-2.5 py-1 text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" />
                LGPD
              </span>
              <span className="rounded-full border border-teal-200 bg-white/80 px-2.5 py-1 text-xs text-muted-foreground flex items-center gap-1">
                <Smile className="h-3 w-3" />
                Módulo Odonto
              </span>
              <span className="rounded-full border border-teal-200 bg-white/80 px-2.5 py-1 text-xs text-muted-foreground">
                TISS 3.05
              </span>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Produto</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="/#diferenciais" className="transition-colors hover:text-foreground">
                    Diferenciais
                  </a>
                </li>
                <li>
                  <a href="/#features" className="transition-colors hover:text-foreground">
                    Recursos
                  </a>
                </li>
                <li>
                  <a href="/#integracoes" className="transition-colors hover:text-foreground">
                    Integrações
                  </a>
                </li>
                <li>
                  <a href="/#pricing" className="transition-colors hover:text-foreground">
                    Preços
                  </a>
                </li>
                <li>
                  <Link to="/agendar-demonstracao" className="transition-colors hover:text-foreground">
                    Agendar Demo
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Soluções</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/solucoes#clinicas-medicas" className="transition-colors hover:text-foreground">Clínicas Médicas</Link>
                </li>
                <li>
                  <Link to="/solucoes#clinicas-odontologicas" className="transition-colors hover:text-foreground">Odontologia</Link>
                </li>
                <li>
                  <Link to="/solucoes#fisioterapia" className="transition-colors hover:text-foreground">Fisioterapia</Link>
                </li>
                <li>
                  <Link to="/solucoes#psicologia-psiquiatria" className="transition-colors hover:text-foreground">Psicologia</Link>
                </li>
                <li>
                  <Link to="/solucoes#multiprofissional" className="transition-colors hover:text-foreground">Multiprofissionais</Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Empresa</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/sobre" className="transition-colors hover:text-foreground">
                    Sobre Nós
                  </Link>
                </li>
                <li>
                  <Link to="/contato" className="transition-colors hover:text-foreground">
                    Contato
                  </Link>
                </li>
                <li>
                  <a href="/#faq" className="transition-colors hover:text-foreground">
                    FAQ
                  </a>
                </li>
                <li>
                  <a
                    href="https://wa.me/5511999999999"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-foreground"
                  >
                    WhatsApp
                  </a>
                </li>
                <li className="text-muted-foreground/90">Seg-Sáb, 8h às 18h</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Legal</h3>
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
                    Canal LGPD / DPO
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border/70 pt-6">
          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5 text-teal-600" />
              LGPD
            </span>
            <span>TISS ANS 3.05</span>
            <span>Retenção CFM 20 anos</span>
            <span>Backup Automático</span>
            <span>Suporte a Assinatura Digital</span>
          </div>
          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {currentYear} ClinicNest by Metaclass Tecnologia Ltda. Todos os direitos reservados.</p>
            <p>Sistema de gestão para clínicas de saúde.</p>
          </div>
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
