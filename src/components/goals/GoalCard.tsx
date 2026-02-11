import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MoreVertical,
  TrendingUp,
  Edit,
  Archive,
  Copy,
  Star,
  StarOff,
  ChevronDown,
} from "lucide-react";
import {
  goalTypeLabels,
  periodLabels,
  getProgressBorderColor,
  getProgressIndicatorClass,
  getProjectedBadgeVariant,
  type GoalWithProgress,
  type GoalType,
  type GoalPeriod,
} from "@/lib/goals";

interface Profile {
  id: string;
  full_name: string;
}

interface Product {
  id: string;
  name: string;
}

interface GoalCardProps {
  goal: GoalWithProgress;
  professionals: Profile[];
  products: Product[];
  formatCurrency: (v: number) => string;
  formatValue: (g: GoalWithProgress) => string;
  onToggleHeader: (goal: GoalWithProgress) => void;
  onArchive: (goal: GoalWithProgress) => void;
  onDuplicate: (goal: GoalWithProgress) => void;
  onEdit: (goal: GoalWithProgress, data: EditData) => Promise<void>;
  onViewDetail?: (goal: GoalWithProgress) => void;
}

export interface EditData {
  name: string;
  goal_type: GoalType;
  target_value: number;
  period: GoalPeriod;
  professional_id: string | null;
  product_id: string | null;
  show_in_header: boolean;
}

export function GoalCard({
  goal,
  professionals,
  products,
  formatCurrency: _formatCurrency,
  formatValue,
  onToggleHeader,
  onArchive,
  onDuplicate,
  onEdit,
  onViewDetail,
}: GoalCardProps) {
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const pct = Math.min(100, goal.progress_pct);
  const indicatorClass = getProgressIndicatorClass(pct);
  const borderColor = getProgressBorderColor(pct);

  const professional = goal.professional_id
    ? professionals.find((p) => p.id === goal.professional_id)
    : null;
  const product = goal.product_id ? products.find((p) => p.id === goal.product_id) : null;

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await onArchive(goal);
      setShowArchiveDialog(false);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <>
      <Card
        className={`overflow-hidden transition-all hover:shadow-md ${borderColor} border-l-4`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base">{goal.name}</CardTitle>
              <CardDescription className="flex flex-wrap gap-x-1 gap-y-0.5 text-xs mt-1">
                <span>{goalTypeLabels[goal.goal_type as GoalType]}</span>
                <span>·</span>
                <span>{periodLabels[goal.period as GoalPeriod]}</span>
                {professional && (
                  <>
                    <span>·</span>
                    <span>{professional.full_name}</span>
                  </>
                )}
                {product && (
                  <>
                    <span>·</span>
                    <span>{product.name}</span>
                  </>
                )}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onViewDetail && (
                  <DropdownMenuItem onClick={() => onViewDetail(goal)}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Ver detalhes
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() =>
                    onEdit(goal, {
                      name: goal.name,
                      goal_type: goal.goal_type as GoalType,
                      target_value: goal.target_value,
                      period: goal.period as GoalPeriod,
                      professional_id: goal.professional_id,
                      product_id: goal.product_id,
                      show_in_header: goal.show_in_header,
                    })
                  }
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggleHeader(goal)}>
                  {goal.show_in_header ? (
                    <>
                      <StarOff className="mr-2 h-4 w-4" />
                      Remover do cabeçalho
                    </>
                  ) : (
                    <>
                      <Star className="mr-2 h-4 w-4" />
                      Exibir no cabeçalho
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDuplicate(goal)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowArchiveDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Arquivar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm font-medium">{formatValue(goal)}</p>
          <Progress value={pct} className={`h-2 ${indicatorClass}`} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              {goal.progress_pct >= 100 ? "Meta concluída!" : `${Math.round(goal.progress_pct)}%`}
            </span>
            {goal.days_remaining != null && goal.days_remaining > 0 && (
              <span className="text-muted-foreground">{goal.days_remaining} dias restantes</span>
            )}
            {goal.projected_reach && goal.progress_pct < 100 && (
              <Badge variant={getProjectedBadgeVariant(goal.projected_reach)}>
                {goal.projected_reach}
              </Badge>
            )}
          </div>
          {onViewDetail && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => onViewDetail(goal)}
            >
              <TrendingUp className="h-4 w-4" />
              Ver evolução e comparativo
              <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
            </Button>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar meta?</AlertDialogTitle>
            <AlertDialogDescription>
              A meta "{goal.name}" será arquivada e não aparecerá mais na lista de metas ativas.
              Você pode desarquivá-la depois se necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={isArchiving}>
              {isArchiving ? "Arquivando..." : "Arquivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
