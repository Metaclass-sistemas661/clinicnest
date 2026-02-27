import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Hash, Lock, Trash2, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface ChatChannel {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  is_default: boolean;
  created_at: string;
}

interface Member {
  id: string;
  full_name: string;
}

interface ChannelManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChannelCreated?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ChannelManager({ open, onOpenChange, onChannelCreated }: ChannelManagerProps) {
  const { profile } = useAuth();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  useEffect(() => {
    if (open && profile?.tenant_id) {
      void fetchChannels();
      void fetchMembers();
    }
  }, [open, profile?.tenant_id]);

  const fetchChannels = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      setChannels(data ?? []);
    } catch (err) {
      logger.error("ChannelManager fetchChannels:", err);
      toast.error("Erro ao carregar canais");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMembers = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("tenant_id", profile.tenant_id)
        .order("full_name");
      if (error) throw error;
      setMembers(data ?? []);
    } catch (err) {
      logger.error("ChannelManager fetchMembers:", err);
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error("Nome do canal é obrigatório");
      return;
    }
    setIsCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_chat_channel", {
        p_name: newChannelName.trim(),
        p_description: newChannelDescription.trim() || null,
        p_is_private: newChannelPrivate,
        p_member_ids: newChannelPrivate ? selectedMembers : [],
      });
      if (error) throw error;
      toast.success("Canal criado com sucesso!");
      setShowCreateDialog(false);
      resetCreateForm();
      void fetchChannels();
      onChannelCreated?.();
    } catch (err: any) {
      logger.error("ChannelManager createChannel:", err);
      if (err.message?.includes("duplicate")) {
        toast.error("Já existe um canal com este nome");
      } else {
        toast.error("Erro ao criar canal");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm("Tem certeza que deseja excluir este canal? Todas as mensagens serão perdidas.")) {
      return;
    }
    try {
      const { error } = await supabase
        .from("chat_channels")
        .delete()
        .eq("id", channelId);
      if (error) throw error;
      toast.success("Canal excluído");
      void fetchChannels();
      onChannelCreated?.();
    } catch (err) {
      logger.error("ChannelManager deleteChannel:", err);
      toast.error("Erro ao excluir canal");
    }
  };

  const resetCreateForm = () => {
    setNewChannelName("");
    setNewChannelDescription("");
    setNewChannelPrivate(false);
    setSelectedMembers([]);
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar Canais</DialogTitle>
            <DialogDescription>
              Crie e gerencie canais de comunicação da equipe.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">
                {channels.length} canal(is)
              </span>
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Novo Canal
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : channels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum canal criado</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {channels.map((channel) => (
                    <div
                      key={channel.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {channel.is_private ? (
                          <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {channel.name}
                            </span>
                            {channel.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                Padrão
                              </Badge>
                            )}
                            {channel.is_private && (
                              <Badge variant="outline" className="text-xs">
                                Privado
                              </Badge>
                            )}
                          </div>
                          {channel.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {channel.description}
                            </p>
                          )}
                        </div>
                      </div>
                      {!channel.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteChannel(channel.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de criação de canal */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Canal</DialogTitle>
            <DialogDescription>
              Crie um novo canal de comunicação para a equipe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="channel-name">Nome do Canal</Label>
              <Input
                id="channel-name"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="ex: Recepção, Enfermagem..."
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel-description">Descrição (opcional)</Label>
              <Textarea
                id="channel-description"
                value={newChannelDescription}
                onChange={(e) => setNewChannelDescription(e.target.value)}
                placeholder="Descreva o propósito do canal..."
                rows={2}
                maxLength={200}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="channel-private">Canal Privado</Label>
                <p className="text-xs text-muted-foreground">
                  Apenas membros selecionados podem ver
                </p>
              </div>
              <Switch
                id="channel-private"
                checked={newChannelPrivate}
                onCheckedChange={setNewChannelPrivate}
              />
            </div>

            {newChannelPrivate && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Membros do Canal
                </Label>
                <ScrollArea className="h-[150px] border rounded-md p-2">
                  <div className="space-y-1">
                    {members
                      .filter((m) => m.id !== profile?.id)
                      .map((member) => (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedMembers.includes(member.id)}
                            onCheckedChange={() => toggleMember(member.id)}
                          />
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {getInitials(member.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{member.full_name}</span>
                        </label>
                      ))}
                  </div>
                </ScrollArea>
                {selectedMembers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedMembers.length} membro(s) selecionado(s)
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetCreateForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateChannel}
              disabled={isCreating || !newChannelName.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Canal"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
