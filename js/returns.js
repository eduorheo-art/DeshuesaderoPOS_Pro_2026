// returns.js - Gestión de Devoluciones y Garantías de Autopartes

class ReturnsManager {
  constructor() {
    this.selectedSaleId = null;
  }

  init() {
    this.attachEvents();
  }

  attachEvents() {
    const returnForm = document.getElementById("return-form");
    if (returnForm) {
      returnForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitReturn();
      });
    }

    const searchInput = document.getElementById("return-search-sale-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.filterSalesForReturn(e.target.value.toLowerCase().trim());
      });
    }
  }

  openModal(preselectedSaleId = null) {
    this.selectedSaleId = preselectedSaleId;
    const modal = document.getElementById("return-modal");
    if (!modal) return;

    if (preselectedSaleId) {
      this.loadSaleDetails(preselectedSaleId);
    } else {
      this.showSalesSelectionList();
    }

    modal.classList.remove("hidden");
  }

  closeModal() {
    const modal = document.getElementById("return-modal");
    if (modal) modal.classList.add("hidden");
    this.selectedSaleId = null;
  }

  showSalesSelectionList() {
    const listStep = document.getElementById("return-step-list");
    const detailStep = document.getElementById("return-step-detail");
    if (listStep) listStep.classList.remove("hidden");
    if (detailStep) detailStep.classList.add("hidden");

    this.renderSalesList();
  }

  renderSalesList(filterText = "") {
    const container = document.getElementById("return-sales-list-container");
    if (!container) return;

    const sales = window.yonkeDB.sales || [];
    // Solo ventas no devueltas
    let eligibleSales = sales.filter(s => s.estado !== "DEVUELTO");

    if (filterText) {
      eligibleSales = eligibleSales.filter(s => 
        `${s.pieza_nombre} ${s.vehiculo_origen} ${s.fecha}`.toLowerCase().includes(filterText)
      );
    }

    if (eligibleSales.length === 0) {
      container.innerHTML = `<div class="py-6 text-center text-xs text-gray-400">No se encontraron ventas para aplicar devolución.</div>`;
      return;
    }

    let html = "";
    eligibleSales.slice(0, 20).forEach(s => {
      html += `
        <div 
          onclick="window.returnsManager.loadSaleDetails('${s.id}')"
          class="p-3 rounded-xl border border-gray-200 hover:border-rose-400 hover:bg-rose-50/30 cursor-pointer transition flex items-center justify-between"
        >
          <div>
            <span class="text-xs font-black text-gray-900 block">${s.pieza_nombre}</span>
            <span class="text-[11px] text-blue-700 font-semibold">${s.vehiculo_origen}</span>
            <span class="text-[10px] text-gray-400 font-mono ml-2">Vendido el: ${s.fecha}</span>
          </div>
          <div class="text-right">
            <span class="text-sm font-black text-emerald-700 block">$${Number(s.monto_cobrado).toLocaleString()}</span>
            <span class="text-[10px] text-rose-600 font-bold">Seleccionar para Garantía ›</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  filterSalesForReturn(text) {
    this.renderSalesList(text);
  }

  loadSaleDetails(saleId) {
    this.selectedSaleId = saleId;
    const sale = (window.yonkeDB.sales || []).find(s => s.id === saleId);
    if (!sale) return;

    const listStep = document.getElementById("return-step-list");
    const detailStep = document.getElementById("return-step-detail");
    if (listStep) listStep.classList.add("hidden");
    if (detailStep) detailStep.classList.remove("hidden");

    // Llenar datos de la venta original
    document.getElementById("return-sale-piece-name").textContent = sale.pieza_nombre;
    document.getElementById("return-sale-vehicle").textContent = sale.vehiculo_origen;
    document.getElementById("return-sale-date").textContent = `Fecha de Venta: ${sale.fecha} (${sale.hora || ''})`;
    document.getElementById("return-sale-charged").textContent = `$${Number(sale.monto_cobrado).toLocaleString()} MXN`;

    // Prellenar monto a reembolsar
    const refundInput = document.getElementById("return-refund-amount");
    if (refundInput) refundInput.value = sale.monto_cobrado;
  }

  submitReturn() {
    if (!this.selectedSaleId) return;
    const sale = (window.yonkeDB.sales || []).find(s => s.id === this.selectedSaleId);
    if (!sale) return;

    const returnTypeSelect = document.getElementById("return-type-action");
    const pieceDestSelect = document.getElementById("return-piece-destination");
    const refundAmountInput = document.getElementById("return-refund-amount");
    const reasonInput = document.getElementById("return-reason-text");

    const returnType = returnTypeSelect.value; // 'refund' (reembolso dinero) o 'exchange' (cambio de pieza)
    const pieceDestination = pieceDestSelect.value; // 'scrapped' (chatarra/dañada) o 'restock' (reingresar a stock)
    const refundAmount = parseFloat(refundAmountInput.value) || 0;
    const reason = reasonInput.value.trim() || "Devolución por defecto de funcionamiento en garantía";

    const confirmAction = confirm(
      `⚠️ CONFIRMAR DEVOLUCIÓN POR GARANTÍA:\n\n` +
      `Pieza: ${sale.pieza_nombre} (${sale.vehiculo_origen})\n` +
      `Tipo: ${returnType === 'refund' ? `Reembolso de Efectivo ($${refundAmount.toLocaleString()})` : 'Cambio físico de refacción'}\n` +
      `Destino de pieza: ${pieceDestination === 'scrapped' ? 'Marcar como DAÑADA / INSERVIBLE' : 'Reingresar a inventario vendible'}\n\n` +
      `¿Deseas procesar esta garantía?`
    );

    if (!confirmAction) return;

    try {
      const result = window.yonkeDB.processReturn({
        saleId: this.selectedSaleId,
        partId: sale.pieza_id,
        returnType: returnType,
        refundAmount: refundAmount,
        pieceDestination: pieceDestination,
        reason: reason
      });

      this.closeModal();

      // Refrescar vistas
      if (window.salesManager) window.salesManager.renderPartsGrid();
      if (window.financesManager) window.financesManager.updateUI();
      if (window.dashboardManager) window.dashboardManager.updateUI();

      alert(
        `✅ GARANTÍA PROCESADA CON ÉXITO\n\n` +
        `• Pieza: ${sale.pieza_nombre}\n` +
        `${returnType === 'refund' ? `• Se reembolsaron $${refundAmount.toLocaleString()} (Descontado: -$${(refundAmount * 0.8).toLocaleString()} de Caja A y -$${(refundAmount * 0.2).toLocaleString()} de Caja B)\n` : '• Cambio físico registrado sin mover efectivo de caja\n'}` +
        `• Estado de la pieza: ${pieceDestination === 'scrapped' ? 'Dañada / Fuera de circulación' : 'Reingresada al catálogo en existencia'}`
      );
    } catch (err) {
      alert("Error al procesar devolución: " + err.message);
    }
  }
}

window.returnsManager = new ReturnsManager();
