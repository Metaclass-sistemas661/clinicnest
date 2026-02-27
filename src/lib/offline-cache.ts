/**
 * Offline Cache Manager
 * 
 * Provides basic offline support by caching essential data in IndexedDB.
 * Syncs with server when online and serves cached data when offline.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema
interface ClinicaFlowDB extends DBSchema {
  appointments: {
    key: string;
    value: {
      id: string;
      data: any;
      cached_at: string;
      tenant_id: string;
    };
    indexes: { 'by-tenant': string; 'by-date': string };
  };
  patients: {
    key: string;
    value: {
      id: string;
      data: any;
      cached_at: string;
      tenant_id: string;
    };
    indexes: { 'by-tenant': string };
  };
  services: {
    key: string;
    value: {
      id: string;
      data: any;
      cached_at: string;
      tenant_id: string;
    };
    indexes: { 'by-tenant': string };
  };
  professionals: {
    key: string;
    value: {
      id: string;
      data: any;
      cached_at: string;
      tenant_id: string;
    };
    indexes: { 'by-tenant': string };
  };
  sync_queue: {
    key: string;
    value: {
      id: string;
      action: 'create' | 'update' | 'delete';
      table: string;
      data: any;
      created_at: string;
      tenant_id: string;
    };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: any;
      updated_at: string;
    };
  };
}

const DB_NAME = 'clinicaflow-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<ClinicaFlowDB> | null = null;

async function getDB(): Promise<IDBPDatabase<ClinicaFlowDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<ClinicaFlowDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Appointments store
      if (!db.objectStoreNames.contains('appointments')) {
        const appointmentsStore = db.createObjectStore('appointments', { keyPath: 'id' });
        appointmentsStore.createIndex('by-tenant', 'tenant_id');
        appointmentsStore.createIndex('by-date', 'data.scheduled_at');
      }

      // Patients store
      if (!db.objectStoreNames.contains('patients')) {
        const patientsStore = db.createObjectStore('patients', { keyPath: 'id' });
        patientsStore.createIndex('by-tenant', 'tenant_id');
      }

      // Services store
      if (!db.objectStoreNames.contains('services')) {
        const servicesStore = db.createObjectStore('services', { keyPath: 'id' });
        servicesStore.createIndex('by-tenant', 'tenant_id');
      }

      // Professionals store
      if (!db.objectStoreNames.contains('professionals')) {
        const professionalsStore = db.createObjectStore('professionals', { keyPath: 'id' });
        professionalsStore.createIndex('by-tenant', 'tenant_id');
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id' });
      }

      // Metadata store
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

// Cache data types
type CacheableStore = 'appointments' | 'patients' | 'services' | 'professionals';

export const offlineCache = {
  /**
   * Cache multiple items
   */
  async cacheItems<T extends { id: string }>(
    store: CacheableStore,
    items: T[],
    tenantId: string
  ): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(store, 'readwrite');
    const now = new Date().toISOString();

    await Promise.all(
      items.map(item =>
        tx.store.put({
          id: item.id,
          data: item,
          cached_at: now,
          tenant_id: tenantId,
        })
      )
    );

    await tx.done;

    // Update metadata
    await this.setMetadata(`${store}_last_sync_${tenantId}`, now);
    await this.setMetadata(`${store}_count_${tenantId}`, items.length);
  },

  /**
   * Get cached items for a tenant
   */
  async getCachedItems<T>(store: CacheableStore, tenantId: string): Promise<T[]> {
    const db = await getDB();
    const items = await db.getAllFromIndex(store, 'by-tenant', tenantId);
    return items.map(item => item.data as T);
  },

  /**
   * Get a single cached item
   */
  async getCachedItem<T>(store: CacheableStore, id: string): Promise<T | null> {
    const db = await getDB();
    const item = await db.get(store, id);
    return item ? (item.data as T) : null;
  },

  /**
   * Clear cache for a store
   */
  async clearStore(store: CacheableStore, tenantId?: string): Promise<void> {
    const db = await getDB();
    
    if (tenantId) {
      const tx = db.transaction(store, 'readwrite');
      const items = await tx.store.index('by-tenant').getAllKeys(tenantId);
      await Promise.all(items.map(key => tx.store.delete(key)));
      await tx.done;
    } else {
      await db.clear(store);
    }
  },

  /**
   * Add item to sync queue (for offline mutations)
   */
  async addToSyncQueue(
    action: 'create' | 'update' | 'delete',
    table: string,
    data: any,
    tenantId: string
  ): Promise<string> {
    const db = await getDB();
    const id = crypto.randomUUID();
    
    await db.put('sync_queue', {
      id,
      action,
      table,
      data,
      created_at: new Date().toISOString(),
      tenant_id: tenantId,
    });

    return id;
  },

  /**
   * Get pending sync items
   */
  async getSyncQueue(): Promise<Array<{
    id: string;
    action: 'create' | 'update' | 'delete';
    table: string;
    data: any;
    created_at: string;
    tenant_id: string;
  }>> {
    const db = await getDB();
    return db.getAll('sync_queue');
  },

  /**
   * Remove item from sync queue
   */
  async removeSyncItem(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('sync_queue', id);
  },

  /**
   * Clear sync queue
   */
  async clearSyncQueue(): Promise<void> {
    const db = await getDB();
    await db.clear('sync_queue');
  },

  /**
   * Set metadata
   */
  async setMetadata(key: string, value: any): Promise<void> {
    const db = await getDB();
    await db.put('metadata', {
      key,
      value,
      updated_at: new Date().toISOString(),
    });
  },

  /**
   * Get metadata
   */
  async getMetadata<T>(key: string): Promise<T | null> {
    const db = await getDB();
    const item = await db.get('metadata', key);
    return item ? (item.value as T) : null;
  },

  /**
   * Get cache stats
   */
  async getCacheStats(tenantId: string): Promise<{
    appointments: { count: number; lastSync: string | null };
    patients: { count: number; lastSync: string | null };
    services: { count: number; lastSync: string | null };
    professionals: { count: number; lastSync: string | null };
    pendingSyncs: number;
  }> {
    const db = await getDB();
    const syncQueue = await db.getAll('sync_queue');

    const getStoreStats = async (store: CacheableStore) => {
      const count = await this.getMetadata<number>(`${store}_count_${tenantId}`) || 0;
      const lastSync = await this.getMetadata<string>(`${store}_last_sync_${tenantId}`);
      return { count, lastSync };
    };

    return {
      appointments: await getStoreStats('appointments'),
      patients: await getStoreStats('patients'),
      services: await getStoreStats('services'),
      professionals: await getStoreStats('professionals'),
      pendingSyncs: syncQueue.filter(s => s.tenant_id === tenantId).length,
    };
  },

  /**
   * Clear all cached data
   */
  async clearAll(): Promise<void> {
    const db = await getDB();
    await Promise.all([
      db.clear('appointments'),
      db.clear('patients'),
      db.clear('services'),
      db.clear('professionals'),
      db.clear('sync_queue'),
      db.clear('metadata'),
    ]);
  },

  /**
   * Check if data is stale (older than maxAge in minutes)
   */
  async isStale(store: CacheableStore, tenantId: string, maxAgeMinutes: number = 30): Promise<boolean> {
    const lastSync = await this.getMetadata<string>(`${store}_last_sync_${tenantId}`);
    if (!lastSync) return true;

    const lastSyncDate = new Date(lastSync);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSyncDate.getTime()) / (1000 * 60);

    return diffMinutes > maxAgeMinutes;
  },
};

export default offlineCache;
