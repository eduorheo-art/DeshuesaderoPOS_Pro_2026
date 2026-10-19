/* excel_import.worker.js - SheetJS en Web Worker, soporte multi-hoja, exclusión de "Proyecciones y Ventas Reales", sin traslapes y con preservación de acentos y ñ */
importScripts("https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js");

function cleanString(val) {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/^\uFEFF/, "")
    .normalize("NFC")
    .replace(/\u00A0/g, " ")
    .trim();
}

function normalizeKey(val) {
  return cleanString(val)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseFecha(val) {
  if (val === null || val === undefined) return null;

  if (typeof val === "string") {
    const s = val.trim();
    if (!s || s === "-" || s.toLowerCase() === "null") return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
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
          return `${String(p.y).padStart(4, '0')}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
        }
      } catch (_) {}
    }
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
  }

  return null;
}

function parsePrice(val) {
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

function parseVentaFinal(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    if (isNaN(val) || val <= 0) return null;
    return Math.round(val * 100) / 100;
  }
  const str = String(val).trim();
  if (!str || str === "-" || str === "0" || str.toLowerCase() === "null" || str === "$ -") return null;

  const p = parsePrice(val);
  return p > 0 ? p : null;
}

function parseEstado(rawEstado, ventaFinal, rawCantidad) {
  const s = cleanString(rawEstado);
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

function parseCantidad(rawCantidad, estado, ventaFinal) {
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

function isExcludedSheet(sheetName) {
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

function isSummaryOrInvalidRow(cols, colIdx) {
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

self.onmessage = function (event) {
  try {
    const { buffer } = event.data;
    const data = new Uint8Array(buffer);
    const workbook = XLSX.read(data, {
      type: "array",
      codepage: 65001,
      cellDates: false,
      raw: true
    });

    const allSheetNames = workbook.SheetNames || [];
    const validSheets = allSheetNames.filter(name => !isExcludedSheet(name));

    if (!validSheets.length) {
      self.postMessage({ type: "error", message: "No se encontraron hojas de inventario válidas (se excluyó 'Proyecciones y Ventas Reales')." });
      return;
    }

    const mapped = [];
    let totalProcessed = 0;

    for (let sIdx = 0; sIdx < validSheets.length; sIdx++) {
      const sheetName = validSheets[sIdx];
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      const sheetRows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: true,
        blankrows: false
      });

      if (!sheetRows || sheetRows.length < 2) continue;

      let headerRowIndex = -1;
      let colIdx = null;

      for (let r = 0; r < Math.min(10, sheetRows.length); r++) {
        const rowCandidate = (sheetRows[r] || []).map(c => normalizeKey(c));
        const hasPieza = rowCandidate.some(h => h.includes("PIEZA") || h.includes("PRODUCTO") || h.includes("REFACCION") || h.includes("DESCRIPCION"));
        const hasModelo = rowCandidate.some(h => h.includes("MODELO") || h.includes("VEHICULO") || h.includes("AUTO"));
        const hasPrecio = rowCandidate.some(h => h.includes("PRECIO") || h.includes("BASE") || h.includes("MINIMO"));
        const hasEstado = rowCandidate.some(h => h.includes("ESTADO") || h.includes("ESTATUS"));

        if (hasPieza || (hasModelo && hasPrecio) || (hasPieza && hasEstado)) {
          headerRowIndex = r;
          const hRow = rowCandidate;
          const findCol = (keywords) => hRow.findIndex(h => keywords.some(k => h.includes(k)));

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

      if (headerRowIndex === -1 || !colIdx || colIdx.pieza === -1) continue;

      let currentVehicleInSheet = "";
      const fallbackVehicle = sheetName.replace(/^[0-9_.\-\s]+/, "").trim();

      for (let r = headerRowIndex + 1; r < sheetRows.length; r++) {
        const cols = sheetRows[r];
        if (!cols || cols.length === 0) continue;
        if (isSummaryOrInvalidRow(cols, colIdx)) continue;

        const pieza = cleanString(cols[colIdx.pieza]);
        if (!pieza) continue;

        const cellModelo = colIdx.modelo !== -1 ? cleanString(cols[colIdx.modelo]) : "";
        if (cellModelo && !isSummaryOrInvalidRow([cellModelo], { pieza: 0, modelo: 0 })) {
          currentVehicleInSheet = cellModelo;
        }
        const modelo = currentVehicleInSheet || fallbackVehicle || "Vehículo General";

        const id = colIdx.id !== -1 ? cleanString(cols[colIdx.id]) : "";
        const anio = colIdx.anio !== -1 ? cleanString(cols[colIdx.anio]) : "";
        const observacion = colIdx.observacion !== -1 ? cleanString(cols[colIdx.observacion]) : "";
        const compatibilidad = colIdx.compatibilidad !== -1 ? cleanString(cols[colIdx.compatibilidad]) : "";
        const fechaVenta = colIdx.fecha_venta !== -1 ? parseFecha(cols[colIdx.fecha_venta]) : null;

        const precioBase = colIdx.precio_base !== -1 ? parsePrice(cols[colIdx.precio_base]) : 0;
        const precioMinimo = colIdx.precio_minimo !== -1 ? parsePrice(cols[colIdx.precio_minimo]) : 0;
        const rawVentaFinal = colIdx.venta_final !== -1 ? cols[colIdx.venta_final] : "";
        const ventaFinal = parseVentaFinal(rawVentaFinal);

        const rawEstado = colIdx.estado !== -1 ? cols[colIdx.estado] : "";
        const rawCantidad = colIdx.cantidad !== -1 ? cols[colIdx.cantidad] : "";
        const estado = parseEstado(rawEstado, ventaFinal, rawCantidad);
        const cantidad = parseCantidad(rawCantidad, estado, ventaFinal);

        totalProcessed++;

        mapped.push({
          id: id || (`P-IMP-${Date.now().toString(36).toUpperCase()}-${totalProcessed}`),
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
          compatibilidad: compatibilidad
        });
      }

      self.postMessage({
        type: "progress",
        sheet: sheetName,
        current: sIdx + 1,
        total: validSheets.length,
        percent: Math.round(((sIdx + 1) / validSheets.length) * 100)
      });
    }

    self.postMessage({ type: "done", rows: mapped, sheetsCount: validSheets.length });
  } catch (err) {
    self.postMessage({ type: "error", message: err.message || "Error al leer el Excel" });
  }
};
