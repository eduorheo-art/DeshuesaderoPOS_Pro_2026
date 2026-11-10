// sales.js - Pantalla de Mostrador / Terminal de Venta TPV
// Filtros en cascada (Marca -> Vehículo -> Pieza), Detalle estilo Mercado Libre,
// Ocultamiento confidencial de Precio Mínimo y Ventana de Emergencia con botón "Permitir" y "Cancelar".

class SalesManager {
  constructor() {
    this.selectedMarca = "";
    this.selectedVehiculo = "";
    this.selectedPartId = null;
    this.availableParts = [];
    this.activePhotoIndex = 0;
    this.photoZoomLevel = 1;
    this.pendingLowPriceSale = null;
  }

  init() {
    this.populateMarcaDropdown();
    this.attachEventListeners();
    this.checkPendingDraft();
    this.setupUnloadProtection();
  }

  getDraftStorageKey() {
    const ownerId = window.yonkeDB?.ownerId;
    return ownerId ? `yonke_active_sale_draft:${ownerId}` : null;
  }

  setupUnloadProtection() {
    window.addEventListener("beforeunload", (e) => {
      const key = this.getDraftStorageKey();
      const raw = key ? localStorage.getItem(key) : null;
      if (raw) {
        e.preventDefault();
        e.returnValue = "Tienes una venta pendiente sin confirmar. ¿Deseas salir?";
      }
    });
  }

  attachEventListeners() {
    const marcaSelect = document.getElementById("sales-filter-marca");
    if (marcaSelect) {
      marcaSelect.addEventListener("change", (e) => {
        this.onMarcaChange(e.target.value);
      });
    }

    const vehiculoSelect = document.getElementById("sales-filter-vehiculo");
    if (vehiculoSelect) {
      vehiculoSelect.addEventListener("change", (e) => {
        this.onVehiculoChange(e.target.value);
      });
    }

    const piezaSelect = document.getElementById("sales-filter-pieza");
    if (piezaSelect) {
      piezaSelect.addEventListener("input", (e) => {
        this.onPiezaChange(e.target.value);
      });
    }

    const historyPeriod = document.getElementById("sales-history-period");
    if (historyPeriod) historyPeriod.addEventListener("change", e => this.onSalesHistoryPeriodChange(e.target.value));
    const historyValue = document.getElementById("sales-history-value");
    if (historyValue) historyValue.addEventListener("change", e => this.renderSalesHistory(e.target.value));
    const historyDate = document.getElementById("sales-history-date");
    if (historyDate) historyDate.addEventListener("change", e => this.renderSalesHistory(e.target.value));
    const historyYear = document.getElementById("sales-history-year");
    if (historyYear) {
      historyYear.addEventListener("change", e => {
        const period = document.getElementById("sales-history-period")?.value;
        if (period === "month") {
          this.populateSalesHistoryMonths(e.target.value);
          document.getElementById("sales-history-month-label")?.classList.toggle("hidden", !e.target.value);
          document.getElementById("sales-history-value")?.classList.toggle("hidden", !e.target.value);
          const results = document.getElementById("sales-history-results");
          if (results) { results.innerHTML = ""; results.classList.add("hidden"); }
        } else if (period === "year") {
          this.renderSalesHistory(e.target.value);
        }
      });
    }
  }

  populateSalesHistoryYears(select) {
    const currentYear = new Date().getFullYear();
    select.innerHTML = `<option value="">Año...</option>`;
    for (let year = currentYear; year >= 1900; year--) select.add(new Option(String(year), String(year)));
  }

  populateSalesHistoryMonths(yearValue) {
    const select = document.getElementById("sales-history-value");
    if (!select) return;
    select.innerHTML = `<option value="">Mes...</option>`;
    if (!yearValue) return;
    const year = Number(yearValue);
    const now = new Date();
    const finalMonth = year === now.getFullYear() ? now.getMonth() : 11;
    for (let month = 0; month <= finalMonth; month++) {
      const monthValue = `${year}-${String(month + 1).padStart(2, "0")}`;
      const name = new Intl.DateTimeFormat("es-MX", { month: "long" }).format(new Date(year, month, 1));
      select.add(new Option(`${name} ${year}`, monthValue));
    }
  }

  onSalesHistoryPeriodChange(period) {
    const container = document.getElementById("sales-history-value-container");
    const select = document.getElementById("sales-history-value");
    const label = document.getElementById("sales-history-value-label");
    const dateInput = document.getElementById("sales-history-date");
    const yearSelect = document.getElementById("sales-history-year");
    const monthLabel = document.getElementById("sales-history-month-label");
    const results = document.getElementById("sales-history-results");
    if (!container || !select || !label || !dateInput || !yearSelect || !monthLabel || !results) return;
    select.innerHTML = `<option value="">Seleccionar...</option>`;
    dateInput.value = "";
    yearSelect.innerHTML = `<option value="">Año...</option>`;
    results.innerHTML = "";
    results.classList.add("hidden");
    container.classList.toggle("hidden", !period);
    dateInput.classList.add("hidden");
    yearSelect.classList.add("hidden");
    select.classList.add("hidden");
    monthLabel.classList.add("hidden");
    if (!period) return;
    const now = new Date();
    if (period === "day") {
      label.textContent = "Fecha";
      dateInput.max = this.normalizeSalesHistoryDate(now);
      dateInput.classList.remove("hidden");
    } else if (period === "month") {
      label.textContent = "Año";
      this.populateSalesHistoryYears(yearSelect);
      yearSelect.classList.remove("hidden");
    } else if (period === "year") {
      label.textContent = "Año";
      this.populateSalesHistoryYears(yearSelect);
      yearSelect.classList.remove("hidden");
    } else {
      container.classList.add("hidden");
    }
  }

