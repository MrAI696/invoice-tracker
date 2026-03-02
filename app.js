/* متتبع الفواتير v4 — Clean App Logic */

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

const dbAll = s => new Promise((r, j) => { const t = db.transaction(s, 'readonly'); const q = t.objectStore(s).getAll(); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
const dbPut = (s, i) => new Promise((r, j) => { const t = db.transaction(s, 'readwrite'); const q = t.objectStore(s).put(i); q.onsuccess = () => r(q.result); q.onerror = () => j(q.error); });
const dbDel = (s, id) => new Promise((r, j) => { const t = db.transaction(s, 'readwrite'); const q = t.objectStore(s).delete(id); q.onsuccess = () => r(); q.onerror = () => j(q.error); });
const dbClr = s => new Promise((r, j) => { const t = db.transaction(s, 'readwrite'); const q = t.objectStore(s).clear(); q.onsuccess = () => r(); q.onerror = () => j(q.error); });

// STATE
let suppliers = [], invoices = [], currentTab = 'home';
let editingSupplierId = null, editingInvoiceId = null;
let selectedInvPayment = '', selectedSuppPayment = 'Cash';
let openAccordions = new Set();

// ARABIC
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PAY_AR = { Cash: 'نقد', Card: 'بطاقة', Transfer: 'تحويل', Transferred: 'تم التحويل' };
const PAY_BADGE = { Cash: 'b-cash', Card: 'b-card', Transfer: 'b-transfer', Transferred: 'b-transferred' };
const AVATARS = ['av1', 'av2', 'av3', 'av4', 'av5', 'av6', 'av7', 'av8'];

const toAr = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const fmt = n => toAr(Number(n).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtK = n => { if (n >= 1e6) return toAr((n / 1e6).toFixed(1)) + 'M'; if (n >= 1e3) return toAr((n / 1e3).toFixed(1)) + 'K'; return fmt(n); };
const fmtDate = d => { const dt = new Date(d); return toAr(dt.getDate()) + ' ' + MONTHS_AR[dt.getMonth()] + ' ' + toAr(dt.getFullYear()); };
const fmtDateShort = d => { const dt = new Date(d); return toAr(dt.getDate()) + ' ' + MONTHS_AR[dt.getMonth()]; };

const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().split('T')[0];
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const getAv = id => AVATARS[Math.abs([...id].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)) % AVATARS.length];
const CHEV = '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>';
const ARROW = '<svg class="accordion-arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>';
const ICON_SEARCH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>';
const ICON_PLUS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>';
const ICON_CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

// TOAST
function showToast(msg) { const t = $('toast'); $('toastMsg').textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2500); }

// CONFIRM
let confirmCb = null;
function showConfirm(title, msg, action, cb) {
  $('confirmTitle').textContent = title; $('confirmMsg').textContent = msg; $('confirmAction').textContent = action;
  confirmCb = cb; $('confirmAction').onclick = () => { closeModal('moConfirm'); if (confirmCb) confirmCb(); confirmCb = null; };
  openModal('moConfirm');
}

// MODALS
function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }
document.addEventListener('click', e => { if (e.target.classList.contains('mo') && e.target.classList.contains('open')) e.target.classList.remove('open'); });

// NAV
function updateNav() {
  const s = suppliers.length, i = invoices.length;
  $('navSub').innerHTML = `<span class="nav-dot"></span>${toAr(s)} ${s === 1 ? 'مورد' : 'موردين'} · ${toAr(i)} فاتورة`;
}

// INIT
async function init() {
  await openDB();
  suppliers = await dbAll('suppliers');
  invoices = (await dbAll('invoices')).sort((a, b) => b.date !== a.date ? b.date.localeCompare(a.date) : (b.createdAt || '').localeCompare(a.createdAt || ''));
  switchTab('home');
  updateNav();
}

