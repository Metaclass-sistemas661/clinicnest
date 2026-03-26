/**
 * PatientShellRoute — Layout route for the patient portal.
 *
 * Combines auth guard + consent gate + persistent layout shell (sidebar,
 * top bar, mobile nav) into a single parent route that stays mounted across
 * navigations. Only the page content changes via <Outlet />.
 *
 * This eliminates the "reload + sidebar scroll reset" issue that happened
 * when each route independently mounted its own PatientProtectedRoute,
 * ConsentGate, and PatientLayout.
 */

import { useState, useEffect, useCallback } from "react";
import { Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { PatientSubscriptionGuard } from "@/components/subscription/PatientSubscriptionGuard";
import { useIsMobile } from "@/hooks/use-mobile";
import { PatientBottomNav } from "@/components/patient/PatientBottomNav";
import { PatientGlobalSearch, usePatientGlobalSearch } from "@/components/patient/PatientGlobalSearch";
import { DependentBanner } from "@/components/patient/DependentSelector";
import { DependentsProvider, useDependentsOptional } from "@/hooks/useDependents";
import { AiPatientChat } from "@/components/ai";
import { SidebarContent } from "./PatientLayout";
import { logger } from "@/lib/logger";
import { usePatientSessionTimeout } from "@/hooks/usePatientSessionTimeout";
import { usePatientAuthSync } from "@/hooks/usePatientAuthSync";

import { PatientShellContext } from "./PatientShellContext";
export { usePatientShell } from "./PatientShellContext";

// ── Dependent banner wrapper ─────────────────────────────────────────────────
function DependentBannerWrapper() {
  const ctx = useDependentsOptional();
  if (!ctx?.activeDependent) return null;
  return (
    <DependentBanner
      dependent={ctx.activeDependent}
      onClear={() => ctx.setActiveDependent(null)}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PatientShellRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // ── Auth state ──
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [patientUser, setPatientUser] = useState<User | null>(null);

  // ── Consent state ──
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentAllowed, setConsentAllowed] = useState(false);
  const [isCheckingConsent, setIsCheckingConsent] = useState(false);

  // ── Shell UI state ──
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { isOpen: searchOpen, setIsOpen: setSearchOpen } = usePatientGlobalSearch();

  // ── Session timeout (inactivity 15min + max age 24h) ──
  usePatientSessionTimeout();

  // ── Cross-tab logout sync ──
  usePatientAuthSync();

  // ── Auth check (runs once) ──
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data: { session } } = await supabasePatient.auth.getSession();
      if (cancelled) return;

      if (!session?.user || session.user.user_metadata?.account_type !== "patient") {
        setPatientUser(null);
        setIsAuthLoading(false);
        return;
      }

      setPatientUser(session.user);
      setIsAuthLoading(false);
    };

    void check();

    const { data: { subscription } } = supabasePatient.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (!session?.user || session.user.user_metadata?.account_type !== "patient") {
        setPatientUser(null);
      } else {
        setPatientUser(session.user);
      }
      setIsAuthLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // ── Consent check ──
  const checkConsents = useCallback(async () => {
    if (!patientUser?.email) {
      setConsentAllowed(true);
      setConsentChecked(true);
      return;
    }

    // Only show spinner on the very first check
    if (!consentChecked) {
      setIsCheckingConsent(true);
    }

    try {
      const { data: client } = await (supabasePatient as any)
        .from("patients")
        .select("id")
        .eq("email", patientUser.email)
        .limit(1)
        .maybeSingle();

      if (!client?.id) {
        setConsentAllowed(true);
        setConsentChecked(true);
        setIsCheckingConsent(false);
        return;
      }

      const { data: pending, error } = await (supabasePatient as any).rpc("get_pending_consents", {
        p_client_id: client.id,
      });

      if (error) {
        logger.error("[PatientShellRoute] consent check error", error);
        setConsentAllowed(true);
        setConsentChecked(true);
        setIsCheckingConsent(false);
        return;
      }

      const hasPending = Array.isArray(pending) && pending.length > 0;
      if (hasPending) {
        navigate("/paciente/termos", { replace: true });
        return;
      }

      setConsentAllowed(true);
    } catch (err) {
      logger.error("[PatientShellRoute] consent check error", err);
      setConsentAllowed(true);
    } finally {
      setConsentChecked(true);
      setIsCheckingConsent(false);
    }
  }, [patientUser, navigate, consentChecked]);

  useEffect(() => {
    if (!isAuthLoading && patientUser) {
      checkConsents();
    }
  }, [isAuthLoading, patientUser, location.pathname, checkConsents]);

  // ── Render: loading / redirect ──
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" className="text-teal-600" />
      </div>
    );
  }

  if (!patientUser) {
    return <Navigate to="/paciente/login" replace />;
  }

  if (isCheckingConsent && !consentChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" className="text-teal-600" />
      </div>
    );
  }

  if (!consentAllowed && !consentChecked) {
    return null;
  }

  // ── Render: persistent shell ──
  return (
    <PatientSubscriptionGuard>
      <DependentsProvider>
        <PatientShellContext.Provider value={{ inShell: true, searchOpen, setSearchOpen }}>
          <div className={cn(
            "h-screen w-screen overflow-hidden",
            !isMobile && "bg-teal-600 dark:bg-teal-700 p-2"
          )}>
            <div className={cn(
              "h-full w-full bg-background relative flex overflow-hidden",
              !isMobile && "rounded-2xl"
            )}>
              {/* Global Search */}
              <PatientGlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

              {/* Desktop sidebar — persistent, never remounts */}
              {!isMobile && (
                <aside
                  className={cn(
                    "hidden lg:flex flex-col bg-teal-600 dark:bg-teal-700 transition-all duration-300 flex-shrink-0 overflow-hidden",
                    collapsed ? "w-[68px]" : "w-[260px]"
                  )}
                >
                  <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
                </aside>
              )}

              {/* Mobile sidebar */}
              {isMobile && (
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="fixed top-3 left-3 z-50 lg:hidden h-10 w-10 rounded-xl bg-background/80 backdrop-blur-sm border shadow-sm"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-[280px] bg-teal-600 dark:bg-teal-700 border-none">
                    <SidebarContent collapsed={false} onNavigate={() => setSheetOpen(false)} />
                  </SheetContent>
                </Sheet>
              )}

              {/* Main content */}
              <main className={cn("flex-1 min-w-0 min-h-0 overflow-y-auto flex flex-col", isMobile && "pb-20")}>
                {/* Dependent banner */}
                <DependentBannerWrapper />

                {/* Page content via Outlet — each page renders its own PatientLayout (lightweight mode) */}
                <div className={cn(
                  "animate-fade-in flex-1",
                  isMobile ? "p-4" : "px-8 pt-6 pb-8"
                )}>
                  <Outlet />
                </div>
              </main>

              {/* Mobile bottom navigation */}
              {isMobile && <PatientBottomNav />}

              {/* Chat IA */}
              <AiPatientChat />
            </div>
          </div>
        </PatientShellContext.Provider>
      </DependentsProvider>
    </PatientSubscriptionGuard>
  );
}
