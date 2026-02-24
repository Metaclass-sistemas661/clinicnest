import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, User, Users, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dependent, getRelationshipLabel } from "@/hooks/useDependents";

interface DependentSelectorProps {
  dependents: Dependent[];
  selectedDependent: Dependent | null;
  onSelect: (dependent: Dependent | null) => void;
  userName?: string;
  disabled?: boolean;
  className?: string;
}

export function DependentSelector({
  dependents,
  selectedDependent,
  onSelect,
  userName = "Eu mesmo",
  disabled = false,
  className,
}: DependentSelectorProps) {
  const [open, setOpen] = useState(false);

  if (dependents.length === 0) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const selectedName = selectedDependent?.dependent_name || userName;
  const isViewingSelf = selectedDependent === null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-2 h-auto py-2 px-3 justify-start",
            !isViewingSelf && "border-teal-300 bg-teal-50/50 dark:border-teal-700 dark:bg-teal-950/30",
            className
          )}
          disabled={disabled}
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className={cn(
              "text-xs",
              isViewingSelf 
                ? "bg-primary/10 text-primary" 
                : "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300"
            )}>
              {isViewingSelf ? <User className="h-3.5 w-3.5" /> : getInitials(selectedName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start text-left">
            <span className="text-xs text-muted-foreground">Agendando para:</span>
            <span className="text-sm font-medium">{selectedName}</span>
          </div>
          <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Para quem é o agendamento?
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Self option */}
        <DropdownMenuItem
          onClick={() => {
            onSelect(null);
            setOpen(false);
          }}
          className="flex items-center gap-3 py-2.5"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">Eu mesmo</p>
          </div>
          {isViewingSelf && <Check className="h-4 w-4 text-teal-600" />}
        </DropdownMenuItem>

        {dependents.length > 0 && <DropdownMenuSeparator />}

        {/* Dependents */}
        {dependents.map((dep) => {
          const isSelected = selectedDependent?.dependent_id === dep.dependent_id;
          return (
            <DropdownMenuItem
              key={dep.dependent_id}
              onClick={() => {
                onSelect(dep);
                setOpen(false);
              }}
              className="flex items-center gap-3 py-2.5"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 text-xs">
                  {getInitials(dep.dependent_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">{dep.dependent_name}</p>
                <p className="text-xs text-muted-foreground">
                  {getRelationshipLabel(dep.relationship)}
                </p>
              </div>
              {isSelected && <Check className="h-4 w-4 text-teal-600" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DependentBannerProps {
  dependent: Dependent;
  onClear: () => void;
}

export function DependentBanner({ dependent, onClear }: DependentBannerProps) {
  return (
    <div className="bg-teal-50 dark:bg-teal-950/40 border-b border-teal-200 dark:border-teal-800 px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          <span className="text-sm text-teal-700 dark:text-teal-300">
            Você está vendo como:{" "}
            <strong>{dependent.dependent_name}</strong>
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {getRelationshipLabel(dependent.relationship)}
            </Badge>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-teal-600 hover:text-teal-700 hover:bg-teal-100 dark:text-teal-400 dark:hover:bg-teal-900 h-7 text-xs"
        >
          Voltar para minha conta
        </Button>
      </div>
    </div>
  );
}
