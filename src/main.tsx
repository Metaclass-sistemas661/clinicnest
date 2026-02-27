import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

const buildInfo = {
  commit: __BUILD_COMMIT__,
  ref: __BUILD_REF__,
  env: __BUILD_ENV__,
  time: __BUILD_TIME__,
} as const;

// Expor para debug rápido no navegador
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__CLINICNEST_BUILD__ = buildInfo;
console.info("[ClinicNest Build]", buildInfo);

const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: (buildInfo.env ?? "unknown") as string,
    release: (buildInfo.commit ?? "dev") as string,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: buildInfo.env === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
  });
  Sentry.setTag("build_ref", buildInfo.ref);
  Sentry.setTag("build_time", buildInfo.time);
}

createRoot(document.getElementById("root")!).render(<App />);
