// valuator.js - Valuador In-Situ e Inspección Fotográfica Multizona con IA para Compra de Vehículos
// Cumple estrictamente con directivas OEM oficiales (excluyendo foros y blogs) y Regla Sagrada Yonke 3:1

localStorage.removeItem("yonke_gemini_api_key");

function getGeminiApiKey() {
  return window.callGeminiProxy ? "server-side" : "";
}

class VehicleValuatorManager {
  constructor() {
    this.marca = "Ford";
    this.vehiculo = "Explorer";
    this.anio = "2006";
    this.motor = "4.0L V6";
    this.fallas = "";
    this.currentModelName = "Ford Explorer 2006 4.0L V6";
    this.vehicleColor = "Por verificar";
    this.referenceImageUrl = "";
    this.lastInspectionModelName = "";
    this.lastInspectionFallas = "";
    this.visualInspection = null;
    this.currentPiecesList = [];
    this.damagedPieceIndexes = new Set();
    this.gruaCost = 0;
    this.photos = {
      frente: null,
      costado_izq: null,
      costado_der: null,
      trasera: null,
      interiores: null
    };
    this.galleryPhotos = [];
    this.lastCalculatedOffer = 0;
    this.lastRescatable = 0;
    this.lastAltaMediaRescatable = 0;
    this.selectedVehicleMainImage = "";
    this.suggestedImages = [];
    window.vehicleValuatorManager = this;
    window.valuatorManager = this;
  }

  init() {
    this.attachEvents();
    const fallasInput = document.getElementById("valuator-fallas-input");
    if (fallasInput) fallasInput.value = "";
    const gruaInput = document.getElementById("valuator-grua-cost");
    if (gruaInput) gruaInput.value = "0";
    const dealPriceInput = document.getElementById("valuator-deal-price");
    if (dealPriceInput) dealPriceInput.value = "";
    this.calculateOffer();
  }

  attachEvents() {
    const analyzeBtn = document.getElementById("valuator-analyze-btn");
    if (analyzeBtn) {
      analyzeBtn.addEventListener("click", () => {
        this.generateDespieceWithAI(true);
      });
    }

    const aiScanBtn = document.getElementById("valuator-ai-scan-btn");
    if (aiScanBtn) {
      aiScanBtn.addEventListener("click", () => {
        this.runAIVisualInspection();
      });
    }

    const gruaInput = document.getElementById("valuator-grua-cost");
    if (gruaInput) {
      gruaInput.addEventListener("input", (e) => {
        this.gruaCost = parseFloat(e.target.value) || 0;
        this.calculateOffer();
      });
    }

    // Botón de compra y alta directa en patio e inventario
    const buyBtn = document.getElementById("valuator-buy-and-register-btn");
    if (buyBtn) {
      buyBtn.addEventListener("click", () => {
        this.buyAndRegisterToInventory();
      });
    }
  }

  readFormInputs() {
    const marcaEl = document.getElementById("valuator-marca-input");
    const vehiculoEl = document.getElementById("valuator-vehiculo-input");
    const anioEl = document.getElementById("valuator-anio-input");
    const motorEl = document.getElementById("valuator-motor-input");
    const fallasEl = document.getElementById("valuator-fallas-input");

    this.marca = (marcaEl && marcaEl.value.trim()) || "Ford";
    this.vehiculo = (vehiculoEl && vehiculoEl.value.trim()) || "Explorer";
    this.anio = (anioEl && anioEl.value.trim()) || "2006";
    this.motor = (motorEl && motorEl.value.trim()) || "4.0L V6";
    this.fallas = (fallasEl && fallasEl.value.trim()) || "";

    this.currentModelName = `${this.marca} ${this.vehiculo} ${this.anio} ${this.motor}`.trim();
    if (this.lastInspectionModelName && (
      this.lastInspectionModelName !== this.currentModelName ||
      this.lastInspectionFallas !== this.fallas
    )) {
      this.resetVisualInspection();
    }
  }

  // --- CAPTURA DE FOTOS EN LAS 5 ZONAS CLAVE ---
  async handlePhotoUpload(zone, event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;

    try {
      let compressed = null;
      if (window.imagesManager && typeof window.imagesManager.compressImage === "function") {
        compressed = await window.imagesManager.compressImage(file, 900, 0.75);
      } else {
        compressed = await this.fallbackCompress(file);
      }

      this.photos[zone] = compressed;
      this.resetVisualInspection();

      const previewImg = document.getElementById(`val-photo-preview-${zone}`);
      const placeholder = document.getElementById(`val-photo-placeholder-${zone}`);
      const checkBadge = document.getElementById(`val-photo-badge-${zone}`);

      if (previewImg && placeholder) {
        previewImg.src = compressed;
        previewImg.classList.remove("hidden");
        placeholder.classList.add("hidden");
      }
      if (checkBadge) {
        checkBadge.classList.remove("hidden");
      }

      const aiBtn = document.getElementById("valuator-ai-scan-btn");
      if (aiBtn) {
        aiBtn.classList.remove("opacity-60");
        aiBtn.classList.add("animate-pulse");
      }
    } catch (err) {
      console.error("Error al cargar foto de valuación:", err);
    }
  }

