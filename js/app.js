// app.js - Orquestador principal de navegación y vistas

class AppManager {
  constructor() {
    this.currentView = "sales";
    this.selectedPartIdForEdit = null;
    this.inventoryBrand = "";
    this.inventoryVehicle = "";
    this.inventoryFiltersInitialized = false;
  }

  async init() {
    // 1. Inicializar base de datos
    await window.yonkeDB.init();
    if (window.aiPriceUpdaterManager) window.aiPriceUpdaterManager.initializeBackgroundChecks();

    // 2. Inicializar subsistemas
    this.initializeInventoryFilters();
    if (window.salesManager) window.salesManager.init();
    if (window.ghostPartsManager) window.ghostPartsManager.init();
    if (window.financesManager) window.financesManager.init();
    if (window.dashboardManager) window.dashboardManager.init();
    if (window.vehicleValuatorManager) window.vehicleValuatorManager.init();
    if (window.imagesManager) window.imagesManager.init();
    if (window.excelSyncManager) window.excelSyncManager.init();
    if (window.aiRegisterManager) window.aiRegisterManager.init();
    if (window.returnsManager) window.returnsManager.init();

    // 3. Configurar navegación
    this.setupNavigation();

    // 4. Mostrar vista inicial
    this.switchView("sales");

    // 5. Configurar service worker si está disponible
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    }
  }

  setupNavigation() {
    const navButtons = document.querySelectorAll("[data-nav-view]");
    navButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const view = btn.getAttribute("data-nav-view");
        if (view === "finances") {
          e.stopPropagation();
          this.switchView(view);
          document.getElementById("nav-dropdown-menu")?.classList.remove("hidden");
          document.getElementById("finance-subnav")?.classList.remove("hidden");
          return;
        }
        if (view) this.switchView(view);
        const dropdownMenu = document.getElementById("nav-dropdown-menu");
        if (dropdownMenu) dropdownMenu.classList.add("hidden");
      });
    });

    const financeMenuButton = document.querySelector("[data-nav-finance-menu]");
    if (financeMenuButton) {
      financeMenuButton.addEventListener("click", (e) => {
        e.stopPropagation();
        this.switchView("finances");
        document.getElementById("nav-dropdown-menu")?.classList.remove("hidden");
        document.getElementById("finance-subnav")?.classList.remove("hidden");
      });
    }

    document.querySelectorAll("[data-finance-subview]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.switchView("finances");
        const panel = document.getElementById(`finance-subview-${btn.getAttribute("data-finance-subview")}`);
        if (panel) panel.classList.remove("hidden");
        document.getElementById("nav-dropdown-menu")?.classList.add("hidden");
        document.getElementById("finance-subnav")?.classList.add("hidden");
      });
    });

    // Cerrar menú desplegable de 3 puntos al hacer clic fuera de él
    document.addEventListener("click", (e) => {
      const wrapper = document.getElementById("nav-dropdown-wrapper");
      const menu = document.getElementById("nav-dropdown-menu");
      if (wrapper && menu && !wrapper.contains(e.target)) {
        menu.classList.add("hidden");
      }
    });
  }

  switchView(viewName) {
    this.currentView = viewName;
    const dropdownMenu = document.getElementById("nav-dropdown-menu");
    if (dropdownMenu) dropdownMenu.classList.add("hidden");
    document.getElementById("finance-subnav")?.classList.add("hidden");
    document.querySelectorAll("[id^='finance-subview-']").forEach(panel => panel.classList.add("hidden"));

    // Ocultar todas las secciones
    const views = ["sales", "dashboard", "finances", "valuator", "inventory", "settings"];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.classList.add("hidden");
    });

    // Mostrar sección activa
    const targetEl = document.getElementById(`view-${viewName}`);
    if (targetEl) targetEl.classList.remove("hidden");

    // Actualizar estilos activos de navegación
    const navButtons = document.querySelectorAll("[data-nav-view]");
    navButtons.forEach(btn => {
      const v = btn.getAttribute("data-nav-view");
      if (v === viewName) {
        btn.classList.add("bg-blue-600", "text-white", "font-bold");
        btn.classList.remove("text-gray-600", "hover:bg-gray-100");
      } else {
        btn.classList.remove("bg-blue-600", "text-white", "font-bold");
        btn.classList.add("text-gray-600", "hover:bg-gray-100");
      }
    });

    // Actualizaciones específicas por vista
    if (viewName === "dashboard" && window.dashboardManager) {
      window.dashboardManager.updateUI();
    } else if (viewName === "finances" && window.financesManager) {
      window.financesManager.updateUI();
    } else if (viewName === "sales" && window.salesManager) {
      window.salesManager.renderPartsGrid();
    } else if (viewName === "inventory") {
      this.initializeInventoryFilters();
      this.renderInventoryTable();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  initializeInventoryFilters() {
    const brandSelect = document.getElementById("inventory-filter-marca");
    const vehicleSelect = document.getElementById("inventory-filter-vehiculo");
    if (!brandSelect || !vehicleSelect) return;

    if (!this.inventoryFiltersInitialized) {
      brandSelect.addEventListener("change", (event) => {
        this.inventoryBrand = event.target.value;
        this.inventoryVehicle = "";
        this.populateInventoryVehicleDropdown();
        this.renderInventoryTable();
      });
      vehicleSelect.addEventListener("change", (event) => {
        this.inventoryVehicle = event.target.value;
        this.renderInventoryTable();
      });
      this.inventoryFiltersInitialized = true;
    }

    const brands = window.salesManager ? window.salesManager.getAvailableBrands() : [];
    brandSelect.replaceChildren(new Option("🏷️ Seleccionar Marca...", ""));
    brands.forEach((brand) => brandSelect.add(new Option(brand, brand)));
    brandSelect.value = this.inventoryBrand;
    this.populateInventoryVehicleDropdown();
  }

  populateInventoryVehicleDropdown() {
    const select = document.getElementById("inventory-filter-vehiculo");
    if (!select) return;
    const vehicles = [...new Set((window.yonkeDB ? window.yonkeDB.getParts() : [])
      .filter((part) => {
        const name = String(part.vehiculo_origen || "");
        const normalizedName = this.normalizeInventoryVehicle(name);
        const normalizedBrand = this.normalizeInventoryVehicle(this.inventoryBrand);
        return this.inventoryBrand && (
          normalizedName.includes(normalizedBrand) ||
          (normalizedBrand === "chevrolet" && normalizedName.includes("chevy")) ||
          (normalizedBrand === "volkswagen" && normalizedName.includes("vw"))
        );
      })
      .map((part) => String(part.vehiculo_origen || "").trim())
      .filter(Boolean))].sort();
    select.replaceChildren(new Option("🚗 Seleccionar Vehículo...", ""));
    vehicles.forEach((vehicle) => select.add(new Option(vehicle, vehicle)));
    select.disabled = !this.inventoryBrand || vehicles.length === 0;
    select.value = vehicles.includes(this.inventoryVehicle) ? this.inventoryVehicle : "";
    if (!select.value) this.inventoryVehicle = "";
  }

  normalizeInventoryVehicle(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  renderInventoryTable() {
    const tbody = document.getElementById("full-inventory-tbody");
    const countEl = document.getElementById("full-inventory-count");
    const tableContainer = document.getElementById("inventory-table-container");
    const emptyState = document.getElementById("inventory-filter-empty-state");
    if (!tbody) return;

    if (!this.inventoryBrand || !this.inventoryVehicle) {
      tbody.innerHTML = "";
      tableContainer?.classList.add("hidden");
      emptyState?.classList.remove("hidden");
      if (countEl) countEl.textContent = "Seleccione marca y vehículo para mostrar inventario";
      this.selectedPartIdForEdit = null;
      return;
    }

    const selectedVehicle = this.normalizeInventoryVehicle(this.inventoryVehicle);
    const parts = window.yonkeDB.getParts().filter(part =>
      this.normalizeInventoryVehicle(part.vehiculo_origen) === selectedVehicle
    );
    tableContainer?.classList.toggle("hidden", parts.length === 0);
    emptyState?.classList.toggle("hidden", parts.length > 0);
    if (countEl) countEl.textContent = parts.length
      ? `${parts.length} piezas registradas para ${this.inventoryVehicle}`
      : `No hay piezas registradas para ${this.inventoryVehicle}`;
    if (!parts.length) {
      tbody.innerHTML = "";
      this.selectedPartIdForEdit = null;
      return;
    }

    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
    let html = "";
    parts.forEach(p => {
      const isVendida = p.estado === "VENDIDO" || (p.cantidad <= 0 && p.estado !== "DAÑADA / GARANTÍA");
      const isDanada = p.estado === "DAÑADA / GARANTÍA" || (p.observacion && p.observacion.toLowerCase().includes("garantía"));

      let statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">En existencia (${escapeHtml(p.cantidad)})</span>`;
      if (isDanada) {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">⚠️ DAÑADA / GARANTÍA</span>`;
      } else if (isVendida) {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700">VENDIDO</span>`;
      }

      const obsHtml = isDanada
        ? `<span class="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">${escapeHtml(p.observacion)}</span>`
        : `<span class="text-gray-600">${escapeHtml(p.observacion || '-')}</span>`;

      let demandaVal = p.demanda;
      if (!demandaVal && window.aiPriceUpdaterManager) {
        demandaVal = window.aiPriceUpdaterManager.calculatePartDemand(p.pieza).demanda;
      }
      let demandaBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">Baja</span>`;
      if (demandaVal === "Alta") {
        demandaBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">🔥 Alta</span>`;
      } else if (demandaVal === "Media") {
        demandaBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">⚡ Media</span>`;
      }

      html += `
        <tr 
          class="border-b border-gray-100 hover:bg-amber-50 cursor-pointer text-xs transition ${isDanada ? 'bg-rose-50/20' : ''}"
          data-part-id="${escapeHtml(p.id)}"
        >
          <td class="py-2.5 px-3 font-mono text-gray-400">${escapeHtml(p.id)}</td>
          <td class="py-2.5 px-3 font-bold text-gray-900">${escapeHtml(p.pieza)}</td>
          <td class="py-2.5 px-3 text-blue-700 font-semibold">${escapeHtml(p.vehiculo_origen)}</td>
          <td class="py-2.5 px-3 text-gray-500">${escapeHtml(p.anio || '-')}</td>
          <td class="py-2.5 px-3">${statusBadge}</td>
          <td class="py-2.5 px-3 whitespace-nowrap">${demandaBadge}</td>
          <td class="py-2.5 px-3 font-black text-gray-900">$${Number(p.precio_base).toLocaleString()}</td>
          <td class="py-2.5 px-3 font-bold text-amber-700">$${Number(p.precio_minimo).toLocaleString()}</td>
          <td class="py-2.5 px-3 text-emerald-700 font-bold">${p.venta_final ? `$${Number(p.venta_final).toLocaleString()}` : '-'}</td>
          <td class="py-2.5 px-3 text-gray-400 font-mono">${escapeHtml(p.fecha_venta || '-')}</td>
          <td class="py-2.5 px-3 text-gray-600 max-w-xs truncate" title="${escapeHtml(p.compatibilidad)}">${escapeHtml(p.compatibilidad || '-')}</td>
          <td class="py-2.5 px-3 max-w-xs truncate" title="${escapeHtml(p.observacion)}">${obsHtml}</td>
          <td class="py-2.5 px-3 text-right">
            <button 
              type="button"
              data-open-part-photos
              class="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 text-[11px] font-bold"
            >
              📷 Fotos (${(p.fotos || []).length})
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    tbody.querySelectorAll("tr[data-part-id]").forEach(row => {
      row.addEventListener("click", () => this.selectInventoryRow(row, row.dataset.partId));
      row.addEventListener("dblclick", () => {
        this.selectInventoryRow(row, row.dataset.partId);
        this.openEditModalForSelected();
      });
      row.querySelector("[data-open-part-photos]")?.addEventListener("click", event => {
        event.stopPropagation();
        window.imagesManager.openCameraModal(row.dataset.partId);
      });
    });
  }

  selectInventoryRow(rowElement, partId) {
    const rows = document.querySelectorAll("#full-inventory-tbody tr");
    rows.forEach(r => r.classList.remove("bg-amber-100", "border-l-4", "border-amber-500", "font-semibold"));
    rowElement.classList.add("bg-amber-100", "border-l-4", "border-amber-500", "font-semibold");
    this.selectedPartIdForEdit = partId;
  }

  openEditModalForSelected() {
    const partId = this.selectedPartIdForEdit;
    if (!partId) {
      alert("⚠️ Por favor haz clic primero sobre cualquier fila de la tabla de inventario que desees editar.");
      return;
    }

    const part = window.yonkeDB.getPartById(partId);
    if (!part) {
      alert("No se encontró la pieza seleccionada en la base de datos.");
      return;
    }

    document.getElementById("edit-field-id").value = part.id;
    const modalIdEl = document.getElementById("edit-modal-part-id");
    if (modalIdEl) modalIdEl.textContent = `ID: ${part.id}`;

    document.getElementById("edit-field-pieza").value = part.pieza || "";
    document.getElementById("edit-field-modelo").value = part.vehiculo_origen || "";
    document.getElementById("edit-field-anio").value = part.anio || "";
    document.getElementById("edit-field-estado").value = part.estado || "En existencia";
    document.getElementById("edit-field-demanda").value = ["Alta", "Media", "Baja"].includes(part.demanda)
      ? part.demanda
      : (window.aiPriceUpdaterManager ? window.aiPriceUpdaterManager.calculatePartDemand(part.pieza).demanda : "Baja");
    document.getElementById("edit-field-cantidad").value = part.cantidad !== undefined ? part.cantidad : 1;
    document.getElementById("edit-field-precio-base").value = part.precio_base || 0;
    document.getElementById("edit-field-precio-minimo").value = part.precio_minimo || 0;
    document.getElementById("edit-field-costo-mercancia").value = part.costo_mercancia_unitario ?? "";
    document.getElementById("edit-field-venta-final").value = part.venta_final !== null && part.venta_final !== undefined ? part.venta_final : "";
    document.getElementById("edit-field-fecha-venta").value = part.fecha_venta || "";
    document.getElementById("edit-field-compatibilidad").value = part.compatibilidad || "";
    document.getElementById("edit-field-observacion").value = part.observacion || "";

    const modal = document.getElementById("edit-part-modal");
    if (modal) modal.classList.remove("hidden");
  }

  closeEditModal() {
    const modal = document.getElementById("edit-part-modal");
    if (modal) modal.classList.add("hidden");
  }

  saveEditedPart(event) {
    event.preventDefault();
    const id = document.getElementById("edit-field-id").value;
    if (!id) return;

    const updatedData = {
      pieza: document.getElementById("edit-field-pieza").value.trim(),
      vehiculo_origen: document.getElementById("edit-field-modelo").value.trim(),
      anio: document.getElementById("edit-field-anio").value.trim(),
      estado: document.getElementById("edit-field-estado").value,
      demanda: document.getElementById("edit-field-demanda").value,
      cantidad: parseInt(document.getElementById("edit-field-cantidad").value, 10) || 0,
      precio_base: parseFloat(document.getElementById("edit-field-precio-base").value) || 0,
      precio_minimo: parseFloat(document.getElementById("edit-field-precio-minimo").value) || 0,
      costo_mercancia_unitario: document.getElementById("edit-field-costo-mercancia").value !== "" ? parseFloat(document.getElementById("edit-field-costo-mercancia").value) : null,
      venta_final: document.getElementById("edit-field-venta-final").value ? parseFloat(document.getElementById("edit-field-venta-final").value) : null,
      fecha_venta: document.getElementById("edit-field-fecha-venta").value || null,
      compatibilidad: document.getElementById("edit-field-compatibilidad").value.trim(),
      observacion: document.getElementById("edit-field-observacion").value.trim()
    };

    window.yonkeDB.updatePart(id, updatedData);
    this.closeEditModal();
    this.renderInventoryTable();

    if (window.salesManager) window.salesManager.renderPartsGrid();
    if (window.dashboardManager) window.dashboardManager.updateUI();

    alert("✅ ¡Datos de la pieza actualizados con éxito en la base de datos!");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.appManager = new AppManager();
  window.appManager.init();
});
