/**
 * Fetch with Timeout
 *
 * Wrapper para fetch com timeout configurável.
 * Evita requests eternos que podem travar o sistema.
 *
 * Uso:
 *   const response = await fetchWithTimeout('https://api.openai.com/...', {
 *     method: 'POST',
 *     headers: { ... },
 *     body: JSON.stringify({ ... }),
 *   }, 10000); // 10 segundos
 */

export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export interface FetchWithTimeoutOptions extends RequestInit {
  /**
   * Timeout em milissegundos
   * @default 30000 (30 segundos)
   */
  timeoutMs?: number;
}

/**
 * Fetch com timeout configurável
 * @param url URL para fetch
 * @param options Opções do fetch + timeout
 * @returns Response do fetch
 * @throws TimeoutError se o timeout for atingido
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new TimeoutError(
        `Request to ${url} timed out after ${timeoutMs}ms`,
        timeoutMs
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch com retry e timeout
 * Combina retry com backoff exponencial e timeout por tentativa
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithTimeoutOptions & {
    maxRetries?: number;
    retryDelayMs?: number;
    retryOn?: (response: Response) => boolean;
  } = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    retryDelayMs = 1000,
    retryOn = (res) => res.status >= 500,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions);

      // Se não deve fazer retry, retorna a response
      if (!retryOn(response) || attempt === maxRetries) {
        return response;
      }

      // Aguardar antes de retry
      const delay = retryDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error: any) {
      lastError = error;

      // Não fazer retry em timeout ou se é a última tentativa
      if (error instanceof TimeoutError || attempt === maxRetries) {
        throw error;
      }

      // Aguardar antes de retry
      const delay = retryDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('All retries failed');
}

export default fetchWithTimeout;
