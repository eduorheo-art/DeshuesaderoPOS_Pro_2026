// sync_engine.js - Supabase Realtime + cola offline + Last Write Wins
class YonkeSyncEngine {
  constructor() {
    this.client = null;
    this.channel = null;
    this.flushing = false;
    this.started = false;
    this.applyingRemote = false;
    this.flushTimer = null;
  }

  deviceOrigin() {
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const narrow = window.innerWidth < 1024;
    return coarse || narrow ? "Móvil" : "PC";
  }

  stamp(record) {
    if (!record || typeof record !== "object") return record;
    record.updated_at = new Date().toISOString();
    record.dispositivo_origen = this.deviceOrigin();
    return record;
  }

  isNewerOrEqual(incoming, current) {
    if (!current) return true;
    const ti = Date.parse(incoming && incoming.updated_at ? incoming.updated_at : 0) || 0;
    const tc = Date.parse(current && current.updated_at ? current.updated_at : 0) || 0;
    return ti >= tc;
  }

  setStatus(text, online) {
    const el = document.getElementById("yonke-sync-status-text");
    const dot = document.getElementById("yonke-sync-status-dot");
    if (el) el.textContent = text;
    if (dot) {
      dot.classList.remove("bg-emerald-500", "bg-amber-400", "bg-rose-500", "bg-slate-500");
      if (online === true) dot.classList.add("bg-emerald-500");
      else if (online === "pending") dot.classList.add("bg-amber-400");
      else if (online === false) dot.classList.add("bg-rose-500");
      else dot.classList.add("bg-slate-500");
    }
  }

  refreshViews() {
    if (window.salesManager) window.salesManager.renderPartsGrid();
    if (window.dashboardManager) window.dashboardManager.updateUI();
    if (window.financesManager) window.financesManager.updateUI();
    if (window.appManager && window.appManager.currentView === "inventory") {
      window.appManager.renderInventoryTable();
    }
  }

