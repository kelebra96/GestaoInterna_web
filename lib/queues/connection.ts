/**
 * Redis Connection for BullMQ
 *
 * BullMQ requer conexão TCP Redis (não REST API).
 *
 * Configuração via variáveis de ambiente (em ordem de prioridade):
 * - REDIS_URL: URL completa (redis://:password@host:port)
 * - REDIS_HOST + REDIS_PASSWORD: Configuração separada
 * - REDIS_TLS_ENABLED: Usar TLS (default: false)
 */

import { ConnectionOptions } from 'bullmq';

/**
 * Parse REDIS_URL para extrair host, port e password
 * Formato: redis://:password@host:port
 */
function parseRedisUrl(url: string): { host: string; port: number; password?: string } | null {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    };
  } catch {
    console.error('[Queues] Erro ao parsear REDIS_URL');
    return null;
  }
}

// Verificar configuração disponível
const redisUrl = process.env.REDIS_URL;
const hasRedisUrl = !!redisUrl;
const hasRedisHostConfig = !!(process.env.REDIS_HOST && process.env.REDIS_PASSWORD);
const hasRedisConfig = hasRedisUrl || hasRedisHostConfig;

/**
 * Configuração de conexão para BullMQ
 * Compatível com Redis local e Upstash
 */
export function getQueueConnection(): ConnectionOptions {
  // Prioridade 1: REDIS_URL
  if (hasRedisUrl) {
    const parsed = parseRedisUrl(redisUrl!);
    if (parsed) {
      console.log('[Queues] Usando REDIS_URL para conexão');
      const connection: ConnectionOptions = {
        host: parsed.host,
        port: parsed.port,
        password: parsed.password,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      };

      if (process.env.REDIS_TLS_ENABLED === 'true') {
        connection.tls = {};
      }

      return connection;
    }
  }

  // Prioridade 2: REDIS_HOST + REDIS_PASSWORD
  if (hasRedisHostConfig) {
    console.log('[Queues] Usando REDIS_HOST para conexão');
    const connection: ConnectionOptions = {
      host: process.env.REDIS_HOST!,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD!,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    if (process.env.REDIS_TLS_ENABLED === 'true') {
      connection.tls = {};
    }

    return connection;
  }

  // Fallback: configuração local sem senha
  console.warn('[Queues] Redis não configurado. Filas não funcionarão.');
  return {
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
  };
}

/**
 * Configuração padrão para todas as filas
 */
export const defaultQueueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    removeOnComplete: {
      count: 1000, // Manter últimos 1000 jobs completos
      age: 24 * 60 * 60, // Ou jobs com menos de 24h
    },
    removeOnFail: {
      count: 5000, // Manter últimos 5000 jobs falhados
      age: 7 * 24 * 60 * 60, // Ou jobs com menos de 7 dias
    },
  },
};

/**
 * Configuração padrão para workers
 */
export const defaultWorkerOptions = {
  concurrency: 5, // Processar 5 jobs simultaneamente
  limiter: {
    max: 100, // Máximo 100 jobs
    duration: 1000, // Por segundo
  },
};

/**
 * Verifica se as filas estão configuradas
 */
export function isQueueConfigured(): boolean {
  if (hasRedisUrl) {
    const parsed = parseRedisUrl(redisUrl!);
    return !!parsed;
  }
  return hasRedisHostConfig;
}

export const queueConnection = getQueueConnection();
