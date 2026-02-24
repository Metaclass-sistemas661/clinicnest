import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useCreateAdverseEvent,
  ADVERSE_EVENT_TYPES,
  ADVERSE_EVENT_SEVERITIES,
  type CreateAdverseEventInput,
} from "@/hooks/useONAIndicators";
import { useAuth } from "@/contexts/AuthContext";

export function AdverseEventButton() {
  const { role } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const createEventMutation = useCreateAdverseEvent();

  const [formData, setFormData] = useState<CreateAdverseEventInput>({
    data_evento: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    tipo: "OUTRO",
    severidade: "LEVE",
    descricao: "",
  });

  const allowedRoles = ["admin", "medico", "enfermeiro", "clinico"];
  if (!allowedRoles.includes(role || "")) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEventMutation.mutate(formData, {
      onSuccess: () => {
        setDialogOpen(false);
        setFormData({
          data_evento: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
          tipo: "OUTRO",
          severidade: "LEVE",
          descricao: "",
        });
      },
    });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-lg border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-600"
            >
              <AlertTriangle className="h-5 w-5" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Notificar Evento Adverso</p>
        </TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Notificar Evento Adverso
          </DialogTitle>
          <DialogDescription>
            Registre um evento adverso ou near miss para investigação pela equipe de qualidade.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_evento">Data/Hora</Label>
              <Input
                id="data_evento"
                type="datetime-local"
                value={formData.data_evento}
                onChange={(e) =>
                  setFormData({ ...formData, data_evento: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select
                value={formData.tipo}
                onValueChange={(v) => setFormData({ ...formData, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ADVERSE_EVENT_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.tipo === "OUTRO" && (
            <div className="space-y-2">
              <Label htmlFor="tipo_outro">Especifique</Label>
              <Input
                id="tipo_outro"
                value={formData.tipo_outro || ""}
                onChange={(e) =>
                  setFormData({ ...formData, tipo_outro: e.target.value })
                }
                placeholder="Descreva o tipo de evento"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="severidade">Severidade</Label>
              <Select
                value={formData.severidade}
                onValueChange={(v) => setFormData({ ...formData, severidade: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ADVERSE_EVENT_SEVERITIES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="local_evento">Local</Label>
              <Input
                id="local_evento"
                value={formData.local_evento || ""}
                onChange={(e) =>
                  setFormData({ ...formData, local_evento: e.target.value })
                }
                placeholder="Ex: Consultório 3"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição do Evento *</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) =>
                setFormData({ ...formData, descricao: e.target.value })
              }
              placeholder="Descreva o que aconteceu..."
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acoes_imediatas">Ações Imediatas</Label>
            <Textarea
              id="acoes_imediatas"
              value={formData.acoes_imediatas || ""}
              onChange={(e) =>
                setFormData({ ...formData, acoes_imediatas: e.target.value })
              }
              placeholder="Quais ações foram tomadas?"
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={createEventMutation.isPending}>
            {createEventMutation.isPending ? "Enviando..." : "Enviar Notificação"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
