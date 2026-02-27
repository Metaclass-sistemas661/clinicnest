/// <reference types="vite/client" />

declare const __BUILD_COMMIT__: string;
declare const __BUILD_REF__: string;
declare const __BUILD_ENV__: string;
declare const __BUILD_TIME__: string;
declare const __APP_VERSION__: string;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
