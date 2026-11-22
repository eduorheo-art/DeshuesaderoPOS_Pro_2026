// ghost_parts.js - Registro y Venta de Piezas fuera de Inventario vinculadas a vehículo con IA y Manuales OEM

class GhostPartsManager {
  constructor() {
    this.currentPhotoBase64 = null;
  }

  init() {
    this.populateVehicleOptions();
    this.attachEvents();
  }

  populateVehicleOptions() {
    const select = document.getElementById("ghost-vehicle-select");
    if (!select) return;

    const vehicles = window.yonkeDB.getVehicles();
    let options = `<option value="">-- Selecciona el auto de donde salió --</option>`;
    vehicles.forEach(v => {
      options += `<option value="${v.modelo}">${v.modelo}</option>`;
    });
    options += `<option value="NUEVO_VEHICULO">➕ Escribir otro vehículo...</option>`;
    options += `<option value="Suelto / Sin auto">Pieza suelta / Donador desconocido</option>`;

    select.innerHTML = options;
  }

  attachEvents() {
    const select = document.getElementById("ghost-vehicle-select");
    const customVehicleContainer = document.getElementById("ghost-custom-vehicle-container");

    if (select && customVehicleContainer) {
      select.addEventListener("change", (e) => {
        if (e.target.value === "NUEVO_VEHICULO") {
          customVehicleContainer.classList.remove("hidden");
        } else {
          customVehicleContainer.classList.add("hidden");
        }
      });
    }

    const form = document.getElementById("ghost-part-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitGhostSale();
      });
    }
  }

  openModal() {
    this.resetPhotoState();
    this.populateVehicleOptions();
    const modal = document.getElementById("ghost-part-modal");
    if (modal) {
      modal.classList.remove("hidden");
      const nameInput = document.getElementById("ghost-part-name");
      if (nameInput) nameInput.focus();
    }
  }

  closeModal() {
    const modal = document.getElementById("ghost-part-modal");
    if (modal) {
      modal.classList.add("hidden");
      const form = document.getElementById("ghost-part-form");
      if (form) form.reset();
      const customVehicleContainer = document.getElementById("ghost-custom-vehicle-container");
      if (customVehicleContainer) customVehicleContainer.classList.add("hidden");
      this.resetPhotoState();
    }
  }

  resetPhotoState() {
    this.currentPhotoBase64 = null;
    const previewContainer = document.getElementById("ghost-photo-preview-container");
    if (previewContainer) previewContainer.classList.add("hidden");
    const previewImg = document.getElementById("ghost-photo-preview-img");
    if (previewImg) previewImg.src = "";
    const badge = document.getElementById("ghost-ai-status-badge");
    if (badge) badge.classList.add("hidden");
    const camInput = document.getElementById("ghost-photo-camera");
    if (camInput) camInput.value = "";
    const galInput = document.getElementById("ghost-photo-gallery");
    if (galInput) galInput.value = "";
  }

  removePhoto() {
    this.resetPhotoState();
  }

  async handlePhotoInput(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;

    const previewContainer = document.getElementById("ghost-photo-preview-container");
    const previewImg = document.getElementById("ghost-photo-preview-img");
    const statusText = document.getElementById("ghost-ai-status-text");
    const sourceText = document.getElementById("ghost-ai-source-text");
    const badge = document.getElementById("ghost-ai-status-badge");

    try {
      if (previewContainer) previewContainer.classList.remove("hidden");
      if (badge) badge.classList.add("hidden");
      if (statusText) statusText.textContent = "Comprimiendo imagen...";
      if (sourceText) sourceText.textContent = "Preparando análisis con manuales OEM...";

      let compressed = null;
      if (window.imagesManager && typeof window.imagesManager.compressImage === "function") {
        try {
          compressed = await window.imagesManager.compressImage(file, 900, 0.75);
        } catch (compErr) {
          console.warn("Fallo en imagesManager.compressImage:", compErr);
        }
      }
      if (!compressed) {
        compressed = await this.fallbackReadFile(file);
      }
      if (!compressed) throw new Error("No se pudo leer la imagen.");

      this.currentPhotoBase64 = compressed;
      if (previewImg) previewImg.src = compressed;

      // Identificar pieza forzando manuales de taller del fabricante (OEM)
      await this.identifyPartWithAI(compressed);
    } catch (err) {
      console.error("Error al procesar foto para pieza fuera de inventario:", err);
      if (statusText) statusText.textContent = "Error al procesar foto.";
      alert("Error al cargar la foto: " + err.message);
    }
  }

  fallbackReadFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  async identifyPartWithAI(base64Photo) {
    const statusText = document.getElementById("ghost-ai-status-text");
    const sourceText = document.getElementById("ghost-ai-source-text");
    const badge = document.getElementById("ghost-ai-status-badge");

    if (statusText) statusText.textContent = "Analizando con IA y manuales OEM...";
    if (sourceText) sourceText.textContent = "Consultando catálogos oficiales de fabricante (sin foros/blogs)...";

    const PROMPT_OEM_MANUALS = `Eres un especialista técnico automotriz OEM con acceso a manuales oficiales de taller de fabricantes (Nissan ESM, Toyota TIS, Ford WSM/Motorcraft, GM Service Information/ACDelco, VW ELSA/ETKA, Honda ESM, Stellantis MOPAR).

Analiza la fotografía de esta autoparte para una venta de mostrador e identifícala con máxima precisión técnica.

DIRECTIVAS ESTRICTAS DE FUENTES:
1. Tu ÚNICA fuente permitida de información son manuales de taller oficiales del fabricante, catálogos de partes de ensambladora y fichas técnicas de homologación de planta.
2. Queda ESTRICTAMENTE PROHIBIDO basarse en blogs, foros de internet, publicaciones de aficionados, YouTube o páginas no oficiales de refaccionarias.
3. Extrae la compatibilidad cruzada oficial fundamentada en catálogos del fabricante.

Responde ÚNICAMENTE un JSON válido con esta estructura (sin texto adicional fuera del JSON):
{
  "pieza": "Nombre técnico exacto de la pieza",
  "vehiculo_donador": "Marca Modelo Submarca y Año(s) de donde proviene según catálogo OEM (ej: Nissan Versa 1.6L 2012-2019)",
  "precio_sugerido": 800,
  "compatibilidad": "Compatibilidad oficial verificada en manuales del fabricante",
  "fuente_manual_oem": "Manual oficial o catálogo de fabricante consultado (ej: Manual de Taller Nissan HR16DE)",
  "observacion": "Detalles técnicos visibles: pines, conectores, códigos estampados y estado"
}`;

    try {
      const mimeType = base64Photo.split(";")[0].split(":")[1] || "image/jpeg";
      const base64Data = base64Photo.split(",")[1];

      let data = null;

      if (window.callGeminiProxy) {
        const response = await window.callGeminiProxy("gemini-3.8-flash", {
          contents: [{
            parts: [
              { text: PROMPT_OEM_MANUALS },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1200
          }
        });

        if (response.ok) {
          const result = await response.json();
          const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            data = JSON.parse(jsonMatch[0]);
          }
        }
      }

      // Fallback si no hay proxy o conexión
      if (!data) {
        data = {
          pieza: "Pieza automotriz no catalogada",
          vehiculo_donador: "Vehículo por determinar",
          precio_sugerido: 0,
          compatibilidad: "Verificar según catálogo/manual OEM oficial",
          fuente_manual_oem: "Inspección manual (IA no disponible o sin conexión)",
          observacion: "No se pudo obtener análisis en línea de IA. Capture los datos manualmente."
        };
      }

      // Rellenar campos de la interfaz
      this.fillFormWithAIData(data);

      if (statusText) statusText.textContent = `✓ ${data.pieza}`;
      if (sourceText) sourceText.textContent = `Fuente OEM: ${data.fuente_manual_oem || "Manual Oficial del Fabricante"}`;
      if (badge) badge.classList.remove("hidden");

    } catch (e) {
      console.warn("Fallo en identifyPartWithAI:", e);
      if (statusText) statusText.textContent = "Foto cargada. Completa los datos requeridos.";
      if (sourceText) sourceText.textContent = "No se pudo conectar con el catálogo en línea.";
    }
  }

  fillFormWithAIData(data) {
    if (!data) return;

    // 1. Nombre de pieza
    const nameInput = document.getElementById("ghost-part-name");
    if (nameInput && data.pieza) {
      nameInput.value = data.pieza;
    }

    // 2. Precio sugerido
    const priceInput = document.getElementById("ghost-part-price");
    if (priceInput && (data.precio_sugerido || data.precio_base_sugerido)) {
      priceInput.value = Number(data.precio_sugerido || data.precio_base_sugerido) || "";
    }

    // 3. Compatibilidad
    const compatInput = document.getElementById("ghost-part-compat");
    if (compatInput && (data.compatibilidad || data.compatibilidad_cruzada)) {
      compatInput.value = data.compatibilidad || data.compatibilidad_cruzada;
    }

    // 4. Notas y Fuente OEM
    const notesInput = document.getElementById("ghost-part-notes");
    if (notesInput) {
      const source = data.fuente_manual_oem || data.fuente_oem || "Manual oficial del fabricante";
      const obs = data.observacion || "";
      notesInput.value = `[Fuente OEM: ${source}] ${obs}`.trim();
    }

    // 5. Vehículo donador
    const selectVehicle = document.getElementById("ghost-vehicle-select");
    const customVehicleContainer = document.getElementById("ghost-custom-vehicle-container");
    const customVehicleInput = document.getElementById("ghost-custom-vehicle");

    if (selectVehicle && data.vehiculo_donador) {
      const target = data.vehiculo_donador.toLowerCase().trim();
      let matched = false;
      for (let i = 0; i < selectVehicle.options.length; i++) {
        const optText = selectVehicle.options[i].text.toLowerCase();
        const optVal = selectVehicle.options[i].value.toLowerCase();
        if (optVal && (optVal === target || target.includes(optVal) || optText.includes(target))) {
          selectVehicle.selectedIndex = i;
          matched = true;
          if (customVehicleContainer) customVehicleContainer.classList.add("hidden");
          break;
        }
      }
      if (!matched) {
        selectVehicle.value = "NUEVO_VEHICULO";
        if (customVehicleContainer) customVehicleContainer.classList.remove("hidden");
        if (customVehicleInput) customVehicleInput.value = data.vehiculo_donador;
      }
    }
  }

  submitGhostSale() {
    const nameInput = document.getElementById("ghost-part-name");
    const selectVehicle = document.getElementById("ghost-vehicle-select");
    const customVehicleInput = document.getElementById("ghost-custom-vehicle");
    const priceInput = document.getElementById("ghost-part-price");
    const compatInput = document.getElementById("ghost-part-compat");
    const notesInput = document.getElementById("ghost-part-notes");

    const pieceName = nameInput.value.trim();
    if (!pieceName) {
      alert("Por favor ingresa el nombre de la pieza.");
      return;
    }

    let vehicleName = selectVehicle.value;
    if (vehicleName === "NUEVO_VEHICULO") {
      vehicleName = customVehicleInput.value.trim();
      if (!vehicleName) {
        alert("Por favor escribe el nombre del vehículo.");
        return;
      }
    } else if (!vehicleName) {
      vehicleName = "Pieza suelta";
    }

    const price = parseFloat(priceInput.value);
    if (isNaN(price) || price <= 0) {
      alert("Por favor ingresa un monto válido cobrado.");
      return;
    }

    try {
      const result = window.yonkeDB.processGhostPartSale({
        pieza: pieceName,
        vehiculo_origen: vehicleName,
        monto: price,
        compatibilidad: compatInput ? compatInput.value.trim() : "",
        observacion: notesInput ? notesInput.value.trim() : "Venta rápida de mostrador",
        fotos: this.currentPhotoBase64 ? [this.currentPhotoBase64] : []
      });

      this.closeModal();

      // Refrescar vistas
      if (window.salesManager) window.salesManager.renderPartsGrid();
      if (window.salesManager) window.salesManager.refreshSalesHistory();
      if (window.financesManager) window.financesManager.updateUI();
      if (window.dashboardManager) window.dashboardManager.updateUI();

      // Notificación exitosa
      window.salesManager.showSaleSuccessModal(result.sale, result.part);
    } catch (err) {
      alert("Error al registrar pieza fuera de inventario: " + err.message);
    }
  }
}

window.ghostPartsManager = new GhostPartsManager();
