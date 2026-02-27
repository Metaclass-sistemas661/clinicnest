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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Check, Zap, Bug, Wrench } from "lucide-react";
import { APP_VERSION } from "@/lib/version";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: "feature" | "improvement" | "fix" | "breaking";
    title: string;
    description?: string;
  }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2.6.0",
    date: "2026-02-23",
    changes: [
      { type: "feature", title: "Página de detalhes do paciente", description: "Nova página /pacientes/:id com todas as informações do paciente em um só lugar" },
      { type: "feature", title: "Atalhos de teclado", description: "Pressione ? para ver todos os atalhos disponíveis" },
      { type: "improvement", title: "Modais padronizados", description: "Todos os modais agora têm tamanhos e animações consistentes" },
      { type: "fix", title: "Correção de focus trap", description: "Tab agora navega corretamente dentro dos modais" },
    ],
  },
  {
    version: "2.5.0",
    date: "2026-02-20",
    changes: [
      { type: "feature", title: "Tabela TUSS Odontológica", description: "3.000+ procedimentos odontológicos com preços regionais" },
      { type: "feature", title: "Periograma digital", description: "Registro de sondagem periodontal com gráficos" },
      { type: "improvement", title: "Autocomplete otimizado", description: "Busca mais rápida em tabelas TUSS" },
    ],
  },
  {
    version: "2.4.0",
    date: "2026-02-15",
    changes: [
      { type: "feature", title: "Dashboard ONA", description: "Indicadores de qualidade para acreditação hospitalar" },
      { type: "feature", title: "Relatórios customizáveis", description: "Crie relatórios personalizados com filtros avançados" },
      { type: "improvement", title: "Performance geral", description: "Carregamento 40% mais rápido em todas as páginas" },
    ],
  },
];

const CURRENT_VERSION = APP_VERSION;
const STORAGE_KEY = "clinicnest_last_seen_version";

export function ChangelogDialog() {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (!lastSeen || lastSeen !== CURRENT_VERSION) {
      setHasUnread(true);
      // Auto-abrir apenas se for uma versão nova (não na primeira visita)
      if (lastSeen) {
        const timer = setTimeout(() => setOpen(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    setHasUnread(false);
    setOpen(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "feature":
        return <Sparkles className="h-4 w-4 text-primary" />;
      case "improvement":
        return <Zap className="h-4 w-4 text-blue-500" />;
      case "fix":
        return <Bug className="h-4 w-4 text-amber-500" />;
      case "breaking":
        return <Wrench className="h-4 w-4 text-red-500" />;
      default:
        return <Check className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "feature":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Novo</Badge>;
      case "improvement":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Melhoria</Badge>;
      case "fix":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Correção</Badge>;
      case "breaking":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Importante</Badge>;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Botão para abrir manualmente (pode ser usado no menu) */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Novidades
        {hasUnread && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Novidades do ClinicNest
            </DialogTitle>
            <DialogDescription>
              Confira as últimas atualizações e melhorias
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-6 py-4">
              {CHANGELOG.map((entry) => (
                <div key={entry.version} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      v{entry.version}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    {entry.version === CURRENT_VERSION && hasUnread && (
                      <Badge className="bg-primary text-primary-foreground">Atual</Badge>
                    )}
                  </div>

                  <div className="space-y-2 pl-2 border-l-2 border-muted">
                    {entry.changes.map((change, idx) => (
                      <div key={idx} className="flex items-start gap-3 py-1">
                        <div className="mt-0.5">{getTypeIcon(change.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{change.title}</span>
                            {getTypeBadge(change.type)}
                          </div>
                          {change.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {change.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button onClick={handleClose} className="gradient-primary text-primary-foreground">
              <Check className="mr-2 h-4 w-4" />
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Hook para verificar se há novidades não lidas
export function useHasUnreadChangelog() {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    setHasUnread(!lastSeen || lastSeen !== CURRENT_VERSION);
  }, []);

  return hasUnread;
}
