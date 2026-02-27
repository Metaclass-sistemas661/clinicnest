import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Info,
  Calculator,
  Building2,
  Stethoscope,
  FileCode,
  ArrowDownUp,
} from "lucide-react";
import type { CommissionRule, CommissionRuleType, CommissionCalculationType } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalId: string;
  professionalName: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

interface InsurancePlan {
  id: string;
  name: string;
}

const RULE_TYPE_LABELS: Record<CommissionRuleType, string> = {
  default: "Padrão",
  service: "Por Serviço",
  insurance: "Por Convênio",
  procedure: "Por Procedimento TUSS",
  sale: "Por Venda",
};

const RULE_TYPE_ICONS: Record<CommissionRuleType, React.ElementType> = {
  default: Calculator,
  service: Stethoscope,
  insurance: Building2,
  procedure: FileCode,
  sale: ArrowDownUp,
};

const RULE_TYPE_COLORS: Record<CommissionRuleType, string> = {
  default: "bg-gray-100 text-gray-700 border-gray-200",
  service: "bg-blue-100 text-blue-700 border-blue-200",
  insurance: "bg-green-100 text-green-700 border-green-200",
  procedure: "bg-purple-100 text-purple-700 border-purple-200",
  sale: "bg-amber-100 text-amber-700 border-amber-200",
};

const CALC_TYPE_LABELS: Record<CommissionCalculationType, string> = {
  percentage: "Percentual (%)",
  fixed: "Valor Fixo (R$)",
  tiered: "Escalonado",
};

