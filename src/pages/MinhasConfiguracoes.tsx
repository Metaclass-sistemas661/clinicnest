import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { Loader2, User, Lock, Bell, ShieldCheck, Camera, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface NotificationPrefs {
  appointment_created: boolean;
  appointment_completed: boolean;
  appointment_cancelled: boolean;
  goal_approved: boolean;
  goal_rejected: boolean;
  goal_reminder: boolean;
  goal_reached: boolean;
  commission_paid: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  appointment_created: true,
  appointment_completed: true,
  appointment_cancelled: true,
  goal_approved: true,
  goal_rejected: true,
  goal_reminder: true,
  goal_reached: true,
  commission_paid: true,
};

type LgpdRequestType =
  | "access"
  | "correction"
  | "deletion"
  | "portability"
  | "consent_revocation"
  | "opposition";

type LgpdRequestStatus = "pending" | "in_progress" | "completed" | "rejected";

interface LgpdDataRequest {
  id: string;
  request_type: LgpdRequestType;
  request_details: string | null;
  status: LgpdRequestStatus;
  requested_at: string;
  due_at: string;
  sla_days: number;
  resolved_at: string | null;
  resolution_notes: string | null;
}

const lgpdRequestTypeLabel: Record<LgpdRequestType, string> = {
  access: "Acesso aos dados",
  correction: "Correção de dados",
  deletion: "Eliminação de dados",
  portability: "Portabilidade",
  consent_revocation: "Revogação de consentimento",
  opposition: "Oposição ao tratamento",
};

const lgpdStatusLabel: Record<LgpdRequestStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  rejected: "Rejeitada",
};