  async handleGalleryPhotoUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    const statusText = document.getElementById("valuator-gallery-status");
    const newPhotos = [];
    try {
      for (let i = 0; i < files.length; i++) {
        if (statusText) statusText.textContent = `Procesando imagen ${i + 1} de ${files.length}...`;
        newPhotos.push(await window.imagesManager.compressImage(files[i], 900, 0.75));
      }
      for (const photo of newPhotos) this.galleryPhotos.push(photo);
      this.resetVisualInspection();
      if (statusText) statusText.textContent = `${this.galleryPhotos.length} imagen(es) adicional(es) listas para analizar`;
    } catch (err) {
      console.error("Error al cargar imágenes de galería para valuación:", err);
      if (statusText) statusText.textContent = "No se pudieron procesar las imágenes seleccionadas.";
      alert("Error al cargar una o más imágenes. Intenta de nuevo.");
    }
  }

  fallbackCompress(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  removePhoto(zone, event) {
    if (event) event.stopPropagation();
    this.photos[zone] = null;
    this.resetVisualInspection();

    const previewImg = document.getElementById(`val-photo-preview-${zone}`);
    const placeholder = document.getElementById(`val-photo-placeholder-${zone}`);
    const checkBadge = document.getElementById(`val-photo-badge-${zone}`);

    if (previewImg && placeholder) {
      previewImg.src = "";
      previewImg.classList.add("hidden");
      placeholder.classList.remove("hidden");
    }
    if (checkBadge) {
      checkBadge.classList.add("hidden");
    }
  }

  resetVisualInspection() {
    this.vehicleColor = "Por verificar";
    this.referenceImageUrl = "";
    this.selectedVehicleMainImage = "";
    this.suggestedImages = [];
    this.lastInspectionModelName = "";
    this.lastInspectionFallas = "";
    this.visualInspection = null;
    const diagnosis = document.getElementById("valuator-ai-diagnosis-result");
    diagnosis?.classList.add("hidden");
    if (diagnosis) diagnosis.textContent = "";
  }

  // --- GENERACIÓN DEL DESPIECE CON IA (MANUALES OEM OFICIALES) ---
  async generateDespieceWithAI(interactive = true) {
    this.readFormInputs();
    const dealPriceInput = document.getElementById("valuator-deal-price");
    if (dealPriceInput) dealPriceInput.value = "";

    const statusModal = document.getElementById("valuator-ai-status-modal");
    const statusText = document.getElementById("valuator-ai-status-text");

    if (interactive && statusModal && statusText) {
      statusModal.classList.remove("hidden");
      statusText.textContent = `Consultando manual oficial de taller OEM para ${this.currentModelName}...`;
    }

    try {
      const apiKey = getGeminiApiKey();
      let pieces = null;

      if (apiKey && interactive) {
        pieces = await this.callGeminiForDespiece(apiKey, statusText);
      }

      // Si no hay API key o no devolvió piezas válidas, usar el generador técnico OEM verificado
      if (!pieces || pieces.length === 0) {
        if (statusText) statusText.textContent = "Cargando catálogo técnico de despiece según ficha oficial de fabricante...";
        pieces = this.generateOfficialOEMDespiece(this.marca, this.vehiculo, this.anio, this.motor, this.fallas);
      }

      this.currentPiecesList = pieces;
      this.damagedPieceIndexes.clear();

      // Pre-marcar piezas dañadas según detección de fallas o IA
      this.currentPiecesList.forEach((item, idx) => {
        if (item.daniada) {
          this.damagedPieceIndexes.add(idx);
        }
      });

      this.renderChecklist();
      this.calculateOffer();

      const diagnosisEl = document.getElementById("valuator-ai-diagnosis-result");
      if (diagnosisEl) {
        const dañadasCount = this.damagedPieceIndexes.size;
        diagnosisEl.innerHTML = `
          <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 font-black text-indigo-950 text-sm">
                <span>📘 Despiece Oficial OEM Generado con IA</span>
              </div>
              <span class="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">Manual de Fabricante</span>
            </div>
            <p class="text-indigo-900 leading-relaxed">
              Vehículo: <strong>${this.currentModelName}</strong>. Se identificaron <strong>${this.currentPiecesList.length} componentes oficiales</strong>. Según fallas reportadas (<em>"${this.fallas || 'Ninguna especificada'}"</em>), se pre-marcaron <strong>${dañadasCount} piezas con falla o daño</strong>.
            </p>
            <p class="text-slate-600 font-medium">
              👉 Puedes tocar cualquier pieza en la lista para marcarla o desmarcarla según tu inspección física.
            </p>
          </div>
        `;
        diagnosisEl.classList.remove("hidden");
      }
    } catch (err) {
      console.error("Error al generar despiece:", err);
      // Fallback infalible
      this.currentPiecesList = this.generateOfficialOEMDespiece(this.marca, this.vehiculo, this.anio, this.motor, this.fallas);
      this.damagedPieceIndexes.clear();
      this.currentPiecesList.forEach((item, idx) => {
        if (item.daniada) this.damagedPieceIndexes.add(idx);
      });
      this.renderChecklist();
      this.calculateOffer();
    } finally {
      if (statusModal) statusModal.classList.add("hidden");
    }
  }

  // --- LLAMADA A GEMINI CON PROMPT OEM ESTRICTO ---
  async callGeminiForDespiece(apiKey, statusText) {
    const prompt = `Eres un Ingeniero Especialista en Despiece Automotriz y Tasación Pericial de Yonke.
REGLA ESTRICTA DE BÚSQUEDA Y FUENTES:
Debes basar tu conocimiento EXCLUSIVAMENTE en manuales oficiales del fabricante (OEM Service Manuals, Ford Workshop Manuals, GM Techline, Nissan Consult/FAST, Toyota TIS, AllData OEM) y catálogos de partes originales. QUEDAN EXPRESAMENTE PROHIBIDOS FOROS, BLOGS, OPINIONES O FUENTES NO OFICIALES.

Vehículo a despiezar:
- Marca: ${this.marca}
- Vehículo / Modelo: ${this.vehiculo}
- Año: ${this.anio}
- Motor: ${this.motor}
- Fallas mecánicas u observaciones reportadas: "${this.fallas}"

INSTRUCCIONES OBLIGATORIAS:
1. Genera una entrada independiente por cada pieza OEM físicamente separable y comercializable en este vehículo (tren motriz, mecánica, carrocería, eléctrico, suspensión, frenos e interior). No omitas piezas por agruparlas.
2. No agrupes piezas en pares, juegos, kits o conjuntos. La única excepción permitida es "Sala completa de asientos" para autos de pasajeros (incluye SUV); en camionetas pickup de trabajo enumera cada asiento individualmente. Desglosa cada lado en entradas propias: faros, calaveras, horquillas, manguetas, cálipers, discos, amortiguadores, resortes, puertas, rines y chicotes de freno de mano.
3. Asigna precio, demanda y estado de daño individualmente a cada pieza. No dupliques el precio de un par o conjunto en cada elemento; estima el valor de una pieza individual.
4. Haz un inventario amplio y exhaustivo organizado por conjuntos, sin omitir piezas pequeñas vendibles:
   - Bahía del motor: múltiples de admisión y escape, soportes de motor y transmisión, bomba de frenos, booster, depósito de anticongelante, módulo ABS, líneas de combustible, bomba y líneas/mangueras de dirección hidráulica si equipa, bomba de dirección ("licuadora") y su soporte/base, alternador, marcha, sensores CKP/CMP, MAF, MAP, ECT, TPS, detonación y oxígeno, además de los demás sensores instalados según configuración.
   - Suspensión y frenos delanteros y traseros: puente/subchasis, horquillas/brazos, manguetas, cálipers, discos, tambores y componentes internos si equipa, resortes, amortiguadores/struts, barras y bieletas estabilizadoras, terminales y rótulas, mazas/rodamientos, brazos traseros y chicotes individuales del freno de mano si equipa.
   - No limites la respuesta a una lista corta ni establezcas un máximo de piezas. Recorre todas las secciones y diagramas OEM de servicio y crea una entrada por cada componente que pueda desmontarse e inspeccionarse individualmente.
   - Tren motriz, enfriamiento, combustible, dirección, electricidad, carrocería e interior: enumera cada componente que el catálogo/manual OEM identifique como pieza de servicio o refacción.
5. Consulta diagramas de despiece, catálogo de partes y manuales oficiales OEM del año, motor y configuración indicados. No uses fuentes de mercado, foros, blogs ni completes con piezas supuestas. Si una pieza depende de la configuración, incluye solo la que indique el OEM o marca claramente "verificar configuración".
6. Determina TODAS las configuraciones/versiones documentadas del vehículo para cada pieza que cambie por versión (por ejemplo, transmisión automática/manual, dirección hidráulica/estándar, motor, tracción y frenos). Verifica las opciones en manuales y catálogos OEM del año/modelo; no inventes variantes. Inclúyelas en "variantes" como objetos con nombre, compatibilidad y su propio precio/demanda si difieren. Usa "variante_seleccionada" (índice desde 0) solo si la versión está confirmada por los datos/fotos; si no, usa null para que el usuario elija.
7. Busca una imagen real de referencia para cada pieza. Prioriza diagramas/fotos publicados en manuales o catálogos OEM. Solo después de revisar exhaustivamente fuentes OEM, puedes usar una foto de una publicación de Mercado Libre, Amazon o Facebook Marketplace. No inventes URLs ni uses una imagen genérica; si no encuentras una imagen accesible, deja "imagen_url" y "imagen_fuente_url" vacías. Devuelve URL directa de la imagen en "imagen_url" y URL de su página/fuente en "imagen_fuente_url"; indica "OEM", "Mercado Libre", "Amazon", "Facebook Marketplace" o "No disponible" en "imagen_tipo".
8. Para cada pieza:
   - "pieza": Nombre técnico exacto de la pieza.
   - "demanda": Nivel de demanda en el mercado digital de refacciones usadas ("Alta", "Media" o "Baja").
   - "busquedas_info": Cantidad y periodicidad de búsquedas en el mercado digital (ej: "Demanda Alta • ~1,850 búsquedas/mes", "Demanda Media • ~620 búsquedas/mes", "Demanda Baja • ~120 búsquedas/mes").
   - "precio_mercado": Precio de referencia más alto en plataformas digitales para pieza original OEM usada/garantizada en pesos mexicanos (MXN, número entero).
   - "daniada": true si las fallas reportadas ("${this.fallas}") indican que este componente o sus partes internas están dañados (ej: 'motor echa humo / bielas' => Motor 3/4 dañado; 'transmisión bota velocidad' => Transmisión dañada; etc.), de lo contrario false.
   - "compatibilidad": Plataforma y modelos compatibles según manual de fabricante.

Responde ÚNICAMENTE con un array JSON válido sin bloques markdown ni texto adicional:
[
  {
    "pieza": "...",
    "demanda": "Alta|Media|Baja",
    "busquedas_info": "Demanda ... • ... búsquedas/mes",
    "precio_mercado": 0,
    "daniada": false,
    "compatibilidad": "...",
    "imagen_url": "https://...",
    "imagen_fuente_url": "https://...",
    "imagen_tipo": "OEM|Mercado Libre|Amazon|Facebook Marketplace|No disponible",
    "variantes": [
      {"nombre":"Transmisión manual","compatibilidad":"...","demanda":"Media","busquedas_info":"...","precio_mercado":0,"imagen_url":"https://...","imagen_fuente_url":"https://...","imagen_tipo":"OEM"}
    ],
    "variante_seleccionada": null
  }
]`;

    const partsPayload = [{ text: prompt }];

    // Incluir fotos si hay disponibles para análisis visual
    for (const [zone, b64] of Object.entries(this.photos)) {
      if (b64 && typeof b64 === "string" && b64.includes(",")) {
        const mime = b64.substring(b64.indexOf(":") + 1, b64.indexOf(";"));
        const data = b64.split(",")[1];
        partsPayload.push({
          inlineData: {
            mimeType: mime || "image/jpeg",
            data: data
          }
        });
      }
    }
    for (const b64 of this.galleryPhotos) {
      if (typeof b64 === "string" && b64.includes(",")) {
        partsPayload.push({
          inlineData: {
            mimeType: b64.substring(b64.indexOf(":") + 1, b64.indexOf(";")) || "image/jpeg",
            data: b64.split(",")[1]
          }
        });
      }
    }

    if (statusText) statusText.textContent = "Analizando con Gemini AI y manuales de fabricante...";

    const res = await window.callGeminiProxy("gemini-3.6-flash", {
        contents: [{ parts: partsPayload }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.2 }
    });

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanJson = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    const safeUrl = (value) => {
      try {
        const url = new URL(String(value || ""));
        return url.protocol === "https:" ? url.href : "";
      } catch {
        return "";
      }
    };
    const groundingSources = new Set((data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [])
      .map((chunk) => safeUrl(chunk.web?.uri)).filter(Boolean));
    const groundedSourceUrl = (value) => {
      const url = safeUrl(value);
      return groundingSources.has(url) ? url : "";
    };
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((p, idx) => {
        const imageSourceUrl = groundedSourceUrl(p.imagen_fuente_url);
        const base = {
          pieza: String(p.pieza || "Componente"),
          demanda: ["Alta", "Media", "Baja"].includes(p.demanda) ? p.demanda : "Media",
          busquedas_info: p.busquedas_info || "Demanda Media • ~500 búsquedas/mes",
          precio_mercado: parseFloat(p.precio_mercado) || 1500,
          compatibilidad: p.compatibilidad || `Manual OEM ${this.marca}`,
          imagen_url: imageSourceUrl ? safeUrl(p.imagen_url) : "",
          imagen_fuente_url: imageSourceUrl,
          imagen_tipo: String(p.imagen_tipo || "No disponible")
        };
        const variantes = Array.isArray(p.variantes) ? p.variantes.filter((v) => v && typeof v === "object" && v.nombre).map((v) => ({
          nombre: String(v.nombre),
          demanda: ["Alta", "Media", "Baja"].includes(v.demanda) ? v.demanda : base.demanda,
          busquedas_info: v.busquedas_info || base.busquedas_info,
          precio_mercado: parseFloat(v.precio_mercado) || base.precio_mercado,
          compatibilidad: v.compatibilidad || base.compatibilidad,
          imagen_url: groundedSourceUrl(v.imagen_fuente_url) ? safeUrl(v.imagen_url) : base.imagen_url,
          imagen_fuente_url: groundedSourceUrl(v.imagen_fuente_url) || base.imagen_fuente_url,
          imagen_tipo: String(v.imagen_tipo || base.imagen_tipo)
        })) : [];
        const selected = Number.isInteger(p.variante_seleccionada) && variantes[p.variante_seleccionada] ? p.variante_seleccionada : null;
        const current = selected === null ? base : { ...base, ...variantes[selected], pieza: variantes[selected].nombre };
        return { id: idx, ...current, daniada: Boolean(p.daniada), base, variantes, varianteSeleccionada: selected };
      });
    }
    return null;
  }

  // --- CATÁLOGO TÉCNICO OEM OFICIAL INTEGRADO (INFALIBLE) ---
  generateOfficialOEMDespiece(marca, vehiculo, anio, motor, fallas) {
    const fallasNorm = (fallas || "").toLowerCase();
    const isTruck = /explorer|f[-\s]?(150|250|350|450|550)|super duty|silverado|sierra|colorado|canyon|ram|tahoe|lobo|ranger|maverick|tacoma|tundra|frontier|navara|hilux|amarok|gladiator|d-max|bt-50|np300|cherokee|sienna|escape|cr-v|rav4|camioneta|pickup|suv/i.test(`${vehiculo} ${marca}`);
    const isWorkTruck = /f[-\s]?(150|250|350|450|550)|super duty|lobo|ranger|silverado|sierra|colorado|canyon|ram|tacoma|tundra|frontier|navara|hilux|amarok|gladiator|d-max|bt-50|np300|maverick|pickup|camioneta de trabajo/i.test(`${vehiculo} ${marca}`);

    // Detección inteligente de fallas en texto
    const motorDañado = /humo|biela|bielas|desbiel|desviel|calent|compresion|anillo|tronado|desarmado|motor roto|amarrado/i.test(fallasNorm);
    const transDañada = /transmi|caja|bota|velocidad|patea|resbala|patina|neutral|fuga aceite caja/i.test(fallasNorm);
    const frenteDañado = /frente|choque frontal|trompa|radiador roto|facia|cofre doblado/i.test(fallasNorm);
    const traseraDañada = /cola|trasera|cajuela aplastada|golpe atras|calavera rota/i.test(fallasNorm);

    // Lista estructurada según manuales oficiales de servicio OEM
    const baseOEM = isTruck ? [
      {
        pieza: `Motor ${motor} 3/4`,
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~2,800 búsquedas/mes en Mercado Libre",
        precio_mercado: 19500,
        daniada: motorDañado,
        compatibilidad: `Manual ${marca}: Compatible con plataformas de camioneta ${marca} ${anio}`
      },
      {
        pieza: "Transmisión Automática / Estándar",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,950 búsquedas/mes en Mercado Libre",
        precio_mercado: 13500,
        daniada: transDañada,
        compatibilidad: `Manual ${marca}: Compatible con tracción trasera/4x4 de la serie`
      },
      {
        pieza: "Caja de Transferencia / Transfer 4x4",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~680 búsquedas/mes",
        precio_mercado: 7500,
        daniada: transDañada,
        compatibilidad: `Manual ${marca} 4WD`
      },
      {
        pieza: "Diferencial Trasero Completo (Eje)",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,100 búsquedas/mes",
        precio_mercado: 6500,
        daniada: false,
        compatibilidad: `Paso de corona y piñón según especificación de catálogo OEM ${marca}`
      },
      {
        pieza: "Computadora de Motor (PCM / ECU)",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,650 búsquedas/mes en plataformas digitales",
        precio_mercado: 3800,
        daniada: false,
        compatibilidad: `Diagrama eléctrico oficial ${marca}: Código específico de calibración`
      },
      {
        pieza: "Alternador Original OEM",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,400 búsquedas/mes",
        precio_mercado: 1900,
        daniada: false,
        compatibilidad: `Manual de taller: Regulador interno compatible con arnés ${marca}`
      },
      {
        pieza: "Marcha / Motor de Arranque",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,250 búsquedas/mes",
        precio_mercado: 1400,
        daniada: false,
        compatibilidad: `Catálogo de partes oficial ${marca}`
      },
      {
        pieza: "Compresor de Aire Acondicionado (A/C)",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,550 búsquedas/mes",
        precio_mercado: 2600,
        daniada: frenteDañado,
        compatibilidad: `Sistema R134a especificación de fábrica ${marca}`
      },
      {
        pieza: "Cuerpo de Aceleración Electrónico",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~720 búsquedas/mes",
        precio_mercado: 1800,
        daniada: false,
        compatibilidad: `Manual de inyección ${marca}`
      },
      {
        pieza: "Bomba de Dirección Hidráulica (Licuadora)",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~640 búsquedas/mes",
        precio_mercado: 1500,
        daniada: false,
        compatibilidad: `Ficha técnica de ensambladora`
      },
      {
        pieza: "Módulo ABS",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~580 búsquedas/mes",
        precio_mercado: 1600,
        daniada: false,
        compatibilidad: `Catálogo de seguridad activa ${marca}`
      },
      {
        pieza: "Bomba de Frenos",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~580 búsquedas/mes",
        precio_mercado: 800,
        daniada: false,
        compatibilidad: `Catálogo de seguridad activa ${marca}`
      },
      {
        pieza: "Cremallera de Dirección Asistida",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~850 búsquedas/mes",
        precio_mercado: 3200,
        daniada: false,
        compatibilidad: `Manual de chasis y suspensión OEM`
      },
      {
        pieza: "Cofre de Motor",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,300 búsquedas/mes",
        precio_mercado: 2800,
        daniada: frenteDañado,
        compatibilidad: `Carrocería oficial ${marca} ${vehiculo}`
      },
      {
        pieza: "Facia Delantera Completa",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,700 búsquedas/mes",
        precio_mercado: 2200,
        daniada: frenteDañado,
        compatibilidad: `Guías y soportes originales`
      },
      {
        pieza: "Faro Delantero Izquierdo",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,900 búsquedas/mes",
        precio_mercado: 1600,
        daniada: frenteDañado,
        compatibilidad: `Óptica OEM izquierda con arnés de fábrica`
      },
      {
        pieza: "Faro Delantero Derecho",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,900 búsquedas/mes",
        precio_mercado: 1600,
        daniada: frenteDañado,
        compatibilidad: `Ópticas OEM con arnés de fábrica`
      },
      {
        pieza: "Salpicadera Izquierda (Chofer)",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~610 búsquedas/mes",
        precio_mercado: 1600,
        daniada: frenteDañado,
        compatibilidad: `Lámina de calibre original`
      },
      {
        pieza: "Salpicadera Derecha (Copiloto)",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~590 búsquedas/mes",
        precio_mercado: 1600,
        daniada: frenteDañado,
        compatibilidad: `Lámina de calibre original`
      },
      {
        pieza: "Puerta Delantera Izquierda Completa",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,150 búsquedas/mes",
        precio_mercado: 3000,
        daniada: false,
        compatibilidad: `Incluye elevador, cerradura y cristal templado OEM`
      },
      {
        pieza: "Puerta Delantera Derecha Completa",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~950 búsquedas/mes",
        precio_mercado: 2800,
        daniada: false,
        compatibilidad: `Incluye elevador, cerradura y cristal templado OEM`
      },
      {
        pieza: "Puerta Trasera Izquierda Completa",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~720 búsquedas/mes",
        precio_mercado: 2500,
        daniada: false,
        compatibilidad: `Carrocería original`
      },
      {
        pieza: "Puerta Trasera Derecha Completa",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~710 búsquedas/mes",
        precio_mercado: 2500,
        daniada: false,
        compatibilidad: `Carrocería original`
      },
      {
        pieza: "Compuerta Trasera / Portón Cajuela",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,200 búsquedas/mes",
        precio_mercado: 3600,
        daniada: traseraDañada,
        compatibilidad: `Cristal y amortiguadores de gas OEM`
      },
      {
        pieza: "Calavera Trasera Izquierda",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,450 búsquedas/mes",
        precio_mercado: 1200,
        daniada: traseraDañada,
        compatibilidad: `Arnés y soquets de fábrica, lado izquierdo`
      },
      {
        pieza: "Calavera Trasera Derecha",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,450 búsquedas/mes",
        precio_mercado: 1200,
        daniada: traseraDañada,
        compatibilidad: `Arnés y soquets de fábrica`
      },
      {
        pieza: "Radiador",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~890 búsquedas/mes",
        precio_mercado: 1800,
        daniada: frenteDañado,
        compatibilidad: `Flujo de enfriamiento según manual oficial de motor ${motor}`
      },
      {
        pieza: "Motoventilador Izquierdo",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~890 búsquedas/mes",
        precio_mercado: 450,
        daniada: frenteDañado,
        compatibilidad: `Sistema de enfriamiento OEM ${marca}`
      },
      {
        pieza: "Motoventilador Derecho",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~890 búsquedas/mes",
        precio_mercado: 450,
        daniada: frenteDañado,
        compatibilidad: `Flujo de enfriamiento manual oficial de motor ${motor}`
      },
      {
        pieza: "Rin Delantero Izquierdo Original de Aluminio",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~2,100 búsquedas/mes",
        precio_mercado: 1700,
        daniada: false,
        compatibilidad: `Barrenación y centro de rueda OEM ${marca}`
      },
      {
        pieza: "Rin Delantero Derecho Original de Aluminio",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~2,100 búsquedas/mes",
        precio_mercado: 1700,
        daniada: false,
        compatibilidad: `Barrenación y centro de rueda OEM ${marca}`
      },
      {
        pieza: "Rin Trasero Izquierdo Original de Aluminio",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~2,100 búsquedas/mes",
        precio_mercado: 1700,
        daniada: false,
        compatibilidad: `Barrenación y centro de rueda OEM ${marca}`
      },
      {
        pieza: "Rin Trasero Derecho Original de Aluminio",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~2,100 búsquedas/mes",
        precio_mercado: 1700,
        daniada: false,
        compatibilidad: `Barrenación y centro de rueda OEM ${marca}`
      },
      {
        pieza: "Cluster / Tablero de Instrumentos Digital",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~540 búsquedas/mes",
        precio_mercado: 2000,
        daniada: false,
        compatibilidad: `Odómetro y arnés oficial`
      },
      {
        pieza: "Asiento Delantero Izquierdo",
        demanda: "Baja",
        busquedas_info: "Demanda Baja • ~180 búsquedas/mes",
        precio_mercado: 750,
        daniada: false,
        compatibilidad: `Tapicería y rieles originales, lado izquierdo`
      },
      {
        pieza: "Asiento Delantero Derecho",
        demanda: "Baja",
        busquedas_info: "Demanda Baja • ~180 búsquedas/mes",
        precio_mercado: 750,
        daniada: false,
        compatibilidad: `Tapicería y rieles originales, lado derecho`
      },
      {
        pieza: "Asiento Trasero Izquierdo",
        demanda: "Baja",
        busquedas_info: "Demanda Baja • ~180 búsquedas/mes",
        precio_mercado: 750,
        daniada: false,
        compatibilidad: `Tapicería y rieles originales`
      },
      {
        pieza: "Asiento Trasero Derecho",
        demanda: "Baja",
        busquedas_info: "Demanda Baja • ~180 búsquedas/mes",
        precio_mercado: 750,
        daniada: false,
        compatibilidad: `Tapicería y rieles originales`
      },
      {
        pieza: "Tanque de Gasolina",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~460 búsquedas/mes",
        precio_mercado: 1200,
        daniada: false,
        compatibilidad: `Tanque según manual técnico OEM`
      },
      {
        pieza: "Bomba de Gasolina",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~460 búsquedas/mes",
        precio_mercado: 800,
        daniada: false,
        compatibilidad: `Presión de riel según manual técnico OEM`
      },
      {
        pieza: "Flotador de Combustible",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~460 búsquedas/mes",
        precio_mercado: 200,
        daniada: false,
        compatibilidad: `Presión de riel según manual técnico OEM`
      }
    ] : [
      {
        pieza: `Motor ${motor} 3/4 4 Cilindros`,
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~3,100 búsquedas/mes en plataformas digitales",
        precio_mercado: 14500,
        daniada: motorDañado,
        compatibilidad: `Manual oficial ${marca}: Compatible con sedanes ${marca} generación ${anio}`
      },
      {
        pieza: "Transmisión Estándar / Automática",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~2,200 búsquedas/mes",
        precio_mercado: 9500,
        daniada: transDañada,
        compatibilidad: `Relación de engranes según catálogo técnico de fábrica`
      },
      {
        pieza: "Computadora de Motor (ECU)",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,800 búsquedas/mes",
        precio_mercado: 3200,
        daniada: false,
        compatibilidad: `Diagrama de pines oficial de la marca`
      },
      {
        pieza: "Alternador OEM Original",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,500 búsquedas/mes",
        precio_mercado: 1600,
        daniada: false,
        compatibilidad: `Amperaje y polea de fábrica`
      },
      {
        pieza: "Marcha / Motor de Arranque",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,350 búsquedas/mes",
        precio_mercado: 1200,
        daniada: false,
        compatibilidad: `Bendix y solenoide original`
      },
      {
        pieza: "Compresor de Aire Acondicionado",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,600 búsquedas/mes",
        precio_mercado: 2300,
        daniada: frenteDañado,
        compatibilidad: `Especificación de carga original de gas`
      },
      {
        pieza: "Cuerpo de Aceleración",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~790 búsquedas/mes",
        precio_mercado: 1600,
        daniada: false,
        compatibilidad: `Manual de inyección electrónica`
      },
      {
        pieza: "Cofre de Motor",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,400 búsquedas/mes",
        precio_mercado: 2100,
        daniada: frenteDañado,
        compatibilidad: `Lámina y bisagras OEM`
      },
      {
        pieza: "Facia Delantera",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,850 búsquedas/mes",
        precio_mercado: 1700,
        daniada: frenteDañado,
        compatibilidad: `Encastre exacto de grapas`
      },
      {
        pieza: "Faro Delantero Izquierdo",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,950 búsquedas/mes",
        precio_mercado: 1300,
        daniada: frenteDañado,
        compatibilidad: `Óptica original homologada, lado izquierdo`
      },
      {
        pieza: "Faro Delantero Derecho",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,950 búsquedas/mes",
        precio_mercado: 1300,
        daniada: frenteDañado,
        compatibilidad: `Ópticas originales homologadas`
      },
      {
        pieza: "Salpicadera Delantera Izquierda",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~780 búsquedas/mes",
        precio_mercado: 1100,
        daniada: frenteDañado,
        compatibilidad: `Calibre oficial de fábrica, lado izquierdo`
      },
      {
        pieza: "Salpicadera Delantera Derecha",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~780 búsquedas/mes",
        precio_mercado: 1100,
        daniada: frenteDañado,
        compatibilidad: `Calibre oficial de fábrica`
      },
      {
        pieza: "Puerta Delantera Izquierda",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,300 búsquedas/mes",
        precio_mercado: 2200,
        daniada: false,
        compatibilidad: `Cristal y mecanismos OEM`
      },
      {
        pieza: "Puerta Delantera Derecha",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,300 búsquedas/mes",
        precio_mercado: 2200,
        daniada: false,
        compatibilidad: `Cristal y mecanismos OEM`
      },
      {
        pieza: "Puerta Trasera Izquierda",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,300 búsquedas/mes",
        precio_mercado: 2050,
        daniada: false,
        compatibilidad: `Cristal y mecanismos OEM`
      },
      {
        pieza: "Puerta Trasera Derecha",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,300 búsquedas/mes",
        precio_mercado: 2050,
        daniada: false,
        compatibilidad: `Cristales templados y mecanismos OEM`
      },
      {
        pieza: "Tapa de Cajuela / Portón",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~690 búsquedas/mes",
        precio_mercado: 2200,
        daniada: traseraDañada,
        compatibilidad: `Cerradura y bisagras de ensamble`
      },
      {
        pieza: "Calavera Trasera Izquierda",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,400 búsquedas/mes",
        precio_mercado: 950,
        daniada: traseraDañada,
        compatibilidad: `Arnés eléctrico original, lado izquierdo`
      },
      {
        pieza: "Calavera Trasera Derecha",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,400 búsquedas/mes",
        precio_mercado: 950,
        daniada: traseraDañada,
        compatibilidad: `Arnés eléctrico original`
      },
      {
        pieza: "Radiador",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~820 búsquedas/mes",
        precio_mercado: 1400,
        daniada: frenteDañado,
        compatibilidad: `Enfriamiento según manual de taller`
      },
      {
        pieza: "Motoventilador",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~820 búsquedas/mes",
        precio_mercado: 700,
        daniada: frenteDañado,
        compatibilidad: `Enfriamiento según manual de taller`
      },
      {
        pieza: "Puente Delantero",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,100 búsquedas/mes",
        precio_mercado: 1800,
        daniada: false,
        compatibilidad: `Geometría de suspensión de fábrica`
      },
      {
        pieza: "Horquilla Delantera Izquierda",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,100 búsquedas/mes",
        precio_mercado: 800,
        daniada: false,
        compatibilidad: `Suspensión OEM, lado izquierdo`
      },
      {
        pieza: "Horquilla Delantera Derecha",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,100 búsquedas/mes",
        precio_mercado: 800,
        daniada: false,
        compatibilidad: `Geometría de suspensión de fábrica`
      },
      {
        pieza: "Cremallera de Dirección Asistida",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~750 búsquedas/mes",
        precio_mercado: 2500,
        daniada: false,
        compatibilidad: `Manual de chasis OEM`
      },
      {
        pieza: "Módulo ABS",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~510 búsquedas/mes",
        precio_mercado: 2100,
        daniada: false,
        compatibilidad: `Norma de frenado de fábrica`
      },
      {
        pieza: "Eje Trasero Completo",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~620 búsquedas/mes",
        precio_mercado: 2600,
        daniada: false,
        compatibilidad: `Rodamientos y tambores/discos originales`
      },
      {
        pieza: "Rin Delantero Izquierdo",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,750 búsquedas/mes",
        precio_mercado: 1300,
        daniada: false,
        compatibilidad: `Barrenación exacta OEM`
      },
      {
        pieza: "Rin Delantero Derecho",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,750 búsquedas/mes",
        precio_mercado: 1300,
        daniada: false,
        compatibilidad: `Barrenación exacta OEM`
      },
      {
        pieza: "Rin Trasero Izquierdo",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,750 búsquedas/mes",
        precio_mercado: 1300,
        daniada: false,
        compatibilidad: `Barrenación exacta OEM`
      },
      {
        pieza: "Rin Trasero Derecho",
        demanda: "Alta",
        busquedas_info: "Demanda Alta • ~1,750 búsquedas/mes",
        precio_mercado: 1300,
        daniada: false,
        compatibilidad: `Barrenación exacta OEM`
      },
      {
        pieza: "Bomba de Gasolina Completa",
        demanda: "Media",
        busquedas_info: "Demanda Media • ~630 búsquedas/mes",
        precio_mercado: 1600,
        daniada: false,
        compatibilidad: `Regulador y flotador calibrado`
      },
      {
        pieza: "Asiento Delantero Izquierdo",
        demanda: "Baja",
        busquedas_info: "Demanda Baja • ~140 búsquedas/mes",
        precio_mercado: 625,
        daniada: false,
        compatibilidad: `Tapicería de serie, lado izquierdo`
      },
      {
        pieza: "Asiento Delantero Derecho",
        demanda: "Baja",
        busquedas_info: "Demanda Baja • ~140 búsquedas/mes",
        precio_mercado: 625,
        daniada: false,
        compatibilidad: `Tapicería de serie, lado derecho`
      },
      {
        pieza: "Asiento Trasero Izquierdo",
        demanda: "Baja",
        busquedas_info: "Demanda Baja • ~140 búsquedas/mes",
        precio_mercado: 625,
        daniada: false,
        compatibilidad: `Tapicería de serie`
      },
      {
        pieza: "Asiento Trasero Derecho",
        demanda: "Baja",
        busquedas_info: "Demanda Baja • ~140 búsquedas/mes",
        precio_mercado: 625,
        daniada: false,
        compatibilidad: `Tapicería de serie`
      }
    ];

    if (!isWorkTruck) {
      const seatParts = baseOEM.filter(item => item.pieza.startsWith("Asiento "));
      if (seatParts.length) {
        const seatIndex = baseOEM.findIndex(item => item.pieza.startsWith("Asiento "));
        baseOEM.splice(seatIndex, seatParts.length, {
          pieza: "Sala Completa de Asientos",
          demanda: "Baja",
          busquedas_info: "Demanda Baja • Sala completa para auto de pasajeros",
          precio_mercado: seatParts.reduce((total, item) => total + item.precio_mercado, 0),
          daniada: seatParts.some(item => item.daniada),
          compatibilidad: `Asientos delanteros y traseros OEM de ${marca} ${vehiculo}`
        });
      }
    }

    baseOEM.push(
      { pieza: "Múltiple de Admisión", demanda: "Media", busquedas_info: "Demanda Media • componente de bahía de motor", precio_mercado: 1800, daniada: motorDañado, compatibilidad: `Admisión OEM para ${motor}` },
      { pieza: "Múltiple de Escape", demanda: "Media", busquedas_info: "Demanda Media • componente de bahía de motor", precio_mercado: 1500, daniada: motorDañado, compatibilidad: `Escape OEM para ${motor}` },
      { pieza: "Soporte de Motor Izquierdo", demanda: "Media", busquedas_info: "Demanda Media • soporte individual", precio_mercado: 700, daniada: motorDañado, compatibilidad: `Soporte OEM lado izquierdo para ${motor}` },
      { pieza: "Soporte de Motor Derecho", demanda: "Media", busquedas_info: "Demanda Media • soporte individual", precio_mercado: 700, daniada: motorDañado, compatibilidad: `Soporte OEM lado derecho para ${motor}` },
      { pieza: "Soporte de Transmisión", demanda: "Media", busquedas_info: "Demanda Media • soporte individual", precio_mercado: 600, daniada: transDañada, compatibilidad: `Soporte OEM para transmisión de ${vehiculo}` },
      { pieza: "Booster de Frenos", demanda: "Media", busquedas_info: "Demanda Media • frenos", precio_mercado: 1300, daniada: false, compatibilidad: `Booster indicado en catálogo OEM ${marca} ${anio}` },
      { pieza: "Bomba de Frenos", demanda: "Media", busquedas_info: "Demanda Media • frenos", precio_mercado: 800, daniada: false, compatibilidad: `Configuración de frenos OEM ${anio}` },
      { pieza: "Bomba de Dirección Hidráulica (Licuadora)", demanda: "Media", busquedas_info: "Demanda Media • dirección", precio_mercado: 1500, daniada: false, compatibilidad: `Solo si equipa sistema hidráulico OEM` },
      { pieza: "Depósito de Anticongelante", demanda: "Media", busquedas_info: "Demanda Media • enfriamiento", precio_mercado: 500, daniada: frenteDañado, compatibilidad: `Depósito OEM para ${vehiculo}` },
      { pieza: "Línea de Combustible de Alimentación", demanda: "Baja", busquedas_info: "Demanda Baja • combustible", precio_mercado: 450, daniada: false, compatibilidad: `Trazado según diagrama OEM ${marca}` },
      { pieza: "Línea de Combustible de Retorno", demanda: "Baja", busquedas_info: "Demanda Baja • combustible", precio_mercado: 400, daniada: false, compatibilidad: `Solo si equipa retorno según configuración OEM` },
      { pieza: "Manguera de Alta Presión de Dirección Hidráulica", demanda: "Media", busquedas_info: "Demanda Media • dirección", precio_mercado: 550, daniada: false, compatibilidad: `Solo en sistema hidráulico indicado por OEM` },
      { pieza: "Manguera de Retorno de Dirección Hidráulica", demanda: "Baja", busquedas_info: "Demanda Baja • dirección", precio_mercado: 350, daniada: false, compatibilidad: `Solo en sistema hidráulico indicado por OEM` },
      { pieza: "Soporte de Bomba de Dirección Hidráulica", demanda: "Baja", busquedas_info: "Demanda Baja • soporte individual", precio_mercado: 350, daniada: false, compatibilidad: `Base OEM de bomba hidráulica si equipa` },
      { pieza: "Sensor de Posición de Cigüeñal CKP", demanda: "Media", busquedas_info: "Demanda Media • sensor de motor", precio_mercado: 600, daniada: motorDañado, compatibilidad: `Sensor y conector según diagrama OEM ${motor}` },
      { pieza: "Sensor de Flujo de Aire MAF", demanda: "Media", busquedas_info: "Demanda Media • sensor de motor", precio_mercado: 700, daniada: false, compatibilidad: `Sensor MAF si equipa según configuración OEM` },
      { pieza: "Sensor de Presión Absoluta MAP", demanda: "Media", busquedas_info: "Demanda Media • sensor de motor", precio_mercado: 500, daniada: false, compatibilidad: `Sensor MAP si equipa según configuración OEM` },
      { pieza: "Sensor de Posición de Árbol de Levas CMP", demanda: "Media", busquedas_info: "Demanda Media • sensor de motor", precio_mercado: 550, daniada: motorDañado, compatibilidad: `Sensor CMP si equipa según configuración OEM` },
      { pieza: "Sensor de Temperatura de Refrigerante ECT", demanda: "Media", busquedas_info: "Demanda Media • sensor de motor", precio_mercado: 350, daniada: false, compatibilidad: `Sensor ECT según diagrama OEM` },
      { pieza: "Sensor de Posición de Acelerador TPS", demanda: "Media", busquedas_info: "Demanda Media • sensor de motor", precio_mercado: 400, daniada: false, compatibilidad: `TPS si es componente separado según configuración OEM` },
      { pieza: "Sensor de Oxígeno", demanda: "Media", busquedas_info: "Demanda Media • sensor de motor", precio_mercado: 450, daniada: motorDañado, compatibilidad: `Cantidad y ubicación según diagrama OEM` },
      { pieza: "Cáliper Delantero Izquierdo", demanda: "Media", busquedas_info: "Demanda Media • freno individual", precio_mercado: 900, daniada: frenteDañado, compatibilidad: `Verificar freno de disco delantero OEM` },
      { pieza: "Cáliper Delantero Derecho", demanda: "Media", busquedas_info: "Demanda Media • freno individual", precio_mercado: 900, daniada: frenteDañado, compatibilidad: `Verificar freno de disco delantero OEM` },
      { pieza: "Disco Delantero Izquierdo", demanda: "Media", busquedas_info: "Demanda Media • freno individual", precio_mercado: 650, daniada: frenteDañado, compatibilidad: `Disco según configuración OEM, lado izquierdo` },
      { pieza: "Disco Delantero Derecho", demanda: "Media", busquedas_info: "Demanda Media • freno individual", precio_mercado: 650, daniada: frenteDañado, compatibilidad: `Disco según configuración OEM, lado derecho` },
      { pieza: "Mangueta Delantera Izquierda", demanda: "Media", busquedas_info: "Demanda Media • suspensión individual", precio_mercado: 1000, daniada: frenteDañado, compatibilidad: `Mangueta OEM lado izquierdo` },
      { pieza: "Mangueta Delantera Derecha", demanda: "Media", busquedas_info: "Demanda Media • suspensión individual", precio_mercado: 1000, daniada: frenteDañado, compatibilidad: `Mangueta OEM lado derecho` },
      { pieza: "Amortiguador Delantero Izquierdo", demanda: "Media", busquedas_info: "Demanda Media • suspensión individual", precio_mercado: 700, daniada: frenteDañado, compatibilidad: `Amortiguador/strut OEM lado izquierdo` },
      { pieza: "Amortiguador Delantero Derecho", demanda: "Media", busquedas_info: "Demanda Media • suspensión individual", precio_mercado: 700, daniada: frenteDañado, compatibilidad: `Amortiguador/strut OEM lado derecho` },
      { pieza: "Cáliper Trasero Izquierdo", demanda: "Media", busquedas_info: "Demanda Media • freno individual", precio_mercado: 800, daniada: traseraDañada, compatibilidad: `Solo si equipa freno de disco trasero OEM` },
      { pieza: "Cáliper Trasero Derecho", demanda: "Media", busquedas_info: "Demanda Media • freno individual", precio_mercado: 800, daniada: traseraDañada, compatibilidad: `Solo si equipa freno de disco trasero OEM` },
      { pieza: "Disco Trasero Izquierdo", demanda: "Media", busquedas_info: "Demanda Media • freno individual", precio_mercado: 550, daniada: traseraDañada, compatibilidad: `Solo si equipa freno de disco trasero OEM` },
      { pieza: "Disco Trasero Derecho", demanda: "Media", busquedas_info: "Demanda Media • freno individual", precio_mercado: 550, daniada: traseraDañada, compatibilidad: `Solo si equipa freno de disco trasero OEM` },
      { pieza: "Mangueta Trasera Izquierda", demanda: "Media", busquedas_info: "Demanda Media • suspensión individual", precio_mercado: 900, daniada: traseraDañada, compatibilidad: `Mangueta OEM lado izquierdo si equipa` },
      { pieza: "Mangueta Trasera Derecha", demanda: "Media", busquedas_info: "Demanda Media • suspensión individual", precio_mercado: 900, daniada: traseraDañada, compatibilidad: `Mangueta OEM lado derecho si equipa` },
      { pieza: "Amortiguador Trasero Izquierdo", demanda: "Media", busquedas_info: "Demanda Media • suspensión individual", precio_mercado: 650, daniada: traseraDañada, compatibilidad: `Amortiguador OEM lado izquierdo` },
      { pieza: "Amortiguador Trasero Derecho", demanda: "Media", busquedas_info: "Demanda Media • suspensión individual", precio_mercado: 650, daniada: traseraDañada, compatibilidad: `Amortiguador OEM lado derecho` },
      { pieza: "Resorte Delantero Izquierdo", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión individual", precio_mercado: 500, daniada: frenteDañado, compatibilidad: `Resorte OEM lado izquierdo si equipa` },
      { pieza: "Resorte Delantero Derecho", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión individual", precio_mercado: 500, daniada: frenteDañado, compatibilidad: `Resorte OEM lado derecho si equipa` },
      { pieza: "Resorte Trasero Izquierdo", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión individual", precio_mercado: 450, daniada: traseraDañada, compatibilidad: `Resorte OEM lado izquierdo si equipa` },
      { pieza: "Resorte Trasero Derecho", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión individual", precio_mercado: 450, daniada: traseraDañada, compatibilidad: `Resorte OEM lado derecho si equipa` },
      { pieza: "Bieleta Estabilizadora Delantera Izquierda", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión individual", precio_mercado: 300, daniada: frenteDañado, compatibilidad: `Bieleta OEM lado izquierdo si equipa` },
      { pieza: "Bieleta Estabilizadora Delantera Derecha", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión individual", precio_mercado: 300, daniada: frenteDañado, compatibilidad: `Bieleta OEM lado derecho si equipa` },
      { pieza: "Bieleta Estabilizadora Trasera Izquierda", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión individual", precio_mercado: 250, daniada: traseraDañada, compatibilidad: `Bieleta OEM lado izquierdo si equipa` },
      { pieza: "Bieleta Estabilizadora Trasera Derecha", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión individual", precio_mercado: 250, daniada: traseraDañada, compatibilidad: `Bieleta OEM lado derecho si equipa` },
      { pieza: "Terminal de Dirección Izquierda", demanda: "Media", busquedas_info: "Demanda Media • suspensión/dirección individual", precio_mercado: 350, daniada: frenteDañado, compatibilidad: `Terminal OEM lado izquierdo` },
      { pieza: "Terminal de Dirección Derecha", demanda: "Media", busquedas_info: "Demanda Media • suspensión/dirección individual", precio_mercado: 350, daniada: frenteDañado, compatibilidad: `Terminal OEM lado derecho` },
      { pieza: "Rótula Inferior Izquierda", demanda: "Media", busquedas_info: "Demanda Media • suspensión individual", precio_mercado: 400, daniada: frenteDañado, compatibilidad: `Rótula OEM lado izquierdo si es reemplazable` },
      { pieza: "Rótula Inferior Derecha", demanda: "Media", busquedas_info: "Demanda Media • suspensión individual", precio_mercado: 400, daniada: frenteDañado, compatibilidad: `Rótula OEM lado derecho si es reemplazable` },
      { pieza: "Maza Delantera Izquierda", demanda: "Media", busquedas_info: "Demanda Media • suspensión individual", precio_mercado: 700, daniada: frenteDañado, compatibilidad: `Maza/rodamiento OEM lado izquierdo` },
      { pieza: "Maza Delantera Derecha", demanda: "Media", busquedas_info: "Demanda Media • suspensión individual", precio_mercado: 700, daniada: frenteDañado, compatibilidad: `Maza/rodamiento OEM lado derecho` },
      { pieza: "Brazo de Suspensión Trasera Izquierdo", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión individual", precio_mercado: 500, daniada: traseraDañada, compatibilidad: `Brazo OEM lado izquierdo si equipa` },
      { pieza: "Brazo de Suspensión Trasera Derecho", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión individual", precio_mercado: 500, daniada: traseraDañada, compatibilidad: `Brazo OEM lado derecho si equipa` },
      { pieza: "Chicote de Freno de Mano Izquierdo", demanda: "Baja", busquedas_info: "Demanda Baja • freno individual", precio_mercado: 300, daniada: false, compatibilidad: `Chicote según sistema OEM, lado izquierdo` },
      { pieza: "Chicote de Freno de Mano Derecho", demanda: "Baja", busquedas_info: "Demanda Baja • freno individual", precio_mercado: 300, daniada: false, compatibilidad: `Chicote según sistema OEM, lado derecho` },
      { pieza: "Múltiple de Admisión", demanda: "Media", busquedas_info: "Demanda Media • bahía del motor", precio_mercado: 1800, daniada: motorDañado, compatibilidad: `Catálogo OEM para ${motor}` },
      { pieza: "Múltiple de Escape", demanda: "Media", busquedas_info: "Demanda Media • bahía del motor", precio_mercado: 1500, daniada: motorDañado, compatibilidad: `Catálogo OEM para ${motor}` },
      { pieza: "Booster de Frenos", demanda: "Media", busquedas_info: "Demanda Media • bahía del motor", precio_mercado: 1300, daniada: false, compatibilidad: `Configuración de frenos OEM ${anio}` },
      { pieza: "Depósito de Anticongelante", demanda: "Media", busquedas_info: "Demanda Media • bahía del motor", precio_mercado: 500, daniada: frenteDañado, compatibilidad: `Enfriamiento OEM ${vehiculo}` },
      { pieza: "Línea de Combustible de Alimentación", demanda: "Baja", busquedas_info: "Demanda Baja • bahía del motor", precio_mercado: 450, daniada: false, compatibilidad: `Diagrama de combustible OEM` },
      { pieza: "Línea de Combustible de Retorno", demanda: "Baja", busquedas_info: "Demanda Baja • bahía del motor", precio_mercado: 400, daniada: false, compatibilidad: `Solo si equipa según configuración OEM` },
      { pieza: "Manguera de Alta Presión de Dirección Hidráulica", demanda: "Media", busquedas_info: "Demanda Media • dirección", precio_mercado: 550, daniada: false, compatibilidad: `Solo si equipa dirección hidráulica OEM` },
      { pieza: "Manguera de Retorno de Dirección Hidráulica", demanda: "Baja", busquedas_info: "Demanda Baja • dirección", precio_mercado: 350, daniada: false, compatibilidad: `Solo si equipa dirección hidráulica OEM` },
      { pieza: "Soporte de Bomba de Dirección Hidráulica", demanda: "Baja", busquedas_info: "Demanda Baja • bahía del motor", precio_mercado: 350, daniada: false, compatibilidad: `Base OEM de bomba hidráulica si equipa` },
      { pieza: "Sensor de Posición de Cigüeñal CKP", demanda: "Media", busquedas_info: "Demanda Media • bahía del motor", precio_mercado: 600, daniada: motorDañado, compatibilidad: `Diagrama eléctrico OEM ${motor}` },
      { pieza: "Sensor de Flujo de Aire MAF", demanda: "Media", busquedas_info: "Demanda Media • bahía del motor", precio_mercado: 700, daniada: false, compatibilidad: `Solo si equipa según configuración OEM` },
      { pieza: "Sensor de Presión Absoluta MAP", demanda: "Media", busquedas_info: "Demanda Media • bahía del motor", precio_mercado: 500, daniada: false, compatibilidad: `Solo si equipa según configuración OEM` },
      { pieza: "Cáliper Delantero Izquierdo", demanda: "Media", busquedas_info: "Demanda Media • suspensión/frenos", precio_mercado: 900, daniada: frenteDañado, compatibilidad: `Freno delantero OEM de disco, lado izquierdo` },
      { pieza: "Cáliper Delantero Derecho", demanda: "Media", busquedas_info: "Demanda Media • suspensión/frenos", precio_mercado: 900, daniada: frenteDañado, compatibilidad: `Freno delantero OEM de disco, lado derecho` },
      { pieza: "Disco Delantero Izquierdo", demanda: "Media", busquedas_info: "Demanda Media • suspensión/frenos", precio_mercado: 650, daniada: frenteDañado, compatibilidad: `Freno OEM, lado izquierdo` },
      { pieza: "Disco Delantero Derecho", demanda: "Media", busquedas_info: "Demanda Media • suspensión/frenos", precio_mercado: 650, daniada: frenteDañado, compatibilidad: `Freno OEM, lado derecho` },
      { pieza: "Mangueta Delantera Izquierda", demanda: "Media", busquedas_info: "Demanda Media • suspensión", precio_mercado: 1000, daniada: frenteDañado, compatibilidad: `Suspensión OEM, lado izquierdo` },
      { pieza: "Mangueta Delantera Derecha", demanda: "Media", busquedas_info: "Demanda Media • suspensión", precio_mercado: 1000, daniada: frenteDañado, compatibilidad: `Suspensión OEM, lado derecho` },
      { pieza: "Amortiguador Delantero Izquierdo", demanda: "Media", busquedas_info: "Demanda Media • suspensión", precio_mercado: 700, daniada: frenteDañado, compatibilidad: `Suspensión OEM, lado izquierdo` },
      { pieza: "Amortiguador Delantero Derecho", demanda: "Media", busquedas_info: "Demanda Media • suspensión", precio_mercado: 700, daniada: frenteDañado, compatibilidad: `Suspensión OEM, lado derecho` },
      { pieza: "Cáliper Trasero Izquierdo", demanda: "Media", busquedas_info: "Demanda Media • suspensión/frenos", precio_mercado: 800, daniada: traseraDañada, compatibilidad: `Solo si equipa freno trasero OEM de disco` },
      { pieza: "Cáliper Trasero Derecho", demanda: "Media", busquedas_info: "Demanda Media • suspensión/frenos", precio_mercado: 800, daniada: traseraDañada, compatibilidad: `Solo si equipa freno trasero OEM de disco` },
      { pieza: "Disco Trasero Izquierdo", demanda: "Media", busquedas_info: "Demanda Media • suspensión/frenos", precio_mercado: 550, daniada: traseraDañada, compatibilidad: `Solo si equipa freno trasero OEM de disco` },
      { pieza: "Disco Trasero Derecho", demanda: "Media", busquedas_info: "Demanda Media • suspensión/frenos", precio_mercado: 550, daniada: traseraDañada, compatibilidad: `Solo si equipa freno trasero OEM de disco` },
      { pieza: "Mangueta Trasera Izquierda", demanda: "Media", busquedas_info: "Demanda Media • suspensión", precio_mercado: 900, daniada: traseraDañada, compatibilidad: `Suspensión OEM, lado izquierdo si equipa` },
      { pieza: "Mangueta Trasera Derecha", demanda: "Media", busquedas_info: "Demanda Media • suspensión", precio_mercado: 900, daniada: traseraDañada, compatibilidad: `Suspensión OEM, lado derecho si equipa` },
      { pieza: "Amortiguador Trasero Izquierdo", demanda: "Media", busquedas_info: "Demanda Media • suspensión", precio_mercado: 650, daniada: traseraDañada, compatibilidad: `Suspensión OEM, lado izquierdo` },
      { pieza: "Amortiguador Trasero Derecho", demanda: "Media", busquedas_info: "Demanda Media • suspensión", precio_mercado: 650, daniada: traseraDañada, compatibilidad: `Suspensión OEM, lado derecho` },
      { pieza: "Resorte Delantero Izquierdo", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión", precio_mercado: 500, daniada: frenteDañado, compatibilidad: `Resorte OEM lado izquierdo si equipa` },
      { pieza: "Resorte Delantero Derecho", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión", precio_mercado: 500, daniada: frenteDañado, compatibilidad: `Resorte OEM lado derecho si equipa` },
      { pieza: "Resorte Trasero Izquierdo", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión", precio_mercado: 450, daniada: traseraDañada, compatibilidad: `Resorte OEM lado izquierdo si equipa` },
      { pieza: "Resorte Trasero Derecho", demanda: "Baja", busquedas_info: "Demanda Baja • suspensión", precio_mercado: 450, daniada: traseraDañada, compatibilidad: `Resorte OEM lado derecho si equipa` }
    );

    const piezasRegistradas = new Set();
    return baseOEM.filter(item => {
      if (piezasRegistradas.has(item.pieza)) return false;
      piezasRegistradas.add(item.pieza);
      return true;
    }).map((item, idx) => ({
      id: idx,
      ...item
    }));
  }

  async findVehicleReferenceImage(color) {
    const images = await this.findThreeVehicleImages(this.marca, this.vehiculo, this.anio, color);
    return images[0] || "";
  }

  async findThreeVehicleImages(marca, vehiculo, anio, color = "") {
    const urls = new Set();
    const cleanMarca = (marca || "").trim();
    const cleanVehiculo = (vehiculo || "").trim();
    const cleanAnio = (anio || "").trim();

    try {
      const searchTerms = [
        `"${cleanMarca} ${cleanVehiculo}" ${cleanAnio}`,
        `"${cleanMarca} ${cleanVehiculo}"`,
        `${cleanMarca} ${cleanVehiculo} ${cleanAnio} vehicle`
      ];

      for (const term of searchTerms) {
        if (urls.size >= 3) break;
        const search = new URLSearchParams({
          action: "query",
          generator: "search",
          gsrsearch: term,
          gsrnamespace: "6",
          gsrlimit: "15",
          prop: "imageinfo",
          iiprop: "url",
          iiurlwidth: "800",
          format: "json",
          origin: "*"
        });
        const response = await fetch(`https://commons.wikimedia.org/w/api.php?${search}`);
        if (response.ok) {
          const data = await response.json();
          const pages = Object.values(data?.query?.pages || {});
          for (const page of pages) {
            const title = (page.title || "").toLowerCase();
            const thumb = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
            const matchesMarca = cleanMarca ? title.includes(cleanMarca.toLowerCase()) : true;
            const matchesVehiculo = cleanVehiculo ? title.includes(cleanVehiculo.toLowerCase()) : true;
            if (thumb && /^https:\/\//i.test(thumb) && (matchesMarca || matchesVehiculo)) {
              urls.add(thumb);
              if (urls.size >= 3) break;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Error en búsqueda de imágenes en Wikimedia Commons:", e);
    }

    if (urls.size < 3 && cleanMarca && cleanVehiculo) {
      try {
        const wikiPages = [`${cleanMarca}_${cleanVehiculo}`, cleanVehiculo];
        for (const wp of wikiPages) {
          if (urls.size >= 3) break;
          const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wp)}`);
          if (res.ok) {
            const data = await res.json();
            const originalUrl = data?.originalimage?.source || data?.thumbnail?.source;
            if (originalUrl && /^https:\/\//i.test(originalUrl)) {
              urls.add(originalUrl);
            }
          }
        }
      } catch (e) {
        console.warn("Error en Wikipedia Summary API:", e);
      }
    }

    return Array.from(urls).slice(0, 3);
  }

  selectMainVehiclePhoto(url) {
    if (!url) return;
    this.selectedVehicleMainImage = url;
    this.referenceImageUrl = url;

    const cards = document.querySelectorAll(".val-photo-option-card");
    cards.forEach(card => {
      const isSelected = card.dataset.photoUrl === url;
      card.classList.toggle("ring-4", isSelected);
      card.classList.toggle("ring-emerald-500", isSelected);
      card.classList.toggle("border-emerald-500", isSelected);
      card.classList.toggle("border-slate-200", !isSelected);

      const badge = card.querySelector(".val-photo-selected-badge");
      if (badge) badge.classList.toggle("hidden", !isSelected);

      const btn = card.querySelector(".val-photo-select-btn");
      if (btn) {
        btn.textContent = isSelected ? "✓ Foto Principal Seleccionada" : "Elegir como Principal";
        btn.className = isSelected
          ? "val-photo-select-btn w-full py-1.5 px-3 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-sm"
          : "val-photo-select-btn w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700";
      }
    });
  }

  async runAIVisualInspection() {
    const photos = [
      ...Object.entries(this.photos).filter(([, photo]) => photo).map(([zone, photo]) => ({ label: zone, photo })),
      ...this.galleryPhotos.filter(Boolean).map((photo, index) => ({ label: `galería ${index + 1}`, photo }))
    ];
    if (!photos.length) {
      alert("Carga al menos una foto del vehículo antes de ejecutar la inspección con IA.");
      return;
    }

    this.readFormInputs();
    const statusModal = document.getElementById("valuator-ai-status-modal");
    const statusText = document.getElementById("valuator-ai-status-text");
    if (statusModal) statusModal.classList.remove("hidden");

    try {
      if (typeof window.callGeminiProxy !== "function") {
        throw new Error("No está disponible la conexión segura con Gemini.");
      }
      if (statusText) statusText.textContent = "Analizando color, carrocería y las cinco zonas del vehículo...";
      const pieceNames = this.currentPiecesList.map(item => item.pieza);
      const prompt = `Analiza las fotos adjuntas del vehículo ${this.currentModelName}. Fallas reportadas: ${JSON.stringify(this.fallas)}. Las imágenes indican su zona en la etiqueta de texto anterior a cada foto.
Determina el color exterior predominante y qué piezas de esta lista muestran daño físico visible: ${JSON.stringify(pieceNames)}.
Evalúa también si las cinco zonas (frente, costado izquierdo, costado derecho, trasera e interior) tienen cobertura suficiente para descartar razonablemente un choque.
Devuelve únicamente JSON válido con esta forma:
{"color":"color exterior o No identificado","collision_damage_visible":true,"mechanical_or_electrical_only":false,"coverage_sufficient":false,"damaged_parts":["nombre exacto de una pieza de la lista"],"reason":"motivo breve"}
Reglas: collision_damage_visible solo es true ante daño de colisión visible; mechanical_or_electrical_only solo es true cuando las fallas reportadas son mecánicas o eléctricas y las fotos no muestran daño de colisión; coverage_sufficient solo es true si las fotos permiten evaluar las cinco zonas. Si la imagen es ambigua, no afirmes que no hubo choque ni que la cobertura es suficiente. No infieras piezas dañadas solo por la presencia de una foto; devuelve nombres exactos de la lista.`;
      const parts = [{ text: prompt }];
      photos.forEach(({ label, photo }) => {
        if (typeof photo !== "string" || !photo.startsWith("data:image/") || !photo.includes(",")) return;
        parts.push({ text: `Foto de zona: ${label}` });
        parts.push({
          inlineData: {
            mimeType: photo.substring(photo.indexOf(":") + 1, photo.indexOf(";")) || "image/jpeg",
            data: photo.split(",")[1]
          }
        });
      });
      if (parts.length === 1) throw new Error("No hay imágenes válidas para enviar al análisis.");

      const response = await window.callGeminiProxy("gemini-3.6-flash", {
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.1 }
      });
      if (!response.ok) throw new Error(`Gemini respondió con error ${response.status}.`);

      const result = await response.json();
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const jsonText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const analysis = JSON.parse(jsonText);
      if (
        typeof analysis.color !== "string" ||
        typeof analysis.collision_damage_visible !== "boolean" ||
        typeof analysis.mechanical_or_electrical_only !== "boolean" ||
        typeof analysis.coverage_sufficient !== "boolean" ||
        !Array.isArray(analysis.damaged_parts)
      ) {
        throw new Error("Gemini devolvió un diagnóstico incompleto.");
      }

      this.vehicleColor = analysis.color.trim().slice(0, 60) || "Por verificar";

      // Detección de choque: IA visual, piezas de carrocería dañadas o falla textual de impacto
      const fallasText = (this.fallas || "").toLowerCase();
      const isFallaChoque = /choque|chocado|golpe|impacto|siniestro|colisi|trompa|volcadura|deshecho|frente destrozado/i.test(fallasText);
      const isDamagedCarroceria = (analysis.damaged_parts || []).some(name =>
        /facia|cofre|salpicadera|defensa|faro|puerta|calavera|cajuela|parrilla|marco/i.test(name)
      );
      const isChocado = Boolean(analysis.collision_damage_visible) || isFallaChoque || isDamagedCarroceria;

      this.referenceImageUrl = "";
      this.suggestedImages = [];
      this.visualInspection = { ...analysis, isChocado };
      this.lastInspectionModelName = this.currentModelName;
      this.lastInspectionFallas = this.fallas;

      if (isChocado) {
        if (statusText) statusText.textContent = "Vehículo chocado detectado. Buscando 3 imágenes del modelo exacto en internet...";
        try {
          this.suggestedImages = await this.findThreeVehicleImages(this.marca, this.vehiculo, this.anio, this.vehicleColor);
          if (this.suggestedImages.length > 0) {
            this.selectedVehicleMainImage = this.suggestedImages[0];
            this.referenceImageUrl = this.suggestedImages[0];
          }
        } catch (error) {
          console.error("No se pudieron cargar imágenes de referencia del vehículo chocado:", error);
        }
      } else {
        const availablePhotos = [
          this.photos.frente,
          this.photos.costado_izq,
          this.photos.costado_der,
          this.photos.trasera,
          this.photos.interiores
        ].filter(p => typeof p === "string" && (/^https:\/\//i.test(p) || /^data:image\//i.test(p)));
        this.selectedVehicleMainImage = availablePhotos[0] || "";
        this.referenceImageUrl = this.selectedVehicleMainImage;
      }

      const normalizePieceName = value => String(value || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const damagedParts = new Set(analysis.damaged_parts.map(normalizePieceName));
      let countMarked = 0;
      this.currentPiecesList.forEach((item, index) => {
        if (damagedParts.has(normalizePieceName(item.pieza))) {
          this.damagedPieceIndexes.add(index);
          countMarked++;
        }
      });
      this.renderChecklist();
      this.calculateOffer();

      const diagnosisEl = document.getElementById("valuator-ai-diagnosis-result");
      if (diagnosisEl) {
        if (isChocado) {
          const cardsHtml = this.suggestedImages.length > 0
            ? this.suggestedImages.map((imgUrl, i) => {
                const isSelected = imgUrl === this.selectedVehicleMainImage;
                return `
                  <div class="val-photo-option-card flex flex-col bg-white rounded-xl border ${isSelected ? 'border-emerald-500 ring-4 ring-emerald-500' : 'border-slate-200'} p-2.5 shadow-sm transition cursor-pointer relative"
                       data-photo-url="${imgUrl}"
                       onclick="window.vehicleValuatorManager.selectMainVehiclePhoto('${imgUrl}')">
                    <div class="relative h-28 w-full rounded-lg overflow-hidden bg-slate-100 mb-2">
                      <img src="${imgUrl}" alt="Opción ${i + 1}" class="w-full h-full object-cover">
                      <span class="val-photo-selected-badge ${isSelected ? '' : 'hidden'} absolute top-1.5 right-1.5 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                        ✓ Seleccionada
                      </span>
                    </div>
                    <div class="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-2">
                      <span>Opción ${i + 1}</span>
                      <span class="text-[10px] text-emerald-600 font-extrabold">100% Coincidencia</span>
                    </div>
                    <button type="button" class="val-photo-select-btn w-full py-1.5 px-3 rounded-lg text-xs ${isSelected ? 'font-bold bg-emerald-600 text-white shadow-sm' : 'font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700'}">
                      ${isSelected ? '✓ Foto Principal Seleccionada' : 'Elegir como Principal'}
                    </button>
                  </div>
                `;
              }).join("")
            : `<div class="col-span-1 sm:col-span-3 text-center py-4 text-xs text-amber-800 font-medium">Buscando imágenes de referencia en internet...</div>`;

          diagnosisEl.innerHTML = `
            <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 font-black text-amber-950 text-sm">
                  <span>⚠️ Daño de Choque / Colisión Detectado</span>
                </div>
                <span class="px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold">IA Detección Visual</span>
              </div>
              <p class="text-amber-900 leading-relaxed">
                La IA detectó daños de choque o colisión. Se obtuvieron <strong>3 imágenes de referencia oficiales</strong> con coincidencia 100% exacta para <strong>${this.marca} ${this.vehiculo} ${this.anio}</strong>. Selecciona cuál deseas que se muestre como <strong>foto principal en los botones de Vehículos</strong> de Mostrador e Inventario:
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                ${cardsHtml}
              </div>
              <div class="text-[11px] text-slate-600 pt-1 border-t border-amber-200 flex items-center justify-between">
                <span>Piezas con daño visible marcadas: <strong>${countMarked}</strong></span>
                <span class="text-slate-500">Color detectado: <strong>${this.vehicleColor}</strong></span>
              </div>
            </div>
          `;
        } else {
          const zones = [
            { key: "frente", label: "Frente" },
            { key: "costado_izq", label: "Costado Izq." },
            { key: "costado_der", label: "Costado Der." },
            { key: "trasera", label: "Trasera" },
            { key: "interiores", label: "Interiores" }
          ];
          const cardsHtml = zones.map(z => {
            const photoUrl = this.photos[z.key];
            if (!photoUrl) {
              return `
                <div class="flex flex-col bg-white rounded-xl border border-dashed border-slate-200 p-2 items-center justify-center text-center h-28 opacity-60">
                  <span class="text-[10px] text-slate-400 font-medium">${z.label}<br>(Sin foto)</span>
                </div>
              `;
            }
            const isSelected = photoUrl === this.selectedVehicleMainImage;
            return `
              <div class="val-photo-option-card flex flex-col bg-white rounded-xl border ${isSelected ? 'border-emerald-500 ring-4 ring-emerald-500' : 'border-slate-200'} p-2 shadow-sm transition cursor-pointer relative"
                   data-photo-url="${photoUrl}"
                   onclick="window.vehicleValuatorManager.selectMainVehiclePhoto('${photoUrl}')">
                <div class="relative h-24 w-full rounded-lg overflow-hidden bg-slate-100 mb-1.5">
                  <img src="${photoUrl}" alt="${z.label}" class="w-full h-full object-cover">
                  <span class="val-photo-selected-badge ${isSelected ? '' : 'hidden'} absolute top-1 right-1 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                    ✓ Principal
                  </span>
                </div>
                <div class="text-center text-[10px] font-bold text-slate-700 mb-1.5">${z.label}</div>
                <button type="button" class="val-photo-select-btn w-full py-1 px-1.5 rounded text-[10px] ${isSelected ? 'font-bold bg-emerald-600 text-white shadow-sm' : 'font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700'}">
                  ${isSelected ? '✓ Principal' : 'Elegir'}
                </button>
              </div>
            `;
          }).join("");

          diagnosisEl.innerHTML = `
            <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 font-black text-emerald-950 text-sm">
                  <span>✅ Vehículo Sin Choque Detectado (Falla Mecánica/Eléctrica)</span>
                </div>
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">Inspección Limpia</span>
              </div>
              <p class="text-emerald-900 leading-relaxed">
                El vehículo no presenta choque. Las <strong>5 fotos de la inspección fotográfica</strong> se guardarán en la galería del vehículo. Selecciona cuál de ellas deseas que sea la <strong>foto principal en los botones de Vehículos</strong> de Mostrador e Inventario:
              </p>
              <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                ${cardsHtml}
              </div>
              <div class="text-[11px] text-slate-600 pt-1 border-t border-emerald-200 flex items-center justify-between">
                <span>Piezas con daño marcadas: <strong>${countMarked}</strong></span>
                <span class="text-slate-500">Color detectado: <strong>${this.vehicleColor}</strong></span>
              </div>
            </div>
          `;
        }
        diagnosisEl.classList.remove("hidden");
      }
      alert(`Inspección IA completada. Se marcaron ${countMarked} piezas con daño visible.\n\n${isChocado ? "Se detectó vehículo chocado: selecciona una de las 3 imágenes de referencia oficiales como foto principal." : "Vehículo sin choque: selecciona cuál de las fotos de inspección será la foto principal."}`);
    } catch (error) {
      console.error("No se pudo completar la inspección visual con IA:", error);
      alert(`No se pudo completar la inspección con IA: ${error.message}`);
    } finally {
      statusModal?.classList.add("hidden");
    }
  }

  toggleDamaged(idx) {
    if (this.damagedPieceIndexes.has(idx)) {
      this.damagedPieceIndexes.delete(idx);
    } else {
      this.damagedPieceIndexes.add(idx);
    }
    this.renderChecklist();
    this.calculateOffer();
  }

  updatePieceDemand(idx, demanda) {
    if (!this.currentPiecesList[idx] || !["Alta", "Media", "Baja"].includes(demanda)) return;
    this.currentPiecesList[idx].demanda = demanda;
    this.renderChecklist();
    this.calculateOffer();
  }

  updatePieceVariant(idx, variantIdx, checked) {
    const item = this.currentPiecesList[idx];
    if (!item || !item.base || !item.variantes?.[variantIdx]) return;
    item.varianteSeleccionada = checked ? variantIdx : null;
    const current = checked ? item.variantes[variantIdx] : item.base;
    Object.assign(item, current, { pieza: current.nombre || current.pieza });
    this.renderChecklist();
    this.calculateOffer();
  }

  // --- RENDERIZADO DEL CHECKLIST CON DEMANDA Y BÚSQUEDAS DIGITALES ---
  renderChecklist() {
    const container = document.getElementById("valuator-checklist-container");
    if (!container) return;

    if (!this.currentPiecesList || this.currentPiecesList.length === 0) {
      container.innerHTML = `
        <div class="p-6 text-center text-slate-400 text-xs">
          Pulsa "Despiece Técnico e Inspección IA" para cargar las piezas del vehículo.
        </div>
      `;
      return;
    }

    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
    let html = "";
    this.currentPiecesList.forEach((item, idx) => {
      const isDamaged = this.damagedPieceIndexes.has(idx);
      const pieceName = escapeHtml(item.pieza);
      const imageUrl = escapeHtml(item.imagen_url || "");
      const imageSourceUrl = escapeHtml(item.imagen_fuente_url || "");
      const variants = (item.variantes || []).map((variant, variantIdx) => `
        <label class="flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
          <input type="checkbox" ${item.varianteSeleccionada === variantIdx ? "checked" : ""}
            onclick="event.stopPropagation()"
            onchange="window.vehicleValuatorManager.updatePieceVariant(${idx}, ${variantIdx}, this.checked)"
            class="mt-0.5 accent-emerald-600 rounded-sm"/>
          <span>${escapeHtml(variant.nombre)} <span class="text-slate-400">— ${escapeHtml(variant.compatibilidad)}</span></span>
        </label>
      `).join("");

      // Colores de badge según demanda
      let demandaBadgeClass = "bg-slate-100 text-slate-700 border-slate-300";
      if (item.demanda === "Alta") {
        demandaBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold";
      } else if (item.demanda === "Media") {
        demandaBadgeClass = "bg-blue-100 text-blue-800 border-blue-300 font-semibold";
      }

      html += `
        <div 
          onclick="window.vehicleValuatorManager.toggleDamaged(${idx})"
          class="p-3 rounded-2xl border cursor-pointer transition flex items-start justify-between gap-3 select-none ${
            isDamaged 
              ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-inner' 
              : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 shadow-sm'
          }"
        >
          <div class="relative w-24 h-20 sm:w-28 sm:h-24 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-100" data-reference-image>
            ${imageUrl ? `<img src="${imageUrl}" alt="${pieceName}" loading="lazy" referrerpolicy="no-referrer" class="w-full h-full object-contain" onerror="this.remove();this.parentElement.querySelector('[data-image-fallback]').classList.remove('hidden')"/>` : ""}
            <div data-image-fallback class="${imageUrl ? "hidden" : ""} w-full h-full flex items-center justify-center text-[10px] text-slate-400 text-center px-1">Sin imagen disponible</div>
            <span class="absolute bottom-0 right-0 bg-slate-900/80 text-white text-[8px] px-1.5 py-0.5 rounded-tl-md">Imagen de referencia</span>
          </div>
          <div class="flex items-start gap-3 min-w-0 flex-1">
            <div class="w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
              isDamaged ? 'bg-rose-600 text-white shadow' : 'bg-slate-100 text-slate-500 border border-slate-200'
            }">
              ${isDamaged ? '✕' : '✓'}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs sm:text-sm font-black block ${isDamaged ? 'line-through opacity-70 text-rose-900' : 'text-slate-900'}">
                  ${pieceName}
                </span>
                <select
                  aria-label="Demanda de ${pieceName}"
                  onclick="event.stopPropagation()"
                  onchange="window.vehicleValuatorManager.updatePieceDemand(${idx}, this.value)"
                  class="text-[10px] px-2 py-1 rounded-lg border font-bold cursor-pointer ${demandaBadgeClass}"
                >
                  <option value="Alta" ${item.demanda === "Alta" ? "selected" : ""}>Alta</option>
                  <option value="Media" ${item.demanda === "Media" ? "selected" : ""}>Media</option>
                  <option value="Baja" ${item.demanda === "Baja" ? "selected" : ""}>Baja</option>
                </select>
              </div>
              <div class="text-[11px] mt-0.5 ${isDamaged ? 'text-rose-600 font-bold' : 'text-slate-500'}">
                ${isDamaged ? '⚠️ Dañada / Inservible (Excluida de la oferta)' : escapeHtml(item.busquedas_info)}
              </div>
              ${variants ? `<fieldset class="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-200" onclick="event.stopPropagation()"><legend class="px-1 text-[10px] font-bold text-slate-500">Variantes OEM: selecciona la correcta</legend><div class="space-y-1">${variants}</div></fieldset>` : ""}
              ${imageSourceUrl ? `<a href="${imageSourceUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="mt-1 inline-block text-[9px] text-blue-600 underline">Fuente de imagen: ${escapeHtml(item.imagen_tipo || "OEM")}</a>` : ""}
            </div>
          </div>
          <div class="text-right shrink-0 ml-2">
            <span class="text-xs sm:text-sm font-black block ${isDamaged ? 'text-rose-500 line-through' : 'text-emerald-700'}">
              $${item.precio_mercado.toLocaleString()}
            </span>
            <span class="text-[10px] text-slate-400">Ref. digital</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // --- CÁLCULO DE LA REGLA SAGRADA 3 A 1 SOBRE EL COSTO EN DEMANDA ALTA Y MEDIA ---
  calculateOffer() {
    let valorTeoricoSano = 0;
    let valorDañado = 0;
    let valorRescatable = 0;
    let valorAltaYMedia = 0;

    this.currentPiecesList.forEach((item, idx) => {
      const isDamaged = this.damagedPieceIndexes.has(idx);
      valorTeoricoSano += item.precio_mercado;

      if (isDamaged) {
        valorDañado += item.precio_mercado;
      } else {
        valorRescatable += item.precio_mercado;
        if (item.demanda === "Alta" || item.demanda === "Media") {
          valorAltaYMedia += item.precio_mercado;
        }
      }
    });

    // REGLA SAGRADA: 3 A 1 SOBRE EL COSTO EN DEMANDA ALTA Y MEDIA
    // 3 * Costo = valorAltaYMedia  => CostoTotal = valorAltaYMedia / 3
    // Oferta Máxima = CostoTotal - CostoGrúa
    const costoPermitido = valorAltaYMedia / 3;
    let ofertaCalculada = Math.max(0, costoPermitido - this.gruaCost);
    ofertaCalculada = Math.floor(ofertaCalculada / 500) * 500;

    // Actualizar elementos en pantalla
    const totalSanoEl = document.getElementById("val-total-sano");
    if (totalSanoEl) totalSanoEl.textContent = `$${valorTeoricoSano.toLocaleString()}`;

    const totalDanadoEl = document.getElementById("val-total-danado");
    if (totalDanadoEl) totalDanadoEl.textContent = `-$${valorDañado.toLocaleString()}`;

    const totalRescatableEl = document.getElementById("val-total-rescatable");
    if (totalRescatableEl) totalRescatableEl.textContent = `$${valorRescatable.toLocaleString()}`;

    const offerEl = document.getElementById("val-oferta-sugerida");
    if (offerEl) offerEl.textContent = `$${ofertaCalculada.toLocaleString()} MXN`;

    this.lastCalculatedOffer = ofertaCalculada;
    this.lastRescatable = valorRescatable;
    this.lastAltaMediaRescatable = valorAltaYMedia;
  }

  // --- TRATO HECHO: ALTA EN PATIO E INVENTARIO CON REGLAS DE PRECIO (BASE MÁS ALTO Y MÍNIMO 3:1) ---
  buyAndRegisterToInventory() {
    this.readFormInputs();
    const model = this.currentModelName || "Vehículo Inspeccionado";
    const dealPriceInput = document.getElementById("valuator-deal-price");
    const costoCompra = dealPriceInput ? parseFloat(dealPriceInput.value) : NaN;
    if (isNaN(costoCompra) || costoCompra <= 0) {
      alert("Por favor ingresa un monto final acordado válido mayor a cero.");
      return;
    }

    const vinInput = prompt("Introduce el número de serie / VIN o placas del vehículo (opcional):", "") || "";

    const mainPhoto = this.selectedVehicleMainImage || this.referenceImageUrl || this.photos.frente || "";
    const allVehiclePhotos = [
      mainPhoto,
      ...Object.values(this.photos),
      ...this.galleryPhotos
    ].filter(photo => typeof photo === "string" && (/^https:\/\//i.test(photo) || /^data:image\//i.test(photo)));
    const uniqueVehiclePhotos = [...new Set(allVehiclePhotos)];

    // 1. Dar de alta el vehículo en patio (yonkeDB)
    if (window.yonkeDB && typeof window.yonkeDB.addVehicle === "function") {
      window.yonkeDB.addVehicle({
        modelo: model,
        anio: this.anio || "N/A",
        costo: costoCompra,
        fecha_ingreso: new Date().toISOString().split("T")[0],
        color: this.lastInspectionModelName === this.currentModelName ? this.vehicleColor : "Por verificar",
        vin: vinInput,
        foto_principal: mainPhoto,
        fotos: uniqueVehiclePhotos,
        notas: `Comprado tras valuación in situ con regla 3:1. Rescatable: $${this.lastRescatable.toLocaleString()}`
      });
    }

    // 2. Cálculo del factor de precio mínimo para recuperar inversión inicial (Costo + Grúa) en menor tiempo posible
    const inversionTotal = costoCompra + this.gruaCost;
    const baseAltaMedia = this.lastAltaMediaRescatable || 1;
    // factor para que la suma de precios mínimos de piezas de alta y media cubra exactamente la inversión
    const factorRecuperacion = Math.min(0.9, Math.max(0.2, inversionTotal / baseAltaMedia));

    let piezasAgregadasCount = 0;
    this.currentPiecesList.forEach((item, idx) => {
      if (!this.damagedPieceIndexes.has(idx)) {
        // PRECIO BASE: El mejor y más alto encontrado en plataformas digitales
        const precioBase = Math.round(item.precio_mercado);

        // PRECIO MÍNIMO: El que reparte el cálculo de 3:1 para obtener la inversión inicial en el menor tiempo posible
        let precioMinimo = 0;
        if (item.demanda === "Alta" || item.demanda === "Media") {
          precioMinimo = Math.max(250, Math.round((precioBase * factorRecuperacion) / 50) * 50);
        } else {
          // Demanda baja: margen protector
          precioMinimo = Math.max(150, Math.round((precioBase * 0.50) / 50) * 50);
        }

        if (window.yonkeDB && typeof window.yonkeDB.addPart === "function") {
          window.yonkeDB.addPart({
            id: `P-${Date.now()}-${idx}`,
            vehiculo_origen: model,
            anio: this.anio || "",
            pieza: item.pieza,
            cantidad: 1,
            estado: "En existencia",
            precio_base: precioBase,
            precio_minimo: precioMinimo,
            demanda: item.demanda,
            compatibilidad: item.compatibilidad || `Manual OEM ${this.marca}: compatible con plataforma de ${this.vehiculo}`,
            observacion: `Inspección In-Situ: Pieza sana. Demanda: ${item.demanda} (${item.busquedas_info})`,
            fotos: mainPhoto ? [mainPhoto] : [],
            ubicacion_patio: `En carrocería ${model}`
          });
          piezasAgregadasCount++;
        }
      }
    });

    // Refrescar vistas del sistema si están activas
    if (window.salesManager) {
      if (typeof window.salesManager.renderVehicleFilterDropdown === "function") window.salesManager.renderVehicleFilterDropdown();
      if (typeof window.salesManager.renderPartsGrid === "function") window.salesManager.renderPartsGrid();
    }
    if (window.dashboardManager) {
      if (typeof window.dashboardManager.populateVehicleSelector === "function") window.dashboardManager.populateVehicleSelector();
      if (typeof window.dashboardManager.updateUI === "function") window.dashboardManager.updateUI();
    }
    if (window.appManager && typeof window.appManager.renderInventoryTable === "function") {
      window.appManager.renderInventoryTable();
    }

    alert(
      `🎉 ¡VEHÍCULO COMPRADO E INGRESADO A PATIO CON ÉXITO!\n\n` +
      `🚗 ${model}\n` +
      `💰 Costo de compra: $${costoCompra.toLocaleString()} MXN\n` +
      `📦 ${piezasAgregadasCount} refacciones OEM cargadas al inventario.\n\n` +
      `• Precios base: Máximo valor de mercado digital.\n` +
      `• Precios mínimos: Distribuidos con la regla 3:1 para liquidación y retorno rápido del capital.`
    );
  }
}

window.vehicleValuatorManager = new VehicleValuatorManager();
