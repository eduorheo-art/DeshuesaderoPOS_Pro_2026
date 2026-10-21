// cloud_config.js - Credenciales de Supabase (se guardan en el dispositivo, no en el código)
const CLOUD_URL_KEY = "yonke_supabase_url";
const CLOUD_ANON_KEY = "yonke_supabase_anon_key";

window.YonkeCloudConfig = {
  get() {
    return {
      url: (localStorage.getItem(CLOUD_URL_KEY) || "https://lkivtjzcemvinymxrrvv.supabase.co").trim(),
      anonKey: (localStorage.getItem(CLOUD_ANON_KEY) || "sb_publishable_kHPdqpQlRfRbj0vp8YTqYw_dKp1tImK").trim()
    };
  },

  save(url, anonKey) {
    if (url) localStorage.setItem(CLOUD_URL_KEY, url.trim());
    if (anonKey) localStorage.setItem(CLOUD_ANON_KEY, anonKey.trim());
  },

  isConfigured() {
    const cfg = this.get();
    return Boolean(cfg.url && cfg.anonKey);
  }
};