export default function MinhasConfiguracoes() {
  const { profile, user, refreshProfile } = useAuth();
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isSubmittingLgpdRequest, setIsSubmittingLgpdRequest] = useState(false);
  const [isLoadingLgpdRequests, setIsLoadingLgpdRequests] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [lgpdRequestType, setLgpdRequestType] = useState<LgpdRequestType>("access");
  const [lgpdRequestDetails, setLgpdRequestDetails] = useState("");
  const [lgpdRequests, setLgpdRequests] = useState<LgpdDataRequest[]>([]);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPhone(profile?.phone ?? "");
  }, [profile?.phone]);

  useEffect(() => {
    if (!user?.id) return;
    api
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            appointment_created: data.appointment_created ?? true,
            appointment_completed: data.appointment_completed ?? true,
            appointment_cancelled: data.appointment_cancelled ?? true,
            goal_approved: data.goal_approved ?? true,
            goal_rejected: data.goal_rejected ?? true,
            goal_reminder: data.goal_reminder ?? true,
            goal_reached: data.goal_reached ?? true,
            commission_paid: data.commission_paid ?? true,
          });
        }
      });
  }, [user?.id]);

  const fetchLgpdRequests = async () => {
    if (!user?.id) return;
    setIsLoadingLgpdRequests(true);
    try {
      const { data, error } = await api
        .from("lgpd_data_requests")
        .select("id, request_type, request_details, status, requested_at, due_at, sla_days, resolved_at, resolution_notes")
        .eq("requester_user_id", user.id)
        .order("requested_at", { ascending: false });

      if (error) throw error;
      setLgpdRequests((data || []) as LgpdDataRequest[]);
    } catch (e) {
      logger.error(e);
      toast.error("Não foi possível carregar suas solicitações LGPD");
    } finally {
      setIsLoadingLgpdRequests(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchLgpdRequests();
    }
  }, [user?.id]);

  const handleSaveProfile = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user?.id) return;
    setIsSavingProfile(true);
    try {
      const { error } = await api
        .from("profiles")
        .update({ phone: phone.trim() || null })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Telefone atualizado!");
      refreshProfile();
    } catch (e) {
      toast.error("Erro ao salvar telefone");
      logger.error(e);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato inválido. Use JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2 MB.");
      return;
    }

    // Local preview
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setIsUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await api.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = api.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await api
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      toast.success("Foto de perfil atualizada!");
      await refreshProfile();
    } catch (e) {
      toast.error("Erro ao enviar foto");
      logger.error(e);
      setAvatarPreview(null);
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.id) return;
    setIsUploadingAvatar(true);
    try {
      const { error } = await api
        .from("profiles")
        .update({ avatar_url: null })
        .eq("user_id", user.id);

      if (error) throw error;
      setAvatarPreview(null);
      toast.success("Foto removida.");
      await refreshProfile();
    } catch (e) {
      toast.error("Erro ao remover foto");
      logger.error(e);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSavePrefs = async () => {
    if (!user?.id) return;
    setIsSavingPrefs(true);
    try {
      const { error } = await api
        .from("user_notification_preferences")
        .upsert(
          {
            user_id: user.id,
            ...prefs,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      toast.success("Preferências de notificação salvas!");
    } catch (e) {
      toast.error("Erro ao salvar preferências");
      logger.error(e);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setIsSavingPassword(true);
    try {
      const { error } = await api.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setPassword("");
      setPasswordConfirm("");
    } catch (e) {
      toast.error("Erro ao alterar senha");
      logger.error(e);
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleCreateLgpdRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !profile?.tenant_id) return;

    const details = lgpdRequestDetails.trim();
    if (!details) {
      toast.error("Descreva sua solicitação LGPD");
      return;
    }

    setIsSubmittingLgpdRequest(true);
    try {
      const { error } = await api.from("lgpd_data_requests").insert({
        tenant_id: profile.tenant_id,
        requester_user_id: user.id,
        requester_email: user.email ?? null,
        request_type: lgpdRequestType,
        request_details: details,
      });

      if (error) throw error;

      setLgpdRequestDetails("");
      setLgpdRequestType("access");
      toast.success("Solicitação LGPD enviada com sucesso");
      await fetchLgpdRequests();
    } catch (e) {
      logger.error(e);
      toast.error("Erro ao enviar solicitação LGPD");
    } finally {
      setIsSubmittingLgpdRequest(false);
    }
  };

  const getLgpdStatusVariant = (status: LgpdRequestStatus): "secondary" | "default" | "destructive" => {
    if (status === "completed") return "default";
    if (status === "rejected") return "destructive";
    return "secondary";
  };

  const getLgpdSlaText = (request: LgpdDataRequest) => {
    if (request.status === "completed" || request.status === "rejected") return "Encerrada";
    const dueAtMs = new Date(request.due_at).getTime();
    const nowMs = Date.now();
    const daysRemaining = Math.ceil((dueAtMs - nowMs) / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0) return `Atrasada (${Math.abs(daysRemaining)} dia(s))`;
    if (daysRemaining <= 3) return `Prazo crítico (${daysRemaining} dia(s))`;
    return `No prazo (${daysRemaining} dia(s))`;
  };

  return (
    <MainLayout title="Minhas Configurações" subtitle="Gerencie seu perfil e preferências">
      <div className="grid w-full gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Minhas Configurações</CardTitle>
            <CardDescription>
              Dados pessoais, segurança e solicitações LGPD
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dados pessoais */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Dados pessoais</h3>
              </div>
              {/* Foto de perfil */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative">
                  {avatarPreview || profile?.avatar_url ? (
                    <img
                      src={avatarPreview ?? profile?.avatar_url ?? ""}
                      alt="Foto de perfil"
                      className="h-24 w-24 rounded-2xl object-cover border border-border shadow-sm"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/60 flex items-center justify-center text-3xl font-bold text-primary-foreground shadow-sm border border-border">
                      {profile?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Foto de perfil</p>
                  <p className="text-xs text-muted-foreground">
                    Recomendado: quadrada, 400 × 400 px, máx. 2 MB.<br />
                    Formatos: JPEG, PNG ou WebP.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingAvatar}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Camera className="h-3.5 w-3.5 mr-1.5" />
                      {profile?.avatar_url || avatarPreview ? "Trocar foto" : "Adicionar foto"}
                    </Button>
                    {(profile?.avatar_url || avatarPreview) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isUploadingAvatar}
                        onClick={handleRemoveAvatar}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Remover
                      </Button>
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={user?.email ?? ""} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">
                    Alterações no e-mail devem ser feitas pelo administrador.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSavingProfile} size="sm" data-tour="my-settings-save-phone">
                  {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar telefone
                </Button>
              </div>
            </section>

            <Separator />

            {/* Alterar senha */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Alterar senha</h3>
              </div>
              <form onSubmit={handleChangePassword} className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nova senha</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar nova senha</Label>
                  <Input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Repita a senha"
                  />
                </div>
                <div className="lg:col-span-2 flex justify-end">
                  <Button type="submit" disabled={isSavingPassword} size="sm" data-tour="my-settings-change-password">
                    {isSavingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Alterar senha
                  </Button>
                </div>
              </form>
            </section>

            <Separator />

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Direitos do titular (LGPD)</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Solicite acesso, correção, portabilidade, eliminação, oposição ou revogação de
                consentimento. O administrador da sua clínica acompanha e responde por aqui.
              </p>

              <form onSubmit={handleCreateLgpdRequest} className="space-y-3 rounded-lg border border-border/70 p-3">
                <div className="space-y-2">
                  <Label htmlFor="lgpd-request-type">Tipo de solicitação</Label>
                  <select
                    id="lgpd-request-type"
                    value={lgpdRequestType}
                    onChange={(e) => setLgpdRequestType(e.target.value as LgpdRequestType)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {Object.entries(lgpdRequestTypeLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lgpd-request-details">Descrição</Label>
                  <Textarea
                    id="lgpd-request-details"
                    placeholder="Descreva sua solicitação e, se necessário, quais dados deseja tratar."
                    value={lgpdRequestDetails}
                    onChange={(e) => setLgpdRequestDetails(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={isSubmittingLgpdRequest} data-tour="my-settings-lgpd-submit">
                    {isSubmittingLgpdRequest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Enviar solicitação
                  </Button>
                </div>
              </form>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Minhas solicitações
                </p>
                {isLoadingLgpdRequests ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando solicitações...
                  </div>
                ) : lgpdRequests.length === 0 ? (
                  <div className="rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
                    Você ainda não abriu nenhuma solicitação LGPD.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lgpdRequests.map((request) => (
                      <div key={request.id} className="rounded-lg border border-border/70 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {lgpdRequestTypeLabel[request.request_type]}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant={getLgpdStatusVariant(request.status)}>
                              {lgpdStatusLabel[request.status]}
                            </Badge>
                            <Badge variant="secondary">{getLgpdSlaText(request)}</Badge>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Abertura: {new Date(request.requested_at).toLocaleString("pt-BR")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Prazo LGPD: {new Date(request.due_at).toLocaleString("pt-BR")} ({request.sla_days} dia(s))
                        </p>
                        {request.request_details ? (
                          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                            {request.request_details}
                          </p>
                        ) : null}
                        {request.resolution_notes ? (
                          <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground whitespace-pre-wrap">
                            Resposta do administrador: {request.resolution_notes}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </CardContent>
        </Card>

        <Card className="h-fit xl:col-span-1">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Notificações</CardTitle>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/notificacoes" data-tour="my-settings-view-notifications">Ver notificações</Link>
              </Button>
            </div>
            <CardDescription>
              Escolha quais notificações deseja receber.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: "appointment_created" as const, label: "Novo agendamento para mim" },
              { key: "appointment_completed" as const, label: "Atendimento concluído (por admin)" },
              { key: "appointment_cancelled" as const, label: "Agendamento cancelado" },
              { key: "goal_approved" as const, label: "Meta sugerida aprovada" },
              { key: "goal_rejected" as const, label: "Meta sugerida rejeitada" },
              { key: "goal_reminder" as const, label: "Meta quase alcançada (80%+)" },
              { key: "goal_reached" as const, label: "Meta alcançada" },
              { key: "commission_paid" as const, label: "Comissão paga" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
                <Label htmlFor={key} className="cursor-pointer text-sm leading-snug">
                  {label}
                </Label>
                <Switch
                  id={key}
                  checked={prefs[key]}
                  onCheckedChange={(checked) =>
                    setPrefs((p) => ({ ...p, [key]: checked }))
                  }
                />
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <Button onClick={handleSavePrefs} disabled={isSavingPrefs} size="sm" data-tour="my-settings-save-notification-prefs">
                {isSavingPrefs ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar preferências
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
