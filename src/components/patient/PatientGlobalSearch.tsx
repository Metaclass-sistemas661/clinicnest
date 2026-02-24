import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Calendar,
  FileText,
  Pill,
  MessageCircle,
  Heart,
  CreditCard,
  Video,
  ClipboardList,
  User,
  Settings,
  CalendarPlus,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  category: string;
}

const searchableItems: SearchResult[] = [
  {
    id: "agendar",
    title: "Agendar Consulta",
    description: "Marque uma nova consulta",
    href: "/paciente/agendar",
    icon: CalendarPlus,
    category: "Ações",
  },
  {
    id: "consultas",
    title: "Minhas Consultas",
    description: "Ver agendamentos e histórico",
    href: "/paciente/consultas",
    icon: Calendar,
    category: "Páginas",
  },
  {
    id: "teleconsulta",
    title: "Teleconsulta",
    description: "Atendimento por vídeo",
    href: "/paciente/teleconsulta",
    icon: Video,
    category: "Páginas",
  },
  {
    id: "saude",
    title: "Minha Saúde",
    description: "Histórico médico e sinais vitais",
    href: "/paciente/saude",
    icon: Heart,
    category: "Páginas",
  },
  {
    id: "mensagens",
    title: "Mensagens",
    description: "Conversar com a clínica",
    href: "/paciente/mensagens",
    icon: MessageCircle,
    category: "Páginas",
  },
  {
    id: "financeiro",
    title: "Financeiro",
    description: "Faturas e pagamentos",
    href: "/paciente/financeiro",
    icon: CreditCard,
    category: "Páginas",
  },
  {
    id: "exames",
    title: "Exames e Laudos",
    description: "Resultados de exames",
    href: "/paciente/exames",
    icon: FileText,
    category: "Páginas",
  },
  {
    id: "receitas",
    title: "Receitas",
    description: "Prescrições médicas",
    href: "/paciente/receitas",
    icon: Pill,
    category: "Páginas",
  },
  {
    id: "atestados",
    title: "Atestados",
    description: "Atestados médicos",
    href: "/paciente/atestados",
    icon: ClipboardList,
    category: "Páginas",
  },
  {
    id: "perfil",
    title: "Meu Perfil",
    description: "Dados pessoais",
    href: "/paciente/perfil",
    icon: User,
    category: "Configurações",
  },
  {
    id: "configuracoes",
    title: "Configurações",
    description: "Preferências do portal",
    href: "/paciente/configuracoes",
    icon: Settings,
    category: "Configurações",
  },
];

interface PatientGlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatientGlobalSearch({ open, onOpenChange }: PatientGlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredResults = query.trim()
    ? searchableItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase())
      )
    : searchableItems;

  const groupedResults = filteredResults.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onOpenChange(false);
      navigate(result.href);
    },
    [navigate, onOpenChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredResults.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredResults[selectedIndex]) {
          handleSelect(filteredResults[selectedIndex]);
        }
      }
    },
    [filteredResults, selectedIndex, handleSelect]
  );

  let flatIndex = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="sr-only">Buscar no portal</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar páginas, ações..."
              className="pl-9 pr-4"
            />
          </div>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {filteredResults.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado
            </div>
          ) : (
            Object.entries(groupedResults).map(([category, items]) => (
              <div key={category} className="mb-2">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {category}
                </div>
                {items.map((item) => {
                  const currentIndex = flatIndex++;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                        currentIndex === selectedIndex
                          ? "bg-teal-50 dark:bg-teal-950/50"
                          : "hover:bg-muted"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg",
                          currentIndex === selectedIndex
                            ? "bg-teal-100 dark:bg-teal-900"
                            : "bg-muted"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            currentIndex === selectedIndex
                              ? "text-teal-600 dark:text-teal-400"
                              : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{item.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="border-t p-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
            <span>navegar</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd>
            <span>selecionar</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
            <span>fechar</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function usePatientGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { isOpen, setIsOpen };
}
