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
    this.ownerId = null;
    this.storageKeys = null;
  }

  async init() {
    try {
      this.initialized = false;
      const cloudConfigured = window.YonkeCloudConfig?.isConfigured();

      // 1. INTENTO PRINCIPAL: Descargar directamente de la Nube (Supabase) si hay conexión y cliente configurado
      let cloudLoaded = false;

      // Asegurar cliente de Supabase si no está inicializado globalmente
      if (!window.yonkeSupabaseClient && typeof supabase !== "undefined" && supabase.createClient) {
        window.yonkeSupabaseClient = supabase.createClient(
          "https://lkivtjzcemvinymxrrvv.supabase.co",
          "sb_publishable_kHPdqpQlRfRbj0vp8YTqYw_dKp1tImK",
          { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
        );
      }

      if (cloudConfigured || window.yonkeSupabaseClient) {
        if (!window.yonkeSupabaseClient) throw new Error("Supabase está configurado pero no hay cliente de autenticación.");
        const { data, error } = await window.yonkeSupabaseClient.auth.getSession();
        if (error) throw error;
        this.ownerId = data.session?.user?.id || null;
        if (!this.ownerId) {
          this.parts = [];
          this.vehicles = [];
          this.sales = [];
          this.expenses = [];
          throw new Error("Inicia sesión antes de cargar datos privados.");
        }
      } else {
        this.ownerId = "offline";
      }

      this.storageKeys = {
        parts: `${STORAGE_KEY_PARTS}:${this.ownerId}`,
        vehicles: `${STORAGE_KEY_VEHICLES}:${this.ownerId}`,
        sales: `${STORAGE_KEY_SALES}:${this.ownerId}`,
        expenses: `${STORAGE_KEY_EXPENSES}:${this.ownerId}`
      };
      if (window.yonkeLocalStore) window.yonkeLocalStore.setOwner(this.ownerId);

      if (window.yonkeSupabaseClient && navigator.onLine) {
        try {
          console.log("Conectando con Supabase para descargar inventario en vivo...");
          const [partsRes, vehiclesRes, salesRes, expensesRes] = await Promise.all([
            window.yonkeSupabaseClient.from("yonke_parts").select("*"),
            window.yonkeSupabaseClient.from("yonke_vehicles").select("*"),
            window.yonkeSupabaseClient.from("yonke_sales").select("*"),
            window.yonkeSupabaseClient.from("yonke_expenses").select("*")
          ]);

          const failedQuery = [partsRes, vehiclesRes, salesRes, expensesRes].find(result => result.error);
          if (failedQuery) throw failedQuery.error;
          if ([partsRes, vehiclesRes, salesRes, expensesRes].some(result => !Array.isArray(result.data))) {
            throw new Error("Supabase devolvió datos inválidos.");
          }

          if (partsRes.data.length || vehiclesRes.data.length || salesRes.data.length || expensesRes.data.length) {
            this.parts = partsRes.data.map(p => ({
              id: p.id,
              vehiculo_origen: p.vehiculo_origen || p["MODELO"] || "Sin vehículo",
              anio: p.anio || p["AÑO"] || "",
              pieza: p.pieza || p["PIEZA"] || "Pieza sin nombre",
              estado: p.estado || p["ESTADO"] || "En existencia",
              precio_base: Number(p.precio_base !== undefined ? p.precio_base : p["PRECIO (BASE)"]) || 0,
              precio_minimo: Number(p.precio_minimo !== undefined ? p.precio_minimo : p["PRECIO (MINIMO)"]) || 0,
              cantidad: p.cantidad !== undefined ? p.cantidad : (p["CANTIDAD"] !== undefined ? p["CANTIDAD"] : 1),
              costo_mercancia_unitario: p.costo_mercancia_unitario !== undefined && p.costo_mercancia_unitario !== null && p.costo_mercancia_unitario !== "" ? Number(p.costo_mercancia_unitario) : null,
              venta_final: p.venta_final !== undefined ? p.venta_final : p["VENTA FINAL"],
              fecha_venta: p.fecha_venta || p["FECHA VENTA"] || p["FECHA DE VENTA"] || null,
              observacion: p.observacion || p["OBSERVACION"] || "",
              compatibilidad: p.compatibilidad || p["COMPATIBILIDAD (OTROS)"] || "",
              demanda: p.demanda || p["DEMANDA"] || "",
              busquedas_info: p.busquedas_info || p["BUSQUEDAS_INFO"] || "",
              fotos: Array.isArray(p.fotos) ? p.fotos : []
            }));
    
            this.vehicles = !vehiclesRes.error && Array.isArray(vehiclesRes.data)
              ? vehiclesRes.data.map(vehicle => ({
                ...vehicle,
                fotos: Array.isArray(vehicle.fotos) ? vehicle.fotos : []
              }))
              : [];
            this.sales = !salesRes.error && Array.isArray(salesRes.data) ? salesRes.data : [];
            this.expenses = !expensesRes.error && Array.isArray(expensesRes.data) ? expensesRes.data : [];
            cloudLoaded = true;
          }
          
        } catch (cloudErr) {
          console.warn("No se pudo conectar a la nube en el arranque, usando respaldo local:", cloudErr);
        }
      }

      // 2. RESPALDO LOCAL: Si no cargó de la nube (por falta de internet o primera vez sin red), usa localStorage / IndexedDB
      if (!cloudLoaded) {
        const cachedParts = localStorage.getItem(this.storageKeys.parts);
        const cachedVehicles = localStorage.getItem(this.storageKeys.vehicles);
        const cachedSales = localStorage.getItem(this.storageKeys.sales);
        const cachedExpenses = localStorage.getItem(this.storageKeys.expenses);

        if (cachedParts && cachedVehicles) {
          this.parts = JSON.parse(cachedParts);
          this.vehicles = JSON.parse(cachedVehicles);
          this.sales = cachedSales ? JSON.parse(cachedSales) : [];
          this.expenses = cachedExpenses ? JSON.parse(cachedExpenses) : [];
        } else {
          this.vehicles = Array.isArray(INITIAL_VEHICLES) ? [...INITIAL_VEHICLES] : [];
          this.parts = Array.isArray(INITIAL_PARTS) ? [...INITIAL_PARTS] : [];
          this.expenses = Array.isArray(INITIAL_EXPENSES) ? [...INITIAL_EXPENSES] : [];
          this.sales = [];
          this.persist();
        }
      }

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

      const stampIfMissing = (arr) => {
        (arr || []).forEach((item) => {
          if (item && !item.updated_at) this.stampRecord(item);
        });
      };
      stampIfMissing(this.parts);
      stampIfMissing(this.vehicles);
      stampIfMissing(this.sales);
      stampIfMissing(this.expenses);
      if (this.ownerId !== "offline") {
        [this.parts, this.vehicles, this.sales, this.expenses].forEach(records => {
          records.forEach(record => { record.owner_id = this.ownerId; });
        });
      }
      this.persist();

      this.initialized = true;
      if (window.yonkeSync && typeof window.yonkeSync.start === "function") {
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
      if (!this.storageKeys) return;
      localStorage.setItem(this.storageKeys.parts, JSON.stringify(this.parts));
      localStorage.setItem(this.storageKeys.vehicles, JSON.stringify(this.vehicles));
      localStorage.setItem(this.storageKeys.sales, JSON.stringify(this.sales));
      localStorage.setItem(this.storageKeys.expenses, JSON.stringify(this.expenses));
      if (window.yonkeLocalStore) {
        window.yonkeLocalStore.saveSnapshot(this);
      }
    } catch (e) {
      console.warn("Advertencia de almacenamiento local:", e);
    }
  }

  stampRecord(record) {
    if (!record) return record;
    if (this.ownerId && this.ownerId !== "offline") record.owner_id = this.ownerId;
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
      fotos: Array.isArray(vehicleData.fotos) ? vehicleData.fotos : [],
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
    return this.parts.find(p => String(p.id) === String(id));
  }

  updatePart(id, updatedFields) {
    const index = this.parts.findIndex(p => String(p.id) === String(id));
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
      costo_mercancia_unitario: partData.costo_mercancia_unitario !== undefined && partData.costo_mercancia_unitario !== null && partData.costo_mercancia_unitario !== "" ? Number(partData.costo_mercancia_unitario) : null,
      venta_final: partData.venta_final !== null && partData.venta_final !== undefined && partData.venta_final !== "" ? Number(partData.venta_final) : null,
      fecha_venta: partData.fecha_venta || null,
      observacion: partData.observacion || "",
      compatibilidad: partData.compatibilidad || "",
      demanda: partData.demanda || "",
      busquedas_info: partData.busquedas_info || "",
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
      costo_mercancia: Number.isFinite(Number(part.costo_mercancia_unitario)) && part.costo_mercancia_unitario !== null ? Number(part.costo_mercancia_unitario) : null,
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
      sale.garantia_fecha = dateFormatted;
      sale.garantia_hora = timeFormatted;
      sale.garantia_motivo = reason;
      sale.garantia_tipo = returnType;
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

    const normalizeSaleDate = value => {
      if (!value) return "";
      const text = String(value).trim();
      const serial = Number(text);
      if (/^\d{5}(?:\.\d+)?$/.test(text) && serial > 30000 && serial < 60000) {
        return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
      }
      const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
      const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
    };
    const recordedPartKeys = new Set(this.sales
      .filter(s => Number(s.monto_cobrado) > 0 && s.pieza_id !== null && s.pieza_id !== undefined)
      .map(s => `${s.pieza_id}|${normalizeSaleDate(s.fecha || s.fecha_venta)}`));
    const recordedPartIds = new Set(this.sales
      .filter(s => Number(s.monto_cobrado) > 0 && s.pieza_id !== null && s.pieza_id !== undefined)
      .map(s => String(s.pieza_id)));
    this.parts.forEach(part => {
      const ventaFinal = Number(part.venta_final) || 0;
      const partId = String(part.id);
      const date = normalizeSaleDate(part.fecha_venta);
      if (ventaFinal <= 0 || (date
        ? recordedPartKeys.has(`${partId}|${date}`) || recordedPartKeys.has(`${partId}|`)
        : recordedPartIds.has(partId))) return;
      totalVendido += ventaFinal;
      totalCajaA_ingresos += ventaFinal * 0.8;
      totalCajaB_ingresos += ventaFinal * 0.2;
    });

    // Los pagos de moto y las compras de vehículos se cargan a Caja A.
    let totalGastosCajaB = 0;
    let pagadoMoto = 0;
    let totalMotoPagado = 0;
    let sueldosRetirados = 0;
    let otrosGastos = 0;
    const currentMonth = new Date().toISOString().slice(0, 7);

    this.expenses.forEach(e => {
      const monto = Number(e.monto) || 0;
      const isMoto = e.categoria === "moto" || (e.concepto || "").toLowerCase().includes("moto");
      if (isMoto) {
        totalMotoPagado += monto;
        if ((e.fecha || "").startsWith(currentMonth)) pagadoMoto += monto;
      } else {
        totalGastosCajaB += monto;
      }
      if (!isMoto && (e.categoria === "sueldo" || (e.concepto || "").toLowerCase().includes("sueldo"))) {
        sueldosRetirados += monto;
      } else if (!isMoto) {
        otrosGastos += monto;
      }
    });

    const comprasVehiculos = this.vehicles.reduce((total, vehicle) => total + (Number(vehicle.costo) || 0), 0);
    const saldoCajaA = Number((totalCajaA_ingresos - comprasVehiculos - totalMotoPagado).toFixed(2));
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
        saldoDisponible: saldoCajaA,
        comprasVehiculos: Number(comprasVehiculos.toFixed(2)),
        pagadoMoto: Number(totalMotoPagado.toFixed(2)),
        pagoMotoMes: Number(pagadoMoto.toFixed(2)),
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

  getBusinessFinanceSummary() {
    const normalizeDate = value => {
      if (!value) return "";
      const text = String(value).trim();
      const serial = Number(text);
      if (/^\d{5}(?:\.\d+)?$/.test(text) && serial > 30000 && serial < 60000) {
        return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
      }
      const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
      const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
    };
    const partsById = new Map(this.parts.map(part => [String(part.id), part]));
    const recordedKeys = new Set(this.sales
      .filter(sale => Number(sale.monto_cobrado) > 0 && sale.pieza_id !== null && sale.pieza_id !== undefined)
      .map(sale => `${sale.pieza_id}|${normalizeDate(sale.fecha || sale.fecha_venta)}`));
    const recordedPartIds = new Set(this.sales
      .filter(sale => Number(sale.monto_cobrado) > 0 && sale.pieza_id !== null && sale.pieza_id !== undefined)
      .map(sale => String(sale.pieza_id)));
    const transactions = this.sales
      .filter(sale => Number(sale.monto_cobrado) > 0 && sale.tipo !== "garantia")
      .map(sale => ({ sale, part: partsById.get(String(sale.pieza_id)) }));
    this.parts.forEach(part => {
      const date = normalizeDate(part.fecha_venta);
      if ((Number(part.venta_final) || 0) <= 0 || (date
        ? recordedKeys.has(`${part.id}|${date}`) || recordedKeys.has(`${part.id}|`)
        : recordedPartIds.has(String(part.id)))) return;
      transactions.push({
        sale: { monto_cobrado: Number(part.venta_final), fecha: date, pieza_id: part.id },
        part
      });
    });

    let cogsAssignedSales = 0;
    let cogsAssignedRevenue = 0;
    let costOfGoodsSold = 0;
    transactions.forEach(({ sale, part }) => {
      const saleCost = sale.costo_mercancia;
      const partCost = part && part.costo_mercancia_unitario;
      const cost = saleCost !== null && saleCost !== undefined && saleCost !== "" && Number.isFinite(Number(saleCost))
        ? Number(saleCost)
        : partCost !== null && partCost !== undefined && partCost !== "" && Number.isFinite(Number(partCost))
          ? Number(partCost)
          : null;
      if (cost === null || cost < 0) return;
      cogsAssignedSales++;
      cogsAssignedRevenue += Number(sale.monto_cobrado) || 0;
      costOfGoodsSold += cost;
    });

    const vehicleAcquisitions = this.vehicles.reduce((sum, vehicle) => sum + (Number(vehicle.costo) || 0), 0);
    const recordedExpenses = this.expenses.reduce((sum, expense) => sum + (Number(expense.monto) || 0), 0);
    const motoPayments = this.expenses.filter(expense =>
      expense.categoria === "moto" || (expense.concepto || "").toLowerCase().includes("moto")
    );
    const actualMotoPaid = motoPayments.reduce((sum, expense) => sum + (Number(expense.monto) || 0), 0);
    const activityDates = [
      ...transactions.map(({ sale, part }) => normalizeDate(sale.fecha || sale.fecha_venta || (part && part.fecha_venta))),
      ...this.expenses.map(expense => normalizeDate(expense.fecha)),
      ...this.vehicles.map(vehicle => normalizeDate(vehicle.fecha_ingreso))
    ].filter(Boolean).sort();
    const firstActivityDate = activityDates[0] || "";
    const lastActivityDate = activityDates[activityDates.length - 1] || "";
    const now = new Date();
    const firstActivityMonth = firstActivityDate.slice(0, 7);
    const monthCount = firstActivityMonth
      ? Math.max(0, (now.getFullYear() * 12 + now.getMonth()) - (Number(firstActivityMonth.slice(0, 4)) * 12 + Number(firstActivityMonth.slice(5, 7)) - 1) + 1)
      : 0;
    const assumedMotoTotal = Math.max(0, monthCount * 2066 - actualMotoPaid);
    const actualReportedSales = this.sales.reduce((sum, sale) => sum + (Number(sale.monto_cobrado) || 0), 0);
    const legacyInventorySales = transactions.reduce((sum, { sale }) => sum + (Number(sale.monto_cobrado) || 0), 0)
      - this.sales.filter(sale => Number(sale.monto_cobrado) > 0 && sale.tipo !== "garantia")
        .reduce((sum, sale) => sum + (Number(sale.monto_cobrado) || 0), 0);

    return {
      revenue: Number((actualReportedSales + legacyInventorySales).toFixed(2)),
      saleCount: transactions.length,
      ledgerSalesCount: this.sales.filter(sale => Number(sale.monto_cobrado) > 0 && sale.tipo !== "garantia").length,
      inventoryOnlySalesCount: Math.max(0, transactions.length - this.sales.filter(sale => Number(sale.monto_cobrado) > 0 && sale.tipo !== "garantia").length),
      legacyInventorySaleCount: Math.max(0, transactions.length - this.sales.filter(sale => Number(sale.monto_cobrado) > 0 && sale.tipo !== "garantia").length),
      costOfGoodsSold: Number(costOfGoodsSold.toFixed(2)),
      cogsAssignedSales,
      cogsAssignedRevenue: Number(cogsAssignedRevenue.toFixed(2)),
      cogsMissingSales: Math.max(0, transactions.length - cogsAssignedSales),
      vehicleAcquisitions: Number(vehicleAcquisitions.toFixed(2)),
      vehiclesWithRecordedCost: this.vehicles.filter(vehicle => Number(vehicle.costo) > 0).length,
      vehicleCount: this.vehicles.length,
      inventoryDonorCount: new Set(this.parts.map(part => String(part.vehiculo_origen || "").trim()).filter(Boolean)).size,
      recordedExpenses: Number(recordedExpenses.toFixed(2)),
      actualMotoPaid: Number(actualMotoPaid.toFixed(2)),
      assumedMotoTotal: Number(assumedMotoTotal.toFixed(2)),
      assumedMotoMonths: monthCount,
      firstActivityDate,
      lastActivityDate,
      partialMovementDifference: Number((actualReportedSales + legacyInventorySales - vehicleAcquisitions - recordedExpenses - assumedMotoTotal).toFixed(2))
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
        totalVendidoAuto += Number(p.venta_final) || 0;
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
    if (this.storageKeys) {
      Object.values(this.storageKeys).forEach(key => localStorage.removeItem(key));
    }
    return this.init();
  }
}

// Exportar instancia global
window.yonkeDB = new YonkeDB();
