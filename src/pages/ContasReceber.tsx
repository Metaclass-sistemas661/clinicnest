import { MainLayout } from "@/components/layout/MainLayout";
import { FinanceiroBillsReceivableTab } from "@/components/financeiro/tabs/FinanceiroBillsReceivableTab";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function ContasReceber() {
  return (
    <MainLayout
      title="Contas a Receber"
      subtitle="Gerencie valores a receber de pacientes e serviços"
      actions={
        <Button variant="outline" asChild>
          <Link to="/financeiro">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Financeiro
          </Link>
        </Button>
      }
    >
      <FinanceiroBillsReceivableTab />
    </MainLayout>
  );
}