// TABS
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  $('pg-' + tab).classList.add('active');
  document.querySelector(`.tab[data-tab="${tab}"]`)?.classList.add('active');
  const titles = { home: 'متتبع الفواتير', suppliers: 'الموردين', reports: 'التقارير', settings: 'الإعدادات' };
  $('navTitle').textContent = titles[tab];
  if (tab === 'home') renderHome();
  if (tab === 'suppliers') renderSuppliers();
  if (tab === 'reports') renderReports();
  if (tab === 'settings') renderSettings();
  updateNav();
}

// ================================================================
//  HOME — Clean: Search + Add Button + Total + Accordion
// ================================================================
function renderHome() {
  const hasSuppliers = suppliers.length > 0;
  const hasInvoices = invoices.length > 0;

  $('homeEmpty').classList.toggle('hidden', hasSuppliers);
  $('homeMain').classList.toggle('hidden', !hasSuppliers);

  if (!hasSuppliers) return;

  // Total strip
  const total = invoices.reduce((s, i) => s + i.amount, 0);
  if (hasInvoices) {
    $('totalStrip').classList.remove('hidden');
    $('totalValue').textContent = fmt(total);
    $('totalCount').textContent = toAr(invoices.length) + ' فاتورة';
  } else {
    $('totalStrip').classList.add('hidden');
  }

  // Clear search
  $('homeSearch').value = '';
  $('homeSearchClear').classList.remove('visible');

  // Render accordion
  renderAccordion();
  $('searchResults').classList.add('hidden');
  $('accordionWrap').classList.remove('hidden');
}

function renderAccordion() {
  // Group invoices by supplier, only suppliers that have invoices
  const groups = {};
  invoices.forEach(inv => {
    if (!groups[inv.supplierId]) {
      groups[inv.supplierId] = { name: inv.supplierName, id: inv.supplierId, invoices: [], total: 0 };
    }
    groups[inv.supplierId].invoices.push(inv);
    groups[inv.supplierId].total += inv.amount;
  });

  // Sort groups by most recent invoice
  const sorted = Object.values(groups).sort((a, b) => {
    return b.invoices[0].date.localeCompare(a.invoices[0].date);
  });

  const el = $('accordionList');
  if (sorted.length === 0) {
    el.innerHTML = '<div class="no-results">لا توجد فواتير بعد</div>';
    return;
  }

  el.innerHTML = sorted.map(g => {
    const av = getAv(g.id);
    const isOpen = openAccordions.has(g.id);
    return `<div class="accordion-item${isOpen ? ' open' : ''}" data-sid="${g.id}">
      <div class="accordion-header" onclick="toggleAccordion('${g.id}')">
        <div class="accordion-avatar ${av}">${g.name.charAt(0)}</div>
        <div class="accordion-body">
          <div class="accordion-name">${g.name}</div>
          <div class="accordion-meta">${fmtDateShort(g.invoices[0].date)}</div>
        </div>
        <div class="accordion-end">
          <span class="accordion-total">${fmt(g.total)}</span>
          <span class="accordion-count">${toAr(g.invoices.length)}</span>
          ${ARROW}
        </div>
      </div>
      <div class="accordion-content">
        ${g.invoices.map(inv => `
          <div class="accordion-inv" onclick="openInvoiceDetail('${inv.id}')">
            <div class="accordion-inv-body">
              <div class="accordion-inv-date">${fmtDate(inv.date)}</div>
              <div class="accordion-inv-note"><span class="badge ${PAY_BADGE[inv.payment]}">${PAY_AR[inv.payment]}</span>${inv.note ? ' ' + inv.note : ''}</div>
            </div>
            <div class="accordion-inv-end">
              <span class="accordion-inv-amt">${fmt(inv.amount)}</span>
              ${CHEV}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }).join('');
}

function toggleAccordion(sid) {
  if (openAccordions.has(sid)) openAccordions.delete(sid);
  else openAccordions.add(sid);
  const item = document.querySelector(`.accordion-item[data-sid="${sid}"]`);
  if (item) item.classList.toggle('open');
}

