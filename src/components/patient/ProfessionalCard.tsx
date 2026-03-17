import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Professional {
  id: string;
  full_name: string;
  avatar_url: string | null;
  professional_type: string;
  council_type: string | null;
  council_number: string | null;
  council_state: string | null;
  avg_rating: number;
}

interface ProfessionalCardProps {
  professional: Professional;
  isSelected: boolean;
  onSelect: () => void;
}

const professionalTypeLabels: Record<string, string> = {
  medico: "Médico(a)",
  dentista: "Dentista",
  enfermeiro: "Enfermeiro(a)",
  fisioterapeuta: "Fisioterapeuta",
  nutricionista: "Nutricionista",
  psicologo: "Psicólogo(a)",
  fonoaudiologo: "Fonoaudiólogo(a)",
  tec_enfermagem: "Téc. Enfermagem",
  secretaria: "Secretária",
  faturista: "Faturista",
  admin: "Administrador",
};

export function ProfessionalCard({
  professional,
  isSelected,
  onSelect,
}: ProfessionalCardProps) {
  const councilInfo =
    professional.council_type && professional.council_number
      ? `${professional.council_type} ${professional.council_number}${
          professional.council_state ? `-${professional.council_state}` : ""
        }`
      : null;

  const typeLabel =
    professionalTypeLabels[professional.professional_type] ||
    professional.professional_type;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isSelected
          ? "ring-2 ring-teal-500 border-teal-500 bg-teal-50/50 dark:bg-teal-950/30"
          : "hover:border-teal-200"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {professional.avatar_url ? (
              <img
                src={professional.avatar_url}
                alt={professional.full_name}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center">
                <User className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">
              {professional.full_name}
            </h3>
            <p className="text-xs text-muted-foreground">{typeLabel}</p>
            {councilInfo && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {councilInfo}
              </p>
            )}
          </div>

          {/* Rating */}
          {professional.avg_rating > 0 && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 text-xs"
            >
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {professional.avg_rating.toFixed(1)}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ProfessionalListProps {
  professionals: Professional[];
  selectedId: string | null;
  onSelect: (professional: Professional) => void;
  isLoading?: boolean;
}

export function ProfessionalList({
  professionals,
  selectedId,
  onSelect,
  isLoading,
}: ProfessionalListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (professionals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum profissional disponível</p>
        <p className="text-xs mt-1">Selecione outro procedimento</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {professionals.map((professional) => (
        <ProfessionalCard
          key={professional.id}
          professional={professional}
          isSelected={selectedId === professional.id}
          onSelect={() => onSelect(professional)}
        />
      ))}
    </div>
  );
}
