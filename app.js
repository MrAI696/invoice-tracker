/* ============================================
   Invoice Tracker v2 — App Logic
   IndexedDB + Settings + Enhanced UX
   ============================================ */

// ===== INLINE SVG CONSTANTS =====
const SVG = {
  chevron: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(234,234,240,0.28)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
};

// ===== DATABASE =====
const DB_NAME = 'InvoiceTrackerDB';
const DB_VERSION = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('suppliers')) {
        const s = d.createObjectStore('suppliers', { keyPath: 'id' });
        s.createIndex('name', 'name', { unique: false });
      }
      if (!d.objectStoreNames.contains('invoices')) {
        const i = d.createObjectStore('invoices', { keyPath: 'id' });
        i.createIndex('supplierId', 'supplierId', { unique: false });
        i.createIndex('date', 'date', { unique: false });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbGetAll(store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(store, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(store, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function dbClear(store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ===== STATE =====
let suppliers = [];
let invoices = [];
let currentTab = 'entry';
let editingSupplierId = null;
let selectedEntryPayment = '';
let selectedSuppPayment = 'Cash';
let viewingInvoiceId = null;

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ===== HELPERS =====
function fmt(n) {
  return Number(n).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return fmt(n);
}

function today() { return new Date().toISOString().split('T')[0]; }

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function payClass(method) { return method ? method.toLowerCase() : 'cash'; }

function $(id) { return document.getElementById(id); }

function showToast(msg, type = 'success') {
  const t = $('toast');
  t.className = 'toast';
  if (type === 'warn') t.classList.add('toast-warn');
  if (type === 'error') t.classList.add('toast-error');

  const ico = $('toastIcon');
  if (type === 'success') ico.innerHTML = '&#10003;';
  else if (type === 'warn') ico.innerHTML = '&#9888;';
  else ico.innerHTML = '&#10007;';

  t.querySelector('.toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ===== CONFIRM DIALOG =====
let confirmCallback = null;

function showConfirm(title, msg, actionText, callback) {
  $('confirmTitle').textContent = title;
  $('confirmMsg').textContent = msg;
  $('confirmAction').textContent = actionText;
  confirmCallback = callback;
  $('confirmAction').onclick = () => {
    closeModal('confirmModal');
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  };
  openModal('confirmModal');
}

// ===== INIT =====
async function init() {
  await openDB();
  suppliers = await dbGetAll('suppliers');
  invoices = (await dbGetAll('invoices')).sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  $('entryDate').value = today();
  switchTab('entry');
  updateStats();

  $('entryAmount').addEventListener('input', updateAddBtn);
  $('entrySupplier').addEventListener('change', onSupplierSelect);
}

function updateStats() {
  $('navSubtitle').textContent = `${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''} · ${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`;
}

// ===== TABS =====
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
  $('tab-' + tab).classList.add('active');
  document.querySelector(`.tab-item[data-tab="${tab}"]`).classList.add('active');

  const titles = { entry: 'Invoice Tracker', suppliers: 'Suppliers', reports: 'Reports', settings: 'Settings' };
  $('navTitle').textContent = titles[tab];

  if (tab === 'entry') renderEntry();
  if (tab === 'suppliers') renderSuppliers();
  if (tab === 'reports') renderReports();
  if (tab === 'settings') renderSettings();
  updateStats();
}

// ===== ENTRY TAB =====
function renderEntry() {
  const hasSup = suppliers.length > 0;
  $('entryEmpty').classList.toggle('hidden', hasSup);
  $('entryForm').classList.toggle('hidden', !hasSup);

  if (hasSup) {
    const sel = $('entrySupplier');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Select supplier</option>' +
      suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (cur) sel.value = cur;
    renderEntryPayment();
    updateAddBtn();
  }

  const recent = invoices.slice(0, 8);
  $('recentSection').classList.toggle('hidden', recent.length === 0);
  $('recentList').innerHTML = recent.map(inv => `
    <div class="list-row" onclick="openInvoiceModal('${inv.id}')">
      <div class="row-left">
        <div class="row-label">${inv.supplierName}</div>
        <div class="row-detail">
          ${inv.date}
          <span class="pay-badge ${payClass(inv.payment)}">${inv.payment}</span>
          ${inv.note ? '<span style="color:var(--text-tertiary)">' + inv.note + '</span>' : ''}
        </div>
      </div>
      <div class="row-right">
        <span class="row-amount">${fmt(inv.amount)}</span>
        ${SVG.chevron}
      </div>
    </div>
  `).join('');
}

function renderEntryPayment() {
  document.querySelectorAll('#entryPayment .segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === selectedEntryPayment);
  });
}

function selectEntryPayment(method) {
  selectedEntryPayment = method;
  renderEntryPayment();
  updateAddBtn();
}

function onSupplierSelect() {
  const sid = $('entrySupplier').value;
  if (sid) {
    const s = suppliers.find(x => x.id === sid);
    if (s) {
      selectedEntryPayment = s.defaultPayment;
      renderEntryPayment();
    }
  }
  updateAddBtn();
}

function updateAddBtn() {
  const ok = $('entrySupplier').value && $('entryAmount').value && selectedEntryPayment;
  $('addInvoiceBtn').disabled = !ok;
}

async function addInvoice() {
  const sid = $('entrySupplier').value;
  const supplier = suppliers.find(s => s.id === sid);
  if (!supplier) return;

  const inv = {
    id: genId(),
    supplierId: sid,
    supplierName: supplier.name,
    date: $('entryDate').value || today(),
    amount: parseFloat($('entryAmount').value),
    payment: selectedEntryPayment,
    note: $('entryNote').value.trim(),
    createdAt: new Date().toISOString()
  };

  await dbPut('invoices', inv);
  invoices.unshift(inv);
  $('entryAmount').value = '';
  $('entryNote').value = '';
  updateAddBtn();
  renderEntry();
  updateStats();
  showToast(`${fmt(inv.amount)} SAR added`);
}

// ===== SUPPLIERS TAB =====
function renderSuppliers() {
  $('suppliersEmpty').classList.toggle('hidden', suppliers.length > 0);
  $('suppliersList').innerHTML = suppliers.length === 0 ? '' :
    '<div class="card" style="margin:0 16px"><div class="list-group">' + suppliers.map(s => {
      const invs = invoices.filter(i => i.supplierId === s.id);
      const total = invs.reduce((sum, i) => sum + i.amount, 0);
      return `
        <div class="list-row" onclick="editSupplier('${s.id}')">
          <div class="row-left">
            <div class="row-label">${s.name}</div>
            <div class="row-detail">
              <span class="pay-badge ${payClass(s.defaultPayment)}">${s.defaultPayment}</span>
              ${invs.length ? `<span>${invs.length} invoices · ${fmt(total)} SAR</span>` : '<span>No invoices</span>'}
            </div>
          </div>
          <div class="row-right">
            ${SVG.chevron}
          </div>
        </div>`;
    }).join('') + '</div></div>';
}

function openSupplierModal(id) {
  editingSupplierId = id || null;
  if (id) {
    const s = suppliers.find(x => x.id === id);
    $('suppNameInput').value = s.name;
    selectedSuppPayment = s.defaultPayment;
    $('supplierModalTitle').textContent = 'Edit Supplier';
    $('saveSuppBtn').textContent = 'Save Changes';
    $('deleteSuppBtn').classList.remove('hidden');
  } else {
    $('suppNameInput').value = '';
    selectedSuppPayment = 'Cash';
    $('supplierModalTitle').textContent = 'New Supplier';
    $('saveSuppBtn').textContent = 'Add Supplier';
    $('deleteSuppBtn').classList.add('hidden');
  }
  renderSuppPayment();
  openModal('supplierModal');
  setTimeout(() => $('suppNameInput').focus(), 350);
}

function editSupplier(id) { openSupplierModal(id); }

function renderSuppPayment() {
  document.querySelectorAll('#suppPayment .segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === selectedSuppPayment);
  });
}

function selectSuppPayment(method) {
  selectedSuppPayment = method;
  renderSuppPayment();
}

async function saveSupplier() {
  const name = $('suppNameInput').value.trim();
  if (!name) return;

  if (editingSupplierId) {
    const idx = suppliers.findIndex(s => s.id === editingSupplierId);
    if (idx !== -1) {
      suppliers[idx].name = name;
      suppliers[idx].defaultPayment = selectedSuppPayment;
      await dbPut('suppliers', suppliers[idx]);
      for (let inv of invoices) {
        if (inv.supplierId === editingSupplierId) {
          inv.supplierName = name;
          await dbPut('invoices', inv);
        }
      }
    }
    showToast('Supplier updated');
  } else {
    const newS = { id: genId(), name, defaultPayment: selectedSuppPayment };
    suppliers.push(newS);
    await dbPut('suppliers', newS);
    showToast('Supplier added');
  }

  closeModal('supplierModal');
  renderSuppliers();
  renderEntry();
  updateStats();
}

async function deleteSupplier() {
  if (!editingSupplierId) return;
  const s = suppliers.find(x => x.id === editingSupplierId);
  const name = s ? s.name : 'this supplier';

  closeModal('supplierModal');
  setTimeout(() => {
    showConfirm('Delete Supplier', `Delete "${name}"? Invoices will remain in history.`, 'Delete', async () => {
      await dbDelete('suppliers', editingSupplierId);
      suppliers = suppliers.filter(s => s.id !== editingSupplierId);
      renderSuppliers();
      renderEntry();
      updateStats();
      showToast('Supplier removed', 'warn');
    });
  }, 400);
}

// ===== REPORTS TAB =====
function renderReports() {
  const fs = $('filterSupplier');
  const curFS = fs.value;
  fs.innerHTML = '<option value="all">All</option>' +
    suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  fs.value = curFS;

  const fy = $('filterYear');
  const curFY = fy.value || new Date().getFullYear().toString();
  const yrs = new Set(invoices.map(i => new Date(i.date).getFullYear()));
  yrs.add(new Date().getFullYear());
  const sorted = [...yrs].sort((a, b) => b - a);
  fy.innerHTML = '<option value="all">All</option>' + sorted.map(y => `<option value="${y}">${y}</option>`).join('');
  fy.value = curFY;

  const fSupp = $('filterSupplier').value;
  const fPay = $('filterPayment').value;
  const fMonth = $('filterMonth').value;
  const fYear = $('filterYear').value;

  const filtered = invoices.filter(inv => {
    if (fSupp !== 'all' && inv.supplierId !== fSupp) return false;
    if (fPay !== 'all' && inv.payment !== fPay) return false;
    const d = new Date(inv.date);
    if (fYear !== 'all' && d.getFullYear().toString() !== fYear) return false;
    if (fMonth !== 'all' && d.getMonth().toString() !== fMonth) return false;
    return true;
  });

  const total = filtered.reduce((s, i) => s + i.amount, 0);
  $('statsLabel').textContent = `Total · ${filtered.length} invoice${filtered.length !== 1 ? 's' : ''}`;
  $('statsAmount').textContent = fmt(total);

  $('exportExcelBtn').classList.toggle('hidden', filtered.length === 0);

  const map = {};
  filtered.forEach(inv => {
    if (!map[inv.supplierId]) map[inv.supplierId] = { name: inv.supplierName, total: 0, count: 0 };
    map[inv.supplierId].total += inv.amount;
    map[inv.supplierId].count++;
  });
  const suppTotals = Object.entries(map).sort((a, b) => b[1].total - a[1].total);

  const bdEl = $('supplierBreakdown');
  if (suppTotals.length > 0) {
    bdEl.innerHTML = suppTotals.map(([id, data]) => {
      const pct = total > 0 ? (data.total / total) * 100 : 0;
      return `
        <div class="breakdown-row">
          <div class="breakdown-top">
            <span class="breakdown-name">${data.name}</span>
            <span class="breakdown-amount">${fmt(data.total)}</span>
          </div>
          <div class="breakdown-bar"><div class="breakdown-fill" style="width:${pct}%"></div></div>
          <div class="breakdown-meta">
            <span>${data.count} invoice${data.count !== 1 ? 's' : ''}</span>
            <span>${pct.toFixed(1)}%</span>
          </div>
        </div>`;
    }).join('');
    $('breakdownSection').classList.remove('hidden');
  } else {
    bdEl.innerHTML = '';
    $('breakdownSection').classList.add('hidden');
  }

  const allEl = $('reportInvoices');
  if (filtered.length > 0) {
    allEl.innerHTML = '<div class="card" style="margin:0"><div class="list-group">' + filtered.map(inv => `
      <div class="list-row" onclick="openInvoiceModal('${inv.id}')">
        <div class="row-left">
          <div class="row-label">${inv.supplierName}</div>
          <div class="row-detail">
            ${inv.date}
            <span class="pay-badge ${payClass(inv.payment)}">${inv.payment}</span>
            ${inv.note ? '<span style="color:var(--text-tertiary)">' + inv.note + '</span>' : ''}
          </div>
        </div>
        <div class="row-right">
          <span class="row-amount">${fmt(inv.amount)}</span>
          ${SVG.chevron}
        </div>
      </div>
    `).join('') + '</div></div>';
    $('invoicesSection').classList.remove('hidden');
  } else {
    allEl.innerHTML = '';
    $('invoicesSection').classList.toggle('hidden', invoices.length === 0);
    if (invoices.length > 0 && filtered.length === 0) {
      allEl.innerHTML = '<p style="text-align:center;padding:30px;color:var(--text-secondary)">No invoices match the current filters.</p>';
      $('invoicesSection').classList.remove('hidden');
    }
  }

  window._filtered = filtered;
  window._suppTotals = suppTotals;
  window._total = total;
}

// ===== SETTINGS TAB =====
function renderSettings() {
  $('settingSuppCount').textContent = suppliers.length;
  $('settingInvCount').textContent = invoices.length;
  const total = invoices.reduce((s, i) => s + i.amount, 0);
  $('settingTotalAmt').textContent = fmtShort(total);
  estimateStorage();
}

async function estimateStorage() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const usedMB = (est.usage / (1024 * 1024)).toFixed(2);
      const quotaMB = (est.quota / (1024 * 1024)).toFixed(0);
      const pct = ((est.usage / est.quota) * 100).toFixed(1);
      $('storageUsed').textContent = `${usedMB} MB used of ${quotaMB} MB`;
      $('storagePercent').textContent = `${pct}%`;
      $('storageBarFill').style.width = `${Math.min(pct, 100)}%`;
    } else {
      const dataStr = JSON.stringify({ suppliers, invoices });
      const bytes = new Blob([dataStr]).size;
      const kb = (bytes / 1024).toFixed(1);
      $('storageUsed').textContent = `~${kb} KB in use`;
      $('storagePercent').textContent = '';
      $('storageBarFill').style.width = '2%';
    }
  } catch (e) {
    $('storageUsed').textContent = 'Unable to estimate';
    $('storagePercent').textContent = '';
  }
}

// ===== INVOICE MODAL =====
function openInvoiceModal(id) {
  viewingInvoiceId = id;
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;

  $('invoiceDetailBody').innerHTML = `
    <div class="detail-row">
      <span class="detail-label">Supplier</span>
      <span class="detail-value">${inv.supplierName}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Date</span>
      <span class="detail-value">${inv.date}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Amount</span>
      <span class="detail-value large">${fmt(inv.amount)} SAR</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Payment</span>
      <span class="detail-value"><span class="pay-badge ${payClass(inv.payment)}">${inv.payment}</span></span>
    </div>
    ${inv.note ? `<div class="detail-row"><span class="detail-label">Note</span><span class="detail-value">${inv.note}</span></div>` : ''}
  `;
  openModal('invoiceModal');
}

async function deleteInvoice() {
  if (!viewingInvoiceId) return;
  closeModal('invoiceModal');
  const id = viewingInvoiceId;

  setTimeout(() => {
    showConfirm('Delete Invoice', 'This invoice will be permanently removed.', 'Delete', async () => {
      await dbDelete('invoices', id);
      invoices = invoices.filter(i => i.id !== id);
      updateStats();
      if (currentTab === 'entry') renderEntry();
      if (currentTab === 'reports') renderReports();
      showToast('Invoice deleted', 'warn');
    });
  }, 400);
}

// ===== MODALS =====
function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop') && e.target.classList.contains('open')) {
    e.target.classList.remove('open');
  }
});

