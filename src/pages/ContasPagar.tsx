import { MainLayout } from "@/components/layout/MainLayout";
import { FinanceiroBillsPayableTab } from "@/components/financeiro/tabs/FinanceiroBillsPayableTab";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function ContasPagar() {
  return (
    <MainLayout
      title="Contas a Pagar"
      subtitle="Gerencie suas despesas e obrigações financeiras"
      actions={
        <Button variant="outline" asChild>
          <Link to="/financeiro">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Financeiro
          </Link>
        </Button>
      }
    >
      <FinanceiroBillsPayableTab />
    </MainLayout>
  );
}
