// ghost_parts.js - Registro y Venta de Piezas fuera de Inventario vinculadas a vehículo

class GhostPartsManager {
  constructor() {}

  init() {
    this.populateVehicleOptions();
    this.attachEvents();
  }

  populateVehicleOptions() {
    const select = document.getElementById("ghost-vehicle-select");
    if (!select) return;

    const vehicles = window.yonkeDB.getVehicles();
    let options = `<option value="">-- Selecciona el auto de donde salió --</option>`;
    vehicles.forEach(v => {
      options += `<option value="${v.modelo}">${v.modelo}</option>`;
    });
    options += `<option value="NUEVO_VEHICULO">➕ Escribir otro vehículo...</option>`;
    options += `<option value="Suelto / Sin auto">Pieza suelta / Donador desconocido</option>`;

    select.innerHTML = options;
  }

  attachEvents() {
    const select = document.getElementById("ghost-vehicle-select");
    const customVehicleContainer = document.getElementById("ghost-custom-vehicle-container");

    if (select && customVehicleContainer) {
      select.addEventListener("change", (e) => {
        if (e.target.value === "NUEVO_VEHICULO") {
          customVehicleContainer.classList.remove("hidden");
        } else {
          customVehicleContainer.classList.add("hidden");
        }
      });
    }

    const form = document.getElementById("ghost-part-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitGhostSale();
      });
    }
  }

  openModal() {
    this.populateVehicleOptions();
    const modal = document.getElementById("ghost-part-modal");
    if (modal) {
      modal.classList.remove("hidden");
      const nameInput = document.getElementById("ghost-part-name");
      if (nameInput) nameInput.focus();
    }
  }

  closeModal() {
    const modal = document.getElementById("ghost-part-modal");
    if (modal) {
      modal.classList.add("hidden");
      const form = document.getElementById("ghost-part-form");
      if (form) form.reset();
      const customVehicleContainer = document.getElementById("ghost-custom-vehicle-container");
      if (customVehicleContainer) customVehicleContainer.classList.add("hidden");
    }
  }

  submitGhostSale() {
    const nameInput = document.getElementById("ghost-part-name");
    const selectVehicle = document.getElementById("ghost-vehicle-select");
    const customVehicleInput = document.getElementById("ghost-custom-vehicle");
    const priceInput = document.getElementById("ghost-part-price");
    const compatInput = document.getElementById("ghost-part-compat");
    const notesInput = document.getElementById("ghost-part-notes");

    const pieceName = nameInput.value.trim();
    if (!pieceName) {
      alert("Por favor ingresa el nombre de la pieza.");
      return;
    }

    let vehicleName = selectVehicle.value;
    if (vehicleName === "NUEVO_VEHICULO") {
      vehicleName = customVehicleInput.value.trim();
      if (!vehicleName) {
        alert("Por favor escribe el nombre del vehículo.");
        return;
      }
    } else if (!vehicleName) {
      vehicleName = "Pieza suelta";
    }

    const price = parseFloat(priceInput.value);
    if (isNaN(price) || price <= 0) {
      alert("Por favor ingresa un monto válido cobrado.");
      return;
    }

    try {
      const result = window.yonkeDB.processGhostPartSale({
        pieza: pieceName,
        vehiculo_origen: vehicleName,
        monto: price,
        compatibilidad: compatInput ? compatInput.value.trim() : "",
        observacion: notesInput ? notesInput.value.trim() : "Venta rápida de mostrador"
      });

      this.closeModal();

      // Refrescar vistas
      if (window.salesManager) window.salesManager.renderPartsGrid();
      if (window.financesManager) window.financesManager.updateUI();
      if (window.dashboardManager) window.dashboardManager.updateUI();

      // Notificación exitosa
      window.salesManager.showSaleSuccessModal(result.sale, result.part);
    } catch (err) {
      alert("Error al registrar pieza fuera de inventario: " + err.message);
    }
  }
}

window.ghostPartsManager = new GhostPartsManager();