  async start() {
    if (this.started) return;
    this.started = true;

    if (window.yonkeLocalStore) {
      await window.yonkeLocalStore.init();      
    }

    window.addEventListener("online", () => this.flushQueue());
    window.addEventListener("offline", () => {
      this.setStatus("Sin internet · cambios en este dispositivo", false);
    });

    if ("serviceWorker" in navigator && "SyncManager" in window) {
      navigator.serviceWorker.ready.then((reg) => {
        return reg.sync.register("yonke-sync-queue");
      }).catch(() => {});
    }

    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "YONKE_BACKGROUND_SYNC") {
          this.flushQueue();
        }
      });
    }

    this.bindConfigUi();
    await this.connectCloud();
    this.updateStatusFromNetwork();
  }

  updateStatusFromNetwork() {
    if (!navigator.onLine) {
      this.setStatus("Sin internet · cola local activa", false);
      return;
    }
    if (!window.YonkeCloudConfig || !window.YonkeCloudConfig.isConfigured()) {
      this.setStatus("Local + IndexedDB · configura la nube para multi-dispositivo", "pending");
      return;
    }
    if (this.client) this.setStatus("Nube en vivo · PC y celular sincronizados", true);
    else this.setStatus("En línea · reconectando nube", "pending");
  }

  async connectCloud() {
    if (this.channel) {
      try { this.client.removeChannel(this.channel); } catch (e) {}
      this.channel = null;
    }
    this.client = null;

    if (!window.YonkeCloudConfig || !window.YonkeCloudConfig.isConfigured()) {
      this.updateStatusFromNetwork();
      return;
    }
    if (typeof supabase === "undefined" || !supabase.createClient) {
      console.warn("SDK de Supabase no cargó.");
      this.setStatus("No se pudo cargar el SDK de la nube", false);
      return;
    }

    const cfg = window.YonkeCloudConfig.get();
    try {
      this.client = supabase.createClient(cfg.url, cfg.anonKey);
      await this.pullAndMerge();
      this.subscribeRealtime();
      await this.flushQueue();
      this.updateStatusFromNetwork();
    } catch (err) {
      console.warn("Error conectando Supabase:", err);
      this.setStatus("Nube no disponible · trabajando local", false);
    }
  }

  subscribeRealtime() {
    if (!this.client) return;
    this.channel = this.client
      .channel("yonke-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "yonke_parts" }, (payload) => {
        this.applyRemote("parts", payload);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "yonke_vehicles" }, (payload) => {
        this.applyRemote("vehicles", payload);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "yonke_sales" }, (payload) => {
        this.applyRemote("sales", payload);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "yonke_expenses" }, (payload) => {
        this.applyRemote("expenses", payload);
      })
      .subscribe();
  }

  tableName(kind) {
    return {
      parts: "yonke_parts",
      vehicles: "yonke_vehicles",
      sales: "yonke_sales",
      expenses: "yonke_expenses"
    }[kind];
  }

  collection(kind) {
    if (!window.yonkeDB) return [];
    return window.yonkeDB[kind] || [];
  }

  applyRemote(kind, payload) {
    if (!window.yonkeDB) return;
    const eventType = payload.eventType || payload.event;
    const row = payload.new || payload.record;
    const oldRow = payload.old;

    this.applyingRemote = true;
    try {
      if (eventType === "DELETE") {
        const id = (oldRow && oldRow.id) || (row && row.id);
        window.yonkeDB[kind] = this.collection(kind).filter((item) => item.id !== id);
      } else if (row && row.id) {
        const list = this.collection(kind);
        const idx = list.findIndex((item) => item.id === row.id);
        if (idx === -1) {
          list.unshift(row);
        } else if (this.isNewerOrEqual(row, list[idx])) {
          list[idx] = { ...list[idx], ...row };
        }
      }
      window.yonkeDB.persist();
      this.refreshViews();
    } finally {
      this.applyingRemote = false;
    }
  }

  async pullAndMerge() {
    if (!this.client || !window.yonkeDB) return;
    const kinds = ["parts", "vehicles", "sales", "expenses"];
    this.applyingRemote = true;
    try {
      for (const kind of kinds) {
        const { data, error } = await this.client.from(this.tableName(kind)).select("*");
        if (error || !Array.isArray(data)) continue;
        const local = this.collection(kind);
        const byId = new Map(local.map((item) => [item.id, item]));
        data.forEach((row) => {
          const current = byId.get(row.id);
          if (!current || this.isNewerOrEqual(row, current)) {
            byId.set(row.id, current ? { ...current, ...row } : row);
          }
        });
        window.yonkeDB[kind] = Array.from(byId.values());

        const remoteById = new Map(data.map((row) => [row.id, row]));
        const toPush = window.yonkeDB[kind].filter((local) => {
          const rem = remoteById.get(local.id);
          if (!rem) return true;
          const tl = Date.parse(local.updated_at || 0) || 0;
          const tr = Date.parse(rem.updated_at || 0) || 0;
          return tl > tr;
        });
        if (toPush.length) {
          await this.client.from(this.tableName(kind)).upsert(toPush, { onConflict: "id" });
        }
      }
      window.yonkeDB.persist();
      this.refreshViews();
    } finally {
      this.applyingRemote = false;
    }
  }

  async enqueue(kind, record, op) {
    if (this.applyingRemote || !record) return;
    const payload = { ...record };
    if (window.yonkeLocalStore) {
      await window.yonkeLocalStore.enqueue(kind, op || "upsert", payload);
    }
    if (navigator.onLine) {
      this.scheduleFlush();
    } else {
      this.setStatus("Sin internet · guardado en cola local", false);
      this.registerBackgroundSync();
    }
  }

  scheduleFlush() {
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flushQueue(), 400);
  }

  registerBackgroundSync() {
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      navigator.serviceWorker.ready.then((reg) => reg.sync.register("yonke-sync-queue")).catch(() => {});
    }
  }

  async flushQueue() {
    if (this.flushing) return;
    if (!navigator.onLine || !this.client) {
      this.updateStatusFromNetwork();
      return;
    }
    if (!window.yonkeLocalStore) return;

    const queue = await window.yonkeLocalStore.getQueue();
    if (!queue.length) {
      this.updateStatusFromNetwork();
      return;
    }

    this.flushing = true;
    this.setStatus("Sincronizando cola con la nube…", "pending");
    try {
      for (const item of queue) {
        const table = this.tableName(item.tableName);
        if (!table) {
          await window.yonkeLocalStore.removeQueueItem(item.qid);
          continue;
        }
        if (item.op === "delete") {
          const { error } = await this.client.from(table).delete().eq("id", item.record.id);
          if (error) throw error;
        } else {
          const { error } = await this.client.from(table).upsert(item.record, { onConflict: "id" });
          if (error) throw error;
        }
        await window.yonkeLocalStore.removeQueueItem(item.qid);
      }
      this.updateStatusFromNetwork();
    } catch (err) {
      console.warn("Cola de sync pendiente:", err);
      this.setStatus("Cola pendiente · se reintentará al reconectar", "pending");
    } finally {
      this.flushing = false;
    }
  }

  bindConfigUi() {
    const openBtn = document.getElementById("cloud-config-btn");
    const modal = document.getElementById("cloud-config-modal");
    const closeBtn = document.getElementById("cloud-config-close");
    const saveBtn = document.getElementById("cloud-config-save");
    const urlInput = document.getElementById("cloud-config-url");
    const keyInput = document.getElementById("cloud-config-key");

    const open = () => {
      if (!modal) return;
      const cfg = window.YonkeCloudConfig.get();
      if (urlInput) urlInput.value = cfg.url;
      if (keyInput) keyInput.value = cfg.anonKey;
      modal.classList.remove("hidden");
    };
    const close = () => {
      if (modal) modal.classList.add("hidden");
    };

    if (openBtn) openBtn.addEventListener("click", open);
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        window.YonkeCloudConfig.save(urlInput.value, keyInput.value);
        close();
        await this.connectCloud();
      });
    }
  }
}

window.yonkeSync = new YonkeSyncEngine();
