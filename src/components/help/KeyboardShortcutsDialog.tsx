import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Keyboard } from "lucide-react";

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  // Navegação
  { keys: ["Ctrl", "K"], description: "Abrir busca global", category: "Navegação" },
  { keys: ["G", "H"], description: "Ir para Dashboard", category: "Navegação" },
  { keys: ["G", "A"], description: "Ir para Agenda", category: "Navegação" },
  { keys: ["G", "P"], description: "Ir para Pacientes", category: "Navegação" },
  { keys: ["G", "R"], description: "Ir para Prontuários", category: "Navegação" },
  
  // Ações
  { keys: ["Ctrl", "N"], description: "Novo agendamento", category: "Ações" },
  { keys: ["Ctrl", "Shift", "N"], description: "Novo paciente", category: "Ações" },
  { keys: ["Ctrl", "S"], description: "Salvar formulário", category: "Ações" },
  
  // Modais
  { keys: ["Esc"], description: "Fechar modal/drawer", category: "Modais" },
  { keys: ["?"], description: "Abrir atalhos de teclado", category: "Modais" },
  { keys: ["Ctrl", "/"], description: "Abrir atalhos de teclado", category: "Modais" },
  
  // Tabelas
  { keys: ["↑", "↓"], description: "Navegar entre linhas", category: "Tabelas" },
  { keys: ["Enter"], description: "Abrir item selecionado", category: "Tabelas" },
  { keys: ["Delete"], description: "Excluir item selecionado", category: "Tabelas" },
];

const CATEGORIES = ["Navegação", "Ações", "Modais", "Tabelas"];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ? key (without modifiers)
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        setOpen(true);
      }
      
      // Ctrl+/ or Cmd+/
      if (e.key === "/" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atalhos de Teclado
          </DialogTitle>
          <DialogDescription>
            Use estes atalhos para navegar mais rapidamente pelo sistema
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {CATEGORIES.map((category) => {
            const categoryShortcuts = SHORTCUTS.filter((s) => s.category === category);
            if (categoryShortcuts.length === 0) return null;

            return (
              <div key={category}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIdx) => (
                          <span key={keyIdx} className="flex items-center gap-1">
                            <kbd className="px-2 py-1 text-xs font-semibold bg-muted border rounded-md shadow-sm min-w-[24px] text-center">
                              {key === "Ctrl" && navigator.platform.includes("Mac") ? "⌘" : key}
                            </kbd>
                            {keyIdx < shortcut.keys.length - 1 && (
                              <span className="text-muted-foreground text-xs">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground text-center">
            Pressione <kbd className="px-1.5 py-0.5 text-xs bg-muted border rounded">?</kbd> ou{" "}
            <kbd className="px-1.5 py-0.5 text-xs bg-muted border rounded">
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+/
            </kbd>{" "}
            a qualquer momento para ver esta lista
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