  normalizeSalesHistoryDate(value) {
    if (!value) return "";
    const text = String(value).trim();
    const serial = Number(text);
    if (/^\d{5}(?:\.\d+)?$/.test(text) && serial > 30000 && serial < 60000) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    }
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  escapeSalesHistoryText(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  renderSalesHistory(selectedValue) {
    const results = document.getElementById("sales-history-results");
    const period = document.getElementById("sales-history-period")?.value;
    if (!results || !period || !selectedValue) {
      if (results) { results.innerHTML = ""; results.classList.add("hidden"); }
      return;
    }
    const sales = window.yonkeDB?.sales || [];
    const matches = value => {
      const date = this.normalizeSalesHistoryDate(value);
      return period === "day" ? date === selectedValue
        : period === "month" ? date.slice(0, 7) === selectedValue
          : date.slice(0, 4) === selectedValue;
    };
    const inventoryParts = window.yonkeDB?.getParts?.() || [];
    const parts = new Map(inventoryParts.map(p => [String(p.id), p]));
    const periodSales = sales.filter(s => s.tipo !== "garantia" && Number(s.monto_cobrado) > 0 && matches(s.fecha || s.fecha_venta));
    const recordedKeys = new Set(periodSales.map(s => `${s.pieza_id || ""}|${this.normalizeSalesHistoryDate(s.fecha || s.fecha_venta)}`));
    inventoryParts.forEach(part => {
      const date = this.normalizeSalesHistoryDate(part.fecha_venta);
      const key = `${part.id}|${date}`;
      if (Number(part.venta_final) > 0 && matches(date) && !recordedKeys.has(key)) {
        periodSales.push({ pieza_id: part.id, pieza_nombre: part.pieza, vehiculo_origen: part.vehiculo_origen, monto_cobrado: part.venta_final, fecha: date, tipo: "inventario" });
      }
    });
    const refundSales = sales.filter(s => s.tipo === "garantia" && matches(s.fecha || s.garantia_fecha));
    const refundKeys = new Set(refundSales.map(s => `${s.pieza_id || ""}|${this.normalizeSalesHistoryDate(s.fecha || s.garantia_fecha)}`));
    const returnedSales = sales.filter(s => {
      if (s.tipo === "garantia" || (s.estado !== "DEVUELTO" && !String(s.notas || "").toLowerCase().includes("garantía aplicada"))) return false;
      const date = s.garantia_fecha || s.fecha;
      return matches(date) && !refundKeys.has(`${s.pieza_id || ""}|${this.normalizeSalesHistoryDate(date)}`);
    });
    const warranties = [...refundSales, ...returnedSales];
    const total = periodSales.reduce((sum, s) => sum + (Number(s.monto_cobrado) || 0), 0);
    const money = n => `$${Number(n || 0).toLocaleString("es-MX")} MXN`;
    const dated = true;
    const rows = (items, warranty = false) => items.map(s => {
      const part = parts.get(String(s.pieza_id));
      const amount = Number(s.monto_cobrado) || 0;
      const date = this.normalizeSalesHistoryDate(warranty ? s.garantia_fecha || s.fecha : s.fecha || s.fecha_venta);
      const notes = warranty ? s.garantia_motivo || s.notas : [s.notas, part?.observacion].filter(Boolean).join(" | ");
      return `<article class="rounded-xl border border-slate-200 bg-slate-50 p-3"><div class="flex flex-wrap justify-between gap-2"><div><p class="text-sm font-bold">${this.escapeSalesHistoryText(s.pieza_nombre || part?.pieza || "Pieza")}</p><p class="text-xs text-slate-500">${this.escapeSalesHistoryText(s.vehiculo_origen || part?.vehiculo_origen || "")}</p></div><span class="text-sm font-black ${warranty ? "text-rose-700" : "text-emerald-700"}">${warranty && amount < 0 ? `Reembolso: ${money(Math.abs(amount))}` : `${warranty ? "Garantía" : "Venta Final"}: ${money(amount)}`}</span></div>${dated && date ? `<p class="mt-1 text-[11px] text-slate-500">Fecha: ${date}</p>` : ""}${notes ? `<p class="mt-2 text-xs text-slate-600"><strong>Observaciones:</strong> ${this.escapeSalesHistoryText(notes)}</p>` : ""}</article>`;
    }).join("");
    const title = period === "day" ? new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date(`${selectedValue}T12:00:00`))
      : period === "month" ? new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date(`${selectedValue}-01T12:00:00`)) : selectedValue;
    results.innerHTML = `<h3 class="text-sm font-black mb-3">Resumen de ${this.escapeSalesHistoryText(title)}</h3><div class="grid grid-cols-2 gap-3 mb-4"><div class="rounded-xl bg-emerald-50 p-3"><span class="block text-[11px] text-emerald-700">Ventas registradas</span><strong class="text-lg">${periodSales.length}</strong></div><div class="rounded-xl bg-blue-50 p-3"><span class="block text-[11px] text-blue-700">Total vendido</span><strong class="text-lg">${money(total)}</strong></div></div><h4 class="text-xs font-black uppercase mb-2">Detalle de ventas</h4><div class="space-y-2">${periodSales.length ? rows(periodSales) : `<p class="py-3 text-xs text-slate-400">No hay ventas en el periodo seleccionado.</p>`}</div><h4 class="text-xs font-black uppercase text-rose-700 mt-5 mb-2">Garantías del periodo (${warranties.length})</h4><div class="space-y-2">${warranties.length ? rows(warranties, true) : `<p class="py-3 text-xs text-slate-400">No hay garantías en el periodo seleccionado.</p>`}</div>`;
    results.classList.remove("hidden");
  }

  // --- EXTRACCIÓN INTELIGENTE DE MARCAS DESDE INVENTARIO Y PATIO ---
  getAvailableBrands() {
    const parts = window.yonkeDB ? window.yonkeDB.getParts() : [];
    const vehicles = window.yonkeDB ? window.yonkeDB.getVehicles() : [];
    const knownBrands = [
      "Ford", "Chevrolet", "Chevy", "Nissan", "Toyota", "Honda", "Dodge", 
      "Chrysler", "Jeep", "GMC", "Volkswagen", "VW", "Mazda", "Hyundai", 
      "Kia", "Mitsubishi", "BMW", "Mercedes-Benz", "Audi", "Seat", "Renault", "Subaru"
    ];

    const detectedBrands = new Set();

    // Extraer de piezas
    parts.forEach(p => {
      const text = `${p.vehiculo_origen || ''} ${p.pieza || ''}`.trim();
      let matched = false;
      for (const brand of knownBrands) {
        if (new RegExp(`\\b${brand}\\b`, "i").test(text)) {
          detectedBrands.add(brand === "Chevy" ? "Chevrolet" : (brand === "VW" ? "Volkswagen" : brand));
          matched = true;
          break;
        }
      }
      if (!matched && p.vehiculo_origen) {
        const firstWord = p.vehiculo_origen.split(" ")[0].trim();
        if (firstWord.length > 2) detectedBrands.add(firstWord);
      }
    });

    // Extraer de vehículos
    vehicles.forEach(v => {
      const text = `${v.modelo || ''}`.trim();
      for (const brand of knownBrands) {
        if (new RegExp(`\\b${brand}\\b`, "i").test(text)) {
          detectedBrands.add(brand === "Chevy" ? "Chevrolet" : (brand === "VW" ? "Volkswagen" : brand));
          break;
        }
      }
    });

    return Array.from(detectedBrands).sort();
  }

  populateMarcaDropdown() {
    const select = document.getElementById("sales-filter-marca");
    if (!select) return;

    const brands = this.getAvailableBrands();
    let html = `<option value="">🏷️ Seleccionar Marca (${brands.length} disponibles)...</option>`;
    brands.forEach(b => {
      html += `<option value="${b}">${b}</option>`;
    });
    select.innerHTML = html;

    // Resetear siguientes selects
    this.resetVehiculoDropdown();
    this.resetPiezaDropdown();
  }

  onMarcaChange(marca) {
    this.selectedMarca = marca;
    this.selectedVehiculo = "";
    this.selectedPartId = null;

    this.populateVehiculoDropdown(marca);
    this.resetPiezaDropdown();
    this.hideDetailView();
  }

  populateVehiculoDropdown(marca) {
    const select = document.getElementById("sales-filter-vehiculo");
    if (!select) return;

    if (!marca) {
      this.resetVehiculoDropdown();
      return;
    }

    const parts = window.yonkeDB ? window.yonkeDB.getParts() : [];
    const vehiclesSet = new Set();

    parts.forEach(p => {
      const vo = (p.vehiculo_origen || "").trim();
      if (!vo) return;
      if (vo.toLowerCase().includes(marca.toLowerCase())) {
        vehiclesSet.add(vo);
      }
    });

    const vehiclesList = Array.from(vehiclesSet).sort();

    let html = `<option value="">🚗 Seleccionar Vehículo de ${marca} (${vehiclesList.length})...</option>`;
    vehiclesList.forEach(v => {
      html += `<option value="${v}">${v}</option>`;
    });

    select.innerHTML = html;
    select.disabled = false;
    select.classList.remove("opacity-50", "cursor-not-allowed");
  }

  resetVehiculoDropdown() {
    const select = document.getElementById("sales-filter-vehiculo");
    if (!select) return;
    select.innerHTML = `<option value="">🚗 Seleccionar Vehículo...</option>`;
    select.disabled = true;
    select.classList.add("opacity-50", "cursor-not-allowed");
  }

  onVehiculoChange(vehiculo) {
    this.selectedVehiculo = vehiculo;
    this.selectedPartId = null;

    this.populatePiezaDropdown(this.selectedMarca, vehiculo);
    this.hideDetailView();
  }

  populatePiezaDropdown(marca, vehiculo) {
    const input = document.getElementById("sales-filter-pieza");
    const suggestions = document.getElementById("sales-filter-pieza-options");
    if (!input || !suggestions) return;

    if (!vehiculo) {
      this.resetPiezaDropdown();
      return;
    }

    const parts = window.yonkeDB ? window.yonkeDB.getParts() : [];
    // Filtrar piezas estrictamente de ese vehículo y marca
    const matchingParts = parts.filter(p => {
      const matchVehiculo = (p.vehiculo_origen || "").toLowerCase() === vehiculo.toLowerCase();
      const isAvailable = p.estado === "En existencia" && (Number(p.cantidad) > 0 || p.cantidad === undefined);
      return matchVehiculo && isAvailable;
    });

    this.availableParts = matchingParts;
    const pieceNames = [...new Set(matchingParts.map(part => String(part.pieza || "").trim()).filter(Boolean))];
    suggestions.replaceChildren(...pieceNames.map(name => {
      const option = document.createElement("option");
      option.value = name;
      return option;
    }));

    input.value = "";
    input.disabled = false;
    input.classList.remove("opacity-50", "cursor-not-allowed");

    const countBadge = document.getElementById("sales-parts-count");
    if (countBadge) {
      countBadge.textContent = `${matchingParts.length} refacciones en existencia para ${vehiculo}`;
    }
  }

  resetPiezaDropdown() {
    const input = document.getElementById("sales-filter-pieza");
    const suggestions = document.getElementById("sales-filter-pieza-options");
    this.availableParts = [];
    if (suggestions) suggestions.replaceChildren();
    if (!input) return;
    input.value = "";
    input.disabled = true;
    input.classList.add("opacity-50", "cursor-not-allowed");
  }

  onPiezaChange(pieceName) {
    const matchedPart = this.availableParts.find(part => String(part.pieza || "").trim() === pieceName.trim());
    if (!matchedPart) {
      this.selectedPartId = null;
      this.hideDetailView();
      return;
    }
    this.selectedPartId = matchedPart.id;
    this.openProductDetail(matchedPart.id);
  }

  // --- NUEVA INTERFAZ ESTILO MERCADO LIBRE ---
  openProductDetail(partId) {
    const part = window.yonkeDB.getPartById(partId);
    if (!part) return;

    const detailView = document.getElementById("sales-product-detail-view");
    const container = document.getElementById("sales-parts-container");
    if (!detailView) return;

    if (container) container.classList.add("hidden");
    detailView.classList.remove("hidden");

    this.activePhotoIndex = 0;
    const photos = Array.isArray(part.fotos) && part.fotos.length > 0 ? part.fotos : [];

    // Renderizar Galería estilo Mercado Libre
    this.renderGalleryML(photos, part);

    // Renderizar datos del producto y formulario inferior derecho
    this.renderProductInfoML(part);

    // Scroll suave hacia el producto
    detailView.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  hideDetailView() {
    const detailView = document.getElementById("sales-product-detail-view");
    const container = document.getElementById("sales-parts-container");
    if (detailView) detailView.classList.add("hidden");
    if (container) container.classList.remove("hidden");
  }

  backToFilters() {
    this.hideDetailView();
    const piezaSelect = document.getElementById("sales-filter-pieza");
    if (piezaSelect) piezaSelect.value = "";
  }

  cancelSaleAction() {
    const confirmCancel = confirm("¿Deseas cancelar la venta de esta pieza y volver a la selección de catálogo?");
    if (confirmCancel) {
      this.discardDraft();
      this.backToFilters();
    }
  }

  // --- RENDERIZADO GALERÍA MERCADO LIBRE ---
  safeSalesImageUrl(value) {
    const url = String(value ?? "");
    if (/^https:\/\//i.test(url) ||
        /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(url)) return url;
    return "";
  }

  renderGalleryML(photos, part) {
    const mainImgEl = document.getElementById("ml-main-photo");
    const thumbContainer = document.getElementById("ml-photo-thumbnails");
    const photoCounterEl = document.getElementById("ml-photo-counter");

    if (!mainImgEl || !thumbContainer) return;

    if (photos.length === 0) {
      mainImgEl.src = "";
      mainImgEl.classList.add("hidden");
      document.getElementById("ml-no-photo-placeholder")?.classList.remove("hidden");
      thumbContainer.innerHTML = `
        <button 
          data-add-photos
          class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-dashed border-slate-300 flex items-center gap-1.5"
        >
          📷 + Agregar Fotos
        </button>
      `;
      thumbContainer.querySelector("[data-add-photos]")?.addEventListener("click", () => {
        window.imagesManager.openCameraModal(part.id);
      });
      if (photoCounterEl) photoCounterEl.textContent = "Sin fotos";
      return;
    }

    document.getElementById("ml-no-photo-placeholder")?.classList.add("hidden");
    mainImgEl.classList.remove("hidden");
    mainImgEl.src = this.safeSalesImageUrl(photos[this.activePhotoIndex]);

    if (photoCounterEl) {
      photoCounterEl.textContent = `${this.activePhotoIndex + 1} de ${photos.length}`;
    }

    let thumbsHtml = "";
    photos.forEach((src, idx) => {
      const isActive = idx === this.activePhotoIndex;
      thumbsHtml += `
        <div 
          data-photo-index="${idx}"
          class="w-16 h-16 rounded-xl overflow-hidden border-2 cursor-pointer transition p-0.5 shrink-0 ${
            isActive ? 'border-blue-600 shadow-md scale-105' : 'border-slate-200 opacity-70 hover:opacity-100'
          }"
        >
          <img src="${this.safeSalesImageUrl(src).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char])}" class="w-full h-full object-cover rounded-lg" alt="Foto ${idx + 1}" />
        </div>
      `;
    });

    thumbContainer.innerHTML = thumbsHtml;
    thumbContainer.querySelectorAll("[data-photo-index]").forEach(element => {
      element.addEventListener("click", () => this.setActivePhoto(Number(element.dataset.photoIndex)));
    });
  }

  setActivePhoto(index) {
    const part = window.yonkeDB.getPartById(this.selectedPartId);
    if (!part || !part.fotos || !part.fotos[index]) return;
    this.activePhotoIndex = index;
    const photos = part.fotos;

    const mainImgEl = document.getElementById("ml-main-photo");
    const photoCounterEl = document.getElementById("ml-photo-counter");

    if (mainImgEl) mainImgEl.src = this.safeSalesImageUrl(photos[index]);
    if (photoCounterEl) photoCounterEl.textContent = `${index + 1} de ${photos.length}`;

    // Actualizar bordes de miniaturas
    this.renderGalleryML(photos, part);
  }

  // --- MODAL DE ZOOM FULLSCREEN ESTILO MERCADO LIBRE ---
  openZoomModal() {
    const part = window.yonkeDB.getPartById(this.selectedPartId);
    if (!part || !part.fotos || part.fotos.length === 0) return;

    const modal = document.getElementById("sales-photo-zoom-modal");
    const zoomImg = document.getElementById("sales-zoom-modal-img");
    const counter = document.getElementById("sales-zoom-modal-counter");

    if (!modal || !zoomImg) return;

    this.photoZoomLevel = 1;
    zoomImg.style.transform = `scale(${this.photoZoomLevel})`;
    zoomImg.src = this.safeSalesImageUrl(part.fotos[this.activePhotoIndex]);

    if (counter) counter.textContent = `${this.activePhotoIndex + 1} / ${part.fotos.length}`;
    modal.classList.remove("hidden");
  }

  closeZoomModal() {
    const modal = document.getElementById("sales-photo-zoom-modal");
    if (modal) modal.classList.add("hidden");
  }

  zoomNextPhoto(delta) {
    const part = window.yonkeDB.getPartById(this.selectedPartId);
    if (!part || !part.fotos || part.fotos.length === 0) return;

    this.activePhotoIndex = (this.activePhotoIndex + delta + part.fotos.length) % part.fotos.length;
    this.photoZoomLevel = 1;

    const zoomImg = document.getElementById("sales-zoom-modal-img");
    const counter = document.getElementById("sales-zoom-modal-counter");

    if (zoomImg) {
      zoomImg.style.transform = "scale(1)";
      zoomImg.src = this.safeSalesImageUrl(part.fotos[this.activePhotoIndex]);
    }
    if (counter) counter.textContent = `${this.activePhotoIndex + 1} / ${part.fotos.length}`;

    // Sincronizar galería principal
    this.setActivePhoto(this.activePhotoIndex);
  }

  zoomIn() {
    this.photoZoomLevel = Math.min(3, this.photoZoomLevel + 0.3);
    const zoomImg = document.getElementById("sales-zoom-modal-img");
    if (zoomImg) zoomImg.style.transform = `scale(${this.photoZoomLevel})`;
  }

  zoomOut() {
    this.photoZoomLevel = Math.max(0.7, this.photoZoomLevel - 0.3);
    const zoomImg = document.getElementById("sales-zoom-modal-img");
    if (zoomImg) zoomImg.style.transform = `scale(${this.photoZoomLevel})`;
  }

  // --- RENDERIZADO DE LA INFORMACIÓN Y FORMULARIO DE COBRO INFERIOR DERECHO ---
  renderProductInfoML(part) {
    const titleEl = document.getElementById("ml-detail-pieza-title");
    const vehicleBadgeEl = document.getElementById("ml-detail-vehicle-badge");
    const compatEl = document.getElementById("ml-detail-compatibilidad");
    const obsEl = document.getElementById("ml-detail-observacion");
    const stockEl = document.getElementById("ml-detail-stock");
    const priceBaseDisplay = document.getElementById("ml-detail-price-base-display");
    const inputContainer = document.getElementById("ml-detail-sale-input-container");
    const demandaBadgeEl = document.getElementById("ml-detail-demanda-badge");

    if (titleEl) titleEl.textContent = part.pieza;

    if (vehicleBadgeEl) {
      vehicleBadgeEl.textContent = `🚗 Vehículo donador: ${part.vehiculo_origen} ${part.anio ? `(${part.anio})` : ''}`;
    }

    if (compatEl) {
      compatEl.replaceChildren();
      if (part.compatibilidad) {
        const label = document.createElement("strong");
        label.className = "text-slate-800";
        label.textContent = "Compatibilidad Oficial:";
        compatEl.append(label, document.createTextNode(` ${part.compatibilidad}`));
      } else {
        const empty = document.createElement("span");
        empty.className = "text-slate-400 italic";
        empty.textContent = "Sin compatibilidad cruzada registrada";
        compatEl.append(empty);
      }
    }

    if (obsEl) {
      obsEl.replaceChildren();
      if (part.observacion) {
        const label = document.createElement("strong");
        label.className = "text-slate-800";
        label.textContent = "Condición / Falla:";
        obsEl.append(label, document.createTextNode(` ${part.observacion}`));
      } else {
        const empty = document.createElement("span");
        empty.className = "text-slate-400 italic";
        empty.textContent = "Pieza original verificada en buen estado";
        obsEl.append(empty);
      }
    }

    if (stockEl) {
      stockEl.textContent = `En existencia (${part.cantidad || 1} disponible)`;
    }

    // Demanda badge
    if (demandaBadgeEl) {
      const demanda = part.demanda || (window.aiPriceUpdaterManager ? window.aiPriceUpdaterManager.calculatePartDemand(part.pieza).demanda : "Media");
      if (demanda === "Alta") {
        demandaBadgeEl.className = "px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300";
        demandaBadgeEl.textContent = "🔥 Demanda Alta";
      } else if (demanda === "Media") {
        demandaBadgeEl.className = "px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300";
        demandaBadgeEl.textContent = "⚡ Demanda Media";
      } else {
        demandaBadgeEl.className = "px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300";
        demandaBadgeEl.textContent = "Demanda Baja";
      }
    }

    // Precio Base en grande
    if (priceBaseDisplay) {
      priceBaseDisplay.textContent = `$${Number(part.precio_base).toLocaleString()} MXN`;
    }

    // Caja de texto en la esquina inferior derecha con precio base inicial
    // NOTA: El Precio Mínimo NO se muestra en pantalla bajo ninguna circunstancia
    if (inputContainer) {
      inputContainer.innerHTML = `
        <div class="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-3 w-full">
          
          <!-- Botón Cancelar -->
          <button 
            type="button"
            data-sale-cancel
            class="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer order-3 sm:order-1"
          >
            <span>✕</span>
            <span>Cancelar</span>
          </button>

          <!-- Input Precio Final acordado -->
          <div class="relative order-1 sm:order-2">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500">$</span>
            <input 
              type="number" 
              data-sale-input
              value="${Number(part.precio_base) || 0}" 
              placeholder="Precio Final"
              class="w-36 pl-7 pr-3 py-2.5 text-base font-black text-slate-900 bg-amber-50 border-2 border-amber-400 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-right shadow-xs"
              title="Ingresa el precio real acordado con el cliente"
            />
          </div>

          <!-- Botón Cobrar -->
          <button 
            type="button"
            data-sale-submit
            class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-2 active:scale-95 whitespace-nowrap cursor-pointer order-2 sm:order-3"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span>Cobrar</span>
          </button>
        </div>
      `;
      const input = inputContainer.querySelector("[data-sale-input]");
      input.id = `input-sale-${part.id}`;
      const saveDraft = () => this.saveDraft(part.id, input.value);
      input.addEventListener("input", saveDraft);
      input.addEventListener("focus", saveDraft);
      inputContainer.querySelector("[data-sale-cancel]")?.addEventListener("click", () => this.cancelSaleAction());
      inputContainer.querySelector("[data-sale-submit]")?.addEventListener("click", () => this.executeSale(part.id));
    }
  }

  // --- EJECUCIÓN DE VENTA Y VENTANA DE EMERGENCIA DE PRECIO MÍNIMO ---
  executeSale(partId, overridePrice) {
    const input = document.querySelector("#ml-detail-sale-input-container [data-sale-input]");
    let finalPrice = overridePrice !== undefined ? overridePrice : (input ? parseFloat(input.value) : NaN);

    if (isNaN(finalPrice) || finalPrice <= 0) {
      alert("Por favor introduce una cantidad válida en el precio de venta.");
      return;
    }

    const part = window.yonkeDB.getPartById(partId);
    if (!part) return;

    const minPrice = Number(part.precio_minimo) || 0;

    // VERIFICACIÓN ESTRICTA: SI ES MENOR AL PRECIO MÍNIMO -> VENTANA DE EMERGENCIA
    if (minPrice > 0 && finalPrice < minPrice) {
      this.pendingLowPriceSale = {
        partId: partId,
        finalPrice: finalPrice,
        part: part
      };
      this.showEmergencyPriceModal(part, finalPrice, minPrice);
      return; // Bloquea la venta hasta que el usuario pulse "Permitir"
    }

    this.completeSaleTransaction(partId, finalPrice, part);
  }

  // --- VENTANA DE EMERGENCIA PARA PRECIO MENOR AL MÍNIMO ---
  showEmergencyPriceModal(part, finalPrice, minPrice) {
    const modal = document.getElementById("sales-emergency-price-modal");
    const textEl = document.getElementById("sales-emergency-price-text");

    if (modal && textEl) {
      textEl.innerHTML = `
        El precio capturado de <strong class="text-rose-600 text-base">$${finalPrice.toLocaleString()} MXN</strong> está por debajo del precio mínimo autorizado de <strong class="text-rose-600 text-base">$${minPrice.toLocaleString()} MXN</strong> para la pieza <strong>"${part.pieza}"</strong>.<br/><br/>
        Para proteger la rentabilidad del yonke y asegurar la regla de retorno 3:1 del vehículo donador, el sistema tiene restringida esta operación.
      `;
      modal.classList.remove("hidden");
    } else {
      // Fallback si por alguna razón no estuviera el modal
      const allow = confirm(`⚠️ VENTANA DE EMERGENCIA:\n\nEl precio de $${finalPrice.toLocaleString()} MXN es menor al Precio Mínimo autorizado de $${minPrice.toLocaleString()} MXN.\n\n¿Deseas PERMITIR la venta de todos modos?`);
      if (allow) {
        this.confirmEmergencySale();
      }
    }
  }

  confirmEmergencySale() {
    if (!this.pendingLowPriceSale) return;
    const { partId, finalPrice, part } = this.pendingLowPriceSale;
    this.closeEmergencyPriceModal();
    this.completeSaleTransaction(partId, finalPrice, part);
  }

  closeEmergencyPriceModal() {
    const modal = document.getElementById("sales-emergency-price-modal");
    if (modal) modal.classList.add("hidden");
    this.pendingLowPriceSale = null;
  }

  completeSaleTransaction(partId, finalPrice, part) {
    try {
      const result = window.yonkeDB.processSale({
        partId: partId,
        finalPrice: finalPrice,
        saleDate: new Date().toISOString().split("T")[0]
      });

      this.discardDraft();

      // Refrescar vistas
      this.hideDetailView();
      this.populatePiezaDropdown(this.selectedMarca, this.selectedVehiculo);

      if (window.financesManager) window.financesManager.updateUI();
      if (window.dashboardManager) window.dashboardManager.updateUI();
      if (window.appManager) window.appManager.renderInventoryTable();

      this.showSaleSuccessModal(result.sale, result.part);
      this.refreshSalesHistory();
    } catch (err) {
      alert("Error al procesar la venta: " + err.message);
    }
  }

  showSaleSuccessModal(sale, part) {
    const modal = document.getElementById("sale-success-modal");
    if (!modal) {
      alert(`✅ ¡Venta Exitosa!\n\nPieza: ${part.pieza}\nCobrado: $${sale.monto_cobrado.toLocaleString()} MXN\n80% Caja A: $${sale.caja_a.toLocaleString()} MXN\n20% Caja B: $${sale.caja_b.toLocaleString()} MXN`);
      return;
    }

    const titleEl = document.getElementById("sale-modal-part-title");
    const amountEl = document.getElementById("sale-modal-amount");
    const cajaAEl = document.getElementById("sale-modal-caja-a");
    const cajaBEl = document.getElementById("sale-modal-caja-b");

    if (titleEl) titleEl.textContent = part.pieza;
    if (amountEl) amountEl.textContent = `$${sale.monto_cobrado.toLocaleString()}`;
    if (cajaAEl) cajaAEl.textContent = `$${sale.caja_a.toLocaleString()}`;
    if (cajaBEl) cajaBEl.textContent = `$${sale.caja_b.toLocaleString()}`;

    modal.classList.remove("hidden");
  }

  closeSaleSuccessModal() {
    const modal = document.getElementById("sale-success-modal");
    if (modal) modal.classList.add("hidden");
  }

  refreshSalesHistory() {
    const period = document.getElementById("sales-history-period")?.value;
    const value = document.getElementById("sales-history-value");
    const selectedValue = period === "day"
      ? document.getElementById("sales-history-date")?.value
      : period === "year"
        ? document.getElementById("sales-history-year")?.value
        : value?.value;
    if (selectedValue) this.renderSalesHistory(selectedValue);
  }

  // --- BORRADOR Y PERSISTENCIA ---
  saveDraft(partId, priceStr) {
    const price = parseFloat(priceStr);
    const part = window.yonkeDB.getPartById(partId);
    if (!part || isNaN(price) || price <= 0) return;

    const draft = {
      partId: part.id,
      pieza: part.pieza,
      vehiculo: part.vehiculo_origen,
      price: price,
      timestamp: Date.now()
    };

    const key = this.getDraftStorageKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(draft));
    this.renderPendingSaleBanner(draft);
  }

  discardDraft() {
    const key = this.getDraftStorageKey();
    if (key) localStorage.removeItem(key);
    const banner = document.getElementById("pending-sale-banner");
    if (banner) banner.classList.add("hidden");
  }

  checkPendingDraft() {
    const key = this.getDraftStorageKey();
    const raw = key ? localStorage.getItem(key) : null;
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (draft && draft.partId) {
        this.renderPendingSaleBanner(draft);
      }
    } catch(e) {}
  }

  renderPendingSaleBanner(draft) {
    const banner = document.getElementById("pending-sale-banner");
    if (!banner) return;

    const textEl = document.getElementById("pending-sale-text");
    if (textEl) {
      const price = Number(draft.price);
      textEl.textContent = `Venta en curso sin confirmar: ${String(draft.pieza || "")} (${String(draft.vehiculo || "")}) por $${Number.isFinite(price) ? price.toLocaleString() : "0"}`;
    }

    banner.classList.remove("hidden");
  }

  resumeOrConfirmDraft() {
    const key = this.getDraftStorageKey();
    const raw = key ? localStorage.getItem(key) : null;
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      this.openProductDetail(draft.partId);
    } catch(e) {}
  }

  // Métodos de compatibilidad para evitar llamadas rotas desde otros módulos
  renderPartsGrid() {
    this.populateMarcaDropdown();
  }

  renderVehicleFilterDropdown() {
    this.populateMarcaDropdown();
  }

  // --- GALERÍA COMPLETA DEL VEHÍCULO A PANTALLA COMPLETA ---
  collectVehiclePhotos(vehicleName) {
    const photos = [];
    const norm = str => String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(vehicleName || this.selectedVehiculo || "");

    // 1. Fotos desde yonkeDB.getVehicles()
    if (window.yonkeDB && typeof window.yonkeDB.getVehicles === "function") {
      const vehicles = window.yonkeDB.getVehicles() || [];
      const match = vehicles.find(v => {
        const vModel = norm(v.modelo || "");
        return vModel && target && (vModel.includes(target) || target.includes(vModel));
      });
      if (match) {
        if (match.foto_principal) photos.push(match.foto_principal);
        if (Array.isArray(match.fotos)) photos.push(...match.fotos);
      }
    }

    // 2. Fotos desde yonkeDB.getParts()
    if (window.yonkeDB && typeof window.yonkeDB.getParts === "function") {
      const parts = window.yonkeDB.getParts() || [];
      parts.forEach(p => {
        const pModel = norm(p.vehiculo_origen || "");
        if (pModel && target && (pModel.includes(target) || target.includes(pModel))) {
          if (Array.isArray(p.fotos)) photos.push(...p.fotos);
        }
      });
    }

    // 3. Foto de la miniatura de referencia actual si existe
    const refImg = document.getElementById("sales-vehicle-reference-image");
    if (refImg && refImg.src && !refImg.src.endsWith("/") && !refImg.src.includes("undefined")) {
      photos.push(refImg.src);
    }

    // Filtrar duplicados y strings válidos
    return [...new Set(photos.filter(p => typeof p === "string" && (p.startsWith("data:image/") || /^https?:\/\//i.test(p))))];
  }

  openVehicleGalleryModal() {
    const vehicleSelect = document.getElementById("sales-filter-vehiculo");
    const heading = document.getElementById("sales-vehicle-heading");
    const vehicleName = (vehicleSelect && vehicleSelect.value) || (heading && heading.textContent) || this.selectedVehiculo || "";
    this.currentGalleryVehicleName = vehicleName;

    const photos = this.collectVehiclePhotos(vehicleName);
    this.currentVehiclePhotos = photos || [];
    this.vehicleGalleryIndex = 0;

    const modal = document.getElementById("vehicle-fullscreen-gallery-modal");
    const titleEl = document.getElementById("vehicle-gallery-modal-title");
    const subtitleEl = document.getElementById("vehicle-gallery-modal-subtitle");
    if (titleEl) titleEl.textContent = vehicleName || "Galería del Vehículo";
    if (subtitleEl) subtitleEl.textContent = this.currentVehiclePhotos.length ? `${this.currentVehiclePhotos.length} fotografía(s) de inspección y referencia` : "Sin fotos registradas";

    // Determinar si el vehículo tiene imagen de referencia como foto principal
    // (no mostrar el botón si contiene las fotos tomadas en la pestaña Valuador)
    const matchBtn = document.getElementById("vehicle-gallery-match-btn");
    const norm = str => String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(vehicleName);
    let isReferenceVehicle = true;

    if (window.yonkeDB && typeof window.yonkeDB.getVehicles === "function") {
      const vehicles = window.yonkeDB.getVehicles() || [];
      const match = vehicles.find(v => {
        const vModel = norm(v.modelo || "");
        return vModel && target && (vModel.includes(target) || target.includes(vModel));
      });
      if (match) {
        const hasRealInspectionPhotos = Array.isArray(match.fotos) && match.fotos.some(f =>
          typeof f === "string" && f.startsWith("data:image/")
        );
        isReferenceVehicle = !hasRealInspectionPhotos;
      }
    }

    if (matchBtn) {
      matchBtn.classList.toggle("hidden", !isReferenceVehicle);
    }

    this.renderVehicleGalleryCurrentPhoto();
    this.renderVehicleGalleryThumbnails();

    if (modal) {
      modal.classList.remove("hidden");
      this.attachVehicleGallerySwipeAndKeys();
    }
  }

  closeVehicleGalleryModal() {
    const modal = document.getElementById("vehicle-fullscreen-gallery-modal");
    if (modal) modal.classList.add("hidden");
  }

  navigateVehicleGallery(delta) {
    if (!this.currentVehiclePhotos || this.currentVehiclePhotos.length === 0) return;
    const total = this.currentVehiclePhotos.length;
    this.vehicleGalleryIndex = (this.vehicleGalleryIndex + delta + total) % total;
    this.renderVehicleGalleryCurrentPhoto();
    this.renderVehicleGalleryThumbnails();
  }

  setVehicleGalleryPhoto(idx) {
    if (!this.currentVehiclePhotos || idx < 0 || idx >= this.currentVehiclePhotos.length) return;
    this.vehicleGalleryIndex = idx;
    this.renderVehicleGalleryCurrentPhoto();
    this.renderVehicleGalleryThumbnails();
  }

  renderVehicleGalleryCurrentPhoto() {
    const imgEl = document.getElementById("vehicle-gallery-modal-img");
    const counterEl = document.getElementById("vehicle-gallery-modal-counter");
    const emptyState = document.getElementById("vehicle-gallery-empty-state");
    const imgContainer = document.getElementById("vehicle-gallery-img-container");
    const prevBtn = document.getElementById("vehicle-gallery-prev-btn");
    const nextBtn = document.getElementById("vehicle-gallery-next-btn");
    const deleteBtn = document.getElementById("vehicle-gallery-delete-btn");

    const total = this.currentVehiclePhotos ? this.currentVehiclePhotos.length : 0;

    if (total === 0) {
      if (emptyState) emptyState.classList.remove("hidden");
      if (imgContainer) imgContainer.classList.add("hidden");
      if (prevBtn) prevBtn.classList.add("hidden");
      if (nextBtn) nextBtn.classList.add("hidden");
      if (deleteBtn) deleteBtn.classList.add("hidden");
      if (counterEl) counterEl.textContent = "0 / 0";
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");
    if (imgContainer) imgContainer.classList.remove("hidden");
    if (prevBtn) prevBtn.classList.remove("hidden");
    if (nextBtn) nextBtn.classList.remove("hidden");
    if (deleteBtn) deleteBtn.classList.remove("hidden");

    if (this.vehicleGalleryIndex >= total) this.vehicleGalleryIndex = total - 1;
    if (this.vehicleGalleryIndex < 0) this.vehicleGalleryIndex = 0;

    const currentUrl = this.currentVehiclePhotos[this.vehicleGalleryIndex];
    if (imgEl && currentUrl) {
      imgEl.src = currentUrl;
    }
    if (counterEl) {
      counterEl.textContent = `${this.vehicleGalleryIndex + 1} / ${total}`;
    }
  }

  // --- BUSCAR COINCIDENCIA CON IA ---
  triggerMatchSearch() {
    const input = document.getElementById("vehicle-match-camera-input");
    if (input) {
      input.value = "";
      input.click();
    }
  }

  async handleMatchPhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const statusModal = document.getElementById("valuator-ai-status-modal");
    const statusText = document.getElementById("valuator-ai-status-text");
    if (statusModal) statusModal.classList.remove("hidden");
    if (statusText) statusText.textContent = "Analizando fotografía del vehículo con IA para detectar color y características...";

    try {
      const reader = new FileReader();
      const base64Data = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      if (!base64Data || !base64Data.includes(",")) throw new Error("No se pudo leer la imagen seleccionada.");

      if (typeof window.callGeminiProxy !== "function") {
        throw new Error("El servicio de IA no está disponible.");
      }

      const vehicleName = this.currentGalleryVehicleName || this.selectedVehiculo || "";
      const prompt = `Analiza esta fotografía tomada del vehículo en patio (${vehicleName}).
Determina con precisión el color exterior predominante del vehículo (ej: blanco, plata, gris, negro, rojo, azul, verde, dorado) y su tipo de carrocería.
Devuelve únicamente JSON con este formato:
{"color_es":"color en español","color_en":"color in english","carroceria":"tipo de carroceria"}`;

      const mimeType = base64Data.substring(base64Data.indexOf(":") + 1, base64Data.indexOf(";")) || "image/jpeg";
      const rawBase64 = base64Data.split(",")[1];

      const aiResponse = await window.callGeminiProxy("gemini-3.6-flash", {
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: rawBase64 } }
          ]
        }],
        generationConfig: { maxOutputTokens: 512, temperature: 0.1 }
      });

      if (!aiResponse.ok) throw new Error(`Gemini respondió con error ${aiResponse.status}`);
      const aiResult = await aiResponse.json();
      const rawText = aiResult?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const jsonText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(jsonText);
      const detectedColor = parsed.color_en || parsed.color_es || "";

      if (statusText) statusText.textContent = `Color detectado: ${parsed.color_es || detectedColor}. Buscando foto de referencia en internet...`;

      const cleanName = vehicleName.replace(/\b(19|20)\d{2}\b/g, "").trim();
      const yearMatch = vehicleName.match(/\b(19|20)\d{2}\b/);
      const anio = yearMatch ? yearMatch[0] : "";

      const searchTerms = [
        `"${cleanName}" ${anio} ${detectedColor}`,
        `"${cleanName}" ${detectedColor}`,
        `${cleanName} ${detectedColor} vehicle`,
        `"${cleanName}" ${anio}`
      ];

      let newRefPhoto = "";
      for (const term of searchTerms) {
        if (newRefPhoto) break;
        const search = new URLSearchParams({
          action: "query",
          generator: "search",
          gsrsearch: term,
          gsrnamespace: "6",
          gsrlimit: "8",
          prop: "imageinfo",
          iiprop: "url",
          iiurlwidth: "800",
          format: "json",
          origin: "*"
        });
        const res = await fetch(`https://commons.wikimedia.org/w/api.php?${search}`);
        if (res.ok) {
          const data = await res.json();
          const pages = Object.values(data?.query?.pages || {});
          for (const page of pages) {
            const thumb = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
            if (thumb && /^https:\/\//i.test(thumb)) {
              newRefPhoto = thumb;
              break;
            }
          }
        }
      }

      if (!newRefPhoto) {
        throw new Error(`La IA detectó el color "${parsed.color_es || detectedColor}", pero no se encontró una foto de referencia en internet con ese tono. Puedes agregar la foto manualmente con el botón "+ Agregar Foto".`);
      }

      this.saveVehicleReferencePhoto(vehicleName, newRefPhoto);

      this.currentVehiclePhotos = [newRefPhoto, ...this.currentVehiclePhotos.filter(p => p !== newRefPhoto && !p.startsWith("data:image/"))];
      this.vehicleGalleryIndex = 0;
      this.renderVehicleGalleryCurrentPhoto();
      this.renderVehicleGalleryThumbnails();

      if (window.appManager && typeof window.appManager.loadSalesVehicleReference === "function") {
        window.appManager.loadSalesVehicleReference(vehicleName);
      }

      alert(`✓ ¡Coincidencia encontrada con IA!\n\nColor detectado en patio: ${parsed.color_es || detectedColor}\nSe actualizó la foto de referencia oficial para este vehículo.`);
    } catch (err) {
      console.error("Error al buscar coincidencia con IA:", err);
      alert(`No se pudo actualizar la coincidencia con IA: ${err.message}`);
    } finally {
      if (statusModal) statusModal.classList.add("hidden");
    }
  }

  saveVehicleReferencePhoto(vehicleName, photoUrl) {
    if (!window.yonkeDB || typeof window.yonkeDB.getVehicles !== "function") return;
    const vehicles = window.yonkeDB.getVehicles() || [];
    const norm = str => String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(vehicleName);

    const match = vehicles.find(v => {
      const vModel = norm(v.modelo || "");
      return vModel && target && (vModel.includes(target) || target.includes(vModel));
    });

    if (match) {
      match.foto_principal = photoUrl;
      if (!Array.isArray(match.fotos)) match.fotos = [];
      match.fotos = [photoUrl, ...match.fotos.filter(p => !p.includes("wikimedia.org") && p !== photoUrl)];
      if (typeof window.yonkeDB.persist === "function") window.yonkeDB.persist();
    } else {
      window.yonkeDB.addVehicle({
        modelo: vehicleName,
        foto_principal: photoUrl,
        fotos: [photoUrl]
      });
    }
  }

  // --- AGREGAR FOTO MANUALMENTE ---
  async handleManualPhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      const base64Data = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const vehicleName = this.currentGalleryVehicleName || this.selectedVehiculo || "";
      if (!this.currentVehiclePhotos) this.currentVehiclePhotos = [];
      this.currentVehiclePhotos.push(base64Data);
      this.vehicleGalleryIndex = this.currentVehiclePhotos.length - 1;

      if (window.yonkeDB && typeof window.yonkeDB.getVehicles === "function") {
        const vehicles = window.yonkeDB.getVehicles() || [];
        const norm = str => String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const target = norm(vehicleName);

        const match = vehicles.find(v => {
          const vModel = norm(v.modelo || "");
          return vModel && target && (vModel.includes(target) || target.includes(vModel));
        });

        if (match) {
          if (!Array.isArray(match.fotos)) match.fotos = [];
          match.fotos.push(base64Data);
          if (!match.foto_principal) match.foto_principal = base64Data;
          if (typeof window.yonkeDB.persist === "function") window.yonkeDB.persist();
        } else {
          window.yonkeDB.addVehicle({
            modelo: vehicleName,
            foto_principal: base64Data,
            fotos: [base64Data]
          });
        }
      }

      this.renderVehicleGalleryCurrentPhoto();
      this.renderVehicleGalleryThumbnails();

      if (window.appManager && typeof window.appManager.loadSalesVehicleReference === "function") {
        window.appManager.loadSalesVehicleReference(vehicleName);
      }
    } catch (err) {
      console.error("Error al agregar foto manual:", err);
      alert("Error al procesar la fotografía: " + err.message);
    }
  }

  // --- BORRAR FOTO CON ADVERTENCIA DE CONFIRMACIÓN ---
  deleteCurrentVehiclePhoto() {
    if (!this.currentVehiclePhotos || this.currentVehiclePhotos.length === 0) return;

    const confirmar = confirm("¿Estás seguro de que deseas eliminar esta fotografía del vehículo? Esta acción no se puede deshacer.");
    if (!confirmar) return;

    const removedUrl = this.currentVehiclePhotos[this.vehicleGalleryIndex];
    this.currentVehiclePhotos.splice(this.vehicleGalleryIndex, 1);

    const vehicleName = this.currentGalleryVehicleName || this.selectedVehiculo || "";

    if (window.yonkeDB && typeof window.yonkeDB.getVehicles === "function") {
      const vehicles = window.yonkeDB.getVehicles() || [];
      const norm = str => String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const target = norm(vehicleName);

      const match = vehicles.find(v => {
        const vModel = norm(v.modelo || "");
        return vModel && target && (vModel.includes(target) || target.includes(vModel));
      });

      if (match) {
        if (Array.isArray(match.fotos)) {
          match.fotos = match.fotos.filter(p => p !== removedUrl);
        }
        if (match.foto_principal === removedUrl) {
          match.foto_principal = match.fotos?.[0] || "";
        }
        if (typeof window.yonkeDB.persist === "function") window.yonkeDB.persist();
      }
    }

    if (this.vehicleGalleryIndex >= this.currentVehiclePhotos.length) {
      this.vehicleGalleryIndex = Math.max(0, this.currentVehiclePhotos.length - 1);
    }

    this.renderVehicleGalleryCurrentPhoto();
    this.renderVehicleGalleryThumbnails();

    if (window.appManager && typeof window.appManager.loadSalesVehicleReference === "function") {
      window.appManager.loadSalesVehicleReference(vehicleName);
    }
  }

  renderVehicleGalleryThumbnails() {
    const thumbsContainer = document.getElementById("vehicle-gallery-thumbnails");
    if (!thumbsContainer || !this.currentVehiclePhotos) return;

    thumbsContainer.replaceChildren();
    this.currentVehiclePhotos.forEach((url, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isActive = idx === this.vehicleGalleryIndex;
      btn.className = `w-14 h-11 sm:w-16 sm:h-12 rounded-lg overflow-hidden border-2 transition flex-shrink-0 cursor-pointer ${
        isActive ? "border-amber-400 ring-2 ring-amber-400 scale-105" : "border-white/30 opacity-60 hover:opacity-100"
      }`;
      btn.title = `Foto ${idx + 1}`;
      const img = document.createElement("img");
      img.src = url;
      img.alt = `Miniatura ${idx + 1}`;
      img.className = "w-full h-full object-cover";
      btn.append(img);
      btn.addEventListener("click", () => this.setVehicleGalleryPhoto(idx));
      thumbsContainer.append(btn);
    });
  }

  attachVehicleGallerySwipeAndKeys() {
    if (this._vehicleGalleryKeysBound) return;
    this._vehicleGalleryKeysBound = true;

    window.addEventListener("keydown", (e) => {
      const modal = document.getElementById("vehicle-fullscreen-gallery-modal");
      if (!modal || modal.classList.contains("hidden")) return;

      if (e.key === "ArrowLeft") {
        this.navigateVehicleGallery(-1);
      } else if (e.key === "ArrowRight") {
        this.navigateVehicleGallery(1);
      } else if (e.key === "Escape") {
        this.closeVehicleGalleryModal();
      }
    });

    const swipeArea = document.getElementById("vehicle-gallery-swipe-area");
    if (swipeArea) {
      let touchStartX = 0;
      let touchEndX = 0;
      swipeArea.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });
      swipeArea.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diffX = touchEndX - touchStartX;
        if (Math.abs(diffX) > 40) {
          if (diffX > 0) {
            this.navigateVehicleGallery(-1);
          } else {
            this.navigateVehicleGallery(1);
          }
        }
      }, { passive: true });
    }
  }
}

window.salesManager = new SalesManager();
