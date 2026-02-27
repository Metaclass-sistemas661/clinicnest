import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Keyboard, Search, Settings2 } from "lucide-react";

interface Shortcut {
  id: string;
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  // Navegação
  { id: "search", keys: ["Ctrl", "K"], description: "Abrir busca global", category: "Navegação" },
  { id: "go-dashboard", keys: ["G", "H"], description: "Ir para Dashboard", category: "Navegação" },
  { id: "go-agenda", keys: ["G", "A"], description: "Ir para Agenda", category: "Navegação" },
  { id: "go-patients", keys: ["G", "P"], description: "Ir para Pacientes", category: "Navegação" },
  { id: "go-records", keys: ["G", "R"], description: "Ir para Prontuários", category: "Navegação" },
  { id: "go-finance", keys: ["G", "F"], description: "Ir para Financeiro", category: "Navegação" },
  { id: "go-procedures", keys: ["G", "S"], description: "Ir para Procedimentos", category: "Navegação" },
  { id: "go-settings", keys: ["G", "C"], description: "Ir para Configurações", category: "Navegação" },
  
  // Ações Rápidas
  { id: "new-appointment", keys: ["Ctrl", "N"], description: "Novo agendamento", category: "Ações Rápidas" },
  { id: "new-patient", keys: ["Ctrl", "Shift", "N"], description: "Novo paciente", category: "Ações Rápidas" },
  { id: "save", keys: ["Ctrl", "S"], description: "Salvar formulário", category: "Ações Rápidas" },
  { id: "refresh", keys: ["Ctrl", "R"], description: "Atualizar dados", category: "Ações Rápidas" },
  { id: "print", keys: ["Ctrl", "P"], description: "Imprimir", category: "Ações Rápidas" },
  
  // Agenda
  { id: "agenda-today", keys: ["T"], description: "Ir para hoje", category: "Agenda" },
  { id: "agenda-prev", keys: ["←"], description: "Dia/semana anterior", category: "Agenda" },
  { id: "agenda-next", keys: ["→"], description: "Próximo dia/semana", category: "Agenda" },
  { id: "agenda-view-day", keys: ["D"], description: "Visualização diária", category: "Agenda" },
  { id: "agenda-view-week", keys: ["W"], description: "Visualização semanal", category: "Agenda" },
  { id: "agenda-view-month", keys: ["M"], description: "Visualização mensal", category: "Agenda" },
  
  // Modais e Navegação
  { id: "close-modal", keys: ["Esc"], description: "Fechar modal/drawer", category: "Modais" },
  { id: "help", keys: ["?"], description: "Abrir atalhos de teclado", category: "Modais" },
  { id: "help-alt", keys: ["Ctrl", "/"], description: "Abrir atalhos de teclado", category: "Modais" },
  { id: "toggle-sidebar", keys: ["["], description: "Expandir/recolher sidebar", category: "Modais" },
  { id: "toggle-theme", keys: ["Ctrl", "Shift", "T"], description: "Alternar tema claro/escuro", category: "Modais" },
  
  // Tabelas
  { id: "table-up", keys: ["↑"], description: "Linha anterior", category: "Tabelas" },
  { id: "table-down", keys: ["↓"], description: "Próxima linha", category: "Tabelas" },
  { id: "table-open", keys: ["Enter"], description: "Abrir item selecionado", category: "Tabelas" },
  { id: "table-delete", keys: ["Delete"], description: "Excluir item selecionado", category: "Tabelas" },
  { id: "table-edit", keys: ["E"], description: "Editar item selecionado", category: "Tabelas" },
  { id: "table-select-all", keys: ["Ctrl", "A"], description: "Selecionar todos", category: "Tabelas" },
  
  // Prontuário
  { id: "record-save", keys: ["Ctrl", "Enter"], description: "Salvar evolução", category: "Prontuário" },
  { id: "record-template", keys: ["Ctrl", "T"], description: "Inserir template", category: "Prontuário" },
  { id: "record-prescription", keys: ["Ctrl", "Shift", "R"], description: "Nova receita", category: "Prontuário" },
  { id: "record-certificate", keys: ["Ctrl", "Shift", "A"], description: "Novo atestado", category: "Prontuário" },
];

const CATEGORIES = ["Navegação", "Ações Rápidas", "Agenda", "Modais", "Tabelas", "Prontuário"];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

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

  const filteredShortcuts = search
    ? SHORTCUTS.filter(s => 
        s.description.toLowerCase().includes(search.toLowerCase()) ||
        s.keys.join(" ").toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase())
      )
    : SHORTCUTS;

  const filteredCategories = search
    ? CATEGORIES.filter(cat => filteredShortcuts.some(s => s.category === cat))
    : CATEGORIES;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atalhos de Teclado
          </DialogTitle>
          <DialogDescription>
            Use estes atalhos para navegar mais rapidamente pelo sistema
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar atalho..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {filteredCategories.map((category) => {
            const categoryShortcuts = filteredShortcuts.filter((s) => s.category === category);
            if (categoryShortcuts.length === 0) return null;

            return (
              <div key={category}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  {category}
                  <Badge variant="secondary" className="text-xs">{categoryShortcuts.length}</Badge>
                </h3>
                <div className="space-y-1">
                  {categoryShortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
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

          {filteredShortcuts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Keyboard className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum atalho encontrado para "{search}"</p>
            </div>
          )}
        </div>

        <div className="border-t pt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Pressione <kbd className="px-1.5 py-0.5 text-xs bg-muted border rounded">?</kbd> ou{" "}
            <kbd className="px-1.5 py-0.5 text-xs bg-muted border rounded">
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+/
            </kbd>{" "}
            a qualquer momento para ver esta lista
          </p>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Export shortcuts for use in other components
export { SHORTCUTS };
export type { Shortcut };