// HOME SEARCH
function onHomeSearch(val) {
  $('homeSearchClear').classList.toggle('visible', val.length > 0);
  if (!val.trim()) {
    $('searchResults').classList.add('hidden');
    $('accordionWrap').classList.remove('hidden');
    $('totalStrip').classList.toggle('hidden', invoices.length === 0);
    return;
  }

  $('accordionWrap').classList.add('hidden');
  $('totalStrip').classList.add('hidden');
  $('searchResults').classList.remove('hidden');

  const results = Search.searchInvoices(val, invoices, suppliers);
  const el = $('searchResultsList');

  if (results.length === 0) {
    el.innerHTML = '<div class="no-results">لا توجد نتائج</div>';
    return;
  }

  el.innerHTML = `<div class="search-results-header">${toAr(results.length)} نتيجة</div><div class="card">` +
    results.map(r => {
      const inv = r.item;
      return `<div class="row" onclick="openInvoiceDetail('${inv.id}')">
        <div class="row-body">
          <div class="row-t">${inv.supplierName}</div>
          <div class="row-s">${fmtDate(inv.date)} <span class="badge ${PAY_BADGE[inv.payment]}">${PAY_AR[inv.payment]}</span>${inv.note ? ' <span style="color:var(--label3)">' + inv.note + '</span>' : ''}</div>
        </div>
        <div class="row-end"><span class="row-amt">${fmt(inv.amount)}</span>${CHEV}</div>
      </div>`;
    }).join('') + '</div>';
}

function clearHomeSearch() {
  $('homeSearch').value = '';
  onHomeSearch('');
  $('homeSearch').focus();
}

// ================================================================
//  INVOICE ADD / EDIT MODAL
// ================================================================
function openInvoiceModal(id) {
  editingInvoiceId = id || null;
  const sel = $('invSupplier');
  sel.innerHTML = '<option value="">اختر المورد</option>' + suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  if (id) {
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;
    sel.value = inv.supplierId;
    $('invDate').value = inv.date;
    $('invAmount').value = inv.amount;
    $('invNote').value = inv.note || '';
    selectedInvPayment = inv.payment;
    $('moInvTitle').textContent = 'تعديل الفاتورة';
    $('saveInvBtn').textContent = 'حفظ التعديلات';
    $('delInvBtn').classList.remove('hidden');
  } else {
    sel.value = '';
    $('invDate').value = today();
    $('invAmount').value = '';
    $('invNote').value = '';
    selectedInvPayment = '';
    $('moInvTitle').textContent = 'فاتورة جديدة';
    $('saveInvBtn').textContent = 'إضافة الفاتورة';
    $('delInvBtn').classList.add('hidden');
  }
  renderInvPay();
  updateInvBtn();
  openModal('moInvoice');
}

