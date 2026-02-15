/**
 * Cliente Redis para cache distribuído, rate limiting e filas
 *
 * Suporta dois modos:
 * - Upstash (REST API) - Recomendado para Vercel/Serverless
 * - ioredis (TCP) - Para ambientes com conexão persistente
 *
 * Configuração via variáveis de ambiente:
 * - UPSTASH_REDIS_REST_URL: URL do Upstash Redis REST API
 * - UPSTASH_REDIS_REST_TOKEN: Token de autenticação Upstash
 * - REDIS_URL: URL de conexão Redis padrão (fallback)
 */

// Tipo para compatibilidade entre Upstash e ioredis
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string> | null>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  srem(key: string, ...members: string[]): Promise<number>;
  publish(channel: string, message: string): Promise<number>;
  ping(): Promise<string>;
  dbsize(): Promise<number>;
  flushdb(): Promise<string>;
  scan(cursor: number, options?: { match?: string; count?: number }): Promise<[string, string[]]>;
  // Sorted Set commands (for metrics)
  zadd(key: string, score: number, member: string): Promise<number>;
  zcard(key: string): Promise<number>;
  zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]>;
  zremrangebyrank(key: string, start: number, stop: number): Promise<number>;
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>;
}

// Cliente mock para quando Redis não está configurado
class MockRedisClient implements RedisClient {
  private store = new Map<string, { value: string; expireAt?: number }>();
  private hashStore = new Map<string, Map<string, string>>();
  private setStore = new Map<string, Set<string>>();

  private isExpired(key: string): boolean {
    const item = this.store.get(key);
    if (!item) return true;
    if (item.expireAt && Date.now() > item.expireAt) {
      this.store.delete(key);
      return true;
    }
    return false;
  }

  async get(key: string): Promise<string | null> {
    if (this.isExpired(key)) return null;
    return this.store.get(key)?.value || null;
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<string | null> {
    const expireAt = options?.ex ? Date.now() + options.ex * 1000 : undefined;
    this.store.set(key, { value, expireAt });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<string | null> {
    return this.set(key, value, { ex: seconds });
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.store.delete(key)) deleted++;
      if (this.hashStore.delete(key)) deleted++;
      if (this.setStore.delete(key)) deleted++;
    }
    return deleted;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter(k => regex.test(k) && !this.isExpired(k));
  }

  async incr(key: string): Promise<number> {
    const current = parseInt(await this.get(key) || '0', 10);
    const newValue = current + 1;
    const item = this.store.get(key);
    await this.set(key, String(newValue), item?.expireAt ? { ex: Math.floor((item.expireAt - Date.now()) / 1000) } : undefined);
    return newValue;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = this.store.get(key);
    if (!item) return 0;
    item.expireAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item) return -2;
    if (!item.expireAt) return -1;
    return Math.max(0, Math.floor((item.expireAt - Date.now()) / 1000));
  }

  async exists(...keys: string[]): Promise<number> {
    return keys.filter(k => !this.isExpired(k)).length;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashStore.get(key)?.get(field) || null;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.hashStore.has(key)) {
      this.hashStore.set(key, new Map());
    }
    const isNew = !this.hashStore.get(key)!.has(field);
    this.hashStore.get(key)!.set(field, value);
    return isNew ? 1 : 0;
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    const hash = this.hashStore.get(key);
    if (!hash) return null;
    return Object.fromEntries(hash);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashStore.get(key);
    if (!hash) return 0;
    let deleted = 0;
    for (const field of fields) {
      if (hash.delete(field)) deleted++;
    }
    return deleted;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.setStore.has(key)) {
      this.setStore.set(key, new Set());
    }
    const set = this.setStore.get(key)!;
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    return added;
  }

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.setStore.get(key) || []);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.setStore.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) removed++;
    }
    return removed;
  }

  async publish(_channel: string, _message: string): Promise<number> {
    return 0; // Mock não suporta pub/sub real
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async dbsize(): Promise<number> {
    return this.store.size + this.hashStore.size + this.setStore.size;
  }

  async flushdb(): Promise<string> {
    this.store.clear();
    this.hashStore.clear();
    this.setStore.clear();
    return 'OK';
  }

  async scan(cursor: number, options?: { match?: string; count?: number }): Promise<[string, string[]]> {
    const allKeys = await this.keys(options?.match || '*');
    const count = options?.count || 10;
    const start = cursor;
    const end = Math.min(start + count, allKeys.length);
    const nextCursor = end >= allKeys.length ? 0 : end;
    return [String(nextCursor), allKeys.slice(start, end)];
  }

  // Sorted Set commands (mock implementation)
  private sortedSets = new Map<string, Map<string, number>>();

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, new Map());
    }
    const isNew = !this.sortedSets.get(key)!.has(member);
    this.sortedSets.get(key)!.set(member, score);
    return isNew ? 1 : 0;
  }

  async zcard(key: string): Promise<number> {
    return this.sortedSets.get(key)?.size || 0;
  }

  async zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]> {
    const set = this.sortedSets.get(key);
    if (!set) return [];

    const minScore = min === '-inf' ? -Infinity : Number(min);
    const maxScore = max === '+inf' ? Infinity : Number(max);

    const results: Array<{ member: string; score: number }> = [];
    for (const [member, score] of set.entries()) {
      if (score >= minScore && score <= maxScore) {
        results.push({ member, score });
      }
    }

    results.sort((a, b) => a.score - b.score);
    return results.map(r => r.member);
  }

  async zremrangebyrank(key: string, start: number, stop: number): Promise<number> {
    const set = this.sortedSets.get(key);
    if (!set) return 0;

    const sorted = Array.from(set.entries()).sort((a, b) => a[1] - b[1]);
    const toRemove = sorted.slice(start, stop + 1);

    for (const [member] of toRemove) {
      set.delete(member);
    }

    return toRemove.length;
  }

  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    const set = this.sortedSets.get(key);
    if (!set) return 0;

    const minScore = min === '-inf' ? -Infinity : Number(min);
    const maxScore = max === '+inf' ? Infinity : Number(max);

    let removed = 0;
    for (const [member, score] of set.entries()) {
      if (score >= minScore && score <= maxScore) {
        set.delete(member);
        removed++;
      }
    }

    return removed;
  }
}

