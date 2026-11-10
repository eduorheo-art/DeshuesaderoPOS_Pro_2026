---
name: yonke-eficiencia
description: >-
  Protocolo de eficiencia y lectura acotada para el proyecto yonke_pos. Activa
  esta skill en cualquier tarea de edición, depuración o desarrollo dentro del
  proyecto yonke_pos. Prohíbe lecturas masivas de archivos completos y exige
  búsqueda quirúrgica (scoped search) por palabra clave o rango de líneas antes
  de leer o modificar cualquier archivo del proyecto.
---

# Skill: Eficiencia y Lectura Acotada — yonke_pos

> [!IMPORTANT]
> Esta skill tiene **MÁXIMA PRIORIDAD** en el proyecto `yonke_pos`.
> Debe aplicarse en **toda tarea** sin excepción.

## Reglas Estrictas

### ❌ PROHIBIDO
- Leer archivos completos (`index.html`, `js/app.js`, `js/db.js`, `js/excel_sync.js`, etc.) cuando la tarea es específica.
- Hacer lecturas de bloques de más de 100 líneas sin haber localizado primero el bloque objetivo con una búsqueda.
- Reescribir archivos completos — solo parches quirúrgicos (`edit_file`).
- Agregar comentarios innecesarios al código.

### ✅ Protocolo Obligatorio (en orden)

1. **Buscar primero.** Usa `run_command` con `Select-String` (PowerShell) para localizar el bloque:
   ```powershell
   Select-String -Path "c:\Users\rubio\Desktop\yonke_pos\index.html" -Pattern "renderInventoryTable" -List
   ```
2. **Leer solo el rango.** Con el número de línea encontrado, lee únicamente ±20–50 líneas alrededor del bloque.
3. **Editar con `edit_file`.** Usa `Target` exacto → `Replacement` mínimo. Nunca `Overwrite` completo.
4. **Verificar.** Lee solo las líneas modificadas para confirmar el cambio.

## Mapa de Bloques Clave (index.html)

| Elemento | Líneas aprox. |
|---|---|
| `#edit-part-modal` HTML | 977–1046 |
| `#view-inventory` (header botones) | 891–930 |
| `class AppManager` constructor | ~7028 |
| `renderInventoryTable()` | ~7112–7171 |
| `class YonkeDB` | buscar con grep |
| `ExcelSyncManager` | buscar con grep |

## Comandos de Búsqueda Rápida (PowerShell)

```powershell
# Localizar función o ID en index.html
Select-String -Path "c:\Users\rubio\Desktop\yonke_pos\index.html" -Pattern "PATRON" | Select-Object LineNumber, Line

# Localizar en todos los js/
Select-String -Path "c:\Users\rubio\Desktop\yonke_pos\js\*.js" -Pattern "PATRON" | Select-Object Path, LineNumber, Line
```
