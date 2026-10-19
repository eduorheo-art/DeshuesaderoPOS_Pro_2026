// finances.js - Módulo independiente de Finanzas, Cajas (A y B), Sueldo y Gastos

class FinancesManager {
  constructor() {}

  init() {
    this.updateUI();
    this.attachEvents();
  }

  attachEvents() {
    const expenseForm = document.getElementById("expense-form");
    if (expenseForm) {
      expenseForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submitExpense();
      });
    }

    // Botón rápido para registrar mensualidad de moto
    const motoQuickBtn = document.getElementById("quick-pay-moto-btn");
    if (motoQuickBtn) {
      motoQuickBtn.addEventListener("click", () => {
        this.quickPayMoto();
      });
    }

    // Botón rápido para retirar sueldo
    const salaryQuickBtn = document.getElementById("quick-pay-salary-btn");
    if (salaryQuickBtn) {
      salaryQuickBtn.addEventListener("click", () => {
        this.quickPaySalary();
      });
    }
  }

  updateUI() {
    const data = window.yonkeDB.getFinancesSummary();
    if (!data) return;

    // Métricas Generales
    const totalSalesEl = document.getElementById("finance-total-sales");
    if (totalSalesEl) totalSalesEl.textContent = `$${data.totalVendido.toLocaleString()}`;

    // Caja A (80%)
    const cajaATotalEl = document.getElementById("finance-caja-a-total");
    if (cajaATotalEl) cajaATotalEl.textContent = `$${data.cajaA.saldoDisponible.toLocaleString()}`;

    // Caja B (20%)
    const cajaBTotalEl = document.getElementById("finance-caja-b-bruto");
    if (cajaBTotalEl) cajaBTotalEl.textContent = `$${data.cajaB.ingresosTotales.toLocaleString()}`;

    const cajaBNetoEl = document.getElementById("finance-caja-b-neto");
    if (cajaBNetoEl) cajaBNetoEl.textContent = `$${data.cajaB.saldoNeto.toLocaleString()}`;

    const cajaBGastosEl = document.getElementById("finance-caja-b-gastos");
    if (cajaBGastosEl) cajaBGastosEl.textContent = `$${data.cajaB.totalGastado.toLocaleString()}`;

    // Sueldo Inteligente (Topado a $3,000)
    const salarySuggestedEl = document.getElementById("finance-salary-suggested");
    if (salarySuggestedEl) salarySuggestedEl.textContent = `$${data.cajaB.sueldoDisponible.toLocaleString()}`;

    const salaryReservaEl = document.getElementById("finance-salary-reserva");
    if (salaryReservaEl) salaryReservaEl.textContent = `$${data.cajaB.colchonReserva.toLocaleString()}`;

    // Tracking Moto Coppel ($2,066)
    const motoPagadoEl = document.getElementById("finance-moto-pagado");
    const motoProgressEl = document.getElementById("finance-moto-progress-bar");
    const motoStatusEl = document.getElementById("finance-moto-status");

    if (motoPagadoEl) motoPagadoEl.textContent = `$${data.cajaB.pagadoMoto.toLocaleString()} / $2,066`;
    if (motoProgressEl) {
      const pct = Math.min(100, Math.round((data.cajaB.pagadoMoto / 2066) * 100));
      motoProgressEl.style.width = `${pct}%`;
      if (pct >= 100) {
        motoProgressEl.className = "h-3 rounded-full bg-emerald-500 transition-all duration-500";
      } else {
        motoProgressEl.className = "h-3 rounded-full bg-amber-500 transition-all duration-500";
      }
    }
    if (motoStatusEl) {
      if (data.cajaB.motoCubierta) {
        motoStatusEl.innerHTML = `<span class="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">✅ Mensualidad Cubierta</span>`;
      } else {
        const falta = 2066 - data.cajaB.pagadoMoto;
        motoStatusEl.innerHTML = `<span class="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">⏳ Falta: $${falta.toLocaleString()}</span>`;
      }
    }

    // Tabla de Historial de Gastos
    this.renderExpensesTable(data.gastos);

    // Tabla de Historial de Ventas Recientes
    this.renderSalesHistoryTable(data.ventas);
  }

  renderExpensesTable(expenses) {
    const tbody = document.getElementById("expenses-table-body");
    if (!tbody) return;

    if (!expenses || expenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-400 text-sm">No hay gastos registrados</td></tr>`;
      return;
    }

    let rowsHtml = "";
    expenses.forEach(e => {
      let badge = `<span class="px-2 py-0.5 text-xs font-semibold rounded bg-gray-100 text-gray-700">General</span>`;
      if (e.categoria === "moto") {
        badge = `<span class="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800">🛵 Moto</span>`;
      } else if (e.categoria === "sueldo") {
        badge = `<span class="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">👤 Sueldo</span>`;
      } else if (e.categoria === "gasolina") {
        badge = `<span class="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800">⛽ Gasolina</span>`;
      } else if (e.categoria === "comida") {
        badge = `<span class="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">🍔 Comida</span>`;
      }

      rowsHtml += `
        <tr class="border-b border-gray-100 hover:bg-gray-50 text-sm">
          <td class="py-2.5 px-3 text-gray-500 font-mono text-xs">${e.fecha}</td>
          <td class="py-2.5 px-3 text-gray-900 font-medium">${e.concepto}</td>
          <td class="py-2.5 px-3">${badge}</td>
          <td class="py-2.5 px-3 text-right font-black text-rose-600">-$${Number(e.monto).toLocaleString()}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  }

  renderSalesHistoryTable(sales) {
    const tbody = document.getElementById("finances-sales-table-body");
    if (!tbody) return;

    if (!sales || sales.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-400 text-sm">No hay ventas registradas</td></tr>`;
      return;
    }

    let rowsHtml = "";
    // Mostrar las últimas 25 ventas
    sales.slice(0, 30).forEach(s => {
      const isRefund = Number(s.monto_cobrado) < 0;
      rowsHtml += `
        <tr class="border-b border-gray-100 hover:bg-gray-50 text-xs ${isRefund ? 'bg-rose-50/40 text-rose-900' : ''}">
          <td class="py-2.5 px-3 text-gray-500 font-mono">${s.fecha}</td>
          <td class="py-2.5 px-3 font-bold ${isRefund ? 'text-rose-700' : 'text-gray-900'}">
            ${isRefund ? '🔄 ' : ''}${s.pieza_nombre}
          </td>
          <td class="py-2.5 px-3 text-blue-700 font-medium">${s.vehiculo_origen}</td>
          <td class="py-2.5 px-3 text-right font-black ${isRefund ? 'text-rose-600' : 'text-gray-900'}">
            ${isRefund ? `-$${Math.abs(s.monto_cobrado).toLocaleString()}` : `$${Number(s.monto_cobrado).toLocaleString()}`}
          </td>
          <td class="py-2.5 px-3 text-right font-bold ${isRefund ? 'text-rose-700 bg-rose-50' : 'text-blue-700 bg-blue-50/50'}">
            ${isRefund ? `-$${Math.abs(s.caja_a).toLocaleString()}` : `$${Number(s.caja_a).toLocaleString()}`}
          </td>
          <td class="py-2.5 px-3 text-right font-bold ${isRefund ? 'text-rose-700 bg-rose-50' : 'text-emerald-700 bg-emerald-50/50'}">
            ${isRefund ? `-$${Math.abs(s.caja_b).toLocaleString()}` : `$${Number(s.caja_b).toLocaleString()}`}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  }

  submitExpense() {
    const dateInput = document.getElementById("expense-date");
    const conceptInput = document.getElementById("expense-concept");
    const categorySelect = document.getElementById("expense-category");
    const amountInput = document.getElementById("expense-amount");
    const notesInput = document.getElementById("expense-notes");

    const concepto = conceptInput.value.trim();
    const monto = parseFloat(amountInput.value);

    if (!concepto) {
      alert("Por favor escribe el concepto del gasto.");
      return;
    }
    if (isNaN(monto) || monto <= 0) {
      alert("Por favor introduce un monto de gasto válido.");
      return;
    }

    window.yonkeDB.addExpense({
      fecha: dateInput ? dateInput.value : new Date().toISOString().split("T")[0],
      concepto: concepto,
      categoria: categorySelect ? categorySelect.value : "general",
      monto: monto,
      nota: notesInput ? notesInput.value.trim() : ""
    });

    // Limpiar formulario y refrescar
    if (conceptInput) conceptInput.value = "";
    if (amountInput) amountInput.value = "";
    if (notesInput) notesInput.value = "";

    this.updateUI();
    alert(`✅ Gasto de $${monto.toLocaleString()} registrado y descontado de Caja B.`);
  }

  quickPayMoto() {
    const confirmPay = confirm("¿Registrar el pago mensual de la moto por $2,066.00 descontado de Caja B?");
    if (!confirmPay) return;

    window.yonkeDB.addExpense({
      fecha: new Date().toISOString().split("T")[0],
      concepto: "Mensualidad Moto Coppel",
      categoria: "moto",
      monto: 2066,
      nota: "Pago de mensualidad de moto de trabajo"
    });

    this.updateUI();
    alert("🛵 Mensualidad de moto registrada exitosamente!");
  }

  quickPaySalary() {
    const data = window.yonkeDB.getFinancesSummary();
    const available = data.cajaB.sueldoDisponible;

    if (available <= 0) {
      alert("Actualmente no hay saldo disponible en Caja B para retirar sueldo.");
      return;
    }

    const withdraw = prompt(
      `Retiro de Sueldo (Tope máximo semanal: $3,000):\nSaldo disponible para sueldo: $${available.toLocaleString()}\n\n¿Cuánto deseas retirar?`,
      available
    );

    if (!withdraw) return;
    const amount = parseFloat(withdraw);
    if (isNaN(amount) || amount <= 0 || amount > available) {
      alert("Monto inválido o superior al disponible.");
      return;
    }

    window.yonkeDB.addExpense({
      fecha: new Date().toISOString().split("T")[0],
      concepto: "Retiro de Sueldo Operador",
      categoria: "sueldo",
      monto: amount,
      nota: `Corte de sueldo personal (Topado a $3,000)`
    });

    this.updateUI();
    alert(`👤 Retiro de sueldo por $${amount.toLocaleString()} registrado con éxito.`);
  }
}

window.financesManager = new FinancesManager();
