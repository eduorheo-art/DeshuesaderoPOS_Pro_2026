// security.js - Protección con PIN de Acceso Privado y Gestor PWA para YonkePOS

class SecurityManager {
  constructor() {
    this.storageKeyPin = "yonke_security_pin";
    this.storageKeyAuth = "yonke_auth_session";
    this.defaultPin = "1234";
    this.deferredInstallPrompt = null;
  }

  init() {
    this.ensurePinSetup();
    this.checkAccess();
    this.attachEvents();
    this.setupPwaInstall();
  }

  ensurePinSetup() {
    if (!localStorage.getItem(this.storageKeyPin)) {
      localStorage.setItem(this.storageKeyPin, this.defaultPin);
    }
  }

  checkAccess() {
    const isAuthed = sessionStorage.getItem(this.storageKeyAuth) === "true";
    const lockScreen = document.getElementById("pin-lock-screen");
    if (!lockScreen) return;

    if (isAuthed) {
      lockScreen.classList.add("hidden");
    } else {
      lockScreen.classList.remove("hidden");
      const pinInput = document.getElementById("pin-input-field");
      if (pinInput) {
        pinInput.value = "";
        setTimeout(() => pinInput.focus(), 100);
      }
    }
  }

  attachEvents() {
    const pinForm = document.getElementById("pin-form");
    if (pinForm) {
      pinForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.validatePin();
      });
    }

    const changePinBtn = document.getElementById("change-pin-btn");
    if (changePinBtn) {
      changePinBtn.addEventListener("click", () => {
        this.promptChangePin();
      });
    }

    const lockBtn = document.getElementById("lock-app-btn");
    if (lockBtn) {
      lockBtn.addEventListener("click", () => {
        this.lockNow();
      });
    }
  }

  validatePin() {
    const pinInput = document.getElementById("pin-input-field");
    const errorMsg = document.getElementById("pin-error-msg");
    const entered = pinInput ? pinInput.value.trim() : "";
    const savedPin = localStorage.getItem(this.storageKeyPin) || this.defaultPin;

    if (entered === savedPin) {
      sessionStorage.setItem(this.storageKeyAuth, "true");
      const lockScreen = document.getElementById("pin-lock-screen");
      if (lockScreen) lockScreen.classList.add("hidden");
      if (errorMsg) errorMsg.classList.add("hidden");
    } else {
      if (errorMsg) {
        errorMsg.textContent = "❌ PIN incorrecto. Intenta de nuevo.";
        errorMsg.classList.remove("hidden");
      }
      if (pinInput) {
        pinInput.value = "";
        pinInput.focus();
      }
    }
  }

  lockNow() {
    sessionStorage.removeItem(this.storageKeyAuth);
    this.checkAccess();
  }

  promptChangePin() {
    const current = prompt("Introduce tu PIN actual:");
    if (!current) return;
    const savedPin = localStorage.getItem(this.storageKeyPin) || this.defaultPin;
    if (current !== savedPin) {
      alert("❌ El PIN actual no coincide.");
      return;
    }

    const newPin = prompt("Introduce tu nuevo PIN (4 a 6 dígitos):");
    if (!newPin || newPin.trim().length < 4) {
      alert("❌ El nuevo PIN debe tener al menos 4 dígitos numéricos.");
      return;
    }

    localStorage.setItem(this.storageKeyPin, newPin.trim());
    alert("✅ PIN de seguridad actualizado con éxito a: " + newPin.trim());
  }

  setupPwaInstall() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      const banner = document.getElementById("pwa-install-banner");
      if (banner) banner.classList.remove("hidden");
    });

    window.addEventListener("appinstalled", () => {
      this.deferredInstallPrompt = null;
      const banner = document.getElementById("pwa-install-banner");
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
            const banner = document.getElementById("pwa-install-banner");
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
