import { FormDrawer, FormDrawerSection, FormDrawerDivider } from "@/components/ui/form-drawer";
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
import { Button } from "@/components/ui/button";
import type { ProductCategory } from "@/types/database";

export interface ProductFormState {
  name: string;
  description: string;
  cost: string;
  sale_price: string;
  quantity: string;
  min_quantity: string;
  purchased_with_company_cash: "yes" | "no";
  category_id: string;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ProductFormState;
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>;
  categories: ProductCategory[];
  noCategoryValue: string;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
  onOpenCategoryDialog: () => void;
  formatCurrency: (value: number) => string;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  categories,
  noCategoryValue,
  onSubmit,
  isSaving,
  onOpenCategoryDialog,
  formatCurrency,
}: ProductFormDialogProps) {
  const cost = parseFloat(form.cost) || 0;
  const salePrice = parseFloat(form.sale_price) || 0;
  const profit = salePrice - cost;
  const marginPercent = salePrice > 0 ? (profit / salePrice) * 100 : 0;
  const profitPercent = cost > 0 ? (profit / cost) * 100 : 0;

  const handleSubmit = () => {
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    onSubmit(fakeEvent);
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Novo Produto"
      description="Cadastre um novo produto no estoque"
      width="lg"
      onSubmit={handleSubmit}
      isSubmitting={isSaving}
      submitLabel="Cadastrar"
      submitDisabled={!form.name.trim()}
    >
      <div className="space-y-6">
        <FormDrawerSection title="Identificação">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Shampoo Profissional"
                data-tour="products-form-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição opcional..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={form.category_id}
              onValueChange={(value) => setForm({ ...form, category_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noCategoryValue}>Sem categoria</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 text-sm"
              onClick={onOpenCategoryDialog}
              data-tour="products-create-category-link"
            >
              Criar nova categoria
            </Button>
          </div>
        </FormDrawerSection>

        <FormDrawerDivider />

        <FormDrawerSection title="Preços">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Custo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Preço de Venda (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.sale_price}
                onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>
          {(cost > 0 || salePrice > 0) && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium text-muted-foreground">Margem de lucro</p>
              <div className="mt-1 flex flex-wrap gap-4">
                <span><strong>Lucro (R$):</strong> {formatCurrency(profit)}</span>
                <span><strong>Margem (%):</strong> {marginPercent.toFixed(1)}%</span>
                <span><strong>Markup (%):</strong> {profitPercent.toFixed(1)}%</span>
              </div>
            </div>
          )}
        </FormDrawerSection>

        <FormDrawerDivider />

        <FormDrawerSection title="Estoque">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Quantidade Inicial</Label>
              <Input
                type="number"
                min="0"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Quantidade Mínima</Label>
              <Input
                type="number"
                min="0"
                value={form.min_quantity}
                onChange={(e) => setForm({ ...form, min_quantity: e.target.value })}
                placeholder="5"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Alerta será exibido quando estoque atingir a quantidade mínima
          </p>
        </FormDrawerSection>

        <FormDrawerDivider />

        <FormDrawerSection title="Financeiro">
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
                <RadioGroupItem value="yes" id="cash-yes" />
                <Label htmlFor="cash-yes" className="font-normal cursor-pointer">Sim</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="cash-no" />
                <Label htmlFor="cash-no" className="font-normal cursor-pointer">Não</Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Se sim, a compra será registrada como despesa no financeiro.
            </p>
          </div>
        </FormDrawerSection>
      </div>
    </FormDrawer>
  );
}
