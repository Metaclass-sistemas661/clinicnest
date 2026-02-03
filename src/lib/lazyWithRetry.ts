import { lazy, ComponentType } from "react";

function retryImport<T>(
  importFn: () => Promise<{ default: T }>,
  retriesLeft: number,
  interval: number
): Promise<{ default: T }> {
  return importFn().catch((error) => {
    if (retriesLeft <= 0) throw error;
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
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  interval = 1500
): React.LazyExoticComponent<T> {
  return lazy(() => retryImport(importFn, retries - 1, interval)) as React.LazyExoticComponent<T>;
}
