/**
 * P3: Utilitário para executar geração de PDF em thread separada (offload via scheduler)
 * 
 * Usa `scheduler.postTask` (onde disponível) ou `requestIdleCallback` como fallback
 * para evitar bloqueio da main thread durante a geração de PDFs pesados.
 * 
 * Nota: jsPDF precisa de acesso ao DOM, então não pode rodar em Web Worker real.
 * Esta abordagem usa yield-to-main via scheduler API.
 */

type TaskPriority = "background" | "user-visible" | "user-blocking";

interface Scheduler {
  postTask<T>(cb: () => T, options?: { priority?: TaskPriority }): Promise<T>;
}

declare global {
  interface Window {
    scheduler?: Scheduler;
  }
}

/**
 * Executa uma tarefa pesada (como geração de PDF) com prioridade "background"
 * para não bloquear interações do usuário.
 */
export function runInBackground<T>(task: () => T): Promise<T> {
  // Scheduler API (Chrome 94+)
  if (typeof window !== "undefined" && window.scheduler?.postTask) {
    return window.scheduler.postTask(task, { priority: "background" });
  }

  // requestIdleCallback fallback
  if (typeof requestIdleCallback === "function") {
    return new Promise((resolve, reject) => {
      requestIdleCallback(() => {
        try {
          resolve(task());
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  // setTimeout fallback (always available)
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(task());
      } catch (err) {
        reject(err);
      }
    }, 0);
  });
}
