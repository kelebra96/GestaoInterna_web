export function resolveSignalingUrl(savedUrl?: string | null, envUrl?: string | null): string {
  const fallback = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002';
  const candidate = savedUrl || envUrl || fallback;

  try {
    const url = new URL(candidate, fallback);

    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      if (url.protocol === 'http:') {
        url.protocol = 'https:';
      }

      if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
        return window.location.origin;
      }

      if (url.port === '3002') {
        url.port = '443';
      }
    }

    return url.origin;
  } catch {
    return fallback;
  }
}

