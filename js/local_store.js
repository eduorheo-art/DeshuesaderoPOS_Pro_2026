// local_store.js - IndexedDB (Dexie) como caché local y cola de sincronización
class YonkeLocalStore {
  constructor() {
    this.db = null;
    this.ready = false;
  }

  async init() {
    if (this.ready) return true;
    if (typeof Dexie === "undefined") {
      console.warn("Dexie.js no está disponible; se usará solo localStorage.");
      return false;
    }

    this.db = new Dexie("YonkePOSLocal");
    this.db.version(1).stores({
      snapshot: "key",
      sync_queue: "++qid, created_at, tableName"
    });

    await this.db.open();
    this.ready = true;
    return true;
  }

  async saveSnapshot(yonkeDb) {
    if (!this.ready) return;
    try {
      await this.db.snapshot.put({
        key: "full",
        parts: yonkeDb.parts,
        vehicles: yonkeDb.vehicles,
        sales: yonkeDb.sales,
        expenses: yonkeDb.expenses,
        saved_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn("No se pudo guardar snapshot IndexedDB:", err);
    }
  }

  async loadSnapshot() {
    if (!this.ready) return null;
    try {
      return await this.db.snapshot.get("full");
    } catch (err) {
      console.warn("No se pudo leer snapshot IndexedDB:", err);
      return null;
    }
  }

  async enqueue(tableName, op, record) {
    if (!this.ready || !record) return;
    try {
      await this.db.sync_queue.add({
        tableName,
        op: op || "upsert",
        record,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn("No se pudo encolar cambio offline:", err);
    }
  }

  async getQueue() {
    if (!this.ready) return [];
    return this.db.sync_queue.orderBy("qid").toArray();
  }

  async removeQueueItem(qid) {
    if (!this.ready) return;
    await this.db.sync_queue.delete(qid);
  }

  async clearQueue() {
    if (!this.ready) return;
    await this.db.sync_queue.clear();
  }
}

window.yonkeLocalStore = new YonkeLocalStore();
