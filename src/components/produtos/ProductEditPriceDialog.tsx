import { FormDrawer, FormDrawerSection, FormDrawerDivider } from "@/components/ui/form-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductCategory } from "@/types/database";

export interface EditPriceFormState {
  cost: string;
  sale_price: string;
  category_id: string;
}

interface ProductEditPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name: string; cost?: number | null; sale_price?: number | null; category_id?: string | null } | null;
  form: EditPriceFormState;
  setForm: React.Dispatch<React.SetStateAction<EditPriceFormState>>;
  categories: ProductCategory[];
  noCategoryValue: string;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
  formatCurrency: (value: number) => string;
}

export function ProductEditPriceDialog({
  open,
  onOpenChange,
  product,
  form,
  setForm,
  categories,
  noCategoryValue,
  onSubmit,
  isSaving,
  formatCurrency,
}: ProductEditPriceDialogProps) {
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
      title="Atualizar Preços"
      description="Ajuste o custo e o preço de venda do produto"
      width="md"
      onSubmit={handleSubmit}
      isSubmitting={isSaving}
      submitLabel="Salvar"
    >
      <div className="space-y-6">
        <FormDrawerSection title="Produto">
          <div className="space-y-2">
            <Label>Nome do produto</Label>
            <Input value={product?.name || ""} disabled className="bg-muted" />
          </div>
        </FormDrawerSection>

        <FormDrawerDivider />

        <FormDrawerSection title="Categoria">
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
      </div>
    </FormDrawer>
  );
}
