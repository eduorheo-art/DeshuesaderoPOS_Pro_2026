// excel_sync.js - Sincronización Inteligente de Excel / CSV sin traslapes, soporte multi-hoja y caracteres especiales (ñ, acentos)

class ExcelSyncManager {
  constructor() {
    this.isImporting = false;
  }

  init() {
    this.attachEvents();
  }

  attachEvents() {
    const importInput = document.getElementById("excel-file-input");
    if (importInput) {
      importInput.addEventListener("change", (e) => {
        this.handleExcelImport(e);
      });
    }

    const exportBtn = document.getElementById("excel-export-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        this.exportToCSV();
      });
    }
  }

  // --- EXPORTAR A CSV (Con BOM UTF-8 y codificación exacta) ---
  exportToCSV() {
    const parts = window.yonkeDB.getParts();
    if (!parts || parts.length === 0) {
      alert("No hay piezas en inventario para exportar.");
      return;
    }

    const headers = [
      "MODELO", "AÑO", "PIEZA", "FECHA DE VENTA", "OBSERVACION",
      "ESTADO", "PRECIO (BASE)", "PRECIO (MINIMO)", "CANTIDAD", "VENTA FINAL", "COMPATIBILIDAD (OTROS)"
    ];

    let csvContent = "\uFEFF" + headers.join(",") + "\n";

    parts.forEach(p => {
      const row = [
        `"${(p.vehiculo_origen || '').replace(/"/g, '""')}"`,
        `"${(p.anio || '').replace(/"/g, '""')}"`,
        `"${(p.pieza || '').replace(/"/g, '""')}"`,
        `"${p.fecha_venta || ''}"`,
        `"${(p.observacion || '').replace(/"/g, '""')}"`,
        `"${p.estado || ''}"`,
        p.precio_base || 0,
        p.precio_minimo || 0,
        p.cantidad !== undefined ? p.cantidad : 1,
        p.venta_final || '',
        `"${(p.compatibilidad || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `Inventario_Yonke_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // --- UTILIDADES DE LIMPIEZA Y FORMATEO ---
  cleanString(val) {
    if (val === null || val === undefined) return "";
    return String(val)
      .replace(/^\uFEFF/, "")
      .normalize("NFC")
      .replace(/\u00A0/g, " ")
      .trim();
  }

  normalizeKey(val) {
    return this.cleanString(val)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  parseFecha(val) {
    if (val === null || val === undefined) return null;

    if (typeof val === "string") {
      const s = val.trim();
      if (!s || s === "-" || s.toLowerCase() === "null") return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) {
        const dd = dmy[1].padStart(2, '0');
        const mm = dmy[2].padStart(2, '0');
        const yyyy = dmy[3];
        return `${yyyy}-${mm}-${dd}`;
      }
      if (/^\d{5}$/.test(s)) {
        val = Number(s);
      } else {
        const parsedDate = new Date(s);
        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1990 && parsedDate.getFullYear() < 2100) {
          return parsedDate.toISOString().split("T")[0];
        }
        return s;
      }
    }

    if (val instanceof Date && !isNaN(val.getTime())) {
      const yyyy = val.getFullYear();
      const mm = String(val.getMonth() + 1).padStart(2, '0');
      const dd = String(val.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    if (typeof val === "number" && !isNaN(val) && val > 30000 && val < 60000) {
      if (typeof XLSX !== "undefined" && XLSX.SSF && typeof XLSX.SSF.parse_date_code === "function") {
        try {
          const p = XLSX.SSF.parse_date_code(val);
          if (p && p.y && p.m && p.d) {
            const yyyy = String(p.y).padStart(4, '0');
            const mm = String(p.m).padStart(2, '0');
            const dd = String(p.d).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          }
        } catch (_) {}
      }
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }

    return null;
  }

  parsePrice(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") {
      return isNaN(val) ? 0 : Math.round(val * 100) / 100;
    }
    const str = String(val).trim();
    if (!str || str === "-" || str.toLowerCase() === "null" || str === "$ -") return 0;

    let clean = str.replace(/[$€\s]/g, "");
    if (!clean) return 0;

    const lastComma = clean.lastIndexOf(",");
    const lastDot = clean.lastIndexOf(".");

    if (lastComma > lastDot) {
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else {
      clean = clean.replace(/,/g, "");
    }

    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  }

  parseVentaFinal(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === "number") {
      if (isNaN(val) || val <= 0) return null;
      return Math.round(val * 100) / 100;
    }
    const str = String(val).trim();
    if (!str || str === "-" || str === "0" || str.toLowerCase() === "null" || str === "$ -") return null;

    const p = this.parsePrice(val);
    return p > 0 ? p : null;
  }

  parseEstado(rawEstado, ventaFinal, rawCantidad) {
    const s = this.cleanString(rawEstado);
    const lower = s.toLowerCase();

    if (lower.includes("existencia") || lower === "disponible" || lower === "activo") {
      return "En existencia";
    }
    if (lower.includes("vendid") || lower === "sold") {
      return "VENDIDO";
    }
    if (lower.includes("dañad") || lower.includes("garant") || lower.includes("falla")) {
      return "DAÑADA / GARANTÍA";
    }
    if (lower.includes("apartad")) {
      return "Apartado";
    }

    if (s) return s;

    if (ventaFinal !== null && ventaFinal > 0) {
      return "VENDIDO";
    }
    const qty = parseInt(String(rawCantidad).replace(/[^0-9-]/g, ""), 10);
    if (!isNaN(qty) && qty <= 0 && rawCantidad !== "" && rawCantidad !== null && rawCantidad !== undefined) {
      return "VENDIDO";
    }

    return "En existencia";
  }

  parseCantidad(rawCantidad, estado, ventaFinal) {
    if (rawCantidad !== null && rawCantidad !== undefined && String(rawCantidad).trim() !== "") {
      if (typeof rawCantidad === "number") {
        return Math.max(0, parseInt(rawCantidad, 10) || 0);
      }
      const clean = String(rawCantidad).replace(/[^0-9-]/g, "");
      if (clean) {
        const parsed = parseInt(clean, 10);
        if (!isNaN(parsed)) return Math.max(0, parsed);
      }
    }

    if (estado === "VENDIDO" || (ventaFinal !== null && ventaFinal > 0)) {
      return 0;
    }
    return 1;
  }

  isExcludedSheet(sheetName) {
    if (!sheetName) return true;
    const norm = sheetName
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");

    if (norm === "proyecciones y ventas reales" || norm === "proyeccion y ventas reales") {
      return true;
    }
    if (norm.includes("proyeccion") && (norm.includes("venta") || norm.includes("real"))) {
      return true;
    }
    return false;
  }

  isSummaryOrInvalidRow(cols, colIdx) {
    if (!cols || cols.length === 0) return true;

    const piezaVal = colIdx.pieza !== -1 ? String(cols[colIdx.pieza] || "").trim() : "";
    const modeloVal = colIdx.modelo !== -1 ? String(cols[colIdx.modelo] || "").trim() : "";

    if (!piezaVal) return true;

    const cleanPieza = piezaVal
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[:*#\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const cleanModelo = modeloVal
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[:*#\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const summaryKeywords = [
      "RETORNO DE INVERSION",
      "RETORNO DE LA INVERSION",
      "RETORNO INVERSION",
      "GANANCIA",
      "GANANCIAS",
      "GANANCIA TOTAL",
      "COSTO",
      "COSTO TOTAL",
      "COSTOS",
      "TOTAL",
      "TOTAL GENERAL",
      "TOTALES",
      "SUBTOTAL",
      "SUB-TOTAL",
      "UTILIDAD",
      "UTILIDADES",
      "UTILIDAD NETA",
      "UTILIDAD BRUTA",
      "MARGEN",
      "MARGENES",
      "RESUMEN",
      "RESUMEN FINANCIERO",
      "PROYECCION",
      "PROYECCIONES",
      "ROI"
    ];

    for (const kw of summaryKeywords) {
      if (cleanPieza === kw || cleanPieza.startsWith(kw + " ") || cleanPieza.endsWith(" " + kw)) {
        return true;
      }
      if (cleanModelo === kw || cleanModelo.startsWith(kw + " ")) {
        return true;
      }
    }

    if (cleanPieza === "PIEZA" || cleanPieza === "DESCRIPCION" || cleanPieza === "PRODUCTO") {
      return true;
    }

    return false;
  }

  showProgress(text, percent) {
    const overlay = document.getElementById("excel-import-progress-overlay");
    const progressText = document.getElementById("excel-import-progress-text");
    const bar = document.getElementById("excel-import-progress-bar");
    const percentEl = document.getElementById("excel-import-progress-percent");

    if (overlay) overlay.classList.remove("hidden");
    if (progressText && text) progressText.textContent = text;
    if (bar) bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (percentEl) percentEl.textContent = `${Math.round(percent)}%`;
  }

  hideProgress() {
    const overlay = document.getElementById("excel-import-progress-overlay");
    if (overlay) overlay.classList.add("hidden");
  }

  async handleExcelImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (this.isImporting) {
      alert("Ya hay una importación en curso. Por favor espera.");
      return;
    }

    this.isImporting = true;
    const startTime = performance.now();
    this.showProgress(`Abriendo archivo: ${file.name}...`, 5);

    try {
      const buffer = await file.arrayBuffer();
      if (typeof XLSX === "undefined") {
        throw new Error("La librería SheetJS (XLSX) no está cargada.");
      }

      const data = new Uint8Array(buffer);
      const workbook = XLSX.read(data, {
        type: "array",
        codepage: 65001,
        cellDates: false,
        raw: true
      });

      const allSheetNames = workbook.SheetNames || [];
      const validSheets = allSheetNames.filter(name => !this.isExcludedSheet(name));

      if (validSheets.length === 0) {
        throw new Error("No se encontraron hojas de inventario válidas en el archivo (se excluyó 'Proyecciones y Ventas Reales').");
      }

      this.showProgress(`Leyendo ${validSheets.length} hojas de inventario...`, 15);

      // Limpiar preventivamente cualquier fila de resumen residual previa en la base de datos local
      if (window.yonkeDB && Array.isArray(window.yonkeDB.parts)) {
        window.yonkeDB.parts = window.yonkeDB.parts.filter(p => {
          if (!p || !p.pieza) return false;
          const c = String(p.pieza).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[:*#\-]/g, " ").trim();
          const bad = ["RETORNO DE INVERSION", "GANANCIA", "COSTO", "COSTO TOTAL", "TOTAL", "TOTAL GENERAL", "SUBTOTAL", "UTILIDAD", "MARGEN", "ROI", "RESUMEN"];
          return !bad.some(k => c === k || c.startsWith(k + " ") || c.endsWith(" " + k));
        });
      }

      // Estructura de indexación de piezas existentes para sincronización inteligente (sin traslapes)
      const existingParts = window.yonkeDB.getParts();
      const partsMapById = new Map();
      const partsMapByKey = new Map();

      existingParts.forEach(p => {
        if (p.id) partsMapById.set(p.id, p);
        const key = `${this.normalizeKey(p.vehiculo_origen)}:::${this.normalizeKey(p.pieza)}`;
        if (!partsMapByKey.has(key)) {
          partsMapByKey.set(key, []);
        }
        partsMapByKey.get(key).push(p);
      });

      let itemsNuevos = 0;
      let itemsModificados = 0;
      let itemsOmitidos = 0;
      let totalFilasProcesadas = 0;

      // Iterar hoja por hoja de manera independiente (evita traslapes entre pestañas)
      for (let sIdx = 0; sIdx < validSheets.length; sIdx++) {
        const sheetName = validSheets[sIdx];
        const percent = 20 + Math.round((sIdx / validSheets.length) * 70);
        this.showProgress(`Procesando hoja (${sIdx + 1}/${validSheets.length}): ${sheetName}...`, percent);

        await new Promise(r => setTimeout(r, 10));

        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;

        const sheetRows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
          raw: true,
          blankrows: false
        });

        if (!sheetRows || sheetRows.length < 2) continue;

        // Detectar fila de encabezados en las primeras 10 filas de esta hoja
        let headerRowIndex = -1;
        let colIdx = null;

        for (let r = 0; r < Math.min(10, sheetRows.length); r++) {
          const rowCandidate = (sheetRows[r] || []).map(c => this.normalizeKey(c));
          const hasPieza = rowCandidate.some(h => h.includes("PIEZA") || h.includes("PRODUCTO") || h.includes("REFACCION") || h.includes("DESCRIPCION"));
          const hasModelo = rowCandidate.some(h => h.includes("MODELO") || h.includes("VEHICULO") || h.includes("AUTO"));
          const hasPrecio = rowCandidate.some(h => h.includes("PRECIO") || h.includes("BASE") || h.includes("MINIMO"));
          const hasEstado = rowCandidate.some(h => h.includes("ESTADO") || h.includes("ESTATUS"));

          if (hasPieza || (hasModelo && hasPrecio) || (hasPieza && hasEstado)) {
            headerRowIndex = r;
            const hRow = rowCandidate;

            const findCol = (keywords) => {
              return hRow.findIndex(h => keywords.some(k => {
                if (k.length <= 2) return h === k || h.startsWith(k + " ") || h.endsWith(" " + k);
                return h.includes(k);
              }));
            };

            colIdx = {
              id: findCol(["ID", "CODIGO"]),
              modelo: findCol(["MODELO", "VEHICULO", "AUTO"]),
              anio: findCol(["ANO", "ANIO", "YEAR"]),
              pieza: findCol(["PIEZA", "PRODUCTO", "REFACCION", "DESCRIPCION"]),
              fecha_venta: findCol(["FECHA DE VENTA", "FECHA VENTA", "FECHA_VENTA"]),
              observacion: findCol(["OBSERVACION", "DETALLE", "NOTA", "NOTAS", "FALLA"]),
              estado: findCol(["ESTADO", "ESTATUS", "STATUS"]),
              precio_base: findCol(["PRECIO (BASE)", "PRECIO BASE", "P. BASE", "BASE"]),
              precio_minimo: findCol(["PRECIO (MINIMO)", "PRECIO (MINIMO)", "PRECIO MINIMO", "P. MINIMO", "MINIMO"]),
              cantidad: findCol(["CANTIDAD", "STOCK", "EXISTENCIA", "EXISTENCIAS", "CANT"]),
              venta_final: findCol(["VENTA FINAL", "VENTA_FINAL", "FINAL"]),
              compatibilidad: findCol(["COMPATIBILIDAD", "OTROS"])
            };

            if (colIdx.precio_base === -1) {
              colIdx.precio_base = hRow.findIndex((h, idx) => h.includes("PRECIO") && idx !== colIdx.precio_minimo && idx !== colIdx.venta_final);
            }

            break;
          }
        }

        if (headerRowIndex === -1 || !colIdx || colIdx.pieza === -1) {
          console.warn(`No se encontró columna de piezas válida en la hoja "${sheetName}". Se omite.`);
          continue;
        }

        // Contexto de vehículo específico para ESTA hoja (no se filtra entre hojas)
        let currentVehicleInSheet = "";
        const fallbackVehicleFromSheet = sheetName.replace(/^[0-9_.\-\s]+/, "").trim();

        for (let r = headerRowIndex + 1; r < sheetRows.length; r++) {
          const cols = sheetRows[r];
          if (!cols || cols.length === 0) continue;

          // Descartar filas de totales o resúmenes financieros
          if (this.isSummaryOrInvalidRow(cols, colIdx)) {
            continue;
          }

          const pieza = this.cleanString(cols[colIdx.pieza]);
          if (!pieza) continue;

          // Obtener modelo respetando caracteres especiales (ñ, acentos)
          const cellModelo = colIdx.modelo !== -1 ? this.cleanString(cols[colIdx.modelo]) : "";
          if (cellModelo && !this.isSummaryOrInvalidRow([cellModelo], { pieza: 0, modelo: 0 })) {
            currentVehicleInSheet = cellModelo;
          }
          const modelo = currentVehicleInSheet || fallbackVehicleFromSheet || "Vehículo General";

          const id = colIdx.id !== -1 ? this.cleanString(cols[colIdx.id]) : "";
          const anio = colIdx.anio !== -1 ? this.cleanString(cols[colIdx.anio]) : "";
          const observacion = colIdx.observacion !== -1 ? this.cleanString(cols[colIdx.observacion]) : "";
          const compatibilidad = colIdx.compatibilidad !== -1 ? this.cleanString(cols[colIdx.compatibilidad]) : "";
          const fechaVenta = colIdx.fecha_venta !== -1 ? this.parseFecha(cols[colIdx.fecha_venta]) : null;

          const precioBase = colIdx.precio_base !== -1 ? this.parsePrice(cols[colIdx.precio_base]) : 0;
          const precioMinimo = colIdx.precio_minimo !== -1 ? this.parsePrice(cols[colIdx.precio_minimo]) : 0;
          const rawVentaFinal = colIdx.venta_final !== -1 ? cols[colIdx.venta_final] : "";
          const ventaFinal = this.parseVentaFinal(rawVentaFinal);

          const rawEstado = colIdx.estado !== -1 ? cols[colIdx.estado] : "";
          const rawCantidad = colIdx.cantidad !== -1 ? cols[colIdx.cantidad] : "";
          const estado = this.parseEstado(rawEstado, ventaFinal, rawCantidad);
          const cantidad = this.parseCantidad(rawCantidad, estado, ventaFinal);

          totalFilasProcesadas++;

          // Auto-registrar vehículo si no existe
          if (window.yonkeDB && typeof window.yonkeDB.getVehicles === "function") {
            const vehicles = window.yonkeDB.getVehicles();
            const existsVeh = vehicles.some(v => this.normalizeKey(v.modelo) === this.normalizeKey(modelo));
            if (!existsVeh && modelo && modelo !== "Vehículo General" && modelo !== "Suelto") {
              window.yonkeDB.addVehicle({
                modelo: modelo,
                anio: anio || "",
                costo: 0,
                fecha_ingreso: new Date().toISOString().split("T")[0]
              });
            }
          }

          // Búsqueda inteligente de pieza existente sin colisiones ni traslapes
          let existing = null;
          if (id) {
            existing = partsMapById.get(id);
          }
          if (!existing) {
            const searchKey = `${this.normalizeKey(modelo)}:::${this.normalizeKey(pieza)}`;
            const candidates = partsMapByKey.get(searchKey);
            if (candidates && candidates.length > 0) {
              existing = candidates.shift();
            }
          }

          if (!existing) {
            const newPartId = id || (`P-IMP-${Date.now().toString(36).toUpperCase()}-${totalFilasProcesadas}`);
            const newPart = {
              id: newPartId,
              vehiculo_origen: modelo,
              anio: anio,
              pieza: pieza,
              estado: estado,
              precio_base: precioBase,
              precio_minimo: precioMinimo,
              cantidad: cantidad,
              venta_final: ventaFinal,
              fecha_venta: fechaVenta,
              observacion: observacion,
              compatibilidad: compatibilidad,
              fotos: []
            };
            window.yonkeDB.addPart(newPart);
            partsMapById.set(newPartId, newPart);
            itemsNuevos++;
          } else {
            const hasChanged =
              existing.precio_base !== precioBase ||
              existing.precio_minimo !== precioMinimo ||
              existing.cantidad !== cantidad ||
              existing.estado !== estado ||
              existing.compatibilidad !== compatibilidad ||
              existing.observacion !== observacion ||
              existing.fecha_venta !== fechaVenta ||
              (ventaFinal !== null && existing.venta_final !== ventaFinal);

            if (hasChanged) {
              window.yonkeDB.updatePart(existing.id, {
                vehiculo_origen: modelo,
                anio: anio || existing.anio,
                pieza: pieza,
                estado: estado,
                precio_base: precioBase,
                precio_minimo: precioMinimo,
                cantidad: cantidad,
                compatibilidad: compatibilidad,
                observacion: observacion,
                fecha_venta: fechaVenta !== null ? fechaVenta : existing.fecha_venta,
                venta_final: ventaFinal !== null ? ventaFinal : existing.venta_final
              });
              itemsModificados++;
            } else {
              itemsOmitidos++;
            }
          }
        }
      }

      this.showProgress("Guardando cambios y actualizando vistas...", 95);
      await new Promise(r => setTimeout(r, 20));

      // Guardar base de datos
      if (window.yonkeDB && typeof window.yonkeDB.persist === "function") {
        window.yonkeDB.persist();
      }

      // Actualizar todas las vistas
      if (window.salesManager && typeof window.salesManager.renderPartsGrid === "function") {
        window.salesManager.renderPartsGrid();
      }
      if (window.dashboardManager && typeof window.dashboardManager.updateUI === "function") {
        window.dashboardManager.updateUI();
      }
      if (window.financesManager && typeof window.financesManager.updateUI === "function") {
        window.financesManager.updateUI();
      }
      if (window.appManager && typeof window.appManager.renderInventoryTable === "function") {
        window.appManager.renderInventoryTable();
      }

      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      this.hideProgress();

      alert(
        `⚡ SINCRONIZACIÓN INTELIGENTE DE INVENTARIO FINALIZADA EN ${duration} SEGUNDOS\n\n` +
        `🟢 ${itemsNuevos} piezas nuevas ingresadas\n` +
        `🟡 ${itemsModificados} piezas actualizadas\n` +
        `⚪ ${itemsOmitidos} piezas sin cambios\n\n` +
        `📁 Hojas procesadas: ${validSheets.length} (Hoja 'Proyecciones y Ventas Reales' y filas financieras excluidas)`
      );

    } catch (err) {
      console.error("Error importando inventario:", err);
      this.hideProgress();
      alert("Error al importar inventario: " + (err.message || err));
    } finally {
      this.isImporting = false;
      event.target.value = "";
    }
  }
}

window.excelSyncManager = new ExcelSyncManager();