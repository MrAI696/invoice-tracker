/* Invoice Tracker v2 — App Logic */

const DB_NAME = 'InvoiceTrackerDB';
const DB_VERSION = 1;
let db = null;

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = e => {
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
    r.onsuccess = e => { db = e.target.result; res(db); };
    r.onerror = e => rej(e.target.error);
  });
}

const dbAll = s => new Promise((r, j) => { const t = db.transaction(s,'readonly'); const q = t.objectStore(s).getAll(); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
const dbPut = (s, i) => new Promise((r, j) => { const t = db.transaction(s,'readwrite'); const q = t.objectStore(s).put(i); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
const dbDel = (s, id) => new Promise((r, j) => { const t = db.transaction(s,'readwrite'); const q = t.objectStore(s).delete(id); q.onsuccess = () => r(); q.onerror = () => j(q.error); });
const dbClr = s => new Promise((r, j) => { const t = db.transaction(s,'readwrite'); const q = t.objectStore(s).clear(); q.onsuccess = () => r(); q.onerror = () => j(q.error); });

let suppliers = [], invoices = [], currentTab = 'entry';
let editingSupplierId = null, selectedEntryPayment = '', selectedSuppPayment = 'Cash', viewingInvoiceId = null;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = n => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : fmt(n);
const today = () => new Date().toISOString().split('T')[0];
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const payClass = m => m ? m.toLowerCase() : 'cash';
const CHEV = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#48484a"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>';

function showToast(msg) {
  const t = $('toast');
  $('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2500);
}

let confirmCb = null;
function showConfirm(title, msg, action, cb) {
  $('confirmTitle').textContent = title;
  $('confirmMsg').textContent = msg;
  $('confirmAction').textContent = action;
  confirmCb = cb;
  $('confirmAction').onclick = () => { closeModal('confirmModal'); if (confirmCb) confirmCb(); confirmCb = null; };
  openModal('confirmModal');
}

function updateStats() {
  $('navSubtitle').textContent = `${suppliers.length} supplier${suppliers.length!==1?'s':''} · ${invoices.length} invoice${invoices.length!==1?'s':''}`;
}

async function init() {
  await openDB();
  suppliers = await dbAll('suppliers');
  invoices = (await dbAll('invoices')).sort((a, b) => b.date !== a.date ? b.date.localeCompare(a.date) : (b.createdAt||'').localeCompare(a.createdAt||''));
  $('entryDate').value = today();
  switchTab('entry');
  updateStats();
  $('entryAmount').addEventListener('input', updateAddBtn);
  $('entrySupplier').addEventListener('change', onSupplierSelect);
}

// TABS
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  $('tab-' + tab).classList.add('active');
  document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
  const t = { entry:'Invoice Tracker', suppliers:'Suppliers', reports:'Reports', settings:'Settings' };
  $('navTitle').textContent = t[tab];
  if (tab === 'entry') renderEntry();
  if (tab === 'suppliers') renderSuppliers();
  if (tab === 'reports') renderReports();
  if (tab === 'settings') renderSettings();
  updateStats();
}

// ENTRY
function renderEntry() {
  const has = suppliers.length > 0;
  $('entryEmpty').classList.toggle('hidden', has);
  $('entryForm').classList.toggle('hidden', !has);
  if (has) {
    const sel = $('entrySupplier'), cur = sel.value;
    sel.innerHTML = '<option value="">Select</option>' + suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (cur) sel.value = cur;
    renderEntryPayment();
    updateAddBtn();
  }
  const recent = invoices.slice(0, 8);
  $('recentSection').classList.toggle('hidden', recent.length === 0);
  $('recentList').innerHTML = recent.map(inv => `
    <div class="inv-row" onclick="openInvoiceModal('${inv.id}')">
      <div class="inv-left">
        <div class="inv-name">${inv.supplierName}</div>
        <div class="inv-meta">${inv.date} <span class="badge ${payClass(inv.payment)}">${inv.payment}</span>${inv.note ? ' <span style="color:var(--text3)">'+inv.note+'</span>' : ''}</div>
      </div>
      <div class="inv-right"><span class="inv-amt">${fmt(inv.amount)}</span>${CHEV}</div>
    </div>`).join('');
}

function renderEntryPayment() {
  document.querySelectorAll('#entryPayment .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.method === selectedEntryPayment));
}
function selectEntryPayment(m) { selectedEntryPayment = m; renderEntryPayment(); updateAddBtn(); }
function onSupplierSelect() {
  const s = suppliers.find(x => x.id === $('entrySupplier').value);
  if (s) { selectedEntryPayment = s.defaultPayment; renderEntryPayment(); }
  updateAddBtn();
}
function updateAddBtn() { $('addInvoiceBtn').disabled = !($('entrySupplier').value && $('entryAmount').value && selectedEntryPayment); }

async function addInvoice() {
  const sup = suppliers.find(s => s.id === $('entrySupplier').value);
  if (!sup) return;
  const inv = { id: genId(), supplierId: sup.id, supplierName: sup.name, date: $('entryDate').value || today(), amount: parseFloat($('entryAmount').value), payment: selectedEntryPayment, note: $('entryNote').value.trim(), createdAt: new Date().toISOString() };
  await dbPut('invoices', inv);
  invoices.unshift(inv);
  $('entryAmount').value = ''; $('entryNote').value = '';
  updateAddBtn(); renderEntry(); updateStats();
  showToast(`${fmt(inv.amount)} SAR added`);
}

// SUPPLIERS
function renderSuppliers() {
  $('suppliersEmpty').classList.toggle('hidden', suppliers.length > 0);
  $('suppliersList').innerHTML = suppliers.length === 0 ? '' : '<div class="group-box">' + suppliers.map(s => {
    const inv = invoices.filter(i => i.supplierId === s.id);
    const tot = inv.reduce((a, i) => a + i.amount, 0);
    return `<div class="inv-row" onclick="editSupplier('${s.id}')">
      <div class="inv-left">
        <div class="inv-name">${s.name}</div>
        <div class="inv-meta"><span class="badge ${payClass(s.defaultPayment)}">${s.defaultPayment}</span>${inv.length ? ` <span>${inv.length} inv · ${fmt(tot)} SAR</span>` : ' <span>No invoices</span>'}</div>
      </div>
      <div class="inv-right">${CHEV}</div>
    </div>`;
  }).join('') + '</div>';
}

function openSupplierModal(id) {
  editingSupplierId = id || null;
  if (id) {
    const s = suppliers.find(x => x.id === id);
    $('suppNameInput').value = s.name; selectedSuppPayment = s.defaultPayment;
    $('supplierModalTitle').textContent = 'Edit Supplier';
    $('saveSuppBtn').textContent = 'Save Changes';
    $('deleteSuppBtn').classList.remove('hidden');
  } else {
    $('suppNameInput').value = ''; selectedSuppPayment = 'Cash';
    $('supplierModalTitle').textContent = 'New Supplier';
    $('saveSuppBtn').textContent = 'Add Supplier';
    $('deleteSuppBtn').classList.add('hidden');
  }
  renderSuppPayment(); openModal('supplierModal');
  setTimeout(() => $('suppNameInput').focus(), 350);
}
function editSupplier(id) { openSupplierModal(id); }
function renderSuppPayment() { document.querySelectorAll('#suppPayment .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.method === selectedSuppPayment)); }
function selectSuppPayment(m) { selectedSuppPayment = m; renderSuppPayment(); }

async function saveSupplier() {
  const name = $('suppNameInput').value.trim();
  if (!name) return;
  if (editingSupplierId) {
    const idx = suppliers.findIndex(s => s.id === editingSupplierId);
    if (idx !== -1) {
      suppliers[idx].name = name; suppliers[idx].defaultPayment = selectedSuppPayment;
      await dbPut('suppliers', suppliers[idx]);
      for (let inv of invoices) { if (inv.supplierId === editingSupplierId) { inv.supplierName = name; await dbPut('invoices', inv); } }
    }
    showToast('Supplier updated');
  } else {
    const n = { id: genId(), name, defaultPayment: selectedSuppPayment };
    suppliers.push(n); await dbPut('suppliers', n);
    showToast('Supplier added');
  }
  closeModal('supplierModal'); renderSuppliers(); renderEntry(); updateStats();
}

async function deleteSupplier() {
  if (!editingSupplierId) return;
  const s = suppliers.find(x => x.id === editingSupplierId);
  closeModal('supplierModal');
  setTimeout(() => showConfirm('Delete Supplier', `Delete "${s?.name}"? Invoices kept.`, 'Delete', async () => {
    await dbDel('suppliers', editingSupplierId);
    suppliers = suppliers.filter(x => x.id !== editingSupplierId);
    renderSuppliers(); renderEntry(); updateStats(); showToast('Supplier removed');
  }), 400);
}

// REPORTS
function renderReports() {
  const fs = $('filterSupplier'), cfs = fs.value;
  fs.innerHTML = '<option value="all">All</option>' + suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  fs.value = cfs;

  const fy = $('filterYear'), cfy = fy.value || new Date().getFullYear().toString();
  const yrs = new Set(invoices.map(i => new Date(i.date).getFullYear())); yrs.add(new Date().getFullYear());
  fy.innerHTML = '<option value="all">All</option>' + [...yrs].sort((a,b) => b-a).map(y => `<option value="${y}">${y}</option>`).join('');
  fy.value = cfy;

  const fS = fs.value, fP = $('filterPayment').value, fM = $('filterMonth').value, fY = fy.value;
  const filtered = invoices.filter(inv => {
    if (fS !== 'all' && inv.supplierId !== fS) return false;
    if (fP !== 'all' && inv.payment !== fP) return false;
    const d = new Date(inv.date);
    if (fY !== 'all' && d.getFullYear().toString() !== fY) return false;
    if (fM !== 'all' && d.getMonth().toString() !== fM) return false;
    return true;
  });

  const total = filtered.reduce((s, i) => s + i.amount, 0);
  $('statsLabel').textContent = `Total · ${filtered.length} invoice${filtered.length!==1?'s':''}`;
  $('statsAmount').textContent = fmt(total);
  $('exportExcelBtn').classList.toggle('hidden', filtered.length === 0);

  // Breakdown
  const map = {};
  filtered.forEach(inv => {
    if (!map[inv.supplierId]) map[inv.supplierId] = { name: inv.supplierName, total: 0, count: 0 };
    map[inv.supplierId].total += inv.amount; map[inv.supplierId].count++;
  });
  const st = Object.entries(map).sort((a, b) => b[1].total - a[1].total);

  const bd = $('supplierBreakdown');
  if (st.length) {
    bd.innerHTML = st.map(([_, d]) => {
      const p = total > 0 ? (d.total/total)*100 : 0;
      return `<div class="bd-row"><div class="bd-top"><span class="bd-name">${d.name}</span><span class="bd-amt">${fmt(d.total)}</span></div><div class="bd-bar"><div class="bd-fill" style="width:${p}%"></div></div><div class="bd-meta"><span>${d.count} inv</span><span>${p.toFixed(1)}%</span></div></div>`;
    }).join('');
    $('breakdownSection').classList.remove('hidden');
  } else { bd.innerHTML = ''; $('breakdownSection').classList.add('hidden'); }

  // Invoice list
  const el = $('reportInvoices');
  if (filtered.length) {
    el.innerHTML = '<div class="group-box">' + filtered.map(inv => `
      <div class="inv-row" onclick="openInvoiceModal('${inv.id}')">
        <div class="inv-left">
          <div class="inv-name">${inv.supplierName}</div>
          <div class="inv-meta">${inv.date} <span class="badge ${payClass(inv.payment)}">${inv.payment}</span>${inv.note ? ' <span style="color:var(--text3)">'+inv.note+'</span>':''}</div>
        </div>
        <div class="inv-right"><span class="inv-amt">${fmt(inv.amount)}</span>${CHEV}</div>
      </div>`).join('') + '</div>';
    $('invoicesSection').classList.remove('hidden');
  } else {
    el.innerHTML = invoices.length && !filtered.length ? '<p style="text-align:center;padding:30px;color:var(--text2)">No invoices match filters</p>' : '';
    $('invoicesSection').classList.toggle('hidden', !invoices.length && !filtered.length);
    if (invoices.length && !filtered.length) $('invoicesSection').classList.remove('hidden');
  }

  window._filtered = filtered; window._suppTotals = st; window._total = total;
}

// SETTINGS
function renderSettings() {
  $('settingSuppCount').textContent = suppliers.length;
  $('settingInvCount').textContent = invoices.length;
  $('settingTotalAmt').textContent = fmtK(invoices.reduce((s, i) => s + i.amount, 0));
  estimateStorage();
}

async function estimateStorage() {
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      const mb = (e.usage/1048576).toFixed(2), qmb = (e.quota/1048576).toFixed(0), p = ((e.usage/e.quota)*100).toFixed(1);
      $('storageUsed').textContent = `${mb} MB of ${qmb} MB`;
      $('storagePercent').textContent = `${p}%`;
      $('storageBarFill').style.width = Math.min(p, 100) + '%';
    } else {
      const kb = (new Blob([JSON.stringify({suppliers,invoices})]).size/1024).toFixed(1);
      $('storageUsed').textContent = `~${kb} KB`; $('storagePercent').textContent = '';
      $('storageBarFill').style.width = '2%';
    }
  } catch { $('storageUsed').textContent = 'Unknown'; $('storagePercent').textContent = ''; }
}

// INVOICE MODAL
function openInvoiceModal(id) {
  viewingInvoiceId = id;
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  $('invoiceDetailBody').innerHTML = `
    <div class="det"><span class="det-lbl">Supplier</span><span class="det-val">${inv.supplierName}</span></div>
    <div class="det"><span class="det-lbl">Date</span><span class="det-val">${inv.date}</span></div>
    <div class="det"><span class="det-lbl">Amount</span><span class="det-val big">${fmt(inv.amount)} SAR</span></div>
    <div class="det"><span class="det-lbl">Payment</span><span class="det-val"><span class="badge ${payClass(inv.payment)}">${inv.payment}</span></span></div>
    ${inv.note ? `<div class="det"><span class="det-lbl">Note</span><span class="det-val">${inv.note}</span></div>` : ''}`;
  openModal('invoiceModal');
}

async function deleteInvoice() {
  if (!viewingInvoiceId) return;
  const id = viewingInvoiceId;
  closeModal('invoiceModal');
  setTimeout(() => showConfirm('Delete Invoice', 'Permanently remove this invoice?', 'Delete', async () => {
    await dbDel('invoices', id);
    invoices = invoices.filter(i => i.id !== id);
    updateStats();
    if (currentTab === 'entry') renderEntry();
    if (currentTab === 'reports') renderReports();
    showToast('Invoice deleted');
  }), 400);
}

// MODALS
function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }
document.addEventListener('click', e => { if (e.target.classList.contains('modal-bg') && e.target.classList.contains('open')) e.target.classList.remove('open'); });

// EXCEL
function exportExcel() {
  const f = window._filtered||[], s = window._suppTotals||[], t = window._total||0;
  if (ExcelExport.exportFiltered(f, s, t, $('filterMonth').value, $('filterYear').value)) showToast('Excel exported');
}
function exportExcelAll() {
  if (ExcelExport.exportAll(suppliers, invoices)) showToast('Excel exported');
  else showToast('No data');
}

// CLEAR
function clearAllInvoices() {
  if (!invoices.length) return showToast('No invoices');
  showConfirm('Clear Invoices', `Delete all ${invoices.length} invoices? Suppliers kept.`, 'Clear', async () => {
    await dbClr('invoices'); invoices = []; updateStats(); renderSettings(); showToast('Invoices cleared');
  });
}
function clearAllData() {
  if (!invoices.length && !suppliers.length) return showToast('No data');
  showConfirm('Clear All Data', `Delete ${suppliers.length} suppliers and ${invoices.length} invoices?`, 'Delete All', async () => {
    await dbClr('suppliers'); await dbClr('invoices'); suppliers = []; invoices = [];
    updateStats(); renderSettings(); showToast('All data cleared');
  });
}

// BACKUP
async function exportData() {
  const d = { version: 2, exportDate: new Date().toISOString(), suppliers, invoices };
  const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b);
  a.download = `InvoiceTracker_${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  showToast('Backup saved');
}

function importData() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
  inp.onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d.suppliers || !d.invoices) return showToast('Invalid file');
      showConfirm('Restore', `Replace data with ${d.suppliers.length} suppliers, ${d.invoices.length} invoices?`, 'Restore', async () => {
        await dbClr('suppliers'); await dbClr('invoices');
        for (const s of d.suppliers) await dbPut('suppliers', s);
        for (const i of d.invoices) await dbPut('invoices', i);
        suppliers = d.suppliers;
        invoices = d.invoices.sort((a, b) => b.date !== a.date ? b.date.localeCompare(a.date) : (b.createdAt||'').localeCompare(a.createdAt||''));
        switchTab(currentTab); updateStats(); showToast(`Imported ${suppliers.length} suppliers`);
      });
    } catch { showToast('Error reading file'); }
  };
  inp.click();
}

document.addEventListener('DOMContentLoaded', init);
