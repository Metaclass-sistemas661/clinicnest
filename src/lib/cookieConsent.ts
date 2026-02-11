export type CookieConsentStatus = "granted" | "denied" | null;

export const COOKIE_CONSENT_STORAGE_KEY = "cookie-consent-status";
const COOKIE_CONSENT_COOKIE_NAME = "cookie_consent";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function readConsentFromCookie(): CookieConsentStatus {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";").map((entry) => entry.trim());
  const target = cookies.find((entry) => entry.startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`));
  if (!target) return null;
  const value = decodeURIComponent(target.split("=")[1] ?? "");
  return value === "granted" || value === "denied" ? value : null;
}

export function getCookieConsentStatus(): CookieConsentStatus {
  if (typeof window === "undefined") return null;
  const localValue = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  if (localValue === "granted" || localValue === "denied") {
    return localValue;
  }
  return readConsentFromCookie();
}

export function setCookieConsentStatus(status: Exclude<CookieConsentStatus, null>): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, status);
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${encodeURIComponent(status)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;

  window.dispatchEvent(new Event("cookie-consent-changed"));
}
