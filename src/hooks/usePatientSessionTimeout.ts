import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * usePatientSessionTimeout
 *
 * Monitors user activity and enforces:
 * - Inactivity timeout: 15 minutes without interaction → auto logout
 * - Max session age: 24 hours since login → auto logout
 *
 * Listens for: mousemove, keydown, click, scroll, touchstart
 * Shows toast before redirecting to login.
 */

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_START_KEY = "patient-session-start";
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

export function usePatientSessionTimeout() {
  const navigate = useNavigate();
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionCheckTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoggingOut = useRef(false);

  const doLogout = useCallback(async (reason: "inactivity" | "max_age") => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;

    logger.info(`[SessionTimeout] Logout reason: ${reason}`);

    try {
      await supabasePatient.auth.signOut();
    } catch (err) {
      logger.error("[SessionTimeout] signOut error:", err);
    }

    localStorage.removeItem(SESSION_START_KEY);

    toast.info("Sessão expirada", {
      description:
        reason === "inactivity"
          ? "Você foi desconectado por inatividade."
          : "Sua sessão expirou. Faça login novamente.",
      duration: 5000,
    });

    navigate("/paciente/login", { replace: true });
  }, [navigate]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = setTimeout(() => {
      doLogout("inactivity");
    }, INACTIVITY_TIMEOUT_MS);
  }, [doLogout]);

  // Record session start on mount (if not already set)
  useEffect(() => {
    if (!localStorage.getItem(SESSION_START_KEY)) {
      localStorage.setItem(SESSION_START_KEY, Date.now().toString());
    }
  }, []);

  // Inactivity monitoring
  useEffect(() => {
    resetInactivityTimer();

    const handler = () => resetInactivityTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handler, { passive: true });
    }

    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handler);
      }
    };
  }, [resetInactivityTimer]);

  // Max session age check (every 60s)
  useEffect(() => {
    const checkMaxAge = () => {
      const startStr = localStorage.getItem(SESSION_START_KEY);
      if (!startStr) return;
      const elapsed = Date.now() - parseInt(startStr, 10);
      if (elapsed >= MAX_SESSION_AGE_MS) {
        doLogout("max_age");
      }
    };

    // Check immediately
    checkMaxAge();

    sessionCheckTimer.current = setInterval(checkMaxAge, 60_000);

    return () => {
      if (sessionCheckTimer.current) clearInterval(sessionCheckTimer.current);
    };
  }, [doLogout]);
}
