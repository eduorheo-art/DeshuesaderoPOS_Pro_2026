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

    const parts = window.yonkeDB ? window.yonkeDB.getParts() : [];
    const vehicleNames = new Map(
      parts.map(part => String(part.vehiculo_origen || "").trim())
        .filter(Boolean)
        .map(name => [this.normalizeVehicleName(name), name])
    );
    (window.yonkeDB?.getVehicles?.() || []).forEach(vehicle => {
      const name = String(vehicle.modelo || "").trim();
      if (name && !vehicleNames.has(this.normalizeVehicleName(name))) {
        vehicleNames.set(this.normalizeVehicleName(name), name);
      }
    });
    select.innerHTML = `<option value="TODOS">🚗 Todos los Vehículos (Consolidado de Patio)</option>`;
    vehicleNames.forEach(vehicleName => {
      const option = document.createElement("option");
      option.value = vehicleName;
      option.textContent = vehicleName;
      select.appendChild(option);
    });
    const selectedOption = [...select.options].find(option => this.normalizeVehicleName(option.value) === this.normalizeVehicleName(this.selectedVehicleId));
    if (selectedOption) {
      this.selectedVehicleId = selectedOption.value;
      select.value = selectedOption.value;
    } else {
      this.selectedVehicleId = "TODOS";
      select.value = "TODOS";
    }
  }

  normalizeVehicleName(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  getInventoryVehicleMetrics(vehicleName) {
    const allParts = window.yonkeDB ? window.yonkeDB.getParts() : [];
    const normalizedName = this.normalizeVehicleName(vehicleName);
    const vehicleParts = allParts.filter(part => this.normalizeVehicleName(part.vehiculo_origen) === normalizedName);
    const vehicles = window.yonkeDB && typeof window.yonkeDB.getVehicles === "function" ? window.yonkeDB.getVehicles() : [];
    const registeredVehicle = vehicles.find(vehicle => this.normalizeVehicleName(vehicle.modelo) === normalizedName);
    const fixedCosts = {
      "fordf1501988": 20000,
      "chevroletopelastra2002": 9000,
      "nissanaltima4a2010": 15000,
      "nissantsuru32001": 12000,
      "toyotasienna1999": 10000,
      "volkswagenjettaa42006": 27000,
      "volkswagenpolo2017": 16000
    };
    const costo = Number(registeredVehicle?.costo) || fixedCosts[normalizedName] || 0;
    const proyeccion = vehicleParts.reduce((total, part) => total + (Number(part.precio_base) || 0), 0);
    const vendido = vehicleParts.reduce((total, part) => total + (Number(part.venta_final) || 0), 0);
    const fechas = vehicleParts.map(part => part.fecha_ingreso || part.created_at || part.fecha)
      .filter(Boolean).map(date => new Date(date).getTime()).filter(Number.isFinite);
    const registeredDate = registeredVehicle?.fecha_ingreso ? new Date(registeredVehicle.fecha_ingreso).getTime() : NaN;
    if (Number.isFinite(registeredDate)) fechas.push(registeredDate);
    const diasEnPatio = fechas.length ? Math.max(0, Math.floor((Date.now() - Math.min(...fechas)) / 86400000)) : 0;
    return { vehicleName, vehicleParts, registeredVehicle, costo, proyeccion, vendido, diasEnPatio };
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
    this.populateVehicleSelector();
    if (this.selectedVehicleId === "TODOS") {
      this.renderConsolidatedDashboard();
    } else {
      this.renderSingleVehicleDashboard(this.selectedVehicleId);
    }
  }

  renderSingleVehicleDashboard(vehicleId) {
    const data = this.getInventoryVehicleMetrics(vehicleId);
    const ganancia = data.vendido - data.costo;
    const roi = data.costo > 0 ? (data.vendido / data.costo).toFixed(2) : "0.00";
    this.renderVehiclePhotos(data.registeredVehicle);
    document.getElementById("dash-vehicle-title").textContent = vehicleId;
    document.getElementById("dash-vehicle-vin").textContent = "Métricas calculadas desde Vehículo Origen y columnas del inventario";
    document.getElementById("dash-piezas-count").textContent = `${data.vehicleParts.filter(part => Number(part.venta_final) > 0).length} vendidas de ${data.vehicleParts.length} piezas`;
    document.getElementById("dash-dias-patio").textContent = `${data.diasEnPatio} días`;
    document.getElementById("dash-costo-piso").textContent = `$${(data.diasEnPatio * 15).toLocaleString()}`;
    document.getElementById("dash-venta-dia").textContent = `$${(data.diasEnPatio ? data.vendido / data.diasEnPatio : 0).toLocaleString()} / día`;
    document.getElementById("dash-estado-patio").innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">📊 Resumen de inventario</span>`;
    document.getElementById("dash-costo-auto").textContent = `$${data.costo.toLocaleString()}`;
    document.getElementById("dash-vendido-auto").textContent = `$${data.vendido.toLocaleString()}`;
    document.getElementById("dash-ganancia-auto").textContent = `${ganancia < 0 ? "-" : "+"}$${Math.abs(ganancia).toLocaleString()}`;
    document.getElementById("dash-roi-auto").textContent = `${roi}x`;
    this.drawPieChart("dashboard-pie-canvas", [
      { label: "Costo de adquisición", value: data.costo, color: "#ef4444" },
      { label: "Proyección (suma Precio Base)", value: data.proyeccion, color: "#3b82f6" },
      { label: "Vendido (suma Venta Final)", value: data.vendido, color: "#10b981" }
    ]);
  }

  renderVehiclePhotos(vehicle) {
    const gallery = document.getElementById("dash-vehicle-photo-gallery");
    if (!gallery) return;
    gallery.replaceChildren();
    const photos = (Array.isArray(vehicle?.fotos) ? vehicle.fotos : [])
      .filter(photo => typeof photo === "string" && (/^https:\/\//i.test(photo) || /^data:image\//i.test(photo)));
    if (!photos.length) {
      gallery.classList.add("hidden");
      return;
    }

    gallery.classList.remove("hidden");
    const mainPhoto = document.createElement("img");
    mainPhoto.src = photos[0];
    mainPhoto.alt = `Imagen principal de ${vehicle.modelo || "vehículo en patio"}`;
    mainPhoto.loading = "lazy";
    mainPhoto.referrerPolicy = "no-referrer";
    mainPhoto.className = "h-24 w-36 rounded-lg border border-slate-600 object-cover";
    gallery.append(mainPhoto);

    if (photos.length > 1) {
      const secondaryPhotos = document.createElement("div");
      secondaryPhotos.className = "flex max-w-full gap-2 overflow-x-auto";
      photos.slice(1).forEach((photo, index) => {
        const image = document.createElement("img");
        image.src = photo;
        image.alt = `Foto secundaria ${index + 1} de ${vehicle.modelo || "vehículo en patio"}`;
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";
        image.className = "h-16 w-24 shrink-0 rounded-lg border border-slate-600 object-cover";
        secondaryPhotos.append(image);
      });
      gallery.append(secondaryPhotos);
    }
  }

  renderConsolidatedDashboard() {
    this.renderVehiclePhotos(null);
    const names = [...new Map((window.yonkeDB ? window.yonkeDB.getParts() : [])
      .map(part => [this.normalizeVehicleName(part.vehiculo_origen), String(part.vehiculo_origen || "").trim()])
      .filter(([key, name]) => key && name)).values()];
    const metrics = names.map(name => this.getInventoryVehicleMetrics(name));
    const totals = metrics.reduce((sum, item) => ({
      costo: sum.costo + item.costo,
      proyeccion: sum.proyeccion + item.proyeccion,
      vendido: sum.vendido + item.vendido,
      dias: sum.dias + item.diasEnPatio,
      piezas: sum.piezas + item.vehicleParts.length,
      piezasVendidas: sum.piezasVendidas + item.vehicleParts.filter(part => Number(part.venta_final) > 0).length
    }), { costo: 0, proyeccion: 0, vendido: 0, dias: 0, piezas: 0, piezasVendidas: 0 });
    const ganancia = totals.vendido - totals.costo;
    document.getElementById("dash-vehicle-title").textContent = `Patio Completo (${names.length} vehículos)`;
    document.getElementById("dash-vehicle-vin").textContent = "Consolidado según Vehículo Origen en el inventario";
    document.getElementById("dash-piezas-count").textContent = `${totals.piezasVendidas} vendidas de ${totals.piezas} piezas catalogadas`;
    document.getElementById("dash-dias-patio").textContent = `~${names.length ? Math.round(totals.dias / names.length) : 0} días prom.`;
    document.getElementById("dash-costo-piso").textContent = `$${(totals.dias * 15).toLocaleString()}`;
    document.getElementById("dash-venta-dia").textContent = `$${(totals.dias ? totals.vendido / totals.dias : 0).toLocaleString()} / día`;
    document.getElementById("dash-estado-patio").innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">📊 Vista Global de Patio</span>`;
    document.getElementById("dash-costo-auto").textContent = `$${totals.costo.toLocaleString()}`;
    document.getElementById("dash-vendido-auto").textContent = `$${totals.vendido.toLocaleString()}`;
    document.getElementById("dash-ganancia-auto").textContent = `${ganancia < 0 ? "-" : "+"}$${Math.abs(ganancia).toLocaleString()}`;
    document.getElementById("dash-roi-auto").textContent = `${totals.costo ? (totals.vendido / totals.costo).toFixed(2) : "0.00"}x`;
    this.drawPieChart("dashboard-pie-canvas", [
      { label: "Costo de adquisición", value: totals.costo, color: "#ef4444" },
      { label: "Proyección (suma Precio Base)", value: totals.proyeccion, color: "#3b82f6" },
      { label: "Vendido (suma Venta Final)", value: totals.vendido, color: "#10b981" }
    ]);
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
      const legendContainer = document.getElementById("dashboard-pie-legend");
      if (legendContainer) {
        legendContainer.innerHTML = slices.map(slice => `
          <div class="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full inline-block" style="background-color: ${slice.color};"></span>
              <span class="font-medium text-gray-700">${slice.label}</span>
            </div>
            <span class="font-black text-gray-900">0 (0%)</span>
          </div>
        `).join("");
      }
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
