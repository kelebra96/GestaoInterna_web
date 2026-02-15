/**
 * Circuit Breaker Service
 *
 * Implementa o padrão Circuit Breaker para proteger contra falhas em cascata.
 * Quando um serviço externo falha repetidamente, o circuito "abre" e
 * retorna um fallback imediatamente, evitando sobrecarga.
 *
 * Estados:
 * - CLOSED: Normal, requests passam
 * - OPEN: Falhas demais, requests bloqueados, retorna fallback
 * - HALF_OPEN: Testando se serviço recuperou
 *
 * Uso:
 *   const result = await circuitBreakers.openai.fire(async () => {
 *     return await callOpenAI(prompt);
 *   });
 */

import CircuitBreaker from 'opossum';

// Tipos
export interface CircuitBreakerOptions {
  /** Timeout em ms para cada chamada */
  timeout?: number;
  /** Porcentagem de erros para abrir o circuito */
  errorThresholdPercentage?: number;
  /** Tempo em ms para tentar fechar o circuito */
  resetTimeout?: number;
  /** Número mínimo de requests antes de calcular erro % */
  volumeThreshold?: number;
}

export interface CircuitBreakerMetrics {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  stats: {
    successes: number;
    failures: number;
    timeouts: number;
    fallbacks: number;
    rejects: number;
  };
}

// Configurações padrão por serviço
const DEFAULT_OPTIONS: Record<string, CircuitBreakerOptions> = {
  openai: {
    timeout: 30000, // OpenAI pode demorar
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 5,
  },
  googleVision: {
    timeout: 15000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 5,
  },
  firebase: {
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 5,
  },
  supabase: {
    timeout: 10000,
    errorThresholdPercentage: 70, // Mais tolerante - é crítico
    resetTimeout: 15000,
    volumeThreshold: 10,
  },
  external: {
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 5,
  },
};

// Fallbacks padrão
const DEFAULT_FALLBACKS: Record<string, () => any> = {
  openai: () => ({
    success: false,
    error: 'circuit_open',
    message: 'OpenAI service temporarily unavailable',
    fallback: true,
  }),
  googleVision: () => ({
    success: false,
    error: 'circuit_open',
    message: 'Google Vision service temporarily unavailable',
    fallback: true,
  }),
  firebase: () => ({
    success: false,
    error: 'circuit_open',
    message: 'Firebase service temporarily unavailable',
    fallback: true,
  }),
  supabase: () => ({
    success: false,
    error: 'circuit_open',
    message: 'Database service temporarily unavailable',
    fallback: true,
  }),
  external: () => ({
    success: false,
    error: 'circuit_open',
    message: 'External service temporarily unavailable',
    fallback: true,
  }),
};

// Cache de circuit breakers
const breakers: Map<string, CircuitBreaker<any[], any>> = new Map();

/**
 * Cria ou obtém um circuit breaker
 */
function getOrCreateBreaker<T>(
  name: string,
  action: (...args: any[]) => Promise<T>,
  options?: CircuitBreakerOptions,
  fallback?: () => T
): CircuitBreaker<any[], T> {
  const key = name;

  if (breakers.has(key)) {
    return breakers.get(key)!;
  }

  const finalOptions = {
    ...DEFAULT_OPTIONS[name] || DEFAULT_OPTIONS.external,
    ...options,
  };

  const breaker = new CircuitBreaker(action, {
    timeout: finalOptions.timeout,
    errorThresholdPercentage: finalOptions.errorThresholdPercentage,
    resetTimeout: finalOptions.resetTimeout,
    volumeThreshold: finalOptions.volumeThreshold,
  });

  // Configurar fallback
  const fallbackFn = fallback || DEFAULT_FALLBACKS[name] || DEFAULT_FALLBACKS.external;
  breaker.fallback(fallbackFn);

  // Eventos para logging
  breaker.on('open', () => {
    console.warn(`[CircuitBreaker] ${name}: OPENED - Too many failures`);
  });

  breaker.on('halfOpen', () => {
    console.info(`[CircuitBreaker] ${name}: HALF_OPEN - Testing recovery`);
  });

  breaker.on('close', () => {
    console.info(`[CircuitBreaker] ${name}: CLOSED - Service recovered`);
  });

  breaker.on('fallback', () => {
    console.warn(`[CircuitBreaker] ${name}: Fallback executed`);
  });

  breaker.on('timeout', () => {
    console.warn(`[CircuitBreaker] ${name}: Request timed out`);
  });

  breakers.set(key, breaker);
  return breaker;
}

