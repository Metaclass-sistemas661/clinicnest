import { createRoot } from "react-dom/client";
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
(window as any).__VYNLOBELLA_BUILD__ = buildInfo;
console.info("[VynloBella Build]", buildInfo);

createRoot(document.getElementById("root")!).render(<App />);
