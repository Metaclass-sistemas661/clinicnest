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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star, MoreVertical, Pencil, Copy, Archive, Loader2, TrendingUp, ChevronDown } from "lucide-react";
import type { GoalWithProgress, GoalType, GoalPeriod } from "@/lib/goals";
import {
  goalTypeLabels,
  periodLabels,
  getProgressBorderColor,
  getProgressIndicatorClass,
  getProjectedBadgeVariant,
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
  formatCurrency,
  formatValue,
  onToggleHeader,
  onArchive,
  onDuplicate,
  onEdit,
  onViewDetail,
}: GoalCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<EditData>({
    name: goal.name,
    goal_type: goal.goal_type,
    target_value: goal.target_value,
    period: goal.period,
    professional_id: goal.professional_id,
    product_id: goal.product_id,
    show_in_header: goal.show_in_header,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      await onEdit(goal, editData);
      setEditOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const pct = Math.min(100, goal.progress_pct);
  const indicatorClass = getProgressIndicatorClass(pct);
  const borderColor = getProgressBorderColor(pct);
  const canHaveProfessional =
    goal.goal_type === "revenue" ||
    goal.goal_type === "services_count" ||
    goal.goal_type === "clientes_novos" ||
    goal.goal_type === "ticket_medio";
  const canHaveProduct =
    goal.goal_type === "product_quantity" || goal.goal_type === "product_revenue";

  return (
    <>
      <Card
        className={`overflow-hidden transition-all hover:shadow-md ${borderColor} border-l-4 ${
          goal.archived_at ? "opacity-75" : ""
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base flex items-center gap-2 truncate">
                {goal.name}
                {goal.show_in_header && (
                  <Star
                    className="h-4 w-4 text-primary fill-primary shrink-0"
                    title="Exibida no cabeçalho"
                  />
                )}
              </CardTitle>
              <CardDescription className="flex flex-wrap gap-x-1 gap-y-0.5 text-xs">
                <span>{goalTypeLabels[goal.goal_type as GoalType]}</span>
                <span>·</span>
                <span>{periodLabels[goal.period as GoalPeriod]}</span>
                {goal.professional_id && (
                  <>
                    <span>·</span>
                    <span>
                      {professionals.find((p) => p.id === goal.professional_id)?.full_name ||
                        "Profissional"}
                    </span>
                  </>
                )}
                {goal.product_id && (
                  <>
                    <span>·</span>
                    <span>
                      {products.find((p) => p.id === goal.product_id)?.name || "Produto"}
                    </span>
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
                <DropdownMenuItem
                  onClick={() => {
                    setEditData({
                      name: goal.name,
                      goal_type: goal.goal_type as GoalType,
                      target_value: goal.target_value,
                      period: goal.period as GoalPeriod,
                      professional_id: goal.professional_id,
                      product_id: goal.product_id,
                      show_in_header: goal.show_in_header,
                    });
                    setEditOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(goal)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggleHeader(goal)}>
                  <Star className="mr-2 h-4 w-4" />
                  {goal.show_in_header ? "Remover do cabeçalho" : "Exibir no cabeçalho"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onArchive(goal)}
                  className="text-amber-600 focus:text-amber-600"
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
              {goal.progress_pct >= 100
                ? "Meta concluída!"
                : `${Math.round(goal.progress_pct)}%`}
            </span>
            {goal.days_remaining != null && goal.days_remaining > 0 && (
              <span className="text-muted-foreground">
                {goal.days_remaining} dias restantes
              </span>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar meta</DialogTitle>
            <DialogDescription>Altere os dados da meta</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                placeholder="Ex: Receita do mês"
              />
            </div>
            <div>
              <Label>Valor da meta</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editData.target_value}
                onChange={(e) =>
                  setEditData({ ...editData, target_value: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label>Período</Label>
              <Select
                value={editData.period}
                onValueChange={(v) => setEditData({ ...editData, period: v as GoalPeriod })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{periodLabels.weekly}</SelectItem>
                  <SelectItem value="monthly">{periodLabels.monthly}</SelectItem>
                  <SelectItem value="quarterly">{periodLabels.quarterly}</SelectItem>
                  <SelectItem value="yearly">{periodLabels.yearly}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canHaveProfessional && (
              <div>
                <Label>Profissional (opcional)</Label>
                <Select
                  value={editData.professional_id || "all"}
                  onValueChange={(v) =>
                    setEditData({
                      ...editData,
                      professional_id: v === "all" ? null : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Salão todo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Salão todo</SelectItem>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {canHaveProduct && (
              <div>
                <Label>Produto (opcional)</Label>
                <Select
                  value={editData.product_id || "all"}
                  onValueChange={(v) =>
                    setEditData({
                      ...editData,
                      product_id: v === "all" ? null : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit_show_header"
                checked={editData.show_in_header}
                onChange={(e) =>
                  setEditData({ ...editData, show_in_header: e.target.checked })
                }
                className="rounded"
              />
              <Label htmlFor="edit_show_header" className="cursor-pointer">
                Exibir no cabeçalho
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
