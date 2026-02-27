import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function AgendaPreview() {
  return (
    <div className="relative dark min-h-full" style={{ backgroundColor: "hsl(200 25% 7%)", color: "hsl(200 15% 95%)" }}>
      <div className="w-full rounded-2xl overflow-hidden min-h-full" style={{ backgroundColor: "hsl(200 25% 7%)" }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-500 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-white" />
            <h3 className="text-white font-semibold text-sm">Agenda</h3>
          </div>
          <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-white/30">
            <Plus className="h-4 w-4 mr-1" />
            Novo
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 lg:p-8" style={{ backgroundColor: "hsl(200 25% 7%)" }}>
          {/* Calendar View */}
          <div className="mb-6">
            <div className="grid grid-cols-7 gap-2 mb-4">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-12 rounded-lg border flex items-center justify-center text-sm",
                    i === 3 ? "bg-teal-500/20 border-teal-500/50 text-teal-400 font-semibold" : "bg-card border-border text-muted-foreground"
                  )}
                  style={{ backgroundColor: i === 3 ? "hsl(174 72% 38% / 0.2)" : "hsl(200 25% 10%)" }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Appointments List */}
          <Card className="border-border" style={{ backgroundColor: "hsl(200 25% 10%)" }}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Agendamentos de Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { time: "09:00", patient: "Maria Silva", procedure: "Consulta Clínica Geral", professional: "Dra. Ana", status: "confirmed" },
                  { time: "10:30", patient: "João Santos", procedure: "Retorno Cardiologia", professional: "Dr. Carlos", status: "confirmed" },
                  { time: "14:00", patient: "Ana Costa", procedure: "Avaliação Dermatológica", professional: "Dra. Ana", status: "pending" },
                  { time: "15:30", patient: "Pedro Lima", procedure: "Consulta Pediátrica", professional: "Dr. Carlos", status: "confirmed" },
                ].map((apt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    style={{ backgroundColor: "hsl(200 25% 10%)" }}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
                        {apt.time}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <p className="font-medium text-sm text-foreground truncate">{apt.patient}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{apt.procedure}</p>
                        <p className="text-xs text-muted-foreground mt-1">Profissional: {apt.professional}</p>
                      </div>
                    </div>
                    <Badge
                      variant={apt.status === "confirmed" ? "default" : "secondary"}
                      className={cn(
                        apt.status === "confirmed" && "bg-green-500/20 text-green-400 border-green-500/30"
                      )}
                    >
                      {apt.status === "confirmed" ? "Confirmado" : "Pendente"}
                    </Badge>
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
