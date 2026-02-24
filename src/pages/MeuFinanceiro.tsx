import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, DollarSign, History, FileText, BarChart3 } from "lucide-react";
import { MeuFinanceiroResumo } from "@/components/meu-financeiro/MeuFinanceiroResumo";
import { MeuFinanceiroComissoes } from "@/components/meu-financeiro/MeuFinanceiroComissoes";
import { MeuFinanceiroSalarios } from "@/components/meu-financeiro/MeuFinanceiroSalarios";
import { MeuFinanceiroHistorico } from "@/components/meu-financeiro/MeuFinanceiroHistorico";
import { MeuFinanceiroRelatorios } from "@/components/meu-financeiro/MeuFinanceiroRelatorios";
import { MeuFinanceiroMobile } from "@/components/meu-financeiro/MeuFinanceiroMobile";

export default function MeuFinanceiro() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("resumo");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (isAdmin) {
    return (
      <MainLayout title="Meu Financeiro" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Administradores acessam o financeiro pelo painel Financeiro
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  // Versão mobile otimizada
  if (isMobile) {
    return (
      <MainLayout
        title="Meu Financeiro"
        subtitle="Suas comissões e salários"
      >
        <MeuFinanceiroMobile />
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Meu Financeiro"
      subtitle="Acompanhe suas comissões, salários e histórico financeiro"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
          <TabsTrigger value="resumo" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Resumo</span>
          </TabsTrigger>
          <TabsTrigger value="comissoes" className="gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Comissões</span>
          </TabsTrigger>
          <TabsTrigger value="salarios" className="gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Salários</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Relatórios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <MeuFinanceiroResumo />
        </TabsContent>

        <TabsContent value="comissoes">
          <MeuFinanceiroComissoes />
        </TabsContent>

        <TabsContent value="salarios">
          <MeuFinanceiroSalarios />
        </TabsContent>

        <TabsContent value="historico">
          <MeuFinanceiroHistorico />
        </TabsContent>

        <TabsContent value="relatorios">
          <MeuFinanceiroRelatorios />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
