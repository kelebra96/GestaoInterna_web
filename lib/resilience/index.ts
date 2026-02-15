/**
 * Resilience Module - Sprint 2
 *
 * Exporta todas as funcionalidades de resiliência:
 * - Circuit Breaker: Proteção contra falhas em cascata
 * - Retry Service: Retry com backoff exponencial
 * - Fetch with Timeout: Timeouts em chamadas HTTP
 */

// Circuit Breaker
export {
  circuitBreakers,
  withCircuitBreaker,
  getCircuitBreakerMetrics,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
  resetAllCircuitBreakers,
  type CircuitBreakerOptions,
  type CircuitBreakerMetrics,
} from './circuit-breaker';

// Retry Service
export {
  RetryService,
  type RetryOptions,
  type RetryResult,
} from './retry.service';

// Fetch with Timeout
export {
  fetchWithTimeout,
  fetchWithRetry,
  TimeoutError,
  type FetchWithTimeoutOptions,
} from '../utils/fetch-with-timeout';
