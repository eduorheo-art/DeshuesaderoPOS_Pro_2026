// local_store.js - IndexedDB (Dexie) como caché local y cola de sincronización
class YonkeLocalStore {
  constructor() {
    this.db = null;
    this.ready = false;
    this.ownerId = null;
  }

  setOwner(ownerId) {
    this.ownerId = ownerId || null;
  }

  async init() {
    if (this.ready) return true;
    if (typeof Dexie === "undefined") {
      console.warn("Dexie.js no está disponible; se usará solo localStorage.");
      return false;
    }

    this.db = new Dexie("YonkePOSLocal");
    this.db.version(2).stores({
      snapshot: "key, owner_id",
      sync_queue: "++qid, created_at, tableName, owner_id"
    });

    await this.db.open();
    this.ready = true;
    return true;
  }

  async saveSnapshot(yonkeDb) {
    if (!this.ready || !this.ownerId) return;
    try {
      await this.db.snapshot.put({
        key: `full:${this.ownerId}`,
        owner_id: this.ownerId,
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
    if (!this.ready || !this.ownerId) return null;
    try {
      return await this.db.snapshot.get(`full:${this.ownerId}`);
    } catch (err) {
      console.warn("No se pudo leer snapshot IndexedDB:", err);
      return null;
    }
  }

  async enqueue(tableName, op, record) {
    if (!this.ready || !this.ownerId || !record) return;
    try {
      await this.db.sync_queue.add({
        owner_id: this.ownerId,
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
    if (!this.ready || !this.ownerId) return [];
    return this.db.sync_queue.where("owner_id").equals(this.ownerId).sortBy("qid");
  }

  async removeQueueItem(qid) {
    if (!this.ready) return;
    await this.db.sync_queue.delete(qid);
  }

  async clearQueue() {
    if (!this.ready || !this.ownerId) return;
    await this.db.sync_queue.where("owner_id").equals(this.ownerId).delete();
  }
}

window.yonkeLocalStore = new YonkeLocalStore();
