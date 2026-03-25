import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Coins,
  Trophy,
  Plus,
  Trash2,
  Save,
  Loader2,
  Users,
  ArrowUp,
  ArrowDown,
  Clock,
  TrendingUp,
  Settings2,
  Star,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useHealthCreditRules,
  useHealthCreditsLeaderboard,
  usePatientCreditsHistory,
  useAdjustCredits,
  useRedemptionConfig,
  getTriggerLabel,
  TRIGGER_OPTIONS,
  type HealthCreditRule,
  type HealthCreditTransaction,
} from "@/hooks/useHealthCredits";
import { cn } from "@/lib/utils";

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  bronze: { label: "Bronze", color: "bg-amber-700 text-white" },
  silver: { label: "Prata", color: "bg-gray-400 text-white" },
  gold: { label: "Ouro", color: "bg-yellow-500 text-white" },
  platinum: { label: "Platina", color: "bg-gray-700 text-white" },
};

// ── Rule Form Dialog ──────────────────────────────────────────────────
function RuleFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Partial<HealthCreditRule> | null;
  onSave: (rule: Partial<HealthCreditRule>) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [trigger, setTrigger] = useState(initial?.trigger_type ?? "appointment_completed");
  const [points, setPoints] = useState(initial?.points ?? 10);
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [expiryDays, setExpiryDays] = useState(initial?.expiry_days ?? 365);
  const [maxPerDay, setMaxPerDay] = useState<number | "">(initial?.max_per_day ?? "");

  const handleSave = () => {
    onSave({
      id: initial?.id,
      name,
      trigger_type: trigger,
      points,
      description: desc,
      expiry_days: expiryDays,
      max_per_day: maxPerDay === "" ? null : Number(maxPerDay),
      is_active: initial?.is_active ?? true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar Regra" : "Nova Regra de Crédito"}</DialogTitle>
          <DialogDescription>
            Configure quando e quanto os pacientes ganham
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome da regra</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Consulta realizada" />
          </div>

          <div className="space-y-2">
            <Label>Gatilho</Label>
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Pontos concedidos</Label>
              <Input
                type="number"
                min={1}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Expira em (dias)</Label>
              <Input
                type="number"
                min={0}
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Limite diário (0 = sem limite)</Label>
            <Input
              type="number"
              min={0}
              value={maxPerDay}
              onChange={(e) => setMaxPerDay(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Sem limite"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição para referência" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Adjust Credits Dialog ─────────────────────────────────────────────
function AdjustDialog({
  open,
  onOpenChange,
  patient,
  onAdjust,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patient: { id: string; name: string } | null;
  onAdjust: (amount: number, reason: string) => void;
  saving: boolean;
}) {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar Créditos</DialogTitle>
          <DialogDescription>{patient?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Quantidade (positivo = bonificar, negativo = debitar)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Bonificação especial" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onAdjust(amount, reason)} disabled={saving || !amount || !reason.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Patient History Panel ─────────────────────────────────────────────
function PatientHistoryPanel({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { data: history, isLoading } = usePatientCreditsHistory(patientId);

  const TYPE_CFG = {
    earn: { label: "Ganho", icon: ArrowUp, color: "text-green-600" },
    redeem: { label: "Resgatado", icon: ArrowDown, color: "text-red-600" },
    expire: { label: "Expirado", icon: Clock, color: "text-gray-400" },
    adjustment: { label: "Ajuste", icon: TrendingUp, color: "text-blue-600" },
  } as const;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">Extrato do Paciente</CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}>Fechar</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !history?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sem movimentações</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {history.map((tx: HealthCreditTransaction) => {
              const cfg = TYPE_CFG[tx.type] || TYPE_CFG.earn;
              const Icon = cfg.icon;
              const isPositive = tx.amount > 0;
              return (
                <div key={tx.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className={cn("p-1 rounded-full bg-muted", cfg.color)}><Icon className="h-3.5 w-3.5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{tx.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                      {tx.expires_at && ` · expira ${new Date(tx.expires_at).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  <span className={cn("text-sm font-bold", isPositive ? "text-green-600" : "text-red-600")}>
                    {isPositive ? "+" : ""}{tx.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────
export default function HealthCreditsSettings() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? "";
  const { data: rules, isLoading: loadingRules, upsertRule, deleteRule, toggleRule } = useHealthCreditRules();
  const { data: leaderboard, isLoading: loadingLb } = useHealthCreditsLeaderboard();
  const { data: redemptionCfg, isLoading: loadingRedeem, save: saveRedemption } = useRedemptionConfig();
  const adjust = useAdjustCredits();

  const [ruleDialog, setRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<HealthCreditRule> | null>(null);
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [historyPatientId, setHistoryPatientId] = useState<string | null>(null);

  // Redemption config local state
  const [creditsPerReal, setCreditsPerReal] = useState<number>(10);
  const [minRedeem, setMinRedeem] = useState<number>(50);
  const [maxDiscount, setMaxDiscount] = useState<number>(20);
  const [redeemActive, setRedeemActive] = useState(true);

  // Sync redemption config
  const redeemLoaded = !!redemptionCfg;
  if (redeemLoaded && creditsPerReal === 10 && redemptionCfg.credits_per_real !== 10) {
    setCreditsPerReal(redemptionCfg.credits_per_real);
    setMinRedeem(redemptionCfg.min_redeem);
    setMaxDiscount(redemptionCfg.max_discount_percent);
    setRedeemActive(redemptionCfg.is_active);
  }

  const openNewRule = () => {
    setEditingRule(null);
    setRuleDialog(true);
  };

  const openEditRule = (rule: HealthCreditRule) => {
    setEditingRule(rule);
    setRuleDialog(true);
  };

  const handleSaveRule = (rule: Partial<HealthCreditRule>) => {
    upsertRule.mutate({ ...rule, tenant_id: tenantId } as HealthCreditRule & { tenant_id: string }, {
      onSuccess: () => setRuleDialog(false),
    });
  };

  const handleAdjust = (amount: number, reason: string) => {
    if (!selectedPatient) return;
    adjust.mutate(
      { tenant_id: tenantId, patient_id: selectedPatient.id, amount, reason },
      { onSuccess: () => setAdjustDialog(false) },
    );
  };

  const totalActive = rules?.filter((r) => r.is_active).length ?? 0;
  const totalPatients = leaderboard?.length ?? 0;
  const totalCreditsCirculating = leaderboard?.reduce((s, p) => s + p.balance, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10"><Coins className="h-5 w-5 text-teal-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Créditos em circulação</p>
                <p className="text-2xl font-bold">{totalCreditsCirculating.toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10"><Users className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Pacientes com créditos</p>
                <p className="text-2xl font-bold">{totalPatients}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10"><Trophy className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Regras ativas</p>
                <p className="text-2xl font-bold">{totalActive}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Regras de Acúmulo</CardTitle>
                <CardDescription>Configure quando e quantos créditos os pacientes ganham</CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={openNewRule}><Plus className="mr-1 h-4 w-4" /> Nova Regra</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingRules ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : !rules?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma regra configurada</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, is_active: checked })}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{rule.name}</p>
                      <Badge variant="outline" className="text-xs">{getTriggerLabel(rule.trigger_type)}</Badge>
                    </div>
                    {rule.description && <p className="text-xs text-muted-foreground truncate">{rule.description}</p>}
                  </div>
                  <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100">+{rule.points} pts</Badge>
                  {rule.max_per_day && <span className="text-xs text-muted-foreground">max {rule.max_per_day}/dia</span>}
                  <span className="text-xs text-muted-foreground">{rule.expiry_days}d</span>
                  <Button size="icon" variant="ghost" onClick={() => openEditRule(rule)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteRule.mutate(rule.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redemption Config */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Configuração de Resgate</CardTitle>
              <CardDescription>Defina a conversão de créditos em desconto</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingRedeem ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <Label className="font-medium">Habilitar resgate de créditos</Label>
                  <p className="text-xs text-muted-foreground">Pacientes podem trocar créditos por desconto</p>
                </div>
                <Switch checked={redeemActive} onCheckedChange={setRedeemActive} />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Créditos por R$ 1,00</Label>
                  <Input
                    type="number"
                    min={1}
                    value={creditsPerReal}
                    onChange={(e) => setCreditsPerReal(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Ex: 10 créditos = R$ 1,00 de desconto</p>
                </div>
                <div className="space-y-2">
                  <Label>Mínimo para resgate</Label>
                  <Input
                    type="number"
                    min={1}
                    value={minRedeem}
                    onChange={(e) => setMinRedeem(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Créditos mínimos para usar</p>
                </div>
                <div className="space-y-2">
                  <Label>Desconto máximo (%)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">% máximo do valor da consulta</p>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  <strong>Exemplo:</strong> Com {creditsPerReal} créditos/R$, um paciente com 100 pts pode obter 
                  R$ {(100 / (creditsPerReal || 1)).toFixed(2)} de desconto (limitado a {maxDiscount}% do valor).
                </p>
              </div>

              <Button
                onClick={() => saveRedemption.mutate({
                  credits_per_real: creditsPerReal,
                  min_redeem: minRedeem,
                  max_discount_percent: maxDiscount,
                  is_active: redeemActive,
                })}
                disabled={saveRedemption.isPending}
                variant="outline"
                className="w-full"
              >
                {saveRedemption.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Configuração de Resgate
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-600">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Ranking de Pacientes</CardTitle>
              <CardDescription>Pacientes com créditos acumulados</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLb ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !leaderboard?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum paciente acumulou créditos ainda. Os créditos serão concedidos automaticamente quando consultas forem concluídas.
            </p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px_auto] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                <span>Paciente</span>
                <span className="text-center">Saldo</span>
                <span className="text-center">Ganhos</span>
                <span className="text-center">Usados</span>
                <span className="text-center">Nível</span>
                <span></span>
              </div>
              {leaderboard.map((p, i) => {
                const tierCfg = TIER_BADGE[p.tier] || TIER_BADGE.bronze;
                return (
                  <div key={p.patient_id} className="grid grid-cols-[1fr_80px_80px_80px_80px_auto] gap-2 items-center px-3 py-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                      <span className="text-sm font-medium truncate">{p.patient_name}</span>
                    </div>
                    <span className="text-center font-bold text-sm">{p.balance}</span>
                    <span className="text-center text-sm text-green-600">+{p.lifetime_earned}</span>
                    <span className="text-center text-sm text-red-600">-{p.lifetime_redeemed}</span>
                    <div className="flex justify-center">
                      <Badge className={cn("text-xs", tierCfg.color)}>{tierCfg.label}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setHistoryPatientId(p.patient_id)}
                      >
                        Extrato
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => { setSelectedPatient({ id: p.patient_id, name: p.patient_name }); setAdjustDialog(true); }}
                      >
                        Ajustar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient history */}
      {historyPatientId && (
        <PatientHistoryPanel patientId={historyPatientId} onClose={() => setHistoryPatientId(null)} />
      )}

      {/* Dialogs */}
      <RuleFormDialog
        open={ruleDialog}
        onOpenChange={setRuleDialog}
        initial={editingRule}
        onSave={handleSaveRule}
        saving={upsertRule.isPending}
      />

      <AdjustDialog
        open={adjustDialog}
        onOpenChange={setAdjustDialog}
        patient={selectedPatient}
        onAdjust={handleAdjust}
        saving={adjust.isPending}
      />
    </div>
  );
}