export function CommissionRulesDrawer({ open, onOpenChange, professionalId, professionalName }: Props) {
  const { profile } = useAuth();
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [insurances, setInsurances] = useState<InsurancePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    rule_type: "default" as CommissionRuleType,
    service_id: "",
    insurance_id: "",
    procedure_code: "",
    calculation_type: "percentage" as CommissionCalculationType,
    value: "",
    is_inverted: false,
  });

  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simServiceId, setSimServiceId] = useState("");
  const [simInsuranceId, setSimInsuranceId] = useState("");
  const [simValue, setSimValue] = useState("");

  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id || !professionalId) return;
    setIsLoading(true);
    try {
      const [rulesRes, servicesRes, insurancesRes] = await Promise.all([
        supabase
          .from("commission_rules")
          .select("*, service:services(id, name), insurance:insurance_plans(id, name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", professionalId)
          .eq("is_active", true)
          .order("priority", { ascending: false }),
        supabase
          .from("procedures")
          .select("id, name, price")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("insurance_plans")
          .select("id, name")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (rulesRes.error) throw rulesRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (insurancesRes.error) throw insurancesRes.error;

      setRules((rulesRes.data || []) as CommissionRule[]);
      setServices((servicesRes.data || []) as Service[]);
      setInsurances((insurancesRes.data || []) as InsurancePlan[]);
    } catch (err) {
      logger.error("CommissionRulesDrawer.fetchData", err);
      toast.error("Erro ao carregar regras de comissão");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, professionalId]);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  const openCreateForm = (ruleType: CommissionRuleType = "default") => {
    setEditingRule(null);
    setFormData({
      rule_type: ruleType,
      service_id: "",
      insurance_id: "",
      procedure_code: "",
      calculation_type: "percentage",
      value: "",
      is_inverted: false,
    });
    setIsFormOpen(true);
  };

  const openEditForm = (rule: CommissionRule) => {
    setEditingRule(rule);
    setFormData({
      rule_type: rule.rule_type,
      service_id: rule.service_id || "",
      insurance_id: rule.insurance_id || "",
      procedure_code: rule.procedure_code || "",
      calculation_type: rule.calculation_type,
      value: String(rule.value),
      is_inverted: rule.is_inverted,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!profile?.tenant_id) return;
    
    const value = parseFloat(formData.value);
    if (isNaN(value) || value < 0) {
      toast.error("Informe um valor válido");
      return;
    }

    if (formData.rule_type === "service" && !formData.service_id) {
      toast.error("Selecione um serviço");
      return;
    }
    if (formData.rule_type === "insurance" && !formData.insurance_id) {
      toast.error("Selecione um convênio");
      return;
    }
    if (formData.rule_type === "procedure" && !formData.procedure_code.trim()) {
      toast.error("Informe o código do procedimento");
      return;
    }

    setIsSaving(true);
    try {
      const priority = formData.rule_type === "procedure" ? 30 
        : formData.rule_type === "service" ? 20 
        : formData.rule_type === "insurance" ? 10 
        : 0;

      const payload = {
        tenant_id: profile.tenant_id,
        professional_id: professionalId,
        rule_type: formData.rule_type,
        service_id: formData.rule_type === "service" ? formData.service_id : null,
        insurance_id: formData.rule_type === "insurance" ? formData.insurance_id : null,
        procedure_code: formData.rule_type === "procedure" ? formData.procedure_code.trim() : null,
        calculation_type: formData.calculation_type,
        value,
        priority,
        is_inverted: formData.is_inverted,
        is_active: true,
        created_by: profile.id,
      };

      if (editingRule) {
        const { error } = await supabase
          .from("commission_rules")
          .update(payload)
          .eq("id", editingRule.id);
        if (error) throw error;
        toast.success("Regra atualizada");
      } else {
        const { error } = await supabase
          .from("commission_rules")
          .insert(payload);
        if (error) throw error;
        toast.success("Regra criada");
      }

      setIsFormOpen(false);
      fetchData();
    } catch (err) {
      logger.error("CommissionRulesDrawer.handleSave", err);
      toast.error("Erro ao salvar regra");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (rule: CommissionRule) => {
    if (!confirm(`Excluir regra "${RULE_TYPE_LABELS[rule.rule_type]}"?`)) return;
    
    try {
      const { error } = await supabase
        .from("commission_rules")
        .update({ is_active: false })
        .eq("id", rule.id);
      if (error) throw error;
      toast.success("Regra excluída");
      fetchData();
    } catch (err) {
      logger.error("CommissionRulesDrawer.handleDelete", err);
      toast.error("Erro ao excluir regra");
    }
  };

  const simulateCommission = () => {
    const servicePrice = parseFloat(simValue) || 0;
    if (servicePrice <= 0) return null;

    const applicableRule = rules.find(r => {
      if (r.rule_type === "service" && r.service_id === simServiceId) return true;
      if (r.rule_type === "insurance" && r.insurance_id === simInsuranceId) return true;
      if (r.rule_type === "default") return true;
      return false;
    });

    if (!applicableRule) return null;

    let amount = 0;
    if (applicableRule.calculation_type === "percentage") {
      amount = (servicePrice * applicableRule.value) / 100;
    } else {
      amount = applicableRule.value;
    }

    return {
      rule: applicableRule,
      amount: applicableRule.is_inverted ? -amount : amount,
    };
  };

  const hasDefaultRule = rules.some(r => r.rule_type === "default");

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Regras de Comissão</SheetTitle>
            <SheetDescription>
              Configure regras de comissão para {professionalName}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => openCreateForm("default")} size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Regra Padrão
              </Button>
              <Button onClick={() => openCreateForm("service")} size="sm" variant="outline" className="gap-1">
                <Stethoscope className="h-4 w-4" />
                Por Serviço
              </Button>
              <Button onClick={() => openCreateForm("insurance")} size="sm" variant="outline" className="gap-1">
                <Building2 className="h-4 w-4" />
                Por Convênio
              </Button>
              <Button onClick={() => setSimulatorOpen(true)} size="sm" variant="secondary" className="gap-1">
                <Calculator className="h-4 w-4" />
                Simular
              </Button>
            </div>

            {/* Rules List */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : rules.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <Calculator className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="font-medium">Nenhuma regra configurada</p>
                  <p className="text-sm text-muted-foreground">
                    Adicione uma regra padrão para começar
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {rules.map(rule => {
                  const Icon = RULE_TYPE_ICONS[rule.rule_type];
                  return (
                    <Card key={rule.id} className="border-gradient">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`p-2 rounded-lg ${RULE_TYPE_COLORS[rule.rule_type]}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{RULE_TYPE_LABELS[rule.rule_type]}</span>
                                {rule.is_inverted && (
                                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                    Invertido
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {rule.rule_type === "service" && rule.service?.name}
                                {rule.rule_type === "insurance" && rule.insurance?.name}
                                {rule.rule_type === "procedure" && `TUSS: ${rule.procedure_code}`}
                                {rule.rule_type === "default" && "Aplicada quando nenhuma outra regra se aplica"}
                              </p>
                              <p className="text-lg font-semibold mt-1">
                                {rule.calculation_type === "percentage" 
                                  ? `${rule.value}%` 
                                  : formatCurrency(rule.value)}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditForm(rule)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(rule)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Warning if no default rule */}
            {!isLoading && !hasDefaultRule && rules.length > 0 && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <Info className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Recomendado: adicione uma regra padrão para cobrir casos não especificados.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra"}</DialogTitle>
            <DialogDescription>
              {RULE_TYPE_LABELS[formData.rule_type]}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {formData.rule_type === "service" && (
              <div className="space-y-2">
                <Label>Serviço *</Label>
                <Select value={formData.service_id} onValueChange={v => setFormData({...formData, service_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {services.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.rule_type === "insurance" && (
              <div className="space-y-2">
                <Label>Convênio *</Label>
                <Select value={formData.insurance_id} onValueChange={v => setFormData({...formData, insurance_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {insurances.map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.rule_type === "procedure" && (
              <div className="space-y-2">
                <Label>Código TUSS *</Label>
                <Input 
                  placeholder="Ex: 10101012" 
                  value={formData.procedure_code}
                  onChange={e => setFormData({...formData, procedure_code: e.target.value})}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo de Cálculo</Label>
              <Select 
                value={formData.calculation_type} 
                onValueChange={v => setFormData({...formData, calculation_type: v as CommissionCalculationType})}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{formData.calculation_type === "percentage" ? "Percentual (%)" : "Valor (R$)"}</Label>
              <Input 
                type="number" 
                step={formData.calculation_type === "percentage" ? "1" : "0.01"}
                min="0"
                placeholder={formData.calculation_type === "percentage" ? "Ex: 30" : "Ex: 50.00"}
                value={formData.value}
                onChange={e => setFormData({...formData, value: e.target.value})}
              />
            </div>

            <TooltipProvider>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="is_inverted" className="cursor-pointer">Repasse Invertido</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Quando ativado, o profissional paga à clínica (ex: locação de sala).
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch 
                  id="is_inverted"
                  checked={formData.is_inverted}
                  onCheckedChange={v => setFormData({...formData, is_inverted: v})}
                />
              </div>
            </TooltipProvider>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simulator Dialog */}
      <Dialog open={simulatorOpen} onOpenChange={setSimulatorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Simulador de Comissão</DialogTitle>
            <DialogDescription>
              Teste qual regra será aplicada em diferentes cenários
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Serviço (opcional)</Label>
              <Select value={simServiceId || "__any__"} onValueChange={(v) => setSimServiceId(v === "__any__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Qualquer procedimento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Qualquer serviço</SelectItem>
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Convênio (opcional)</Label>
              <Select value={simInsuranceId || "__particular__"} onValueChange={(v) => setSimInsuranceId(v === "__particular__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Particular" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__particular__">Particular</SelectItem>
                  {insurances.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor do Serviço (R$)</Label>
              <Input 
                type="number" 
                step="0.01"
                min="0"
                placeholder="Ex: 150.00"
                value={simValue}
                onChange={e => setSimValue(e.target.value)}
              />
            </div>

            {simValue && parseFloat(simValue) > 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  {(() => {
                    const result = simulateCommission();
                    if (!result) return (
                      <p className="text-sm text-muted-foreground">Nenhuma regra aplicável</p>
                    );
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className={RULE_TYPE_COLORS[result.rule.rule_type]}>
                            {RULE_TYPE_LABELS[result.rule.rule_type]}
                          </Badge>
                          {result.rule.is_inverted && (
                            <Badge variant="outline" className="text-amber-600">Invertido</Badge>
                          )}
                        </div>
                        <p className="text-2xl font-bold">
                          {result.amount < 0 ? "-" : ""}{formatCurrency(Math.abs(result.amount))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {result.rule.calculation_type === "percentage" 
                            ? `${result.rule.value}% de ${formatCurrency(parseFloat(simValue))}`
                            : `Valor fixo`}
                        </p>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSimulatorOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
