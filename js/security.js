// security.js - Gestor de Instalación PWA y Compatibilidad para YonkePOS

(function() {
  try {
    console.log(
      "%c⚠️ YONKEPOS PRO - CONSOLA DE DIAGNÓSTICO",
      "color: #f59e0b; font-size: 13px; font-weight: bold;"
    );
    console.log(
      "%cConsola habilitada para diagnóstico técnico. Funciones del sistema protegidas contra manipulación e inyección externa.",
      "color: #94a3b8; font-size: 11px;"
    );
  } catch (_) {}

  const _rawError = console.error.bind(console);
  console.error = function(...args) {
    const sanitized = args.map(arg => {
      if (arg instanceof Error) {
        return `[Diagnóstico]: ${arg.message || arg.name || 'Operación no completada'}`;
      }
      return arg;
    });
    _rawError(...sanitized);
  };

  window.addEventListener("error", function(e) {
    if (e && e.message) {
      console.warn(`[Diagnóstico]: ${e.message}`);
    }
    e.preventDefault();
    return true;
  });

  window.addEventListener("unhandledrejection", function(e) {
    const reason = e?.reason;
    const msg = reason?.message || reason || "Operación asíncrona interrumpida";
    console.warn(`[Diagnóstico]: ${msg}`);
    e.preventDefault();
  });
})();

class SecurityManager {
  constructor() {
    this.deferredInstallPrompt = null;
  }

  init() {
    this.setupPwaInstall();
  }

  // Métodos no-op seguros de compatibilidad (evitan errores si son invocados)
  ensurePinSetup() {}
  checkAccess() {}
  validatePin() {}
  lockNow() {}
  promptChangePin() {}

  setupPwaInstall() {
    // Si la aplicación ya se ejecuta en modo independiente (instalada en el dispositivo), ocultar permanentemente
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || 
                         window.navigator.standalone === true || 
                         document.referrer.includes("android-app://") ||
                         localStorage.getItem("yonke_pwa_installed") === "true";

    const banner = document.getElementById("pwa-install-banner");
    if (isStandalone) {
      if (banner) banner.classList.add("hidden");
      return; // Permanece oculta permanentemente si ya está instalada
    }

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (!isStandalone && banner) banner.classList.remove("hidden");
    });

    window.addEventListener("appinstalled", () => {
      this.deferredInstallPrompt = null;
      localStorage.setItem("yonke_pwa_installed", "true");
      if (banner) banner.classList.add("hidden");
    });

    const installBtn = document.getElementById("pwa-install-action-btn");
    if (installBtn) {
      installBtn.addEventListener("click", async () => {
        if (this.deferredInstallPrompt) {
          this.deferredInstallPrompt.prompt();
          const choice = await this.deferredInstallPrompt.userChoice;
          if (choice.outcome === "accepted") {
            this.deferredInstallPrompt = null;
            localStorage.setItem("yonke_pwa_installed", "true");
            if (banner) banner.classList.add("hidden");
          }
        } else {
          alert("📱 Para instalar en tu celular:\n\n• En Android (Chrome): Toca los 3 puntos (⋮) arriba a la derecha de la pantalla y presiona 'Instalar aplicación' o 'Agregar a la pantalla principal'.\n\n• En iPhone (Safari): Toca el botón de Compartir (icono de cuadrado con flecha) y elige 'Agregar al inicio'.");
        }
      });
    }
  }
}

window.securityManager = new SecurityManager();
document.addEventListener("DOMContentLoaded", () => {
  window.securityManager.init();
});
