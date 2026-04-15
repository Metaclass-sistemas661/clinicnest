import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/integrations/gcp/client";

interface PatientOption {
  id: string;
  name: string;
}

interface PatientComboboxProps {
  tenantId: string | undefined;
  value: string;
  onSelect: (patientId: string, patientName: string) => void;
  placeholder?: string;
  className?: string;
}

export function PatientCombobox({
  tenantId,
  value,
  onSelect,
  placeholder = "Buscar paciente por nome...",
  className,
}: PatientComboboxProps) {
  const PAGE_SIZE = 20;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch selected patient name if value set externally
  useEffect(() => {
    if (!value || selectedName) return;
    if (!tenantId) return;
    void (async () => {
      const { data } = await api
        .from("patients")
        .select("name")
        .eq("id", value)
        .eq("tenant_id", tenantId)
        .single();
      if (data) setSelectedName(data.name);
    })();
  }, [value, tenantId]);

  const searchPatients = useCallback(
    async (term: string, offset = 0) => {
      if (!tenantId || !term.trim()) {
        setResults([]);
        setHasMore(false);
        return;
      }
      if (offset === 0) setIsSearching(true);
      else setIsLoadingMore(true);

      const { data } = await api
        .from("patients")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .ilike("name", `%${term}%`)
        .order("name")
        .range(offset, offset + PAGE_SIZE - 1);

      const fetched = (data ?? []) as PatientOption[];
      if (offset === 0) {
        setResults(fetched);
      } else {
        setResults(prev => [...prev, ...fetched]);
      }
      setHasMore(fetched.length === PAGE_SIZE);
      setIsSearching(false);
      setIsLoadingMore(false);
    },
    [tenantId],
  );

  // Debounced search — fires on every keystroke, no minimum chars
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchPatients(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, searchPatients]);

  const handleSelect = (patient: PatientOption) => {
    setSelectedName(patient.name);
    setQuery("");
    setOpen(false);
    onSelect(patient.id, patient.name);
  };

  const handleClear = () => {
    setSelectedName("");
    setQuery("");
    setResults([]);
    setOpen(false);
    onSelect("", "");
    inputRef.current?.focus();
  };

  // When showing selected patient
  if (value && selectedName) {
    return (
      <div className={cn("relative", className)}>
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate font-medium">{selectedName}</span>
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
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
            if (query.trim()) setOpen(true);
          }}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg">
          <ScrollArea className="max-h-60">
            <div className="py-1">
              {results.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => handleSelect(patient)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{patient.name}</span>
                </button>
              ))}
              {hasMore && (
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={() => void searchPatients(query, results.length)}
                  className="flex w-full items-center justify-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:bg-accent transition-colors"
                >
                  {isLoadingMore ? "Carregando..." : "Carregar mais"}
                </button>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {open && query.trim() && !isSearching && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover p-3 shadow-lg">
          <p className="text-sm text-muted-foreground text-center">
            Nenhum paciente encontrado para &quot;{query}&quot;
          </p>
        </div>
      )}

      {open && isSearching && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover p-3 shadow-lg">
          <p className="text-sm text-muted-foreground text-center">
            Buscando...
          </p>
        </div>
      )}
    </div>
  );
}
