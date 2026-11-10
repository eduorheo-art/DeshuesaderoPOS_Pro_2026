# REGLA DE EFICIENCIA — yonke_pos (Siempre Activa)

## Protocolo Obligatorio de Lectura y Edición de Archivos

> [!IMPORTANT]
> Esta regla tiene MÁXIMA PRIORIDAD en el proyecto `yonke_pos`. Todos los agentes deben cumplirla en **cada tarea**.

### ❌ PROHIBIDO
- Leer `index.html`, `js/app.js`, `js/db.js`, `js/excel_sync.js` u otros archivos completos cuando la tarea es específica o localizada.
- Hacer escaneos generales del workspace sin una necesidad global explícita.
- Cargar bloques masivos de código solo para "orientarse".

### ✅ OBLIGATORIO: Búsqueda Quirúrgica (Scoped Search)
1. **Localizar primero:** Usa `grep` o búsqueda por palabra clave para encontrar el número de línea exacto del elemento objetivo (ID, función, método, clase).
2. **Leer solo el rango necesario:** Lee únicamente las líneas del bloque involucrado (ej: `StartLine=7112, EndLine=7171` para `renderInventoryTable()`).
3. **Editar directamente:** Aplica el parche sobre ese bloque mínimo. No reescribas archivos completos.
4. **Sin comentarios innecesarios:** No agregues comentarios de código que no aporten valor funcional.

### Referencia de Bloques Clave en index.html (actualizar si cambia)
| Elemento | Líneas aprox. |
|---|---|
| `#edit-part-modal` | 977–1046 |
| `#view-inventory` header | 891–930 |
| Script principal `<script>` | 1592+ |
| `renderInventoryTable()` en AppManager | ~7112–7171 |
| `class AppManager` | ~7028–7172 |
