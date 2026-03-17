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
import { Calendar, Users, Stethoscope, ClipboardList, DollarSign, ArrowRight, Heart, Video } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "clinicnest_onboarding_seen";

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
    { icon: Calendar, label: "Agenda", href: "/agenda", desc: "Gerencie consultas e horários dos profissionais" },
    { icon: Users, label: "Pacientes", href: "/pacientes", desc: "Cadastro e histórico dos seus pacientes" },
    { icon: Stethoscope, label: "Prontuários", href: "/prontuarios", desc: "Registros clínicos e evolução dos atendimentos" },
    { icon: Video, label: "Teleconsulta", href: "/teleconsulta", desc: "Atendimento por vídeo com seus pacientes" },
    { icon: ClipboardList, label: "Receituários", href: "/receituarios", desc: "Prescrições, atestados e laudos médicos" },
    { icon: DollarSign, label: "Financeiro", href: "/financeiro", desc: "Faturamento, contas a receber e fluxo de caixa" },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-vibrant shadow-glow">
              <Heart className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Bem-vindo ao ClinicNest!</DialogTitle>
              <DialogDescription>
                Sua plataforma completa de gestão clínica
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Comece cadastrando seus pacientes e profissionais, configure os procedimentos da clínica e utilize a agenda para organizar seus atendimentos.
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
          <Button onClick={handleClose} variant="gradient">
            Começar a usar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
