// app.js - Orquestador principal de navegación y vistas

class AppManager {
  constructor() {
    this.currentView = "sales";
  }

  async init() {
    // 1. Inicializar base de datos
    await window.yonkeDB.init();

    // 2. Inicializar subsistemas
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
        if (view) this.switchView(view);
      });
    });
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Ocultar todas las secciones
    const views = ["sales", "dashboard", "finances", "valuator", "inventory"];
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
      this.renderInventoryTable();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  renderInventoryTable() {
    const tbody = document.getElementById("full-inventory-tbody");
    const countEl = document.getElementById("full-inventory-count");
    if (!tbody) return;

    const parts = window.yonkeDB.getParts();
    if (countEl) countEl.textContent = `${parts.length} piezas registradas`;

    let html = "";
    parts.forEach(p => {
      const isVendida = p.estado === "VENDIDO" || (p.cantidad <= 0 && p.estado !== "DAÑADA / GARANTÍA");
      const isDanada = p.estado === "DAÑADA / GARANTÍA" || (p.observacion && p.observacion.toLowerCase().includes("garantía"));

      let statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">En existencia (${p.cantidad})</span>`;
      if (isDanada) {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">⚠️ DAÑADA / GARANTÍA</span>`;
      } else if (isVendida) {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700">VENDIDO</span>`;
      }

      const obsHtml = isDanada
        ? `<span class="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">${p.observacion}</span>`
        : `<span class="text-gray-600">${p.observacion || '-'}</span>`;

      html += `
        <tr class="border-b border-gray-100 hover:bg-gray-50 text-xs ${isDanada ? 'bg-rose-50/20' : ''}">
          <td class="py-2.5 px-3 font-mono text-gray-400">${p.id}</td>
          <td class="py-2.5 px-3 font-bold text-gray-900">${p.pieza}</td>
          <td class="py-2.5 px-3 text-blue-700 font-semibold">${p.vehiculo_origen}</td>
          <td class="py-2.5 px-3 text-gray-500">${p.anio || '-'}</td>
          <td class="py-2.5 px-3">${statusBadge}</td>
          <td class="py-2.5 px-3 font-black text-gray-900">$${Number(p.precio_base).toLocaleString()}</td>
          <td class="py-2.5 px-3 font-bold text-amber-700">$${Number(p.precio_minimo).toLocaleString()}</td>
          <td class="py-2.5 px-3 text-emerald-700 font-bold">${p.venta_final ? `$${Number(p.venta_final).toLocaleString()}` : '-'}</td>
          <td class="py-2.5 px-3 text-gray-400 font-mono">${p.fecha_venta || '-'}</td>
          <td class="py-2.5 px-3 text-gray-600 max-w-xs truncate" title="${p.compatibilidad}">${p.compatibilidad || '-'}</td>
          <td class="py-2.5 px-3 max-w-xs truncate" title="${p.observacion}">${obsHtml}</td>
          <td class="py-2.5 px-3 text-right">
            <button 
              onclick="window.imagesManager.openCameraModal('${p.id}')"
              class="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 text-[11px] font-bold"
            >
              📷 Fotos (${(p.fotos || []).length})
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.appManager = new AppManager();
  window.appManager.init();
});