/**
 * Executa uma função protegida por circuit breaker
 */
export async function withCircuitBreaker<T>(
  name: string,
  action: () => Promise<T>,
  options?: CircuitBreakerOptions & { fallback?: () => T }
): Promise<T> {
  const breaker = getOrCreateBreaker(
    name,
    action,
    options,
    options?.fallback
  );

  return breaker.fire();
}

/**
 * Obtém métricas de todos os circuit breakers
 */
export function getCircuitBreakerMetrics(): CircuitBreakerMetrics[] {
  const metrics: CircuitBreakerMetrics[] = [];

  for (const [name, breaker] of breakers) {
    const stats = breaker.stats;
    metrics.push({
      name,
      state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
      stats: {
        successes: stats.successes,
        failures: stats.failures,
        timeouts: stats.timeouts,
        fallbacks: stats.fallbacks,
        rejects: stats.rejects,
      },
    });
  }

  return metrics;
}

/**
 * Obtém status de um circuit breaker específico
 */
export function getCircuitBreakerStatus(name: string): CircuitBreakerMetrics | null {
  const breaker = breakers.get(name);
  if (!breaker) return null;

  const stats = breaker.stats;
  return {
    name,
    state: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
    stats: {
      successes: stats.successes,
      failures: stats.failures,
      timeouts: stats.timeouts,
      fallbacks: stats.fallbacks,
      rejects: stats.rejects,
    },
  };
}

/**
 * Reseta um circuit breaker (força fechamento)
 */
export function resetCircuitBreaker(name: string): boolean {
  const breaker = breakers.get(name);
  if (!breaker) return false;

  breaker.close();
  return true;
}

/**
 * Reseta todos os circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  for (const breaker of breakers.values()) {
    breaker.close();
  }
}

// Circuit breakers pré-configurados para serviços comuns
export const circuitBreakers = {
  /**
   * Circuit breaker para chamadas OpenAI
   */
  openai: {
    fire: async <T>(action: () => Promise<T>, fallback?: () => T): Promise<T> => {
      return withCircuitBreaker('openai', action, { fallback });
    },
    getStatus: () => getCircuitBreakerStatus('openai'),
    reset: () => resetCircuitBreaker('openai'),
  },

  /**
   * Circuit breaker para chamadas Google Vision
   */
  googleVision: {
    fire: async <T>(action: () => Promise<T>, fallback?: () => T): Promise<T> => {
      return withCircuitBreaker('googleVision', action, { fallback });
    },
    getStatus: () => getCircuitBreakerStatus('googleVision'),
    reset: () => resetCircuitBreaker('googleVision'),
  },

  /**
   * Circuit breaker para chamadas Firebase
   */
  firebase: {
    fire: async <T>(action: () => Promise<T>, fallback?: () => T): Promise<T> => {
      return withCircuitBreaker('firebase', action, { fallback });
    },
    getStatus: () => getCircuitBreakerStatus('firebase'),
    reset: () => resetCircuitBreaker('firebase'),
  },

  /**
   * Circuit breaker para chamadas Supabase (mais tolerante)
   */
  supabase: {
    fire: async <T>(action: () => Promise<T>, fallback?: () => T): Promise<T> => {
      return withCircuitBreaker('supabase', action, { fallback });
    },
    getStatus: () => getCircuitBreakerStatus('supabase'),
    reset: () => resetCircuitBreaker('supabase'),
  },

  /**
   * Circuit breaker genérico para outras APIs externas
   */
  external: {
    fire: async <T>(
      name: string,
      action: () => Promise<T>,
      options?: { fallback?: () => T; timeout?: number }
    ): Promise<T> => {
      return withCircuitBreaker(`external:${name}`, action, options);
    },
    getStatus: (name: string) => getCircuitBreakerStatus(`external:${name}`),
    reset: (name: string) => resetCircuitBreaker(`external:${name}`),
  },
};

export default circuitBreakers;
