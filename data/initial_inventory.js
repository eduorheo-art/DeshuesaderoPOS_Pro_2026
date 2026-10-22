// initial_inventory.js - Versión optimizada, comprimida y alineada con los nombres de columnas de Supabase y tus CSV

// Esquema de índices comprimidos correspondientes exactamente a las columnas de tu base de datos:
// [0:id, 1:MODELO, 2:AÑO, 3:PIEZA, 4:ESTADO, 5:PRECIO (BASE), 6:PRECIO (MINIMO), 7:CANTIDAD, 8:VENTA FINAL, 9:FECHA DE VENTA, 10:OBSERVACION, 11:COMPATIBILIDAD (OTROS)]
const _COMPRESSED_PARTS = [
  // Puedes agregar aquí tus respaldos comprimidos respetando este orden estricto de columnas:
  // ["P-F150-004", "F-150 1988", "1987 - 1991", "Defensa trasera", "En existencia", 3000, 2500, 1, null, null, "", "Ford Bronco 1987-1991"]
];

function _decompressParts(arr) {
  return arr.map(p => ({
    id: p[0],
    vehiculo_origen: p[1],         // Mapeado con MODELO
    anio: p[2],                    // Mapeado con AÑO
    pieza: p[3],                   // Mapeado con PIEZA
    estado: p[4],                  // Mapeado con ESTADO
    precio_base: p[5],             // Mapeado con PRECIO (BASE)
    precio_minimo: p[6],           // Mapeado con PRECIO (MINIMO)
    cantidad: p[7],                // Mapeado con CANTIDAD
    venta_final: p[8],             // Mapeado con VENTA FINAL
    fecha_venta: p[9],             // Mapeado con FECHA DE VENTA
    observacion: p[10],            // Mapeado con OBSERVACION
    compatibilidad: p[11],         // Mapeado con COMPATIBILIDAD (OTROS)
    fotos: []
  }));
}

const INITIAL_VEHICLES = [];
const INITIAL_PARTS = _decompressParts(_COMPRESSED_PARTS);

// Plantillas de despiece optimizadas para el valuador in-situ
const TEMPLATES_DESPIECE = {
  "SUV_PICKUP": [
    ["Motor completo 3/4 o 7/8", 18000, "critica"],
    ["Transmisión automática o estándar", 12000, "critica"],
    ["Transfer / Diferencial 4x4", 7500, "alta"],
    ["Computadora de motor (PCM)", 3500, "alta"],
    ["Alternador OEM", 1800, "media"],
    ["Marcha", 1200, "media"],
    ["Cofre", 2500, "alta"],
    ["Faro delantero izquierdo", 1500, "media"],
    ["Faro delantero derecho", 1500, "media"],
    ["Salpicadera izquierda", 1600, "media"],
    ["Salpicadera derecha", 1600, "media"],
    ["Puerta delantera izquierda", 2800, "alta"],
    ["Puerta delantera derecha", 2800, "alta"],
    ["Puerta trasera izquierda", 2500, "alta"],
    ["Puerta trasera derecha", 2500, "alta"],
    ["Cajuela / Portón trasero", 3500, "alta"],
    ["Calavera trasera izquierda", 1200, "media"],
    ["Calavera trasera derecha", 1200, "media"],
    ["Juego de rines originales (4)", 6000, "alta"],
    ["Módulo ABS", 2200, "media"],
    ["Cremallera de dirección", 2800, "media"],
    ["Bomba y Booster de frenos", 2000, "media"],
    ["Radiador y motoventiladores", 2500, "media"]
  ].map(t => ({ pieza: t[0], precio_mercado: t[1], peso_relevancia: t[2] })),
  
  "SEDAN_COMPACTO": [
    ["Motor 4 cilindros 3/4", 13000, "critica"],
    ["Caja de velocidades", 7500, "critica"],
    ["Computadora (ECU)", 3000, "alta"],
    ["Cuerpo de aceleración", 1500, "media"],
    ["Alternador", 1500, "media"],
    ["Marcha", 1000, "media"],
    ["Cofre", 1800, "alta"],
    ["Facia delantera", 1500, "media"],
    ["Faro izquierdo", 1000, "media"],
    ["Faro derecho", 1000, "media"],
    ["Salpicadera izquierda", 1000, "media"],
    ["Salpicadera derecha", 1000, "media"],
    ["Puertas (juego de 4)", 8000, "alta"],
    ["Cajuela", 2000, "media"],
    ["Calaveras (par)", 1800, "media"],
    ["Juego de rines y llantas", 4500, "alta"],
    ["Suspensión delantera y puente", 3500, "alta"],
    ["Eje trasero", 2500, "media"]
  ].map(t => ({ pieza: t[0], precio_mercado: t[1], peso_relevancia: t[2] }))
};

// Historial inicial de gastos (Caja B)
const INITIAL_EXPENSES = [
];