// ===== EXPORT EXCEL =====
function exportExcel() {
  const filtered = window._filtered || [];
  const suppTotals = window._suppTotals || [];
  const total = window._total || 0;
  const fm = $('filterMonth').value;
  const fy = $('filterYear').value;

  if (ExcelExport.exportFiltered(filtered, suppTotals, total, fm, fy)) {
    showToast('Excel exported');
  }
}

function exportExcelAll() {
  if (ExcelExport.exportAll(suppliers, invoices)) {
    showToast('Full Excel exported');
  } else {
    showToast('No data to export', 'warn');
  }
}

// ===== CLEAR DATA =====
function clearAllInvoices() {
  if (invoices.length === 0) { showToast('No invoices to clear', 'warn'); return; }
  showConfirm('Clear All Invoices', `This will permanently delete all ${invoices.length} invoices. Suppliers will be kept.`, 'Clear Invoices', async () => {
    await dbClear('invoices');
    invoices = [];
    updateStats();
    renderSettings();
    showToast('All invoices cleared', 'warn');
  });
}

function clearAllData() {
  if (invoices.length === 0 && suppliers.length === 0) { showToast('No data to clear', 'warn'); return; }
  showConfirm('Clear All Data', `This will permanently delete ${suppliers.length} suppliers and ${invoices.length} invoices. This cannot be undone.`, 'Delete Everything', async () => {
    await dbClear('suppliers');
    await dbClear('invoices');
    suppliers = [];
    invoices = [];
    updateStats();
    renderSettings();
    showToast('All data cleared', 'warn');
  });
}

// ===== JSON BACKUP =====
async function exportData() {
  const data = {
    version: 2,
    exportDate: new Date().toISOString(),
    suppliers: suppliers,
    invoices: invoices
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `InvoiceTracker_Backup_${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup exported');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.suppliers || !data.invoices) { showToast('Invalid backup file', 'error'); return; }

      showConfirm('Restore Backup', `This will replace all current data with ${data.suppliers.length} suppliers and ${data.invoices.length} invoices.`, 'Restore', async () => {
        await dbClear('suppliers');
        await dbClear('invoices');
        for (const s of data.suppliers) await dbPut('suppliers', s);
        for (const i of data.invoices) await dbPut('invoices', i);

        suppliers = data.suppliers;
        invoices = data.invoices.sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });

        switchTab(currentTab);
        updateStats();
        showToast(`Imported ${suppliers.length} suppliers, ${invoices.length} invoices`);
      });
    } catch (err) {
      showToast('Error reading file', 'error');
      console.error(err);
    }
  };
  input.click();
}

// ===== START =====
document.addEventListener('DOMContentLoaded', init);
