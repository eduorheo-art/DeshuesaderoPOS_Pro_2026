// dashboard.js - Tablero de Control con Gráfica de Pastel (Vendido vs Costo), Días en Patio y Costo de Piso

class DashboardManager {
  constructor() {
    this.selectedVehicleId = "TODOS";
  }

  init() {
    this.populateVehicleSelector();
    this.attachEvents();
    this.updateUI();
  }

  populateVehicleSelector() {
    const select = document.getElementById("dashboard-vehicle-selector");
    if (!select) return;

    const vehicles = window.yonkeDB.getVehicles();
    let options = `<option value="TODOS">🚗 Todos los Vehículos (Consolidado de Patio)</option>`;
    vehicles.forEach(v => {
      options += `<option value="${v.id}">${v.modelo} (Costo: $${v.costo.toLocaleString()})</option>`;
    });
    select.innerHTML = options;
  }

  attachEvents() {
    const select = document.getElementById("dashboard-vehicle-selector");
    if (select) {
      select.addEventListener("change", (e) => {
        this.selectedVehicleId = e.target.value;
        this.updateUI();
      });
    }
  }

  updateUI() {
    if (this.selectedVehicleId === "TODOS") {
      this.renderConsolidatedDashboard();
    } else {
      this.renderSingleVehicleDashboard(this.selectedVehicleId);
    }
  }

  renderSingleVehicleDashboard(vehicleId) {
    const data = window.yonkeDB.getVehicleDashboardData(vehicleId);
    if (!data) return;

    // Encabezado
    const titleEl = document.getElementById("dash-vehicle-title");
    if (titleEl) titleEl.textContent = `${data.vehicle.modelo} (${data.vehicle.anio || 'Año no esp.'})`;

    const vinEl = document.getElementById("dash-vehicle-vin");
    if (vinEl) vinEl.textContent = data.vehicle.vin ? `VIN: ${data.vehicle.vin}` : `Color: ${data.vehicle.color}`;

    // Métricas Financieras del Auto
    const costoEl = document.getElementById("dash-costo-auto");
    if (costoEl) costoEl.textContent = `$${data.costoAuto.toLocaleString()}`;

    const vendidoEl = document.getElementById("dash-vendido-auto");
    if (vendidoEl) vendidoEl.textContent = `$${data.totalVendidoAuto.toLocaleString()}`;

    const gananciaEl = document.getElementById("dash-ganancia-auto");
    if (gananciaEl) {
      const ganancia = data.gananciaRecuperada;
      if (ganancia >= 0) {
        gananciaEl.textContent = `+$${ganancia.toLocaleString()}`;
        gananciaEl.className = "text-2xl font-black text-emerald-600";
      } else {
        gananciaEl.textContent = `-$${Math.abs(ganancia).toLocaleString()}`;
        gananciaEl.className = "text-2xl font-black text-amber-600";
      }
    }

    const roiEl = document.getElementById("dash-roi-auto");
    if (roiEl) roiEl.textContent = `${data.roiActual}x`;

    // Métricas de Tiempo en Patio y Costo de Piso
    const diasEl = document.getElementById("dash-dias-patio");
    if (diasEl) diasEl.textContent = `${data.diasEnPatio} días`;

    const costoPisoEl = document.getElementById("dash-costo-piso");
    if (costoPisoEl) costoPisoEl.textContent = `$${data.costoPisoAcumulado.toLocaleString()}`;

    const ventaPorDiaEl = document.getElementById("dash-venta-dia");
    if (ventaPorDiaEl) ventaPorDiaEl.textContent = `$${data.ventaPorDia.toLocaleString()} / día`;

    // Estado del auto en patio
    const estadoPatioEl = document.getElementById("dash-estado-patio");
    if (estadoPatioEl) {
      if (data.gananciaRecuperada > 0) {
        estadoPatioEl.innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✅ Inversión Recuperada (Pura Ganancia)</span>`;
      } else if (data.diasEnPatio > 180) {
        estadoPatioEl.innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">⚠️ Auto Estancado (> 6 meses en patio)</span>`;
      } else {
        estadoPatioEl.innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">🔄 Recuperando Inversión</span>`;
      }
    }

    // Piezas inventariadas
    const piezasCountEl = document.getElementById("dash-piezas-count");
    if (piezasCountEl) {
      piezasCountEl.textContent = `${data.piezasVendidasCount} vendidas de ${data.totalPiezas} piezas registradas`;
    }

// --- NUEVO CÁLCULO FINANCIERO Y GRÁFICA CORREGIDA ---
    const costoFijoAdquisicion = Number(data.costoAuto || 0); // Toma el costo real (ej. 12,000)
    const totalVendido = Number(data.totalVendidoAuto || 0);
    const valorPiezasRestantes = Number(data.valorPiezasRestantes || 0);

    // Ganancia Real (Solo resta el costo fijo de adquisición, ignorando el costo de patio)
    const gananciaRealNeta = totalVendido - costoFijoAdquisicion;
    if (gananciaEl) {
      gananciaEl.textContent = `+$${gananciaRealNeta.toLocaleString()}`;
    }

    const slices = [
      {
        label: "Total Vendido Cobrado",
        value: totalVendido,
        color: "#10b981" // Verde
      },
      {
        label: "Costo de Adquisición",
        value: costoFijoAdquisicion, // ¡Aquí se inyecta el costo real de 20,000 o 9,000!
        color: "#ef4444" // Rojo (Costo Fijo)
      },
      {
        label: "Valor in Piezas Restantes",
        value: valorPiezasRestantes,
        color: "#3b82f6" // Azul
      }
    ];

    this.drawPieChart("dashboard-pie-canvas", slices);

    // Dibujar la gráfica con los datos correctos
    this.drawPieChart("dashboard-pie-canvas", slices);    

    // --- LLAMADA A NUESTRO NUEVO ANÁLISIS FINANCIERO ---
    const currentVehicleData = {
      vehiculoNombre: vehicle ? vehicle.modelo : "Vehículo",
      marca: vehicle ? vehicle.marca : "",
      costoAdquisicion: vehicle ? Number(vehicle.costoAdquisicion || vehicle.costo || 0) : 0,
      fechaLlegada: vehicle ? vehicle.fechaLlegada : null,
      totalVendido: window.salesManager ? window.salesManager.getTotalByVehicle(vehicleId) : 0
    };
  renderVehicleFinancialChart([currentVehicleData]);
  }

