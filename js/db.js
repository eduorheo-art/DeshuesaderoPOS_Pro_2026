// db.js - Motor de base de datos local y 100% offline para Yonke TPV

const DB_NAME = "YonkeAutoPartsDB";
const DB_VERSION = 1;
const STORAGE_KEY_PARTS = "yonke_parts_data";
const STORAGE_KEY_VEHICLES = "yonke_vehicles_data";
const STORAGE_KEY_SALES = "yonke_sales_history";
const STORAGE_KEY_EXPENSES = "yonke_expenses_data";

class YonkeDB {
  constructor() {
    this.parts = [];
    this.vehicles = [];
    this.sales = [];
    this.expenses = [];
    this.initialized = false;
  }

  async init() {
    try {
      // 🚨 LIMPIEZA TOTAL FORZADA DE INDEXEDDB Y LOCALSTORAGE 🚨
      indexedDB.deleteDatabase("YonkeAutoPartsDB");
      indexedDB.deleteDatabase("yonke_db");
      indexedDB.deleteDatabase("yonke_pwa_db");
      localStorage.clear();
      sessionStorage.clear();

      // 1. Intentar cargar desde localStorage
      const cachedParts = localStorage.getItem(STORAGE_KEY_PARTS);
      const cachedVehicles = localStorage.getItem(STORAGE_KEY_VEHICLES);
      const cachedSales = localStorage.getItem(STORAGE_KEY_SALES);
      const cachedExpenses = localStorage.getItem(STORAGE_KEY_EXPENSES);

      if (cachedParts && cachedVehicles) {
        this.parts = JSON.parse(cachedParts);
        this.vehicles = JSON.parse(cachedVehicles);
        this.sales = cachedSales ? JSON.parse(cachedSales) : [];
        this.expenses = cachedExpenses ? JSON.parse(cachedExpenses) : [];

        // Limpieza preventiva de seguridad de filas de resumen o fórmulas importadas erróneamente
        const prevPartsLen = this.parts.length;
        this.parts = this.parts.filter(p => {
          if (!p || !p.pieza) return false;
          const c = String(p.pieza).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[:*#\-]/g, " ").trim();
          const bad = ["RETORNO DE INVERSION", "GANANCIA", "COSTO", "COSTO TOTAL", "TOTAL", "TOTAL GENERAL", "SUBTOTAL", "UTILIDAD", "MARGEN", "ROI", "RESUMEN"];
          return !bad.some(k => c === k || c.startsWith(k + " ") || c.endsWith(" " + k));
        });
        if (this.parts.length !== prevPartsLen) {
          this.persist();
        }
      } else {
        // Inicializar con los datos precargados del yonke
        this.vehicles = Array.isArray(INITIAL_VEHICLES) ? [...INITIAL_VEHICLES] : [];
        this.parts = Array.isArray(INITIAL_PARTS) ? [...INITIAL_PARTS] : [];
        this.expenses = Array.isArray(INITIAL_EXPENSES) ? [...INITIAL_EXPENSES] : [];
        
        // Generar ventas históricas iniciales a partir de las piezas ya marcadas como VENDIDAS
        this.sales = [];
        this.parts.forEach(p => {
          if (p.estado === "VENDIDO" && p.venta_final && p.venta_final > 0) {
            this.sales.push({
              id: "sale-hist-" + p.id,
              pieza_id: p.id,
              pieza_nombre: p.pieza,
              vehiculo_origen: p.vehiculo_origen,
              precio_base: p.precio_base,
              precio_minimo: p.precio_minimo,
              monto_cobrado: p.venta_final,
              caja_a: Number((p.venta_final * 0.80).toFixed(2)),
              caja_b: Number((p.venta_final * 0.20).toFixed(2)),
              fecha: p.fecha_venta || "2026-01-01",
              hora: "12:00:00",
              tipo: "historica",
              notas: p.observacion || ""
            });
          }
        });

        this.persist();
      }

      const stampIfMissing = (arr) => {
        (arr || []).forEach((item) => {
          if (item && !item.updated_at) this.stampRecord(item);
        });
      };
      stampIfMissing(this.parts);
      stampIfMissing(this.vehicles);
      stampIfMissing(this.sales);
      stampIfMissing(this.expenses);
      this.persist();

      this.initialized = true;
      if (window.yonkeSync) {
        window.yonkeSync.start().catch((e) => console.warn("Sync:", e));
      }
      return true;
    } catch (err) {
      console.error("Error al inicializar base de datos local:", err);
      return false;
    }
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY_PARTS, JSON.stringify(this.parts));
      localStorage.setItem(STORAGE_KEY_VEHICLES, JSON.stringify(this.vehicles));
      localStorage.setItem(STORAGE_KEY_SALES, JSON.stringify(this.sales));
      localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(this.expenses));
      if (window.yonkeLocalStore) {
        window.yonkeLocalStore.saveSnapshot(this);
      }
    } catch (e) {
      console.warn("Advertencia de almacenamiento local:", e);
    }
  }

  stampRecord(record) {
    if (!record) return record;
    if (window.yonkeSync) return window.yonkeSync.stamp(record);
    record.updated_at = new Date().toISOString();
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    record.dispositivo_origen = coarse || window.innerWidth < 1024 ? "Móvil" : "PC";
    return record;
  }

  syncRecord(kind, record) {
    if (window.yonkeSync) window.yonkeSync.enqueue(kind, record);
  }

  // --- VEHÍCULOS ---
  getVehicles() {
    return [...this.vehicles];
  }

  getVehicleById(id) {
    return this.vehicles.find(v => v.id === id || v.modelo === id);
  }

  addVehicle(vehicleData) {
    const newVehicle = {
      id: "veh-" + Date.now(),
      modelo: vehicleData.modelo,
      anio: vehicleData.anio || "",
      costo: Number(vehicleData.costo) || 0,
      fecha_ingreso: vehicleData.fecha_ingreso || new Date().toISOString().split("T")[0],
      color: vehicleData.color || "No especificado",
      vin: vehicleData.vin || "",
      notas: vehicleData.notas || ""
    };
    this.stampRecord(newVehicle);
    this.vehicles.unshift(newVehicle);
    this.persist();
    this.syncRecord("vehicles", newVehicle);
    return newVehicle;
  }

  // --- PIEZAS / INVENTARIO ---
  getParts() {
    return [...this.parts];
  }

  getPartById(id) {
    return this.parts.find(p => p.id === id);
  }

  updatePart(id, updatedFields) {
    const index = this.parts.findIndex(p => p.id === id);
    if (index === -1) return null;

    const part = { ...this.parts[index], ...updatedFields };

    if (updatedFields.estado) {
      part.estado = updatedFields.estado;
      if (part.estado === "VENDIDO" && (part.cantidad === undefined || part.cantidad > 0)) {
        if (updatedFields.cantidad === undefined) part.cantidad = 0;
      }
    } else if (part.cantidad <= 0 && part.estado !== "DAÑADA / GARANTÍA") {
      part.estado = "VENDIDO";
      part.cantidad = 0;
    } else if (part.cantidad > 0 && part.estado === "VENDIDO") {
      part.estado = "En existencia";
    }

    this.stampRecord(part);
    this.parts[index] = part;
    this.persist();
    this.syncRecord("parts", part);
    return part;
  }

  addPart(partData) {
    const qty = Number(partData.cantidad) >= 0 ? Number(partData.cantidad) : 1;
    const estado = partData.estado || (qty === 0 ? "VENDIDO" : "En existencia");
    const newPart = {
      id: partData.id || "P-" + Date.now(),
      vehiculo_origen: partData.vehiculo_origen || "Sin vehículo",
      anio: partData.anio || "",
      pieza: partData.pieza || "Pieza sin nombre",
      estado: estado,
      precio_base: Number(partData.precio_base) || 0,
      precio_minimo: Number(partData.precio_minimo) || 0,
      cantidad: qty,
      venta_final: partData.venta_final !== null && partData.venta_final !== undefined && partData.venta_final !== "" ? Number(partData.venta_final) : null,
      fecha_venta: partData.fecha_venta || null,
      observacion: partData.observacion || "",
      compatibilidad: partData.compatibilidad || "",
      fotos: Array.isArray(partData.fotos) ? partData.fotos : [],
      ubicacion_patio: partData.ubicacion_patio || "Patio general"
    };

    this.stampRecord(newPart);
    this.parts.unshift(newPart);
    this.persist();
    this.syncRecord("parts", newPart);
    return newPart;
  }

  // --- REGISTRO DE VENTA AUTOMATIZADO ---
  processSale({ partId, finalPrice, saleDate, note = "" }) {
    const part = this.getPartById(partId);
    if (!part) {
      throw new Error("Pieza no encontrada en inventario");
    }

    const price = Number(finalPrice);
    if (isNaN(price) || price < 0) {
      throw new Error("El precio de venta final no es válido");
    }

    const now = new Date();
    const dateFormatted = saleDate || now.toISOString().split("T")[0];
    const timeFormatted = now.toTimeString().split(" ")[0];

    // 1. Actualizar la pieza en inventario
    const newQty = Math.max(0, (Number(part.cantidad) || 1) - 1);
    const updatedState = newQty === 0 ? "VENDIDO" : "En existencia";

    part.cantidad = newQty;
    part.estado = updatedState;
    part.venta_final = price;
    part.fecha_venta = dateFormatted;
    if (note) {
      part.observacion = (part.observacion ? part.observacion + " | " : "") + note;
    }

    // 2. Cálculo Financiero Sagrado (80% Caja A, 20% Caja B)
    const cajaA = Number((price * 0.80).toFixed(2));
    const cajaB = Number((price * 0.20).toFixed(2));

    // 3. Registrar en historial de ventas
    const saleRecord = {
      id: "sale-" + Date.now(),
      pieza_id: part.id,
      pieza_nombre: part.pieza,
      vehiculo_origen: part.vehiculo_origen,
      precio_base: part.precio_base,
      precio_minimo: part.precio_minimo,
      monto_cobrado: price,
      caja_a: cajaA,
      caja_b: cajaB,
      fecha: dateFormatted,
      hora: timeFormatted,
      tipo: "mostrador",
      notas: note
    };

    this.stampRecord(part);
    this.stampRecord(saleRecord);
    this.sales.unshift(saleRecord);
    this.persist();
    this.syncRecord("parts", part);
    this.syncRecord("sales", saleRecord);

    return {
      part,
      sale: saleRecord
    };
  }

  // --- PIEZAS FUERA DE INVENTARIO (Pieza no catalogada vendida al momento) ---
  processGhostPartSale({ pieza, vehiculo_origen, monto, compatibilidad = "", observacion = "" }) {
    const price = Number(monto);
    if (isNaN(price) || price <= 0) {
      throw new Error("El precio de la pieza fuera de inventario debe ser mayor a 0");
    }

    const now = new Date();
    const dateFormatted = now.toISOString().split("T")[0];
    const timeFormatted = now.toTimeString().split(" ")[0];

    // 1. Se crea la pieza y se agrega al inventario como VENDIDA
    const newPart = {
      id: "P-FUERA-INV-" + Date.now(),
      vehiculo_origen: vehiculo_origen || "Desconocido / Suelto",
      anio: "",
      pieza: pieza || "Pieza especial",
      estado: "VENDIDO", // Cantidad 0 = VENDIDO
      precio_base: price,
      precio_minimo: price,
      cantidad: 0,
      venta_final: price,
      fecha_venta: dateFormatted,
      observacion: "[Pieza fuera de Inventario] " + (observacion || "Venta rápida no catalogada"),
      compatibilidad: compatibilidad || "",
      fotos: [],
      ubicacion_patio: "Venta directa"
    };

    this.stampRecord(newPart);
    this.parts.unshift(newPart);

    // 2. Reparto 80/20
    const cajaA = Number((price * 0.80).toFixed(2));
    const cajaB = Number((price * 0.20).toFixed(2));

    const saleRecord = {
      id: "sale-gh-" + Date.now(),
      pieza_id: newPart.id,
      pieza_nombre: newPart.pieza,
      vehiculo_origen: newPart.vehiculo_origen,
      precio_base: price,
      precio_minimo: price,
      monto_cobrado: price,
      caja_a: cajaA,
      caja_b: cajaB,
      fecha: dateFormatted,
      hora: timeFormatted,
      tipo: "fuera_de_inventario",
      notas: observacion
    };

    this.stampRecord(saleRecord);
    this.sales.unshift(saleRecord);
    this.persist();
    this.syncRecord("parts", newPart);
    this.syncRecord("sales", saleRecord);

    return {
      part: newPart,
      sale: saleRecord
    };
  }

  // --- GESTIÓN DE DEVOLUCIONES Y GARANTÍAS ---
  processReturn({ saleId, partId, returnType, refundAmount, pieceDestination, reason }) {
    const sale = this.sales.find(s => s.id === saleId);
    const part = this.getPartById(partId);

    const now = new Date();
    const dateFormatted = now.toISOString().split("T")[0];
    const timeFormatted = now.toTimeString().split(" ")[0];

    if (sale) {
      sale.estado = "DEVUELTO";
      sale.notas = (sale.notas ? sale.notas + " | " : "") + `[Garantía Aplicada]: ${reason}`;
    }

    // Si es reembolso en efectivo, descuenta automáticamente de Caja A y Caja B
    if (returnType === "refund" && refundAmount > 0) {
      const cajaARefund = Number((refundAmount * 0.80).toFixed(2));
      const cajaBRefund = Number((refundAmount * 0.20).toFixed(2));

      const refundSale = {
        id: "ret-" + Date.now(),
        pieza_id: partId,
        pieza_nombre: (part ? part.pieza : (sale ? sale.pieza_nombre : "Pieza")) + " (DEVOLUCIÓN GARANTÍA)",
        vehiculo_origen: part ? part.vehiculo_origen : (sale ? sale.vehiculo_origen : ""),
        precio_base: 0,
        precio_minimo: 0,
        monto_cobrado: -refundAmount,
        caja_a: -cajaARefund,
        caja_b: -cajaBRefund,
        fecha: dateFormatted,
        hora: timeFormatted,
        tipo: "garantia",
        notas: `Reembolso por garantía: ${reason}`
      };
      this.stampRecord(refundSale);
      this.sales.unshift(refundSale);
      this.syncRecord("sales", refundSale);
    }

    // Actualizar estado de la pieza física en catálogo
    if (part) {
      if (pieceDestination === "scrapped") {
        part.estado = "DAÑADA / GARANTÍA";
        part.cantidad = 0;
        part.observacion = (part.observacion ? part.observacion + " | " : "") + `[Garantía aplicada]: ${reason}`;
      } else if (pieceDestination === "restock") {
        part.estado = "En existencia";
        part.cantidad = (Number(part.cantidad) || 0) + 1;
        part.venta_final = null;
        part.fecha_venta = null;
      }
    }

    if (sale) this.stampRecord(sale);
    if (part) this.stampRecord(part);
    this.persist();
    if (sale) this.syncRecord("sales", sale);
    if (part) this.syncRecord("parts", part);
    return { sale, part };
  }

  // --- FINANZAS Y CAJAS ---
  getFinancesSummary() {
    let totalVendido = 0;
    let totalCajaA_ingresos = 0;
    let totalCajaB_ingresos = 0;

    this.sales.forEach(s => {
      const monto = Number(s.monto_cobrado) || 0;
      totalVendido += monto;
      totalCajaA_ingresos += Number(s.caja_a) || (monto * 0.80);
      totalCajaB_ingresos += Number(s.caja_b) || (monto * 0.20);
    });

    // Gastos que salieron de Caja B
    let totalGastosCajaB = 0;
    let pagadoMoto = 0;
    let sueldosRetirados = 0;
    let otrosGastos = 0;

    this.expenses.forEach(e => {
      const monto = Number(e.monto) || 0;
      totalGastosCajaB += monto;
      if (e.categoria === "moto" || e.concepto.toLowerCase().includes("moto")) {
        pagadoMoto += monto;
      } else if (e.categoria === "sueldo" || e.concepto.toLowerCase().includes("sueldo")) {
        sueldosRetirados += monto;
      } else {
        otrosGastos += monto;
      }
    });

    const saldoCajaA = Number(totalCajaA_ingresos.toFixed(2));
    const saldoCajaB_Bruto = Number(totalCajaB_ingresos.toFixed(2));
    const saldoCajaB_Neto = Number((saldoCajaB_Bruto - totalGastosCajaB).toFixed(2));

    // Sueldo sugerido disponible (máximo topado a $3,000 en el corte)
    // El excedente sobre $3,000 pasa al colchón de reserva
    const sueldoCap = 3000;
    let sueldoDisponible = Math.min(sueldoCap, Math.max(0, saldoCajaB_Neto));
    let colchonReserva = Math.max(0, saldoCajaB_Neto - sueldoCap);

    return {
      totalVendido: Number(totalVendido.toFixed(2)),
      cajaA: {
        ingresosTotales: Number(totalCajaA_ingresos.toFixed(2)),
        saldoDisponible: saldoCajaA, // Fondo sagrado para comprar autos
        porcentaje: 80
      },
      cajaB: {
        ingresosTotales: saldoCajaB_Bruto,
        totalGastado: Number(totalGastosCajaB.toFixed(2)),
        saldoNeto: saldoCajaB_Neto,
        pagadoMoto,
        metaMotoMensual: 2066,
        motoCubierta: pagadoMoto >= 2066,
        sueldoCap,
        sueldoDisponible: Number(sueldoDisponible.toFixed(2)),
        colchonReserva: Number(colchonReserva.toFixed(2)),
        porcentaje: 20
      },
      gastos: [...this.expenses],
      ventas: [...this.sales]
    };
  }

  addExpense({ fecha, concepto, categoria = "general", monto, nota = "" }) {
    const expense = {
      id: "exp-" + Date.now(),
      fecha: fecha || new Date().toISOString().split("T")[0],
      concepto: concepto || "Gasto sin concepto",
      categoria: categoria,
      monto: Number(monto) || 0,
      nota: nota
    };
    this.stampRecord(expense);
    this.expenses.unshift(expense);
    this.persist();
    this.syncRecord("expenses", expense);
    return expense;
  }

  // --- MÉTRICAS Y TABLERO DE CONTROL (POR VEHÍCULO) ---
  getVehicleDashboardData(vehicleIdentifier) {
    const vehicle = this.getVehicleById(vehicleIdentifier);
    if (!vehicle) return null;

    // Obtener todas las piezas asociadas a este vehículo
    const vehicleParts = this.parts.filter(p => 
      p.vehiculo_origen.toLowerCase().trim() === vehicle.modelo.toLowerCase().trim()
    );

    let totalVendidoAuto = 0;
    let piezasVendidasCount = 0;
    let piezasEnExistenciaCount = 0;
    let valorPotencialRestante = 0;

    vehicleParts.forEach(p => {
      if (p.estado === "VENDIDO") {
        piezasVendidasCount++;
        totalVendidoAuto += Number(p.venta_final) || Number(p.precio_base) || 0;
      } else {
        piezasEnExistenciaCount += (Number(p.cantidad) || 1);
        valorPotencialRestante += (Number(p.precio_base) * (Number(p.cantidad) || 1));
      }
    });

    const costoAuto = Number(vehicle.costo) || 0;
    const gananciaRecuperada = totalVendidoAuto - costoAuto;
    const roiActual = costoAuto > 0 ? (totalVendidoAuto / costoAuto).toFixed(2) : 0;

    // Cálculo del tiempo transcurrido en patio
    const fechaIngreso = new Date(vehicle.fecha_ingreso || "2026-01-01");
    const hoy = new Date();
    const diffMs = Math.max(0, hoy - fechaIngreso);
    const diasEnPatio = Math.floor(diffMs / (1000 * 60 * 60 * 24)) || 1;

    // Costo de tenerlo parado / Rendimiento diario
    const ventaPorDia = Number((totalVendidoAuto / diasEnPatio).toFixed(2));
    const costoPisoEstimadoPorDia = 15; // $15 pesos diarios de espacio/vigilancia promedio en yonke
    const costoPisoAcumulado = Number((costoPisoEstimadoPorDia * diasEnPatio).toFixed(2));

    return {
      vehicle,
      totalVendidoAuto,
      costoAuto,
      gananciaRecuperada,
      roiActual,
      valorPotencialRestante,
      piezasVendidasCount,
      piezasEnExistenciaCount,
      totalPiezas: vehicleParts.length,
      diasEnPatio,
      ventaPorDia,
      costoPisoAcumulado,
      piezas: vehicleParts
    };
  }

  // Resumen consolidado de todos los autos
  getConsolidatedVehiclesMetrics() {
    return this.vehicles.map(v => this.getVehicleDashboardData(v.id)).filter(Boolean);
  }

  // Restablecer a fábrica (si se requiere)
  resetToDefault() {
    localStorage.removeItem(STORAGE_KEY_PARTS);
    localStorage.removeItem(STORAGE_KEY_VEHICLES);
    localStorage.removeItem(STORAGE_KEY_SALES);
    localStorage.removeItem(STORAGE_KEY_EXPENSES);
    return this.init();
  }
}

// Exportar instancia global
window.yonkeDB = new YonkeDB();
