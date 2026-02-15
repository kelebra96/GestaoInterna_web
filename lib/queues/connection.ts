/**
 * Redis Connection for BullMQ
 *
 * BullMQ requer conexão TCP Redis (não REST API).
 * Usa ioredis com as credenciais do Upstash.
 *
 * Configuração via variáveis de ambiente:
 * - REDIS_HOST: Host do Redis
 * - REDIS_PORT: Porta (default: 6379)
 * - REDIS_PASSWORD: Senha de autenticação
 * - REDIS_TLS_ENABLED: Usar TLS (default: true para Upstash)
 */

import { ConnectionOptions } from 'bullmq';

// Verificar se estamos em ambiente de desenvolvimento sem Redis
const isDevelopment = process.env.NODE_ENV === 'development';
const hasRedisConfig = !!(process.env.REDIS_HOST && process.env.REDIS_PASSWORD);

/**
 * Configuração de conexão para BullMQ
 * Compatível com Upstash Redis (TLS habilitado)
 */
export function getQueueConnection(): ConnectionOptions {
  if (!hasRedisConfig) {
    console.warn('[Queues] Redis não configurado. Filas não funcionarão.');
    // Retorna configuração dummy que vai falhar - melhor do que silently não funcionar
    return {
      host: 'localhost',
      port: 6379,
    };
  }

  const connection: ConnectionOptions = {
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD!,
    maxRetriesPerRequest: null, // Necessário para BullMQ
    enableReadyCheck: false, // Melhora performance
  };

  // Upstash requer TLS
  if (process.env.REDIS_TLS_ENABLED === 'true') {
    connection.tls = {};
  }

  return connection;
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
  return hasRedisConfig;
}

export const queueConnection = getQueueConnection();
