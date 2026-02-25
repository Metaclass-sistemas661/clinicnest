import { lazy, ComponentType } from "react";

const RELOAD_KEY = "chunk_reload_attempted";

function shouldReload(): boolean {
  const lastReload = sessionStorage.getItem(RELOAD_KEY);
  if (!lastReload) return true;
  const elapsed = Date.now() - parseInt(lastReload, 10);
  return elapsed > 10000;
}

function markReloadAttempted(): void {
  sessionStorage.setItem(RELOAD_KEY, Date.now().toString());
}

function retryImport<T>(
  importFn: () => Promise<{ default: T }>,
  retriesLeft: number,
  interval: number
): Promise<{ default: T }> {
  return importFn().catch((error) => {
    const isChunkError =
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("Loading CSS chunk");

    if (retriesLeft <= 0) {
      if (isChunkError && shouldReload()) {
        markReloadAttempted();
        window.location.reload();
      }
      throw error;
    }

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        retryImport(importFn, retriesLeft - 1, interval).then(resolve).catch(reject);
      }, interval);
    });
  });
}

/**
 * Lazy load com retry automático quando o chunk falha (ex: deploy novo, cache desatualizado).
 * Útil para erros "Failed to fetch dynamically imported module".
 * Após esgotar retries, faz reload automático da página uma vez.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  interval = 1500
): React.LazyExoticComponent<T> {
  return lazy(() =>
    retryImport(importFn, retries - 1, interval).then((mod) => {
      if (!mod || typeof mod !== "object" || !("default" in mod) || !mod.default) {
        const keys = mod && typeof mod === "object" ? Object.keys(mod as object).join(",") : "<invalid>";
        throw new Error(
          `lazyWithRetry: o módulo importado não possui export default (keys: ${keys}). ` +
            "Verifique se a página/componente exporta 'export default ...'."
        );
      }
      return mod;
    })
  ) as React.LazyExoticComponent<T>;
}
