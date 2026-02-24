import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodedEntry {
  code: string;
  label: string;
}

interface Props<T extends CodedEntry> {
  items: T[];
  value: string;
  onChange: (code: string, label: string) => void;
  placeholder?: string;
  className?: string;
  badgeColor?: string;
  groupKey?: keyof T;
}

export function NandaNicNocCombobox<T extends CodedEntry>({
  items,
  value,
  onChange,
  placeholder = "Buscar por código ou nome...",
  className,
  badgeColor,
  groupKey,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => items.find((e) => e.code === value), [value, items]);

  const results = useMemo(() => {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    return items
      .filter((e) => e.code.toLowerCase().includes(q) || e.label.toLowerCase().includes(q))
      .slice(0, 30);
  }, [query, items]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (entry: CodedEntry) => {
    onChange(entry.code, entry.label);
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
          <Badge variant="outline" className={cn("font-mono shrink-0 text-[10px]", badgeColor)}>
            {selected.code}
          </Badge>
          <span className="truncate text-muted-foreground">{selected.label}</span>
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
            onFocus={() => {
              if (query.length >= 1) setOpen(true);
            }}
            placeholder={placeholder}
            className="pl-9"
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
                  <Badge variant="outline" className={cn("font-mono text-[10px] shrink-0", badgeColor)}>
                    {entry.code}
                  </Badge>
                  <span className="truncate">{entry.label}</span>
                  {groupKey && (
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                      {String(entry[groupKey])}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {open && query.length >= 1 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover p-3 shadow-lg">
          <p className="text-sm text-muted-foreground text-center">
            Nenhum resultado para "{query}"
          </p>
        </div>
      )}
    </div>
  );
}
