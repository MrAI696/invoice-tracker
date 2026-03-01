/* Excel Export Module */
const ExcelExport = (() => {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const cols = (ws, w) => { ws['!cols'] = w.map(n => ({ wch: n })); };

  function exportFiltered(inv, suppTotals, total, fm, fy) {
    if (!inv.length) return false;
    const wb = XLSX.utils.book_new();

    // Invoices
    const rows = [['#','Date','Supplier','Amount (SAR)','Payment','Note']];
    inv.forEach((v, i) => rows.push([i+1, v.date, v.supplierName, v.amount, v.payment, v.note||'']));
    rows.push([], ['','','TOTAL', total, '', inv.length + ' invoices']);
    const ws1 = XLSX.utils.aoa_to_sheet(rows); cols(ws1, [5,12,24,16,16,28]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Invoices');

    // By Supplier
    if (suppTotals.length) {
      const sr = [['Supplier','Total (SAR)','Count','%']];
      suppTotals.forEach(([_, d]) => sr.push([d.name, d.total, d.count, total > 0 ? ((d.total/total)*100).toFixed(1)+'%' : '0%']));
      sr.push([], ['TOTAL', total, inv.length, '100%']);
      const ws2 = XLSX.utils.aoa_to_sheet(sr); cols(ws2, [24,18,14,12]);
      XLSX.utils.book_append_sheet(wb, ws2, 'By Supplier');
    }

    // By Payment
    const pm = {};
    inv.forEach(v => { if (!pm[v.payment]) pm[v.payment] = { t: 0, c: 0 }; pm[v.payment].t += v.amount; pm[v.payment].c++; });
    const pr = [['Payment','Total (SAR)','Count']];
    Object.entries(pm).sort((a,b) => b[1].t - a[1].t).forEach(([m, d]) => pr.push([m, d.t, d.c]));
    const ws3 = XLSX.utils.aoa_to_sheet(pr); cols(ws3, [18,18,14]);
    XLSX.utils.book_append_sheet(wb, ws3, 'By Payment');

    const ms = fm !== 'all' ? MONTHS[parseInt(fm)] : 'All';
    XLSX.writeFile(wb, `Invoices_${fy !== 'all' ? fy : 'All'}_${ms}.xlsx`);
    return true;
  }

  function exportAll(suppliers, invoices) {
    if (!invoices.length && !suppliers.length) return false;
    const wb = XLSX.utils.book_new();
    const total = invoices.reduce((s, i) => s + i.amount, 0);

    const rows = [['#','Date','Supplier','Amount (SAR)','Payment','Note']];
    invoices.forEach((v, i) => rows.push([i+1, v.date, v.supplierName, v.amount, v.payment, v.note||'']));
    rows.push([], ['','','TOTAL', total, '', invoices.length + ' invoices']);
    const ws1 = XLSX.utils.aoa_to_sheet(rows); cols(ws1, [5,12,24,16,16,28]);
    XLSX.utils.book_append_sheet(wb, ws1, 'All Invoices');

    const map = {};
    invoices.forEach(v => { if (!map[v.supplierId]) map[v.supplierId] = { name: v.supplierName, t: 0, c: 0 }; map[v.supplierId].t += v.amount; map[v.supplierId].c++; });
    const st = Object.entries(map).sort((a,b) => b[1].t - a[1].t);
    if (st.length) {
      const sr = [['Supplier','Total (SAR)','Count','%']];
      st.forEach(([_, d]) => sr.push([d.name, d.t, d.c, total > 0 ? ((d.t/total)*100).toFixed(1)+'%' : '0%']));
      const ws2 = XLSX.utils.aoa_to_sheet(sr); cols(ws2, [24,18,14,12]);
      XLSX.utils.book_append_sheet(wb, ws2, 'By Supplier');
    }

    const sr2 = [['Name','Default Payment','Invoices','Total (SAR)']];
    suppliers.forEach(s => { const d = map[s.id] || { c: 0, t: 0 }; sr2.push([s.name, s.defaultPayment, d.c, d.t]); });
    const ws4 = XLSX.utils.aoa_to_sheet(sr2); cols(ws4, [24,16,14,18]);
    XLSX.utils.book_append_sheet(wb, ws4, 'Suppliers');

    XLSX.writeFile(wb, `InvoiceTracker_Full_${new Date().toISOString().split('T')[0]}.xlsx`);
    return true;
  }

  return { exportFiltered, exportAll };
})();