  renderConsolidatedDashboard() {
    // 1. Obtener la lista de todos los vehículos
    const allVehicles = window.inventoryManager ? window.inventoryManager.getAllVehicles() : [];
    
    let totalCostoAdquisicionGlobal = 0;
    let totalVendidoGlobal = 0;
    let totalCostoPatioInformativoGlobal = 0;

    allVehicles.forEach(car => {
      const costoFijo = Number(car.costoAdquisicion || car.costo || 0);
      const totalVendido = window.salesManager ? window.salesManager.getTotalByVehicle(car.id) : 0;
      
      const diasEnPatio = Math.floor((new Date() - new Date(car.fechaLlegada || Date.now())) / (1000 * 60 * 60 * 24));
      const costoPatioTotal = diasEnPatio * 15; // $15 diarios informativos

      totalCostoAdquisicionGlobal += costoFijo;
      totalVendidoGlobal += totalVendido;
      totalCostoPatioInformativoGlobal += costoPatioTotal;
    });

    // La utilidad neta global resta ÚNICAMENTE el costo de adquisición fijo
    const utilidadNetaGlobal = totalVendidoGlobal - totalCostoAdquisicionGlobal;

    // Aquí puedes renderizar los totales generales en el contenedor consolidado de tu HTML
    const consolidatedContainer = document.getElementById("consolidated-chart-container") || document.getElementById("vehicle-chart-container");
    
    if (consolidatedContainer) {
      consolidatedContainer.innerHTML = `
        <div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
          <h3 class="text-base font-bold text-slate-100 flex items-center gap-2">📊 Consolidado General del Patio (Todos los Vehículos)</h3>
          
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="bg-slate-950 p-3 rounded-xl border border-red-500/20">
              <span class="block text-xs text-slate-400">Costo Adquisición Total (Fijo):</span>
              <span class="text-lg font-bold text-red-400">$${totalCostoAdquisicionGlobal.toLocaleString()}</span>
            </div>
            <div class="bg-slate-950 p-3 rounded-xl border border-amber-500/20">
              <span class="block text-xs text-slate-400">Costo Patio Total (Informativo):</span>
              <span class="text-lg font-bold text-amber-400">$${totalCostoPatioInformativoGlobal.toLocaleString()}</span>
            </div>
            <div class="bg-slate-950 p-3 rounded-xl border border-emerald-500/20">
              <span class="block text-xs text-slate-400">Utilidad Neta Global:</span>
              <span class="text-lg font-bold ${utilidadNetaGlobal >= 0 ? 'text-emerald-400' : 'text-red-400'}">$${utilidadNetaGlobal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Dibujador de Gráfica de Pastel en Canvas 2D nativo y responsivo
  drawPieChart(canvasId, slices) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);
    if (total <= 0) {
      ctx.fillStyle = "#9ca3af";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Sin datos financieros para graficar", width / 2, height / 2);
      return;
    }

    const centerX = width / 2;
    const centerY = (height / 2) - 15;
    const radius = Math.min(centerX, centerY) - 20;

    let currentAngle = -Math.PI / 2;

    slices.forEach(slice => {
      if (slice.value <= 0) return;
      const sliceAngle = (slice.value / total) * 2 * Math.PI;

      // Dibujar rebanada
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();

      // Borde blanco fino
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      currentAngle += sliceAngle;
    });

    // Círculo central blanco para estilo dona moderna
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.45, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Actualizar Leyendas HTML
    const legendContainer = document.getElementById("dashboard-pie-legend");
    if (legendContainer) {
      let legendHtml = "";
      slices.forEach(s => {
        const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
        legendHtml += `
          <div class="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full inline-block" style="background-color: ${s.color};"></span>
              <span class="font-medium text-gray-700">${s.label}</span>
            </div>
            <div class="text-right">
              <span class="font-black text-gray-900">$${Number(s.value).toLocaleString()}</span>
              <span class="text-gray-400 text-[10px] ml-1">(${pct}%)</span>
            </div>
          </div>
        `;
      });
      legendContainer.innerHTML = legendHtml;
    }
  }
}
  // ==========================================
// ANÁLISIS FINANCIERO Y COSTOS POR VEHÍCULO
// ==========================================
function renderVehicleFinancialChart(vehicleDataList) {
  const container = document.getElementById("vehicle-chart-container");
  if (!container) return;

  let html = `<div class="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">`;
  html += `<h3 class="text-base font-bold text-slate-100 flex items-center gap-2">📊 Análisis Financiero y Costos por Vehículo</h3>`;
  
  vehicleDataList.forEach(car => {
    const costoFijo = car.costoAdquisicion || 0;
    const diasEnPatio = car.diasPatio || Math.floor((new Date() - new Date(car.fechaLlegada || Date.now())) / (1000 * 60 * 60 * 24));
    const costoPatioDiario = 15; 
    const costoPatioTotal = diasEnPatio * costoPatioDiario;
    
    const totalVendido = car.totalVendido || 0;
    const utilidadNeta = totalVendido - costoFijo; // Solo resta el costo fijo de adquisición

    html += `
      <div class="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
        <div class="flex justify-between items-center">
          <span class="font-bold text-slate-200">${car.vehiculoNombre || car.modelo}</span>
          <span class="text-xs font-semibold text-red-400 bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-500/30">
            Costo Fijo: $${costoFijo.toLocaleString()}
          </span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-400">
          <div class="bg-slate-900 p-2 rounded-lg">
            <span class="block text-slate-500">Costo Piso/Patio (Informativo):</span>
            <span class="font-bold text-amber-400">$${costoPatioTotal.toLocaleString()} (${diasEnPatio} días)</span>
          </div>
          <div class="bg-slate-900 p-2 rounded-lg">
            <span class="block text-slate-500">Total Vendido:</span>
            <span class="font-bold text-blue-400">$${totalVendido.toLocaleString()}</span>
          </div>
          <div class="bg-slate-900 p-2 rounded-lg">
            <span class="block text-slate-500">Utilidad Neta:</span>
            <span class="font-bold ${utilidadNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}">$${utilidadNeta.toLocaleString()}</span>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

window.dashboardManager = new DashboardManager();
