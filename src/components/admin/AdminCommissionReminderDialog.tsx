import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Users, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const INTERVAL_MS = 45 * 60 * 1000; // 45 minutos
const STORAGE_KEY = "clinicnest_admin_commission_reminder_last";

interface StaffWithoutCommission {
  user_id: string;
  full_name: string;
  profile_id: string;
}

export function AdminCommissionReminderDialog() {
  const auth = useAuth();
  const profile = auth?.profile;
  const isAdmin = auth?.isAdmin ?? false;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [staffWithoutCommission, setStaffWithoutCommission] = useState<StaffWithoutCommission[]>([]);

  const checkStaffWithoutCommission = useCallback(async () => {
    if (!profile?.tenant_id || !isAdmin) return [];

    const [profilesRes, rolesRes, commissionsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_id, full_name")
        .eq("tenant_id", profile.tenant_id),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("tenant_id", profile.tenant_id),
      supabase
        .from("professional_commissions")
        .select("user_id")
        .eq("tenant_id", profile.tenant_id),
    ]);

    if (profilesRes.error || rolesRes.error || commissionsRes.error) return [];

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const commissions = commissionsRes.data || [];

    const staffUserIds = new Set(
      roles.filter((r) => r.role === "staff").map((r) => r.user_id)
    );
    const usersWithCommission = new Set(commissions.map((c) => c.user_id));

    const staffWithout: StaffWithoutCommission[] = profiles
      .filter(
        (p) =>
          staffUserIds.has(p.user_id) && !usersWithCommission.has(p.user_id)
      )
      .map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name || "Profissional",
        profile_id: p.id,
      }));

    return staffWithout;
  }, [profile?.tenant_id, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !profile?.tenant_id) return;

    const runCheck = async () => {
      const staff = await checkStaffWithoutCommission();
      if (staff.length === 0) return;

      const lastShown = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
      const now = Date.now();
      if (now - lastShown >= INTERVAL_MS) {
        setStaffWithoutCommission(staff);
        setOpen(true);
        localStorage.setItem(STORAGE_KEY, String(now));
      }
    };

    runCheck();
    const interval = setInterval(runCheck, INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAdmin, profile?.tenant_id, checkStaffWithoutCommission]);

  const handleSim = () => {
    const first = staffWithoutCommission[0];
    if (first) {
      navigate(`/equipe?highlight=${first.user_id}`);
    }
    setOpen(false);
  };

  const handleDepois = () => {
    setOpen(false);
  };

  const names = staffWithoutCommission.map((s) => s.full_name).join(", ");
  const count = staffWithoutCommission.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/20 text-warning">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg">Comissão ou salário não definido</DialogTitle>
              <DialogDescription>
                {count === 1
                  ? `${names} não tem comissão ou salário fixo definido. Deseja adicionar agora?`
                  : `${count} profissionais não têm comissão ou salário fixo definido: ${names}. Deseja adicionar agora?`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" />
          <span>
            Acesse Equipe para configurar a comissão ou valor fixo de cada profissional.
          </span>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleDepois}>
            Deixar para depois
          </Button>
          <Button className="gradient-primary text-primary-foreground" onClick={handleSim}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Sim, ir para Equipe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
