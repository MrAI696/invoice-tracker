/* ============================================
   Invoice Tracker — Excel Export Module
   Separated for easy customization
   ============================================ */

const ExcelExport = (() => {

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  /**
   * Format a number as currency string
   */
  function fmtCurrency(n) {
    return Number(n).toFixed(2);
  }

  /**
   * Apply column widths to a worksheet
   */
  function setColWidths(ws, widths) {
    ws['!cols'] = widths.map(w => ({ wch: w }));
  }

  /**
   * Build the main invoices sheet data
   * @param {Array} invoices - filtered invoice list
   * @param {number} total - pre-calculated total
   * @returns {Array} rows for XLSX
   */
  function buildInvoiceRows(invoices, total) {
    const header = ['#', 'Date', 'Supplier', 'Amount (SAR)', 'Payment Method', 'Note'];
    const rows = [header];

    invoices.forEach((inv, idx) => {
      rows.push([
        idx + 1,
        inv.date,
        inv.supplierName,
        Number(inv.amount),
        inv.payment,
        inv.note || ''
      ]);
    });

    // Blank row
    rows.push([]);
    // Totals row
    rows.push(['', '', 'TOTAL', total, '', `${invoices.length} invoice(s)`]);

    return rows;
  }

  /**
   * Build the supplier summary sheet
   * @param {Array} suppTotals - array of [id, { name, total, count }]
   * @param {number} grandTotal
   * @returns {Array} rows
   */
  function buildSummaryRows(suppTotals, grandTotal) {
    const header = ['Supplier', 'Total Amount (SAR)', 'Invoice Count', '% of Total'];
    const rows = [header];

    suppTotals.forEach(([_, data]) => {
      const pct = grandTotal > 0 ? ((data.total / grandTotal) * 100).toFixed(1) + '%' : '0%';
      rows.push([data.name, Number(data.total), data.count, pct]);
    });

    rows.push([]);
    rows.push(['GRAND TOTAL', grandTotal, suppTotals.reduce((s, [_, d]) => s + d.count, 0), '100%']);

    return rows;
  }

  /**
   * Build payment breakdown sheet
   * @param {Array} invoices
   * @returns {Array} rows
   */
  function buildPaymentRows(invoices) {
    const methods = {};
    invoices.forEach(inv => {
      if (!methods[inv.payment]) methods[inv.payment] = { total: 0, count: 0 };
      methods[inv.payment].total += inv.amount;
      methods[inv.payment].count++;
    });

    const header = ['Payment Method', 'Total Amount (SAR)', 'Invoice Count'];
    const rows = [header];

    Object.entries(methods)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([method, data]) => {
        rows.push([method, Number(data.total), data.count]);
      });

    return rows;
  }

  /**
   * Export filtered invoices to Excel
   * Called from the Reports tab export button
   */
  function exportFiltered(filtered, suppTotals, total, filterMonth, filterYear) {
    if (!filtered.length) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Invoices
    const invRows = buildInvoiceRows(filtered, total);
    const ws1 = XLSX.utils.aoa_to_sheet(invRows);
    setColWidths(ws1, [5, 12, 24, 16, 16, 28]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Invoices');

    // Sheet 2: Supplier Summary
    if (suppTotals.length) {
      const sumRows = buildSummaryRows(suppTotals, total);
      const ws2 = XLSX.utils.aoa_to_sheet(sumRows);
      setColWidths(ws2, [24, 18, 14, 12]);
      XLSX.utils.book_append_sheet(wb, ws2, 'By Supplier');
    }

    // Sheet 3: Payment Breakdown
    const payRows = buildPaymentRows(filtered);
    if (payRows.length > 1) {
      const ws3 = XLSX.utils.aoa_to_sheet(payRows);
      setColWidths(ws3, [18, 18, 14]);
      XLSX.utils.book_append_sheet(wb, ws3, 'By Payment');
    }

    // Filename
    const fm = filterMonth;
    const fy = filterYear;
    const monthStr = fm !== 'all' ? MONTHS[parseInt(fm)] : 'All';
    const yearStr = fy !== 'all' ? fy : 'AllYears';
    XLSX.writeFile(wb, `Invoices_${yearStr}_${monthStr}.xlsx`);

    return true;
  }

  /**
   * Export ALL data (used from Settings)
   * @param {Array} suppliers
   * @param {Array} invoices
   */
  function exportAll(suppliers, invoices) {
    if (!invoices.length && !suppliers.length) return false;

    const wb = XLSX.utils.book_new();

    // Sheet 1: All Invoices
    const total = invoices.reduce((s, i) => s + i.amount, 0);
    const invRows = buildInvoiceRows(invoices, total);
    const ws1 = XLSX.utils.aoa_to_sheet(invRows);
    setColWidths(ws1, [5, 12, 24, 16, 16, 28]);
    XLSX.utils.book_append_sheet(wb, ws1, 'All Invoices');

    // Sheet 2: Supplier Summary
    const map = {};
    invoices.forEach(inv => {
      if (!map[inv.supplierId]) map[inv.supplierId] = { name: inv.supplierName, total: 0, count: 0 };
      map[inv.supplierId].total += inv.amount;
      map[inv.supplierId].count++;
    });
    const suppTotals = Object.entries(map).sort((a, b) => b[1].total - a[1].total);

    if (suppTotals.length) {
      const sumRows = buildSummaryRows(suppTotals, total);
      const ws2 = XLSX.utils.aoa_to_sheet(sumRows);
      setColWidths(ws2, [24, 18, 14, 12]);
      XLSX.utils.book_append_sheet(wb, ws2, 'By Supplier');
    }

    // Sheet 3: Payment Breakdown
    const payRows = buildPaymentRows(invoices);
    if (payRows.length > 1) {
      const ws3 = XLSX.utils.aoa_to_sheet(payRows);
      setColWidths(ws3, [18, 18, 14]);
      XLSX.utils.book_append_sheet(wb, ws3, 'By Payment');
    }

    // Sheet 4: Suppliers List
    const suppHeader = ['Name', 'Default Payment', 'Total Invoices', 'Total Amount (SAR)'];
    const suppRows = [suppHeader];
    suppliers.forEach(s => {
      const data = map[s.id] || { count: 0, total: 0 };
      suppRows.push([s.name, s.defaultPayment, data.count, Number(data.total)]);
    });
    const ws4 = XLSX.utils.aoa_to_sheet(suppRows);
    setColWidths(ws4, [24, 16, 14, 18]);
    XLSX.utils.book_append_sheet(wb, ws4, 'Suppliers');

    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `InvoiceTracker_Full_${today}.xlsx`);

    return true;
  }

  // Public API
  return {
    exportFiltered,
    exportAll
  };

})();
