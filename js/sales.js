// sales.js - Pantalla de Ventas / Mostrador TPV con formato exacto solicitado

class SalesManager {
  constructor() {
    this.currentSearch = "";
    this.currentVehicleFilter = "TODOS";
    this.currentStatusFilter = "EXISTENCIA"; // Por defecto solo mostrar disponibles para agilizar venta
  }

  init() {
    this.renderVehicleFilterDropdown();
    this.renderPartsGrid();
    this.attachEventListeners();
    this.checkPendingDraft();
    this.setupUnloadProtection();
  }

  setupUnloadProtection() {
    window.addEventListener("beforeunload", (e) => {
      const raw = localStorage.getItem("yonke_active_sale_draft");
      if (raw) {
        e.preventDefault();
        e.returnValue = "Tienes una venta pendiente sin confirmar. ¿Deseas salir?";
      }
    });
  }

  attachEventListeners() {
    const searchInput = document.getElementById("sales-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.currentSearch = e.target.value.toLowerCase().trim();
        this.renderPartsGrid();
      });
    }

    const vehicleSelect = document.getElementById("sales-vehicle-filter");
    if (vehicleSelect) {
      vehicleSelect.addEventListener("change", (e) => {
        this.currentVehicleFilter = e.target.value;
        this.renderPartsGrid();
      });
    }

    const statusSelect = document.getElementById("sales-status-filter");
    if (statusSelect) {
      statusSelect.addEventListener("change", (e) => {
        this.currentStatusFilter = e.target.value;
        this.renderPartsGrid();
      });
    }
  }

  renderVehicleFilterDropdown() {
    const select = document.getElementById("sales-vehicle-filter");
    if (!select) return;

    const vehicles = window.yonkeDB.getVehicles();
    let optionsHtml = `<option value="TODOS">🚗 Todos los Vehículos Donadores</option>`;
    vehicles.forEach(v => {
      optionsHtml += `<option value="${v.modelo}">${v.modelo}</option>`;
    });
    select.innerHTML = optionsHtml;
  }

  renderPartsGrid() {
    const container = document.getElementById("sales-parts-container");
    const countBadge = document.getElementById("sales-parts-count");
    if (!container) return;

    let parts = window.yonkeDB.getParts();

    // Filtro por Estado
    if (this.currentStatusFilter === "EXISTENCIA") {
      parts = parts.filter(p => p.estado === "En existencia" && p.cantidad > 0);
    } else if (this.currentStatusFilter === "VENDIDO") {
      parts = parts.filter(p => p.estado === "VENDIDO" || p.cantidad === 0);
    }

    // Filtro por Vehículo
    if (this.currentVehicleFilter !== "TODOS") {
      parts = parts.filter(p => p.vehiculo_origen.toLowerCase() === this.currentVehicleFilter.toLowerCase());
    }

    // Filtro por Texto de Búsqueda
    if (this.currentSearch) {
      parts = parts.filter(p => {
        const text = `${p.pieza} ${p.vehiculo_origen} ${p.compatibilidad} ${p.observacion}`.toLowerCase();
        return text.includes(this.currentSearch);
      });
    }

    if (countBadge) {
      countBadge.textContent = `${parts.length} piezas encontradas`;
    }

    if (parts.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-gray-300">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 text-amber-600 mb-4">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 class="text-lg font-bold text-gray-800">No se encontraron piezas</h3>
          <p class="text-sm text-gray-500 mt-1">Prueba con otro término o registra una Pieza fuera de Inventario si es una refacción rápida.</p>
          <button onclick="window.ghostPartsManager.openModal()" class="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white font-semibold text-sm rounded-xl shadow-md hover:bg-amber-700 transition">
            ⚡ Vender como Pieza fuera de Inventario
          </button>
        </div>
      `;
      return;
    }

    let cardsHtml = "";
    parts.forEach(p => {
      const isVendida = p.estado === "VENDIDO" || p.cantidad <= 0;
      const statusBadge = isVendida
        ? `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300">🔴 VENDIDO</span>`
        : `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">🟢 En existencia (${p.cantidad})</span>`;

      // Foto miniatura o placeholder
      const hasPhoto = p.fotos && p.fotos.length > 0;
      const photoHtml = hasPhoto
        ? `<img src="${p.fotos[0]}" alt="${p.pieza}" class="w-16 h-16 rounded-xl object-cover cursor-pointer border border-gray-200 hover:scale-105 transition shadow-sm" onclick="window.imagesManager.openGallery('${p.id}')"/>`
        : `<div class="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-200 transition" onclick="window.imagesManager.openCameraModal('${p.id}')">
             <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
             <span class="text-[9px] font-medium mt-0.5">+ Foto</span>
           </div>`;

      // Precio default para la venta final sugerido (precio base o precio mínimo)
      const suggestedPrice = p.precio_base || p.precio_minimo || 0;

      cardsHtml += `
        <div class="bg-white rounded-2xl border ${isVendida ? 'border-gray-200 opacity-75' : 'border-gray-200 hover:border-blue-400 hover:shadow-lg'} transition-all duration-200 p-5 flex flex-col justify-between relative shadow-sm">
          
          <!-- Encabezado de la Tarjeta de Pieza -->
          <div>
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3 flex-1">
                ${photoHtml}
                <div>
                  <!-- 1. Nombre de la Pieza -->
                  <h3 class="text-lg font-black text-gray-900 leading-snug tracking-tight">${p.pieza}</h3>
                  <!-- 2. De qué vehículo es -->
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      🚗 ${p.vehiculo_origen}
                    </span>
                    ${p.anio ? `<span class="text-xs text-gray-500 font-medium">(${p.anio})</span>` : ''}
                  </div>
                </div>
              </div>
              <!-- 3. ESTADO -->
              <div>
                ${statusBadge}
              </div>
            </div>

            <!-- 4 y 5. Precios Base y Mínimo -->
            <div class="grid grid-cols-2 gap-2 my-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span class="text-[11px] uppercase tracking-wider font-bold text-gray-500 block">4. PRECIO BASE</span>
                <span class="text-base font-black text-gray-900">$${Number(p.precio_base).toLocaleString()}</span>
              </div>
              <div class="border-l border-slate-200 pl-3">
                <span class="text-[11px] uppercase tracking-wider font-bold text-amber-700 block">5. PRECIO MÍNIMO</span>
                <span class="text-base font-black text-amber-700">$${Number(p.precio_minimo).toLocaleString()}</span>
              </div>
            </div>

            <!-- 6. Compatibilidades (Abajo de los precios) -->
            <div class="mt-2 mb-4">
              <span class="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Compatibilidad (Otros Vehículos):
              </span>
              <p class="text-xs text-gray-700 mt-1 leading-relaxed bg-gray-50 p-2 rounded-lg border border-gray-100">
                ${p.compatibilidad ? p.compatibilidad : '<span class="text-gray-400 italic">No se indicaron otros modelos</span>'}
              </p>
            </div>
          </div>

          <!-- Pie de la Tarjeta: Esquina inferior derecha para Capturar VENTA FINAL -->
          <div class="pt-3 border-t border-gray-100 mt-auto">
            ${isVendida ? `
              <div class="flex items-center justify-between text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                <span>Vendido el: <strong class="text-gray-800">${p.fecha_venta || 'Histórico'}</strong></span>
                <span>Cobrado: <strong class="text-emerald-700 font-bold">$${Number(p.venta_final || p.precio_base).toLocaleString()}</strong></span>
              </div>
            ` : `
              <div class="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-3">
                <!-- Información rápida de stock -->
                <div class="text-xs text-gray-500">
                  <span>Stock disponible: <strong class="text-gray-900 font-bold">${p.cantidad} pza(s)</strong></span>
                </div>

                <!-- 7. Captura de Venta Final en la Esquina Inferior Derecha -->
                <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <div class="relative">
                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">$</span>
                    <input 
                      type="number" 
                      id="input-sale-${p.id}" 
                      value="${suggestedPrice}" 
                      placeholder="Precio Final"
                      oninput="window.salesManager.saveDraft('${p.id}', this.value)"
                      onfocus="window.salesManager.saveDraft('${p.id}', this.value)"
                      class="w-28 pl-6 pr-2 py-2 text-sm font-black text-gray-900 bg-amber-50 border-2 border-amber-400 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
                      title="Ingresa el precio real acordado con el cliente"
                    />
                  </div>
                  <button 
                    onclick="window.salesManager.executeSale('${p.id}')"
                    class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    Cobrar
                  </button>
                </div>
              </div>
            `}
          </div>

        </div>
      `;
    });

    container.innerHTML = cardsHtml;
  }

  // --- GESTIÓN DE BORRADOR AUTOMÁTICO DE VENTA PENDIENTE ---
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

    localStorage.setItem("yonke_active_sale_draft", JSON.stringify(draft));
    this.renderPendingSaleBanner(draft);
  }

  discardDraft() {
    localStorage.removeItem("yonke_active_sale_draft");
    const banner = document.getElementById("pending-sale-banner");
    if (banner) banner.classList.add("hidden");
  }

  checkPendingDraft() {
    const raw = localStorage.getItem("yonke_active_sale_draft");
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
      textEl.innerHTML = `Venta en curso sin confirmar: <strong>${draft.pieza}</strong> (${draft.vehiculo}) por <strong>$${draft.price.toLocaleString()}</strong>`;
    }

    banner.classList.remove("hidden");
  }

  resumeOrConfirmDraft() {
    const raw = localStorage.getItem("yonke_active_sale_draft");
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      this.executeSale(draft.partId, draft.price);
    } catch(e) {}
  }

  executeSale(partId, overridePrice) {
    const input = document.getElementById(`input-sale-${partId}`);
    let finalPrice = overridePrice !== undefined ? overridePrice : (input ? parseFloat(input.value) : NaN);

    if (isNaN(finalPrice) || finalPrice < 0) {
      alert("Por favor introduce una cantidad válida para la Venta Final.");
      return;
    }

    const part = window.yonkeDB.getPartById(partId);
    if (!part) return;

    // Alerta si se vende por debajo del precio mínimo
    if (part.precio_minimo && finalPrice < part.precio_minimo) {
      const confirmLow = confirm(
        `⚠️ ADVERTENCIA DE PRECIO:\n\nEl precio que ingresaste ($${finalPrice.toLocaleString()}) es MENOR al Precio Mínimo configurado ($${Number(part.precio_minimo).toLocaleString()}).\n\n¿Deseas confirmar la venta de todos modos?`
      );
      if (!confirmLow) return;
    }

    try {
      const result = window.yonkeDB.processSale({
        partId: partId,
        finalPrice: finalPrice,
        saleDate: new Date().toISOString().split("T")[0]
      });

      // Limpiar borrador pendiente tras venta exitosa
      this.discardDraft();

      // Refrescar vistas
      this.renderPartsGrid();
      if (window.financesManager) window.financesManager.updateUI();
      if (window.dashboardManager) window.dashboardManager.updateUI();

      // Mostrar modal de ticket y confirmación de venta
      this.showSaleSuccessModal(result.sale, result.part);
    } catch (err) {
      alert("Error al procesar la venta: " + err.message);
    }
  }

  showSaleSuccessModal(sale, part) {
    const modal = document.getElementById("sale-success-modal");
    if (!modal) {
      alert(`✅ Venta Exitosa!\n\nPieza: ${part.pieza}\nCobrado: $${sale.monto_cobrado.toLocaleString()}\n80% Caja A: $${sale.caja_a.toLocaleString()}\n20% Caja B: $${sale.caja_b.toLocaleString()}`);
      return;
    }

    document.getElementById("modal-sale-part-name").textContent = part.pieza;
    document.getElementById("modal-sale-vehicle").textContent = part.vehiculo_origen;
    document.getElementById("modal-sale-amount").textContent = `$${sale.monto_cobrado.toLocaleString()}`;
    document.getElementById("modal-sale-caja-a").textContent = `$${sale.caja_a.toLocaleString()}`;
    document.getElementById("modal-sale-caja-b").textContent = `$${sale.caja_b.toLocaleString()}`;
    document.getElementById("modal-sale-date").textContent = `${sale.fecha} - ${sale.hora}`;

    // Configurar enlace de ticket WhatsApp
    const whatsappBtn = document.getElementById("modal-sale-whatsapp-btn");
    if (whatsappBtn) {
      const text = encodeURIComponent(
        `*TICKET DE VENTA - YONKE DE AUTOPARTES*\n` +
        `----------------------------------------\n` +
        `Pieza: ${part.pieza}\n` +
        `Vehículo: ${part.vehiculo_origen}\n` +
        `Total Cobrado: $${sale.monto_cobrado.toLocaleString()} MXN\n` +
        `Fecha: ${sale.fecha} ${sale.hora}\n` +
        `Garantía: 30 días en partes mecánicas (eléctricas y colisión sin garantía).\n` +
        `----------------------------------------\n` +
        `¡Gracias por su compra!`
      );
      whatsappBtn.href = `https://wa.me/?text=${text}`;
    }

    modal.classList.remove("hidden");
  }

  closeSaleSuccessModal() {
    const modal = document.getElementById("sale-success-modal");
    if (modal) modal.classList.add("hidden");
  }
}

window.salesManager = new SalesManager();
