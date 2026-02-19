import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Scissors, Package, DollarSign, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "beautygest_onboarding_seen";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {
      // ignore
    }
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  const features = [
    { icon: Calendar, label: "Agenda", href: "/agenda", desc: "Agende e gerencie horários" },
    { icon: Users, label: "Clientes", href: "/clientes", desc: "Cadastre e acompanhe clientes" },
    { icon: Scissors, label: "Serviços", href: "/servicos", desc: "Catálogo de serviços e preços" },
    { icon: Package, label: "Produtos", href: "/produtos", desc: "Controle de estoque" },
    { icon: DollarSign, label: "Financeiro", href: "/financeiro", desc: "Receitas, despesas e relatórios" },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-vibrant shadow-glow">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Bem-vindo ao ClinicNest!</DialogTitle>
              <DialogDescription>
                Seu painel de gestão para clínicas e consultórios
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Acesse os módulos pelo menu lateral. Comece cadastrando clientes, serviços e depois use a agenda.
        </p>
        <div className="grid gap-2">
          {features.map(({ icon: Icon, label, href, desc }) => (
            <Link
              key={href}
              to={href}
              onClick={handleClose}
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleClose} className="gradient-primary text-primary-foreground">
            Entendi, começar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
