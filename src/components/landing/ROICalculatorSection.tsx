import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, TrendingUp, DollarSign, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function ROICalculatorSection() {
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [appointmentsPerMonth, setAppointmentsPerMonth] = useState("");
  const [timeSpentOnAdmin, setTimeSpentOnAdmin] = useState("");

  const calculateROI = () => {
    const revenue = parseFloat(monthlyRevenue) || 0;
    const appointments = parseInt(appointmentsPerMonth) || 0;
    const adminHours = parseFloat(timeSpentOnAdmin) || 0;

    if (!revenue || !appointments || !adminHours) return null;

    // Estimativas conservadoras
    const timeSaved = adminHours * 0.6; // 60% de economia de tempo
    const revenueIncrease = revenue * 0.15; // 15% de aumento de receita (melhor organização)
    const costPerHour = revenue / (appointments * 2); // Estimativa de valor por hora
    const timeValue = timeSaved * costPerHour;
    const totalBenefit = revenueIncrease + timeValue;
    const monthlyCost = 79.90; // Plano mensal
    const roi = ((totalBenefit - monthlyCost) / monthlyCost) * 100;
    const paybackMonths = monthlyCost / totalBenefit;

    return {
      timeSaved: timeSaved.toFixed(1),
      revenueIncrease: revenueIncrease.toFixed(2),
      timeValue: timeValue.toFixed(2),
      totalBenefit: totalBenefit.toFixed(2),
      roi: roi.toFixed(0),
      paybackMonths: paybackMonths.toFixed(1),
    };
  };

  const results = calculateROI();

  return (
    <section className="py-20 sm:py-32 bg-gradient-to-b from-violet-50/50 to-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 border border-green-200 mb-6">
              <Calculator className="h-4 w-4 text-green-600" aria-hidden="true" />
              <span className="text-sm font-medium text-green-600">Calculadora de ROI</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              Descubra quanto você pode{" "}
              <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                economizar
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Calcule o retorno sobre investimento do BeautyGest para o seu salão.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Input Form */}
            <Card>
              <CardHeader>
                <CardTitle>Informações do seu Salão</CardTitle>
                <CardDescription>
                  Preencha os dados para calcular seu ROI personalizado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="revenue">Faturamento Mensal (R$)</Label>
                  <Input
                    id="revenue"
                    type="number"
                    placeholder="Ex: 15000"
                    value={monthlyRevenue}
                    onChange={(e) => setMonthlyRevenue(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appointments">Agendamentos por Mês</Label>
                  <Input
                    id="appointments"
                    type="number"
                    placeholder="Ex: 200"
                    value={appointmentsPerMonth}
                    onChange={(e) => setAppointmentsPerMonth(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-hours">Horas Gastas com Tarefas Administrativas por Mês</Label>
                  <Input
                    id="admin-hours"
                    type="number"
                    placeholder="Ex: 40"
                    value={timeSpentOnAdmin}
                    onChange={(e) => setTimeSpentOnAdmin(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <Card className={cn("border-2", results && "border-green-200 bg-green-50/50")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Resultado do Cálculo
                </CardTitle>
                <CardDescription>
                  {results
                    ? "Veja quanto o BeautyGest pode economizar para você"
                    : "Preencha os campos ao lado para ver os resultados"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {results ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-white border">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="text-xs text-muted-foreground">Tempo Economizado</span>
                        </div>
                        <p className="text-2xl font-bold">{results.timeSaved}h/mês</p>
                      </div>

                      <div className="p-4 rounded-lg bg-white border">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="text-xs text-muted-foreground">Aumento de Receita</span>
                        </div>
                        <p className="text-2xl font-bold">R$ {parseFloat(results.revenueIncrease).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>

                    <div className="p-6 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white">
                      <p className="text-sm mb-2">Benefício Total Mensal Estimado</p>
                      <p className="text-4xl font-bold">R$ {parseFloat(results.totalBenefit).toLocaleString("pt-BR")}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 rounded-lg bg-white border">
                        <span className="text-sm font-medium">ROI Estimado</span>
                        <span className="text-lg font-bold text-green-600">{results.roi}%</span>
                      </div>

                      <div className="flex justify-between items-center p-3 rounded-lg bg-white border">
                        <span className="text-sm font-medium">Payback</span>
                        <span className="text-lg font-bold text-violet-600">
                          {results.paybackMonths} meses
                        </span>
                      </div>
                    </div>

                    <a href="/cadastro" className="block">
                      <Button
                        size="lg"
                        className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600"
                      >
                        Começar Teste Grátis
                      </Button>
                    </a>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Preencha os campos ao lado para calcular</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            * Cálculos baseados em estimativas conservadoras. Resultados reais podem variar.
          </p>
        </div>
      </div>
    </section>
  );
}