function renderInvPay() { document.querySelectorAll('#invPaySeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.m === selectedInvPayment)); }
function selectInvPay(m) { selectedInvPayment = m; renderInvPay(); updateInvBtn(); }
function onInvSuppChange() {
  const s = suppliers.find(x => x.id === $('invSupplier').value);
  if (s && !editingInvoiceId) { selectedInvPayment = s.defaultPayment; renderInvPay(); }
  updateInvBtn();
}
function updateInvBtn() { $('saveInvBtn').disabled = !($('invSupplier').value && $('invAmount').value && selectedInvPayment); }

async function saveInvoice() {
  const sup = suppliers.find(s => s.id === $('invSupplier').value);
  if (!sup) return;

  if (editingInvoiceId) {
    const idx = invoices.findIndex(i => i.id === editingInvoiceId);
    if (idx !== -1) {
      Object.assign(invoices[idx], { supplierId: sup.id, supplierName: sup.name, date: $('invDate').value || today(), amount: parseFloat($('invAmount').value), payment: selectedInvPayment, note: $('invNote').value.trim() });
      await dbPut('invoices', invoices[idx]);
    }
    showToast('تم تحديث الفاتورة');
  } else {
    const inv = { id: genId(), supplierId: sup.id, supplierName: sup.name, date: $('invDate').value || today(), amount: parseFloat($('invAmount').value), payment: selectedInvPayment, note: $('invNote').value.trim(), createdAt: new Date().toISOString() };
    await dbPut('invoices', inv);
    invoices.unshift(inv);
    showToast('تمت إضافة ' + fmt(inv.amount) + ' ر.س');
  }
  invoices.sort((a, b) => b.date !== a.date ? b.date.localeCompare(a.date) : (b.createdAt || '').localeCompare(a.createdAt || ''));
  closeModal('moInvoice');
  if (currentTab === 'home') renderHome();
  if (currentTab === 'reports') renderReports();
  updateNav();
}

function delInvFromModal() {
  if (!editingInvoiceId) return;
  const id = editingInvoiceId;
  closeModal('moInvoice');
  setTimeout(() => showConfirm('حذف الفاتورة', 'هل تريد حذف هذه الفاتورة نهائياً؟', 'حذف', async () => {
    await dbDel('invoices', id); invoices = invoices.filter(i => i.id !== id);
    updateNav(); if (currentTab === 'home') renderHome(); if (currentTab === 'reports') renderReports();
    showToast('تم حذف الفاتورة');
  }), 400);
}

// INVOICE DETAIL
function openInvoiceDetail(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  $('invDetBody').innerHTML = `
    <div class="det"><span class="det-l">المورد</span><span class="det-v">${inv.supplierName}</span></div>
    <div class="det"><span class="det-l">التاريخ</span><span class="det-v">${fmtDate(inv.date)}</span></div>
    <div class="det"><span class="det-l">المبلغ</span><span class="det-v big">${fmt(inv.amount)} ر.س</span></div>
    <div class="det"><span class="det-l">الدفع</span><span class="det-v"><span class="badge ${PAY_BADGE[inv.payment]}">${PAY_AR[inv.payment]}</span></span></div>
    ${inv.note ? `<div class="det"><span class="det-l">ملاحظة</span><span class="det-v">${inv.note}</span></div>` : ''}`;
  $('editInvBtn').onclick = () => { closeModal('moInvDet'); setTimeout(() => openInvoiceModal(id), 350); };
  $('delInvDetBtn').onclick = () => {
    closeModal('moInvDet');
    setTimeout(() => showConfirm('حذف الفاتورة', 'هل تريد حذف هذه الفاتورة نهائياً؟', 'حذف', async () => {
      await dbDel('invoices', id); invoices = invoices.filter(i => i.id !== id);
      updateNav(); if (currentTab === 'home') renderHome(); if (currentTab === 'reports') renderReports();
      showToast('تم حذف الفاتورة');
    }), 400);
  };
  openModal('moInvDet');
}

// ================================================================
//  SUPPLIERS
// ================================================================
function renderSuppliers() {
  $('suppEmpty').classList.toggle('hidden', suppliers.length > 0);
  $('suppContent').classList.toggle('hidden', suppliers.length === 0);
  $('suppSearch').value = '';
  renderSuppList(suppliers);
}

function renderSuppList(list) {
  $('suppList').innerHTML = list.length === 0 ? '<div class="no-results">لا توجد نتائج</div>' : list.map(s => {
    const inv = invoices.filter(v => v.supplierId === s.id);
    const tot = inv.reduce((a, v) => a + v.amount, 0);
    const av = getAv(s.id);
    return `<div class="row" onclick="openSuppDetail('${s.id}')">
      <div class="row-avatar ${av}">${s.name.charAt(0)}</div>
      <div class="row-body">
        <div class="row-t">${s.name}</div>
        <div class="row-s"><span class="badge ${PAY_BADGE[s.defaultPayment]}">${PAY_AR[s.defaultPayment]}</span> <span>${inv.length ? toAr(inv.length) + ' فاتورة · ' + fmt(tot) + ' ر.س' : 'لا توجد فواتير'}</span></div>
      </div>
      <div class="row-end">${CHEV}</div>
    </div>`;
  }).join('');
}

function onSuppSearch(val) {
  if (!val.trim()) return renderSuppList(suppliers);
  renderSuppList(Search.searchSuppliers(val, suppliers));
}

// SUPPLIER MODAL
function openSuppModal(id) {
  editingSupplierId = id || null;
  if (id) {
    const s = suppliers.find(x => x.id === id);
    $('suppNameInput').value = s.name; selectedSuppPayment = s.defaultPayment;
    $('moSuppTitle').textContent = 'تعديل المورد'; $('saveSuppBtn').textContent = 'حفظ التعديلات'; $('delSuppBtn').classList.remove('hidden');
  } else {
    $('suppNameInput').value = ''; selectedSuppPayment = 'Cash';
    $('moSuppTitle').textContent = 'مورد جديد'; $('saveSuppBtn').textContent = 'إضافة المورد'; $('delSuppBtn').classList.add('hidden');
  }
  renderSuppPay(); openModal('moSupp');
  setTimeout(() => $('suppNameInput').focus(), 350);
}

function renderSuppPay() { document.querySelectorAll('#suppPaySeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.m === selectedSuppPayment)); }
function selectSuppPay(m) { selectedSuppPayment = m; renderSuppPay(); }

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
    showToast('تم تحديث المورد');
  } else {
    const n = { id: genId(), name, defaultPayment: selectedSuppPayment };
    suppliers.push(n); await dbPut('suppliers', n);
    showToast('تمت إضافة المورد');
  }
  closeModal('moSupp');
  if (currentTab === 'suppliers') renderSuppliers();
  if (currentTab === 'home') renderHome();
  updateNav();
}

function delSuppFromModal() {
  if (!editingSupplierId) return;
  const s = suppliers.find(x => x.id === editingSupplierId);
  closeModal('moSupp');
  setTimeout(() => showConfirm('حذف المورد', `حذف "${s?.name}"؟ الفواتير ستبقى.`, 'حذف', async () => {
    await dbDel('suppliers', editingSupplierId); suppliers = suppliers.filter(x => x.id !== editingSupplierId);
    if (currentTab === 'suppliers') renderSuppliers(); if (currentTab === 'home') renderHome();
    updateNav(); showToast('تم حذف المورد');
  }), 400);
}

// SUPPLIER DETAIL
function openSuppDetail(id) {
  const s = suppliers.find(x => x.id === id);
  if (!s) return;
  const inv = invoices.filter(v => v.supplierId === id);
  const tot = inv.reduce((a, v) => a + v.amount, 0);
  const av = getAv(s.id);

  $('sdBody').innerHTML = `
    <div class="sd-head">
      <div class="sd-avatar ${av}">${s.name.charAt(0)}</div>
      <div class="sd-info"><div class="sd-name">${s.name}</div>
        <div class="sd-meta"><span class="badge ${PAY_BADGE[s.defaultPayment]}">${PAY_AR[s.defaultPayment]}</span> الدفع الافتراضي</div>
      </div>
    </div>
    <div class="sd-stats">
      <div class="sd-stat"><span class="sd-stat-v" style="color:var(--green)">${fmt(tot)}</span><span class="sd-stat-l">إجمالي (ر.س)</span></div>
      <div class="sd-stat"><span class="sd-stat-v" style="color:var(--blue)">${toAr(inv.length)}</span><span class="sd-stat-l">عدد الفواتير</span></div>
    </div>
    ${inv.length ? '<div class="card" style="margin:0 16px">' + inv.map(v =>
      `<div class="row" onclick="closeModal('moSuppDet');setTimeout(()=>openInvoiceDetail('${v.id}'),350)">
        <div class="row-body"><div class="row-t">${fmtDate(v.date)}</div>
          <div class="row-s"><span class="badge ${PAY_BADGE[v.payment]}">${PAY_AR[v.payment]}</span>${v.note ? ' ' + v.note : ''}</div></div>
        <div class="row-end"><span class="row-amt">${fmt(v.amount)}</span>${CHEV}</div>
      </div>`).join('') + '</div>' : '<div class="no-results">لا توجد فواتير</div>'}`;

  $('editSuppDetBtn').onclick = () => { closeModal('moSuppDet'); setTimeout(() => openSuppModal(id), 350); };
  openModal('moSuppDet');
}

// ================================================================
//  REPORTS
// ================================================================
function renderReports() {
  const fs = $('filterSupplier'), cfs = fs.value;
  fs.innerHTML = '<option value="all">الكل</option>' + suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  fs.value = cfs;
  const fy = $('filterYear'), cfy = fy.value || new Date().getFullYear().toString();
  const yrs = new Set(invoices.map(i => new Date(i.date).getFullYear())); yrs.add(new Date().getFullYear());
  fy.innerHTML = '<option value="all">الكل</option>' + [...yrs].sort((a, b) => b - a).map(y => `<option value="${y}">${toAr(y)}</option>`).join('');
  fy.value = cfy;
  applyFilters();
}

function applyFilters() {
  const fS = $('filterSupplier').value, fP = $('filterPayment').value, fM = $('filterMonth').value, fY = $('filterYear').value;
  const filtered = invoices.filter(inv => {
    if (fS !== 'all' && inv.supplierId !== fS) return false;
    if (fP !== 'all' && inv.payment !== fP) return false;
    const d = new Date(inv.date);
    if (fY !== 'all' && d.getFullYear().toString() !== fY) return false;
    if (fM !== 'all' && d.getMonth().toString() !== fM) return false;
    return true;
  });

  const total = filtered.reduce((s, i) => s + i.amount, 0);
  $('rptLabel').textContent = toAr(filtered.length) + ' فاتورة';
  $('rptAmt').textContent = fmt(total);
  $('exportBtn').classList.toggle('hidden', filtered.length === 0);

  // Breakdown
  const map = {};
  filtered.forEach(inv => { if (!map[inv.supplierId]) map[inv.supplierId] = { name: inv.supplierName, total: 0, count: 0 }; map[inv.supplierId].total += inv.amount; map[inv.supplierId].count++; });
  const st = Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  const bd = $('bdList');
  if (st.length) {
    bd.innerHTML = st.map(([_, d]) => { const p = total > 0 ? (d.total / total) * 100 : 0;
      return `<div class="bd"><div class="bd-top"><span class="bd-name">${d.name}</span><span class="bd-amt">${fmt(d.total)}</span></div><div class="bd-bar"><div class="bd-fill" style="width:${p}%"></div></div><div class="bd-meta"><span>${toAr(d.count)} فاتورة</span><span>${toAr(p.toFixed(1))}٪</span></div></div>`;
    }).join('');
    $('bdSec').classList.remove('hidden');
  } else { bd.innerHTML = ''; $('bdSec').classList.add('hidden'); }

  // List
  const el = $('rptList');
  if (filtered.length) {
    el.innerHTML = filtered.map(inv => `<div class="row" onclick="openInvoiceDetail('${inv.id}')"><div class="row-body"><div class="row-t">${inv.supplierName}</div><div class="row-s">${fmtDate(inv.date)} <span class="badge ${PAY_BADGE[inv.payment]}">${PAY_AR[inv.payment]}</span>${inv.note ? ' <span style="color:var(--label3)">' + inv.note + '</span>' : ''}</div></div><div class="row-end"><span class="row-amt">${fmt(inv.amount)}</span>${CHEV}</div></div>`).join('');
    $('rptListSec').classList.remove('hidden');
  } else { el.innerHTML = invoices.length ? '<div class="no-results">لا توجد فواتير مطابقة</div>' : ''; $('rptListSec').classList.toggle('hidden', !invoices.length); }
  window._filtered = filtered; window._suppTotals = st; window._total = total;
}

// ================================================================
//  SETTINGS
// ================================================================
function renderSettings() {
  $('setSC').textContent = toAr(suppliers.length);
  $('setIC').textContent = toAr(invoices.length);
  $('setT').textContent = fmtK(invoices.reduce((s, i) => s + i.amount, 0));
  estimateStorage();
}

async function estimateStorage() {
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate(); const mb = (e.usage / 1048576).toFixed(2); const qmb = (e.quota / 1048576).toFixed(0); const p = ((e.usage / e.quota) * 100).toFixed(1);
      $('storUsed').textContent = `${toAr(mb)} م.ب من ${toAr(qmb)} م.ب`; $('storPct').textContent = toAr(p) + '٪'; $('storFill').style.width = Math.min(p, 100) + '%';
    } else { const kb = (new Blob([JSON.stringify({ suppliers, invoices })]).size / 1024).toFixed(1); $('storUsed').textContent = `~${toAr(kb)} ك.ب`; $('storPct').textContent = ''; $('storFill').style.width = '2%'; }
  } catch { $('storUsed').textContent = 'غير معروف'; $('storPct').textContent = ''; }
}

