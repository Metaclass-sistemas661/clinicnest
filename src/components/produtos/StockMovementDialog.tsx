import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import type { Product } from "@/types/database";

export interface MovementFormState {
  product_id: string;
  quantity: string;
  movement_type: "in" | "out";
  out_reason_type: "" | "sale" | "damaged";
  purchased_with_company_cash: "yes" | "no";
  reason: string;
}

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: MovementFormState;
  setForm: React.Dispatch<React.SetStateAction<MovementFormState>>;
  products: (Product & { quantity: number })[];
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
}

export function StockMovementDialog({
  open,
  onOpenChange,
  form,
  setForm,
  products,
  onSubmit,
  isSaving,
}: StockMovementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Movimentação de Estoque</DialogTitle>
          <DialogDescription>Registre entrada ou saída de produtos</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select
                value={form.product_id}
                onValueChange={(v) => setForm({ ...form, product_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.quantity} em estoque)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.movement_type}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    movement_type: v as "in" | "out",
                    out_reason_type: v === "in" ? "" : form.out_reason_type,
                    purchased_with_company_cash: v === "out" ? "no" : form.purchased_with_company_cash,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">
                    <span className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4 text-success" /> Entrada
                    </span>
                  </SelectItem>
                  <SelectItem value="out">
                    <span className="flex items-center gap-2">
                      <ArrowDown className="h-4 w-4 text-destructive" /> Saída
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              />
            </div>
            {form.movement_type === "in" && (
              <div className="space-y-3">
                <Label>Você utilizou o caixa da empresa para comprar esse produto?</Label>
                <RadioGroup
                  value={form.purchased_with_company_cash}
                  onValueChange={(v) =>
                    setForm({ ...form, purchased_with_company_cash: v as "yes" | "no" })
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="movement-cash-yes" />
                    <Label htmlFor="movement-cash-yes" className="font-normal cursor-pointer">Sim</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="movement-cash-no" />
                    <Label htmlFor="movement-cash-no" className="font-normal cursor-pointer">Não</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  Se sim, a entrada será registrada como despesa no financeiro.
                </p>
              </div>
            )}
            {form.movement_type === "out" && (
              <div className="space-y-3">
                <Label>Você está registrando essa saída como venda ou baixa danificado?</Label>
                <RadioGroup
                  value={form.out_reason_type}
                  onValueChange={(v) =>
                    setForm({ ...form, out_reason_type: v as "sale" | "damaged" })
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sale" id="out-sale" />
                    <Label htmlFor="out-sale" className="font-normal cursor-pointer">Venda</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="damaged" id="out-damaged" />
                    <Label htmlFor="out-damaged" className="font-normal cursor-pointer">Baixa danificado</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  Venda gera receita no financeiro. Baixa danificado apenas registra histórico para conferência.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Ex: Compra de fornecedor, uso em serviço..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Registrar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
