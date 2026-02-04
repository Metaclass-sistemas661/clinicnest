import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function AgendaPreview() {
  return (
    <div className="relative dark min-h-full" style={{ backgroundColor: "hsl(250 25% 7%)", color: "hsl(250 15% 95%)" }}>
      <div className="rounded-2xl overflow-hidden min-h-full" style={{ backgroundColor: "hsl(250 25% 7%)" }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-fuchsia-500 p-4 flex items-center justify-between">
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
        <div className="p-6" style={{ backgroundColor: "hsl(250 25% 7%)" }}>
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
                    i === 3 ? "bg-violet-500/20 border-violet-500/50 text-violet-400 font-semibold" : "bg-card border-border text-muted-foreground"
                  )}
                  style={{ backgroundColor: i === 3 ? "hsl(262 80% 65% / 0.2)" : "hsl(250 25% 10%)" }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Appointments List */}
          <Card className="border-border" style={{ backgroundColor: "hsl(250 25% 10%)" }}>
            <CardHeader>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Agendamentos de Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { time: "09:00", client: "Maria Silva", service: "Corte Feminino", professional: "Ana", status: "confirmed" },
                  { time: "10:30", client: "João Santos", service: "Barba", professional: "Carlos", status: "confirmed" },
                  { time: "14:00", client: "Ana Costa", service: "Coloração", professional: "Ana", status: "pending" },
                  { time: "15:30", client: "Pedro Lima", service: "Corte Masculino", professional: "Carlos", status: "confirmed" },
                ].map((apt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    style={{ backgroundColor: "hsl(250 25% 10%)" }}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
                        {apt.time}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <p className="font-medium text-sm text-foreground truncate">{apt.client}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{apt.service}</p>
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
