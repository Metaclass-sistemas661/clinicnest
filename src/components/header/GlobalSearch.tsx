import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, User, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  name: string;
  phone?: string | null;
  cpf?: string | null;
  email?: string | null;
}

export function GlobalSearch() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (term: string) => {
    if (!profile?.tenant_id || term.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const cleaned = term.replace(/[.\-/()]/g, "");
      const isNumeric = /^\d+$/.test(cleaned);

      let q = supabase
        .from("clients")
        .select("id, name, phone, cpf, email")
        .eq("tenant_id", profile.tenant_id)
        .limit(8);

      if (isNumeric) {
        q = q.or(`cpf.ilike.%${cleaned}%,phone.ilike.%${cleaned}%`);
      } else {
        q = q.or(`name.ilike.%${term}%,email.ilike.%${term}%,cpf.ilike.%${term}%`);
      }

      const { data } = await q.order("name");
      setResults((data as SearchResult[]) || []);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  const handleSelect = (client: SearchResult) => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    navigate(`/clientes?detail=${client.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0 && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setSelectedIndex(-1); }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar paciente... (Ctrl+K)"
          className="h-8 w-48 lg:w-64 pl-8 pr-8 text-xs"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setIsOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && (query.length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border bg-popover shadow-lg max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Nenhum paciente encontrado
            </div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors",
                  i === selectedIndex && "bg-accent"
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[r.phone, r.cpf, r.email].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
