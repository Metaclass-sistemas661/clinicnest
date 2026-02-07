import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Loader2, Building, Save } from "lucide-react";
import { toast } from "sonner";

export default function Configuracoes() {
  const { profile, tenant, isAdmin, refreshProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    default_commission_percent: "",
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || "",
        phone: tenant.phone || "",
        email: tenant.email || "",
        address: tenant.address || "",
        default_commission_percent: tenant.default_commission_percent != null
          ? String(tenant.default_commission_percent)
          : "10",
      });
    }
  }, [tenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;

    setIsSaving(true);

    const defaultPct = formData.default_commission_percent
      ? Math.min(100, Math.max(0, parseFloat(formData.default_commission_percent)))
      : 10;

    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          name: formData.name,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          default_commission_percent: defaultPct,
        })
        .eq("id", tenant.id);

      if (error) throw error;

      toast.success("Configurações salvas com sucesso!");
      refreshProfile();
    } catch (error) {
      toast.error("Erro ao salvar configurações");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <MainLayout title="Configurações" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Apenas administradores podem acessar as configurações
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Configurações"
      subtitle="Configure os dados do seu salão"
    >
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Dados do Salão</CardTitle>
                <CardDescription>Informações básicas do estabelecimento</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Nome do Salão</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do seu salão"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@salao.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>
              <div className="space-y-2">
                <Label>Comissão padrão (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={formData.default_commission_percent}
                  onChange={(e) => setFormData({ ...formData, default_commission_percent: e.target.value })}
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground">
                  Usada quando o profissional não tem comissão configurada na Equipe
                </p>
              </div>
              <Button
                type="submit"
                disabled={isSaving}
                className="gradient-primary text-primary-foreground"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
