// Componente de Autocomplete otimizado para TUSS Odontológico
// Busca por código ou descrição, filtro por categoria

import * as React from "react";
import { Check, ChevronsUpDown, Search, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  searchTussOdonto,
  ODONTO_CATEGORIES,
  type TussOdontoEntry,
  type OdontoCategory,
} from "@/data/tuss-odonto-index";
import { getPriceByRegion, type Region } from "@/data/tuss-odonto-precos";

interface TussOdontoComboboxProps {
  value?: string;
  onSelect: (entry: TussOdontoEntry | null) => void;
  placeholder?: string;
  disabled?: boolean;
  showPrice?: boolean;
  region?: Region;
  defaultCategory?: OdontoCategory;
  allowCategoryFilter?: boolean;
  className?: string;
}

export function TussOdontoCombobox({
  value,
  onSelect,
  placeholder = "Buscar procedimento odontológico...",
  disabled = false,
  showPrice = false,
  region = "SP",
  defaultCategory,
  allowCategoryFilter = true,
  className,
}: TussOdontoComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<OdontoCategory | "all">(
    defaultCategory || "all"
  );
  const [results, setResults] = React.useState<TussOdontoEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = React.useState<TussOdontoEntry | null>(null);

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length >= 2 || category !== "all") {
        const searchResults = searchTussOdonto(search, {
          category: category === "all" ? undefined : category,
          limit: 50,
        });
        setResults(searchResults);
      } else {
        setResults([]);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [search, category]);

  // Load selected entry when value changes
  React.useEffect(() => {
    if (value) {
      const entry = searchTussOdonto(value, { limit: 1 })[0];
      if (entry && entry.code === value) {
        setSelectedEntry(entry);
      }
    } else {
      setSelectedEntry(null);
    }
  }, [value]);

  const handleSelect = (entry: TussOdontoEntry) => {
    setSelectedEntry(entry);
    onSelect(entry);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEntry(null);
    onSelect(null);
    setSearch("");
  };

  const getCategoryInfo = (key: string) => {
    return ODONTO_CATEGORIES.find((c) => c.key === key);
  };

  const getScopeLabel = (scope: TussOdontoEntry["scope"]) => {
    const labels: Record<TussOdontoEntry["scope"], string> = {
      dente: "Por dente",
      arcada: "Por arcada",
      hemiarcada: "Por hemiarcada",
      boca: "Boca toda",
      sessao: "Por sessão",
    };
    return labels[scope];
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {allowCategoryFilter && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as OdontoCategory | "all")}
          >
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Filtrar por categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {ODONTO_CATEGORIES.map((cat) => (
                <SelectItem key={cat.key} value={cat.key}>
                  <span className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between h-auto min-h-10 py-2",
              !selectedEntry && "text-muted-foreground"
            )}
          >
            {selectedEntry ? (
              <div className="flex flex-col items-start gap-1 text-left flex-1 mr-2">
                <div className="flex items-center gap-2 w-full">
                  <Badge variant="outline" className="text-xs font-mono">
                    {selectedEntry.code}
                  </Badge>
                  {getCategoryInfo(selectedEntry.category) && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        getCategoryInfo(selectedEntry.category)?.color
                      )}
                    >
                      {getCategoryInfo(selectedEntry.category)?.icon}{" "}
                      {getCategoryInfo(selectedEntry.category)?.name}
                    </Badge>
                  )}
                </div>
                <span className="text-sm font-medium truncate max-w-full">
                  {selectedEntry.description}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{getScopeLabel(selectedEntry.scope)}</span>
                  {showPrice && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-green-600">
                        {getPriceByRegion(selectedEntry.code, region)
                          ? `R$ ${getPriceByRegion(selectedEntry.code, region)?.toLocaleString("pt-BR")}`
                          : "Preço não disponível"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                {placeholder}
              </span>
            )}
            <div className="flex items-center gap-1">
              {selectedEntry && (
                <X
                  className="h-4 w-4 opacity-50 hover:opacity-100 cursor-pointer"
                  onClick={handleClear}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[500px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Digite código ou descrição..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {search.length < 2
                  ? "Digite pelo menos 2 caracteres para buscar"
                  : "Nenhum procedimento encontrado"}
              </CommandEmpty>
              <ScrollArea className="h-[300px]">
                {results.length > 0 && (
                  <CommandGroup>
                    {results.map((entry) => {
                      const catInfo = getCategoryInfo(entry.category);
                      const price = showPrice
                        ? getPriceByRegion(entry.code, region)
                        : null;

                      return (
                        <CommandItem
                          key={entry.code}
                          value={entry.code}
                          onSelect={() => handleSelect(entry)}
                          className="flex flex-col items-start gap-1 py-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 w-full">
                            <Check
                              className={cn(
                                "h-4 w-4",
                                selectedEntry?.code === entry.code
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <Badge
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              {entry.code}
                            </Badge>
                            {catInfo && (
                              <Badge
                                variant="secondary"
                                className={cn("text-xs", catInfo.color)}
                              >
                                {catInfo.icon}
                              </Badge>
                            )}
                            {price && (
                              <span className="ml-auto text-xs font-medium text-green-600">
                                R$ {price.toLocaleString("pt-BR")}
                              </span>
                            )}
                          </div>
                          <span className="text-sm ml-6 text-left">
                            {entry.description}
                          </span>
                          <span className="text-xs text-muted-foreground ml-6">
                            {getScopeLabel(entry.scope)}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Componente simplificado para seleção rápida
interface TussOdontoQuickSelectProps {
  category: OdontoCategory;
  onSelect: (entry: TussOdontoEntry) => void;
  limit?: number;
}

export function TussOdontoQuickSelect({
  category,
  onSelect,
  limit = 10,
}: TussOdontoQuickSelectProps) {
  const [entries, setEntries] = React.useState<TussOdontoEntry[]>([]);

  React.useEffect(() => {
    const results = searchTussOdonto("", { category, limit });
    setEntries(results);
  }, [category, limit]);

  const catInfo = ODONTO_CATEGORIES.find((c) => c.key === category);

  return (
    <div className="space-y-2">
      {catInfo && (
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{catInfo.icon}</span>
          <span>{catInfo.name}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {entries.map((entry) => (
          <Badge
            key={entry.code}
            variant="outline"
            className="cursor-pointer hover:bg-accent"
            onClick={() => onSelect(entry)}
          >
            {entry.code} - {entry.description.slice(0, 30)}
            {entry.description.length > 30 ? "..." : ""}
          </Badge>
        ))}
      </div>
    </div>
  );
}
