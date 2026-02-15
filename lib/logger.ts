/**
 * Structured Logger - Sprint 4 Observabilidade
 *
 * Logger estruturado com:
 * - Logs em formato JSON para fácil parsing
 * - Níveis: debug, info, warn, error
 * - Contexto automático (módulo, operação, duração)
 * - Integração com Sentry para erros
 * - Request tracing via correlationId
 *
 * Uso:
 *   import { logger } from '@/lib/logger';
 *
 *   logger.info('Usuário logado', {
 *     module: 'auth',
 *     operation: 'login',
 *     userId: user.id,
 *   });
 *
 *   logger.error('Falha ao processar', {
 *     module: 'dashboard',
 *     operation: 'build',
 *     error: err,
 *   });
 */

import * as Sentry from '@sentry/nextjs';

// Tipos
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  /** Módulo/área do sistema */
  module?: string;
  /** Operação sendo executada */
  operation?: string;
  /** ID do usuário (se autenticado) */
  userId?: string;
  /** ID da organização */
  orgId?: string;
  /** ID de correlação para tracing */
  correlationId?: string;
  /** Duração em ms */
  durationMs?: number;
  /** Erro (será serializado) */
  error?: Error | any;
  /** Dados extras */
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  environment: string;
  context: LogContext;
}

// Configuração
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
const ENABLE_JSON_LOGS = process.env.NODE_ENV === 'production';

/**
 * Serializa erro para log
 */
function serializeError(error: any): Record<string, any> {
  if (!error) return {};

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error as any).code && { code: (error as any).code },
    };
  }

  return { message: String(error) };
}

/**
 * Formata log entry
 */
function formatLogEntry(
  level: LogLevel,
  message: string,
  context: LogContext = {}
): LogEntry {
  const { error, ...restContext } = context;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    environment: process.env.NODE_ENV || 'development',
    context: {
      ...restContext,
      ...(error && { error: serializeError(error) }),
    },
  };

  return entry;
}

/**
 * Output do log
 */
function outputLog(entry: LogEntry): void {
  const { level, message, context } = entry;

  if (ENABLE_JSON_LOGS) {
    // JSON para produção (fácil parsing por ferramentas)
    console[level](JSON.stringify(entry));
  } else {
    // Formato legível para desenvolvimento
    const prefix = `[${entry.timestamp.split('T')[1].split('.')[0]}]`;
    const levelTag = `[${level.toUpperCase()}]`;
    const moduleTag = context.module ? `[${context.module}]` : '';
    const durationTag = context.durationMs ? ` (${context.durationMs}ms)` : '';

    const contextStr = Object.entries(context)
      .filter(([k]) => !['module', 'operation', 'durationMs', 'error'].includes(k))
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' ');

    console[level](
      `${prefix} ${levelTag}${moduleTag} ${message}${durationTag}`,
      contextStr ? `| ${contextStr}` : '',
      context.error ? `\n  Error: ${context.error.message}` : ''
    );
  }
}

/**
 * Verifica se deve logar baseado no nível
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

/**
 * Logger principal
 */
export const logger = {
  /**
   * Log de debug (apenas desenvolvimento)
   */
  debug(message: string, context?: LogContext): void {
    if (!shouldLog('debug')) return;
    const entry = formatLogEntry('debug', message, context);
    outputLog(entry);
  },

  /**
   * Log informativo
   */
  info(message: string, context?: LogContext): void {
    if (!shouldLog('info')) return;
    const entry = formatLogEntry('info', message, context);
    outputLog(entry);
  },

  /**
   * Log de aviso
   */
  warn(message: string, context?: LogContext): void {
    if (!shouldLog('warn')) return;
    const entry = formatLogEntry('warn', message, context);
    outputLog(entry);

    // Enviar warnings para Sentry em produção
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureMessage(message, {
        level: 'warning',
        extra: context,
      });
    }
  },

  /**
   * Log de erro
   */
  error(message: string, context?: LogContext): void {
    if (!shouldLog('error')) return;
    const entry = formatLogEntry('error', message, context);
    outputLog(entry);

    // Enviar erros para Sentry
    if (context?.error instanceof Error) {
      Sentry.captureException(context.error, {
        extra: context,
      });
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: context,
      });
    }
  },

  /**
   * Cria logger com contexto pré-definido
   */
  child(defaultContext: Partial<LogContext>) {
    return {
      debug: (message: string, context?: LogContext) =>
        logger.debug(message, { ...defaultContext, ...context }),
      info: (message: string, context?: LogContext) =>
        logger.info(message, { ...defaultContext, ...context }),
      warn: (message: string, context?: LogContext) =>
        logger.warn(message, { ...defaultContext, ...context }),
      error: (message: string, context?: LogContext) =>
        logger.error(message, { ...defaultContext, ...context }),
    };
  },

  /**
   * Mede duração de uma operação
   */
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const durationMs = Date.now() - start;

      logger.info(`${operation} completed`, {
        ...context,
        operation,
        durationMs,
      });

      return result;
    } catch (error: any) {
      const durationMs = Date.now() - start;

      logger.error(`${operation} failed`, {
        ...context,
        operation,
        durationMs,
        error,
      });

      throw error;
    }
  },

  /**
   * Wrapper para API routes
   */
  api(module: string) {
    return {
      start: (operation: string, context?: LogContext) => {
        const startTime = Date.now();
        const correlationId = context?.correlationId || crypto.randomUUID();

        logger.debug(`API ${operation} started`, {
          module,
          operation,
          correlationId,
          ...context,
        });

        return {
          correlationId,
          success: (data?: any) => {
            logger.info(`API ${operation} success`, {
              module,
              operation,
              correlationId,
              durationMs: Date.now() - startTime,
              ...data,
            });
          },
          error: (error: Error, data?: any) => {
            logger.error(`API ${operation} failed`, {
              module,
              operation,
              correlationId,
              durationMs: Date.now() - startTime,
              error,
              ...data,
            });
          },
        };
      },
    };
  },
};

// Loggers pré-configurados por módulo
export const authLogger = logger.child({ module: 'auth' });
export const dashboardLogger = logger.child({ module: 'dashboard' });
export const fcmLogger = logger.child({ module: 'fcm' });
export const imageLogger = logger.child({ module: 'image' });
export const cacheLogger = logger.child({ module: 'cache' });
export const queueLogger = logger.child({ module: 'queue' });

export default logger;
