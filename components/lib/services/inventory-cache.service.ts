/**
 * Serviço de Cache Local para Inventário usando IndexedDB
 * Permite que a coleta funcione 100% offline
 */

interface InventoryItem {
  id?: string;
  ean: string;
  description: string;
  internalCode: string;
  expectedQuantity: number;
  price?: number;
  productId?: string;
}

interface CountRecord {
  id?: number;
  inventoryId: string;
  addressCode: string;
  ean: string;
  quantity: number;
  expirationDate?: string;
  timestamp: number;
  synced: number; // 0 = não sincronizado, 1 = sincronizado
  userId: string;
}

interface ActiveSession {
  inventoryId: string;
  addressCode: string;
  startedAt: number;
}

interface InventoryAddress {
  addressCode: string;
  inventoryId: string;
}

interface InventoryMetadata {
  inventoryId: string;
  name: string;
  downloadedAt: number;
  itemsCount: number;
  addressesCount: number;
  isReadyForOffline: boolean;
}

class InventoryCacheService {
  private dbName = 'inventory_offline_db';
  private dbVersion = 3; // Incrementado para corrigir tipo do campo synced
  private db: IDBDatabase | null = null;

  /**
   * Inicializa o banco de dados IndexedDB
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('IndexedDB não disponível (SSR)'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Erro ao abrir IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[Cache] IndexedDB inicializado');
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        // Store para itens do inventário
        if (!db.objectStoreNames.contains('inventory_items')) {
          const itemsStore = db.createObjectStore('inventory_items', {
            keyPath: 'id',
            autoIncrement: true,
          });
          itemsStore.createIndex('inventoryId', 'inventoryId', { unique: false });
          itemsStore.createIndex('ean', 'ean', { unique: false });
        }

        // Store para contagens offline
        if (!db.objectStoreNames.contains('count_records')) {
          const countsStore = db.createObjectStore('count_records', {
            keyPath: 'id',
            autoIncrement: true,
          });
          countsStore.createIndex('inventoryId', 'inventoryId', { unique: false });
          countsStore.createIndex('synced', 'synced', { unique: false });
          countsStore.createIndex('timestamp', 'timestamp', { unique: false });
        } else if (oldVersion < 3) {
          // Migração da v2 para v3: limpar count_records antigos (com boolean)
          const transaction = event.target.transaction;
          const store = transaction.objectStore('count_records');
          store.clear();
          console.log('[Cache] Limpando count_records antigos (migração v2 → v3)');
        }

        // Store para sessão ativa
        if (!db.objectStoreNames.contains('active_session')) {
          db.createObjectStore('active_session', { keyPath: 'inventoryId' });
        }

        // Store para endereços do inventário
        if (!db.objectStoreNames.contains('inventory_addresses')) {
          const addressStore = db.createObjectStore('inventory_addresses', {
            keyPath: 'id',
            autoIncrement: true,
          });
          addressStore.createIndex('inventoryId', 'inventoryId', { unique: false });
          addressStore.createIndex('addressCode', 'addressCode', { unique: false });
        }

        // Store para metadados do inventário
        if (!db.objectStoreNames.contains('inventory_metadata')) {
          db.createObjectStore('inventory_metadata', { keyPath: 'inventoryId' });
        }

        console.log('[Cache] Estrutura do IndexedDB criada/atualizada');
      };
    });
  }

  /**
   * Garante que o DB está inicializado
   */
  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('IndexedDB não disponível');
    }
    return this.db;
  }

  /**
   * Salva itens do inventário no cache local
   */
  async cacheInventoryItems(
    inventoryId: string,
    items: InventoryItem[]
  ): Promise<void> {
    const db = await this.ensureDb();
    const transaction = db.transaction(['inventory_items'], 'readwrite');
    const store = transaction.objectStore('inventory_items');
    const index = store.index('inventoryId');

    return new Promise((resolve, reject) => {
      // Primeiro, limpar itens antigos deste inventário
      const deleteRequest = index.openCursor(IDBKeyRange.only(inventoryId));

      deleteRequest.onsuccess = () => {
        const cursor = deleteRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // Depois que terminou de deletar, adicionar novos itens
          for (const item of items) {
            store.add({ ...item, inventoryId });
          }
        }
      };

      deleteRequest.onerror = () => reject(deleteRequest.error);

      transaction.oncomplete = () => {
        console.log(`[Cache] ${items.length} itens salvos no cache`);
        resolve();
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Busca item do inventário por EAN
   */
  async getInventoryItemByEan(
    inventoryId: string,
    ean: string
  ): Promise<InventoryItem | null> {
    const db = await this.ensureDb();
    const transaction = db.transaction(['inventory_items'], 'readonly');
    const store = transaction.objectStore('inventory_items');
    const index = store.index('ean');

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(ean));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const item = cursor.value;
          if (item.inventoryId === inventoryId) {
            resolve(item);
          } else {
            cursor.continue();
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Registra uma contagem offline
   */
  async saveCountRecord(record: Omit<CountRecord, 'id'>): Promise<number> {
    const db = await this.ensureDb();
    const transaction = db.transaction(['count_records'], 'readwrite');
    const store = transaction.objectStore('count_records');

    return new Promise((resolve, reject) => {
      const request = store.add({
        ...record,
        timestamp: Date.now(),
        synced: 0, // 0 = não sincronizado
      });

      request.onsuccess = () => {
        console.log('[Cache] Contagem salva offline:', request.result);
        resolve(request.result as number);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Busca todas as contagens não sincronizadas
   */
  async getUnsyncedCounts(): Promise<CountRecord[]> {
    const db = await this.ensureDb();
    const transaction = db.transaction(['count_records'], 'readonly');
    const store = transaction.objectStore('count_records');
    const index = store.index('synced');

    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(0)); // 0 = não sincronizado

      request.onsuccess = () => {
        console.log(`[Cache] ${request.result.length} contagens não sincronizadas`);
        resolve(request.result);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Marca contagem como sincronizada
   */
  async markCountAsSynced(id: number): Promise<void> {
    const db = await this.ensureDb();
    const transaction = db.transaction(['count_records'], 'readwrite');
    const store = transaction.objectStore('count_records');

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          record.synced = 1; // 1 = sincronizado
          const updateRequest = store.put(record);

          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Salva sessão ativa
   */
  async saveActiveSession(session: ActiveSession): Promise<void> {
    const db = await this.ensureDb();
    const transaction = db.transaction(['active_session'], 'readwrite');
    const store = transaction.objectStore('active_session');

    return new Promise((resolve, reject) => {
      const request = store.put(session);

      request.onsuccess = () => {
        console.log('[Cache] Sessão ativa salva');
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Busca sessão ativa
   */
  async getActiveSession(inventoryId: string): Promise<ActiveSession | null> {
    const db = await this.ensureDb();
    const transaction = db.transaction(['active_session'], 'readonly');
    const store = transaction.objectStore('active_session');

    return new Promise((resolve, reject) => {
      const request = store.get(inventoryId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove sessão ativa
   */
  async clearActiveSession(inventoryId: string): Promise<void> {
    const db = await this.ensureDb();
    const transaction = db.transaction(['active_session'], 'readwrite');
    const store = transaction.objectStore('active_session');

    return new Promise((resolve, reject) => {
      const request = store.delete(inventoryId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }


  /**
   * Limpa contagens sincronizadas antigas (mais de 7 dias)
   */
  async cleanupOldRecords(): Promise<void> {
    const db = await this.ensureDb();
    const transaction = db.transaction(['count_records'], 'readwrite');
    const store = transaction.objectStore('count_records');
    const index = store.index('timestamp');

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.upperBound(sevenDaysAgo));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const record = cursor.value;
          if (record.synced) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        console.log('[Cache] Registros antigos limpos');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Salva endereços do inventário
   */
  async cacheInventoryAddresses(
    inventoryId: string,
    addresses: string[]
  ): Promise<void> {
    const db = await this.ensureDb();
    const transaction = db.transaction(['inventory_addresses'], 'readwrite');
    const store = transaction.objectStore('inventory_addresses');
    const index = store.index('inventoryId');

    return new Promise((resolve, reject) => {
      // Primeiro, limpar endereços antigos deste inventário
      const deleteRequest = index.openCursor(IDBKeyRange.only(inventoryId));

      deleteRequest.onsuccess = () => {
        const cursor = deleteRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // Depois que terminou de deletar, adicionar novos
          for (const addressCode of addresses) {
            store.add({ inventoryId, addressCode });
          }
        }
      };

      deleteRequest.onerror = () => reject(deleteRequest.error);

      transaction.oncomplete = () => {
        console.log(`[Cache] ${addresses.length} endereços salvos no cache`);
        resolve();
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Verifica se um endereço existe no inventário
   */
  async addressExists(inventoryId: string, addressCode: string): Promise<boolean> {
    const db = await this.ensureDb();
    const transaction = db.transaction(['inventory_addresses'], 'readonly');
    const store = transaction.objectStore('inventory_addresses');
    const index = store.index('inventoryId');

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(inventoryId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          if (cursor.value.addressCode === addressCode.toUpperCase()) {
            resolve(true);
            return;
          }
          cursor.continue();
        } else {
          resolve(false);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Salva metadados do inventário
   */
  async saveInventoryMetadata(metadata: InventoryMetadata): Promise<void> {
    const db = await this.ensureDb();
    const transaction = db.transaction(['inventory_metadata'], 'readwrite');
    const store = transaction.objectStore('inventory_metadata');

    return new Promise((resolve, reject) => {
      const request = store.put(metadata);

      request.onsuccess = () => {
        console.log('[Cache] Metadados salvos');
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Busca metadados do inventário
   */
  async getInventoryMetadata(inventoryId: string): Promise<InventoryMetadata | null> {
    const db = await this.ensureDb();
    const transaction = db.transaction(['inventory_metadata'], 'readonly');
    const store = transaction.objectStore('inventory_metadata');

    return new Promise((resolve, reject) => {
      const request = store.get(inventoryId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Verifica se o inventário está pronto para uso offline
   */
  async isReadyForOffline(inventoryId: string): Promise<boolean> {
    try {
      const metadata = await this.getInventoryMetadata(inventoryId);
      return metadata?.isReadyForOffline || false;
    } catch (error) {
      return false;
    }
  }


  /**
   * Obtém estatísticas do cache
   */
  async getStats(): Promise<{
    totalItems: number;
    unsyncedCounts: number;
    cacheSize: string;
  }> {
    const db = await this.ensureDb();

    const itemsCount = await new Promise<number>((resolve) => {
      const transaction = db.transaction(['inventory_items'], 'readonly');
      const request = transaction.objectStore('inventory_items').count();
      request.onsuccess = () => resolve(request.result);
    });

    const unsyncedCount = await new Promise<number>((resolve) => {
      const transaction = db.transaction(['count_records'], 'readonly');
      const index = transaction.objectStore('count_records').index('synced');
      const request = index.count(IDBKeyRange.only(0)); // 0 = não sincronizado
      request.onsuccess = () => resolve(request.result);
    });

    // Estimar tamanho do cache
    const estimate = await navigator.storage?.estimate();
    const cacheSize = estimate?.usage
      ? `${(estimate.usage / 1024 / 1024).toFixed(2)} MB`
      : 'N/A';

    return {
      totalItems: itemsCount,
      unsyncedCounts: unsyncedCount,
      cacheSize,
    };
  }

  /**
   * Baixa todos os dados do inventário para uso offline
   */
  async downloadInventoryForOffline(
    inventoryId: string,
    inventoryName: string,
    items: InventoryItem[],
    addresses: string[]
  ): Promise<void> {
    console.log('[Cache] Iniciando download para offline...');

    // Salvar itens
    await this.cacheInventoryItems(inventoryId, items);

    // Salvar endereços
    await this.cacheInventoryAddresses(inventoryId, addresses);

    // Salvar metadados
    await this.saveInventoryMetadata({
      inventoryId,
      name: inventoryName,
      downloadedAt: Date.now(),
      itemsCount: items.length,
      addressesCount: addresses.length,
      isReadyForOffline: true,
    });

    console.log('[Cache] Download para offline concluído!');
  }
}

// Exportar instância singleton
export const inventoryCacheService = new InventoryCacheService();
export type { InventoryItem, CountRecord, ActiveSession, InventoryAddress, InventoryMetadata };
