import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import { TUSS_DATA, type TussEntry } from "@/data/tuss";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (code: string, description?: string) => void;
  placeholder?: string;
  className?: string;
}

export function TussCombobox({ value, onChange, placeholder, className }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => TUSS_DATA.find((e) => e.code === value),
    [value],
  );

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return TUSS_DATA.filter(
      (e) =>
        e.code.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q),
    ).slice(0, 30);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (entry: TussEntry) => {
    onChange(entry.code, entry.description);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    onChange("", "");
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {value && selected ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <Badge variant="outline" className="font-mono shrink-0">
            {selected.code}
          </Badge>
          <span className="truncate text-muted-foreground">{selected.description}</span>
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => query.length >= 2 && setOpen(true)}
            placeholder={placeholder || "Buscar TUSS (código ou procedimento)..."}
            className="pl-9 font-mono"
          />
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg">
          <ScrollArea className="max-h-60">
            <div className="py-1">
              {results.map((entry) => (
                <button
                  key={entry.code}
                  type="button"
                  onClick={() => handleSelect(entry)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                >
                  <Badge variant="outline" className="font-mono text-xs shrink-0">
                    {entry.code}
                  </Badge>
                  <span className="truncate">{entry.description}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover p-3 shadow-lg">
          <p className="text-sm text-muted-foreground text-center">
            Nenhum procedimento TUSS encontrado para "{query}"
          </p>
        </div>
      )}
    </div>
  );
}
