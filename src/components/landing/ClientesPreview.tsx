import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Search, Plus } from "lucide-react";

export function ClientesPreview() {
  return (
    <div className="relative dark min-h-full" style={{ backgroundColor: "hsl(200 25% 7%)", color: "hsl(200 15% 95%)" }}>
      <div className="w-full rounded-2xl overflow-hidden min-h-full" style={{ backgroundColor: "hsl(200 25% 7%)" }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-500 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-white" />
            <h3 className="text-white font-semibold text-sm">Pacientes</h3>
          </div>
          <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-white/30">
            <Plus className="h-4 w-4 mr-1" />
            Novo Paciente
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 lg:p-8" style={{ backgroundColor: "hsl(200 25% 7%)" }}>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pacientes..."
                className="pl-10 bg-card border-border"
                style={{ backgroundColor: "hsl(200 25% 10%)" }}
              />
            </div>
          </div>

          {/* Clients List */}
          <Card className="border-border" style={{ backgroundColor: "hsl(200 25% 10%)" }}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-foreground">Lista de Pacientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Maria Silva", phone: "(11) 98765-4321", procedures: 12, products: 5, total: "R$ 2.450,00" },
                  { name: "João Santos", phone: "(21) 97654-3210", procedures: 8, products: 3, total: "R$ 1.890,00" },
                  { name: "Ana Costa", phone: "(31) 96543-2109", procedures: 15, products: 7, total: "R$ 3.120,00" },
                  { name: "Pedro Lima", phone: "(11) 95432-1098", procedures: 6, products: 2, total: "R$ 980,00" },
                ].map((patient, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    style={{ backgroundColor: "hsl(200 25% 10%)" }}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {patient.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">{patient.name}</p>
                        <p className="text-xs text-muted-foreground">{patient.phone}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                            {patient.procedures} consultas
                          </Badge>
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
                            {patient.products} retornos
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{patient.total}</p>
                      <p className="text-xs text-muted-foreground">Total gasto</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
