/**
 * Client Device & IP Telemetry Detector
 * Identifies the visitor's OS, browser, device category, and public IP address.
 */

export interface ClientTelemetry {
  os: string;
  browser: string;
  deviceType: 'workstation' | 'mobile' | 'tablet';
  ip: string;
  loading: boolean;
}

export function detectClientDevice(): {
  os: string;
  browser: string;
  deviceType: 'workstation' | 'mobile' | 'tablet';
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      os: 'Client Workstation',
      browser: 'Web Browser',
      deviceType: 'workstation',
    };
  }

  const ua = navigator.userAgent;
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';

  // 1. Detect Operating System & Form Factor
  let os = 'Workstation';
  let deviceType: 'workstation' | 'mobile' | 'tablet' = 'workstation';

  if (/iPad|Tablet/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    os = 'iPad Tablet';
    deviceType = 'tablet';
  } else if (/iPhone|iPod/i.test(ua)) {
    os = 'iOS Mobile';
    deviceType = 'mobile';
  } else if (/Android/i.test(ua)) {
    const isTablet = !/Mobile/i.test(ua) || /Tablet/i.test(ua);
    os = isTablet ? 'Android Tablet' : 'Android Mobile';
    deviceType = isTablet ? 'tablet' : 'mobile';
  } else if (/Windows/i.test(ua) || /Win/i.test(platform)) {
    os = 'Windows Workstation';
    deviceType = 'workstation';
  } else if (/Macintosh|MacIntel|Mac OS X/i.test(ua)) {
    os = 'macOS Workstation';
    deviceType = 'workstation';
  } else if (/Linux/i.test(ua) || /Linux/i.test(platform)) {
    os = 'Linux Workstation';
    deviceType = 'workstation';
  } else if (/CrOS/i.test(ua)) {
    os = 'ChromeOS Device';
    deviceType = 'workstation';
  }

  // 2. Detect Specific Browser Engine
  let browser = 'Chrome Browser';

  // Check Brave browser
  const isBrave = typeof (navigator as any).brave?.isBrave === 'function';

  if (isBrave) {
    browser = 'Brave Browser';
  } else if (/Edg\//i.test(ua)) {
    browser = 'Edge Browser';
  } else if (/OPR\/|Opera\//i.test(ua)) {
    browser = 'Opera Browser';
  } else if (/SamsungBrowser/i.test(ua)) {
    browser = 'Samsung Browser';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Firefox Browser';
  } else if (/Chrome\//i.test(ua)) {
    browser = 'Chrome Browser';
  } else if (/Safari\//i.test(ua)) {
    browser = 'Safari Browser';
  } else {
    browser = 'Modern Browser';
  }

  return { os, browser, deviceType };
}

/**
 * Fetches the client's real public IP address.
 * Uses a prioritized multi-tiered race with fast timeouts.
 */
export async function fetchClientIP(): Promise<string> {
  const timeoutMs = 3000;

  // Helper with AbortSignal timeout
  const fetchWithTimeout = async (url: string): Promise<string | null> => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (data && typeof data.ip === 'string' && data.ip.trim()) {
        return data.ip.trim();
      }
      return null;
    } catch {
      return null;
    }
  };

  // 1. Primary: Fast public ipify endpoint
  const primaryIp = await fetchWithTimeout('https://api.ipify.org?format=json');
  if (primaryIp) return primaryIp;

  // 2. Secondary: Dual-stack IPv4/IPv6 ipify
  const secondaryIp = await fetchWithTimeout('https://api64.ipify.org?format=json');
  if (secondaryIp) return secondaryIp;

  // 3. Fallback: Internal backend /user/client-info
  try {
    const apiBase = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
    const backendIp = await fetchWithTimeout(`${apiBase}/user/client-info`);
    if (backendIp) return backendIp;
  } catch {
    // ignore
  }

  // 4. Ultimate fallback if offline or blocked
  return '127.0.0.1';
}
