let cachedIp: string | null = null;

export async function getClientIp(): Promise<string | null> {
  if (cachedIp) return cachedIp;
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const { ip } = (await res.json()) as { ip: string };
    cachedIp = ip;
    return ip;
  } catch {
    return null;
  }
}