// EXCEL
function exportExcel() {
  if (typeof ExcelExport !== 'undefined' && ExcelExport.exportFiltered(window._filtered || [], window._suppTotals || [], window._total || 0, $('filterMonth').value, $('filterYear').value)) showToast('تم تصدير Excel');
  else showToast('لا توجد بيانات');
}
function exportExcelAll() { if (typeof ExcelExport !== 'undefined' && ExcelExport.exportAll(suppliers, invoices)) showToast('تم تصدير Excel'); else showToast('لا توجد بيانات'); }

// CLEAR
function clearAllInv() { if (!invoices.length) return showToast('لا توجد فواتير'); showConfirm('حذف جميع الفواتير', `حذف ${toAr(invoices.length)} فاتورة؟`, 'حذف', async () => { await dbClr('invoices'); invoices = []; openAccordions.clear(); updateNav(); renderSettings(); showToast('تم حذف جميع الفواتير'); }); }
function clearAll() { if (!invoices.length && !suppliers.length) return showToast('لا توجد بيانات'); showConfirm('حذف جميع البيانات', `حذف ${toAr(suppliers.length)} مورد و ${toAr(invoices.length)} فاتورة؟`, 'حذف الكل', async () => { await dbClr('suppliers'); await dbClr('invoices'); suppliers = []; invoices = []; openAccordions.clear(); updateNav(); renderSettings(); showToast('تم حذف جميع البيانات'); }); }

// BACKUP
async function exportData() { const d = { version: 4, exportDate: new Date().toISOString(), suppliers, invoices }; const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `متتبع_الفواتير_${today()}.json`; a.click(); URL.revokeObjectURL(a.href); showToast('تم حفظ النسخة الاحتياطية'); }
function importData() { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json'; inp.onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); if (!d.suppliers || !d.invoices) return showToast('ملف غير صالح'); showConfirm('استعادة البيانات', `استبدال البيانات بـ ${toAr(d.suppliers.length)} مورد و ${toAr(d.invoices.length)} فاتورة؟`, 'استعادة', async () => { await dbClr('suppliers'); await dbClr('invoices'); for (const s of d.suppliers) await dbPut('suppliers', s); for (const i of d.invoices) await dbPut('invoices', i); suppliers = d.suppliers; invoices = d.invoices.sort((a, b) => b.date !== a.date ? b.date.localeCompare(a.date) : (b.createdAt || '').localeCompare(a.createdAt || '')); openAccordions.clear(); switchTab(currentTab); updateNav(); showToast('تمت الاستعادة بنجاح'); }); } catch { showToast('خطأ في قراءة الملف'); } }; inp.click(); }

document.addEventListener('DOMContentLoaded', init);