// Wrapper para Upstash REST API
class UpstashRedisClient implements RedisClient {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  private async execute<T>(command: string[]): Promise<T> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Redis error: ${error}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Redis error: ${data.error}`);
    }

    return data.result;
  }

  async get(key: string): Promise<string | null> {
    return this.execute(['GET', key]);
  }

  async set(key: string, value: string, options?: { ex?: number }): Promise<string | null> {
    if (options?.ex) {
      return this.execute(['SET', key, value, 'EX', String(options.ex)]);
    }
    return this.execute(['SET', key, value]);
  }

  async setex(key: string, seconds: number, value: string): Promise<string | null> {
    return this.execute(['SETEX', key, String(seconds), value]);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.execute(['DEL', ...keys]);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.execute(['KEYS', pattern]);
  }

  async incr(key: string): Promise<number> {
    return this.execute(['INCR', key]);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.execute(['EXPIRE', key, String(seconds)]);
  }

  async ttl(key: string): Promise<number> {
    return this.execute(['TTL', key]);
  }

  async exists(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.execute(['EXISTS', ...keys]);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.execute(['HGET', key, field]);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.execute(['HSET', key, field, value]);
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    const result = await this.execute<string[]>(['HGETALL', key]);
    if (!result || result.length === 0) return null;
    const obj: Record<string, string> = {};
    for (let i = 0; i < result.length; i += 2) {
      obj[result[i]] = result[i + 1];
    }
    return obj;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    if (fields.length === 0) return 0;
    return this.execute(['HDEL', key, ...fields]);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    return this.execute(['SADD', key, ...members]);
  }

  async smembers(key: string): Promise<string[]> {
    return this.execute(['SMEMBERS', key]);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (members.length === 0) return 0;
    return this.execute(['SREM', key, ...members]);
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.execute(['PUBLISH', channel, message]);
  }

  async ping(): Promise<string> {
    return this.execute(['PING']);
  }

  async dbsize(): Promise<number> {
    return this.execute(['DBSIZE']);
  }

  async flushdb(): Promise<string> {
    return this.execute(['FLUSHDB']);
  }

  async scan(cursor: number, options?: { match?: string; count?: number }): Promise<[string, string[]]> {
    const args = ['SCAN', String(cursor)];
    if (options?.match) {
      args.push('MATCH', options.match);
    }
    if (options?.count) {
      args.push('COUNT', String(options.count));
    }
    return this.execute(args);
  }

  // Sorted Set commands
  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.execute(['ZADD', key, String(score), member]);
  }

  async zcard(key: string): Promise<number> {
    return this.execute(['ZCARD', key]);
  }

  async zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]> {
    return this.execute(['ZRANGEBYSCORE', key, String(min), String(max)]);
  }

  async zremrangebyrank(key: string, start: number, stop: number): Promise<number> {
    return this.execute(['ZREMRANGEBYRANK', key, String(start), String(stop)]);
  }

  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    return this.execute(['ZREMRANGEBYSCORE', key, String(min), String(max)]);
  }
}

// Singleton do cliente Redis
let redisClient: RedisClient | null = null;

/**
 * Obtém instância do cliente Redis
 * Usa Upstash se configurado, senão usa mock em memória
 */
export function getRedisClient(): RedisClient {
  if (redisClient) {
    return redisClient;
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    console.log('[Redis] Usando Upstash Redis');
    redisClient = new UpstashRedisClient(upstashUrl, upstashToken);
  } else {
    console.warn('[Redis] Variáveis UPSTASH não configuradas, usando mock em memória');
    console.warn('[Redis] Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN para produção');
    redisClient = new MockRedisClient();
  }

  return redisClient;
}

// Export default para uso simples
export const redis = getRedisClient();

// Tipos já exportados na interface no início do arquivo
