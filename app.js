/* متتبع الفواتير v4.1 — Bulletproof App Logic */

// ===== DATABASE =====
var DB_NAME = 'InvoiceTrackerDB';
var DB_VERSION = 1;
var db = null;

function openDB() {
  return new Promise(function(res, rej) {
    var r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = function(e) {
      var d = e.target.result;
      if (!d.objectStoreNames.contains('suppliers')) {
        var s = d.createObjectStore('suppliers', { keyPath: 'id' });
        s.createIndex('name', 'name', { unique: false });
      }
      if (!d.objectStoreNames.contains('invoices')) {
        var i = d.createObjectStore('invoices', { keyPath: 'id' });
        i.createIndex('supplierId', 'supplierId', { unique: false });
        i.createIndex('date', 'date', { unique: false });
      }
    };
    r.onsuccess = function(e) { db = e.target.result; res(db); };
    r.onerror = function(e) { rej(e.target.error); };
  });
}

function dbAll(s) { return new Promise(function(r, j) { var t = db.transaction(s, 'readonly'); var q = t.objectStore(s).getAll(); q.onsuccess = function() { r(q.result); }; q.onerror = function() { j(q.error); }; }); }
function dbPut(s, i) { return new Promise(function(r, j) { var t = db.transaction(s, 'readwrite'); var q = t.objectStore(s).put(i); q.onsuccess = function() { r(q.result); }; q.onerror = function() { j(q.error); }; }); }
function dbDel(s, id) { return new Promise(function(r, j) { var t = db.transaction(s, 'readwrite'); var q = t.objectStore(s).delete(id); q.onsuccess = function() { r(); }; q.onerror = function() { j(q.error); }; }); }
function dbClr(s) { return new Promise(function(r, j) { var t = db.transaction(s, 'readwrite'); var q = t.objectStore(s).clear(); q.onsuccess = function() { r(); }; q.onerror = function() { j(q.error); }; }); }

// ===== STATE =====
var suppliers = [], invoices = [], currentTab = 'home';
var editingSupplierId = null, editingInvoiceId = null;
var selectedInvPayment = '', selectedSuppPayment = 'Cash';
var openAccordions = new Set();

// ===== ARABIC =====
var MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
var PAY_AR = { Cash: 'نقد', Card: 'بطاقة', Transfer: 'تحويل', Transferred: 'تم التحويل' };
var PAY_BADGE = { Cash: 'b-cash', Card: 'b-card', Transfer: 'b-transfer', Transferred: 'b-transferred' };
var AVATARS = ['av1', 'av2', 'av3', 'av4', 'av5', 'av6', 'av7', 'av8'];

function toAr(n) { return String(n).replace(/\d/g, function(d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }
function fmt(n) { return toAr(Number(n).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); }
function fmtK(n) { if (n >= 1e6) return toAr((n / 1e6).toFixed(1)) + 'M'; if (n >= 1e3) return toAr((n / 1e3).toFixed(1)) + 'K'; return fmt(n); }
function fmtDate(d) { var dt = new Date(d); return toAr(dt.getDate()) + ' ' + MONTHS_AR[dt.getMonth()] + ' ' + toAr(dt.getFullYear()); }
function fmtDateShort(d) { var dt = new Date(d); return toAr(dt.getDate()) + ' ' + MONTHS_AR[dt.getMonth()]; }

// ===== NULL-SAFE DOM HELPER =====
// Returns a dummy element if not found — prevents all "Cannot set properties of null" errors
var _dummy = null;
function getDummy() {
  if (!_dummy) { _dummy = document.createElement('div'); _dummy.style.display = 'none'; }
  return _dummy;
}
function $(id) {
  var el = document.getElementById(id);
  if (!el) { console.warn('Element #' + id + ' not found'); return getDummy(); }
  return el;
}

function today() { return new Date().toISOString().split('T')[0]; }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function getAv(id) {
  var h = 0;
  for (var i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return AVATARS[Math.abs(h) % AVATARS.length];
}

var CHEV = '<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>';
var ARROW = '<svg class="accordion-arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>';

// ===== TOAST =====
function showToast(msg) {
  var t = $('toast');
  $('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(function() { t.classList.remove('show'); }, 2500);
}

// ===== CONFIRM =====
var confirmCb = null;
function showConfirm(title, msg, action, cb) {
  $('confirmTitle').textContent = title;
  $('confirmMsg').textContent = msg;
  $('confirmAction').textContent = action;
  confirmCb = cb;
  $('confirmAction').onclick = function() {
    closeModal('moConfirm');
    if (confirmCb) confirmCb();
    confirmCb = null;
  };
  openModal('moConfirm');
}

// ===== MODALS =====
function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('mo') && e.target.classList.contains('open')) {
    e.target.classList.remove('open');
  }
});

// ===== NAV =====
function updateNav() {
  var s = suppliers.length, i = invoices.length;
  $('navSub').innerHTML = '<span class="nav-dot"></span>' + toAr(s) + ' ' + (s === 1 ? 'مورد' : 'موردين') + ' · ' + toAr(i) + ' فاتورة';
}

// ===== INIT =====
async function init() {
  try {
    await openDB();
    suppliers = await dbAll('suppliers');
    invoices = (await dbAll('invoices')).sort(function(a, b) {
      return b.date !== a.date ? b.date.localeCompare(a.date) : (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    switchTab('home');
    updateNav();
  } catch (err) {
    console.error('Init failed:', err);
    // Still try to render empty state
    try { switchTab('home'); } catch (e) { /* silent */ }
  }
}

// ===== TABS =====
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.page').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.tab').forEach(function(el) { el.classList.remove('active'); });

  var pageEl = document.getElementById('pg-' + tab);
  if (pageEl) pageEl.classList.add('active');

  var tabBtn = document.querySelector('.tab[data-tab="' + tab + '"]');
  if (tabBtn) tabBtn.classList.add('active');

  var titles = { home: 'متتبع الفواتير', suppliers: 'الموردين', reports: 'التقارير', settings: 'الإعدادات' };
  $('navTitle').textContent = titles[tab] || '';

  try {
    if (tab === 'home') renderHome();
    if (tab === 'suppliers') renderSuppliers();
    if (tab === 'reports') renderReports();
    if (tab === 'settings') renderSettings();
  } catch (err) {
    console.error('Render error for tab ' + tab + ':', err);
  }
  updateNav();
}

// ================================================================
//  HOME
// ================================================================
function renderHome() {
  var hasSuppliers = suppliers.length > 0;
  var hasInvoices = invoices.length > 0;

  $('homeEmpty').classList.toggle('hidden', hasSuppliers);
  $('homeMain').classList.toggle('hidden', !hasSuppliers);

  if (!hasSuppliers) return;

  var total = invoices.reduce(function(s, i) { return s + i.amount; }, 0);
  if (hasInvoices) {
    $('totalStrip').classList.remove('hidden');
    $('totalValue').textContent = fmt(total);
    $('totalCount').textContent = toAr(invoices.length) + ' فاتورة';
  } else {
    $('totalStrip').classList.add('hidden');
  }

  var searchEl = $('homeSearch');
  if (searchEl && searchEl !== getDummy()) searchEl.value = '';
  $('homeSearchClear').classList.remove('visible');

  renderAccordion();
  $('searchResults').classList.add('hidden');
  $('accordionWrap').classList.remove('hidden');
}

function renderAccordion() {
  var groups = {};
  invoices.forEach(function(inv) {
    if (!groups[inv.supplierId]) {
      groups[inv.supplierId] = { name: inv.supplierName, id: inv.supplierId, invoices: [], total: 0 };
    }
    groups[inv.supplierId].invoices.push(inv);
    groups[inv.supplierId].total += inv.amount;
  });

  var sorted = Object.values(groups).sort(function(a, b) {
    return b.invoices[0].date.localeCompare(a.invoices[0].date);
  });

  var el = $('accordionList');
  if (sorted.length === 0) {
    el.innerHTML = '<div class="no-results">لا توجد فواتير بعد</div>';
    return;
  }

  el.innerHTML = sorted.map(function(g) {
    var av = getAv(g.id);
    var isOpen = openAccordions.has(g.id);
    return '<div class="accordion-item' + (isOpen ? ' open' : '') + '" data-sid="' + g.id + '">' +
      '<div class="accordion-header" onclick="toggleAccordion(\'' + g.id + '\')">' +
        '<div class="accordion-avatar ' + av + '">' + g.name.charAt(0) + '</div>' +
        '<div class="accordion-body">' +
          '<div class="accordion-name">' + g.name + '</div>' +
          '<div class="accordion-meta">' + fmtDateShort(g.invoices[0].date) + '</div>' +
        '</div>' +
        '<div class="accordion-end">' +
          '<span class="accordion-total">' + fmt(g.total) + '</span>' +
          '<span class="accordion-count">' + toAr(g.invoices.length) + '</span>' +
          ARROW +
        '</div>' +
      '</div>' +
      '<div class="accordion-content">' +
        g.invoices.map(function(inv) {
          return '<div class="accordion-inv" onclick="openInvoiceDetail(\'' + inv.id + '\')">' +
            '<div class="accordion-inv-body">' +
              '<div class="accordion-inv-date">' + fmtDate(inv.date) + '</div>' +
              '<div class="accordion-inv-note"><span class="badge ' + PAY_BADGE[inv.payment] + '">' + PAY_AR[inv.payment] + '</span>' + (inv.note ? ' ' + inv.note : '') + '</div>' +
            '</div>' +
            '<div class="accordion-inv-end">' +
              '<span class="accordion-inv-amt">' + fmt(inv.amount) + '</span>' +
              CHEV +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
  }).join('');
}

function toggleAccordion(sid) {
  if (openAccordions.has(sid)) openAccordions.delete(sid);
  else openAccordions.add(sid);
  var item = document.querySelector('.accordion-item[data-sid="' + sid + '"]');
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

  // Check if Search module loaded
  if (typeof Search === 'undefined' || !Search.searchInvoices) {
    $('searchResultsList').innerHTML = '<div class="no-results">خطأ في تحميل البحث</div>';
    return;
  }

  var results = Search.searchInvoices(val, invoices, suppliers);
  var el = $('searchResultsList');

  if (results.length === 0) {
    el.innerHTML = '<div class="no-results">لا توجد نتائج</div>';
    return;
  }

  el.innerHTML = '<div class="search-results-header">' + toAr(results.length) + ' نتيجة</div><div class="card">' +
    results.map(function(r) {
      var inv = r.item;
      return '<div class="row" onclick="openInvoiceDetail(\'' + inv.id + '\')">' +
        '<div class="row-body">' +
          '<div class="row-t">' + inv.supplierName + '</div>' +
          '<div class="row-s">' + fmtDate(inv.date) + ' <span class="badge ' + PAY_BADGE[inv.payment] + '">' + PAY_AR[inv.payment] + '</span>' + (inv.note ? ' <span style="color:var(--label3)">' + inv.note + '</span>' : '') + '</div>' +
        '</div>' +
        '<div class="row-end"><span class="row-amt">' + fmt(inv.amount) + '</span>' + CHEV + '</div>' +
      '</div>';
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
  var sel = $('invSupplier');
  sel.innerHTML = '<option value="">اختر المورد</option>' + suppliers.map(function(s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('');

  if (id) {
    var inv = invoices.find(function(i) { return i.id === id; });
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

function renderInvPay() {
  document.querySelectorAll('#invPaySeg .seg-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-m') === selectedInvPayment);
  });
}
function selectInvPay(m) { selectedInvPayment = m; renderInvPay(); updateInvBtn(); }
function onInvSuppChange() {
  var s = suppliers.find(function(x) { return x.id === $('invSupplier').value; });
  if (s && !editingInvoiceId) { selectedInvPayment = s.defaultPayment; renderInvPay(); }
  updateInvBtn();
}
function updateInvBtn() {
  $('saveInvBtn').disabled = !($('invSupplier').value && $('invAmount').value && selectedInvPayment);
}

async function saveInvoice() {
  var sup = suppliers.find(function(s) { return s.id === $('invSupplier').value; });
  if (!sup) return;

  if (editingInvoiceId) {
    var idx = invoices.findIndex(function(i) { return i.id === editingInvoiceId; });
    if (idx !== -1) {
      invoices[idx].supplierId = sup.id;
      invoices[idx].supplierName = sup.name;
      invoices[idx].date = $('invDate').value || today();
      invoices[idx].amount = parseFloat($('invAmount').value);
      invoices[idx].payment = selectedInvPayment;
      invoices[idx].note = $('invNote').value.trim();
      await dbPut('invoices', invoices[idx]);
    }
    showToast('تم تحديث الفاتورة');
  } else {
    var inv = {
      id: genId(), supplierId: sup.id, supplierName: sup.name,
      date: $('invDate').value || today(), amount: parseFloat($('invAmount').value),
      payment: selectedInvPayment, note: $('invNote').value.trim(),
      createdAt: new Date().toISOString()
    };
    await dbPut('invoices', inv);
    invoices.unshift(inv);
    showToast('تمت إضافة ' + fmt(inv.amount) + ' ر.س');
  }
  invoices.sort(function(a, b) { return b.date !== a.date ? b.date.localeCompare(a.date) : (b.createdAt || '').localeCompare(a.createdAt || ''); });
  closeModal('moInvoice');
  if (currentTab === 'home') renderHome();
  if (currentTab === 'reports') renderReports();
  updateNav();
}

function delInvFromModal() {
  if (!editingInvoiceId) return;
  var id = editingInvoiceId;
  closeModal('moInvoice');
  setTimeout(function() {
    showConfirm('حذف الفاتورة', 'هل تريد حذف هذه الفاتورة نهائياً؟', 'حذف', async function() {
      await dbDel('invoices', id);
      invoices = invoices.filter(function(i) { return i.id !== id; });
      updateNav();
      if (currentTab === 'home') renderHome();
      if (currentTab === 'reports') renderReports();
      showToast('تم حذف الفاتورة');
    });
  }, 400);
}

// INVOICE DETAIL
function openInvoiceDetail(id) {
  var inv = invoices.find(function(i) { return i.id === id; });
  if (!inv) return;
  $('invDetBody').innerHTML =
    '<div class="det"><span class="det-l">المورد</span><span class="det-v">' + inv.supplierName + '</span></div>' +
    '<div class="det"><span class="det-l">التاريخ</span><span class="det-v">' + fmtDate(inv.date) + '</span></div>' +
    '<div class="det"><span class="det-l">المبلغ</span><span class="det-v big">' + fmt(inv.amount) + ' ر.س</span></div>' +
    '<div class="det"><span class="det-l">الدفع</span><span class="det-v"><span class="badge ' + PAY_BADGE[inv.payment] + '">' + PAY_AR[inv.payment] + '</span></span></div>' +
    (inv.note ? '<div class="det"><span class="det-l">ملاحظة</span><span class="det-v">' + inv.note + '</span></div>' : '');

  $('editInvBtn').onclick = function() { closeModal('moInvDet'); setTimeout(function() { openInvoiceModal(id); }, 350); };
  $('delInvDetBtn').onclick = function() {
    closeModal('moInvDet');
    setTimeout(function() {
      showConfirm('حذف الفاتورة', 'هل تريد حذف هذه الفاتورة نهائياً؟', 'حذف', async function() {
        await dbDel('invoices', id);
        invoices = invoices.filter(function(i) { return i.id !== id; });
        updateNav();
        if (currentTab === 'home') renderHome();
        if (currentTab === 'reports') renderReports();
        showToast('تم حذف الفاتورة');
      });
    }, 400);
  };
  openModal('moInvDet');
}

// ================================================================
//  SUPPLIERS
// ================================================================
function renderSuppliers() {
  $('suppEmpty').classList.toggle('hidden', suppliers.length > 0);
  $('suppContent').classList.toggle('hidden', suppliers.length === 0);
  var searchEl = $('suppSearch');
  if (searchEl && searchEl !== getDummy()) searchEl.value = '';
  renderSuppList(suppliers);
}

function renderSuppList(list) {
  $('suppList').innerHTML = list.length === 0 ? '<div class="no-results">لا توجد نتائج</div>' : list.map(function(s) {
    var inv = invoices.filter(function(v) { return v.supplierId === s.id; });
    var tot = inv.reduce(function(a, v) { return a + v.amount; }, 0);
    var av = getAv(s.id);
    return '<div class="row" onclick="openSuppDetail(\'' + s.id + '\')">' +
      '<div class="row-avatar ' + av + '">' + s.name.charAt(0) + '</div>' +
      '<div class="row-body">' +
        '<div class="row-t">' + s.name + '</div>' +
        '<div class="row-s"><span class="badge ' + PAY_BADGE[s.defaultPayment] + '">' + PAY_AR[s.defaultPayment] + '</span> <span>' + (inv.length ? toAr(inv.length) + ' فاتورة · ' + fmt(tot) + ' ر.س' : 'لا توجد فواتير') + '</span></div>' +
      '</div>' +
      '<div class="row-end">' + CHEV + '</div>' +
    '</div>';
  }).join('');
}

function onSuppSearch(val) {
  if (!val || !val.trim()) return renderSuppList(suppliers);
  if (typeof Search !== 'undefined' && Search.searchSuppliers) {
    renderSuppList(Search.searchSuppliers(val, suppliers));
  }
}

// SUPPLIER MODAL
function openSuppModal(id) {
  editingSupplierId = id || null;
  if (id) {
    var s = suppliers.find(function(x) { return x.id === id; });
    if (!s) return;
    $('suppNameInput').value = s.name;
    selectedSuppPayment = s.defaultPayment;
    $('moSuppTitle').textContent = 'تعديل المورد';
    $('saveSuppBtn').textContent = 'حفظ التعديلات';
    $('delSuppBtn').classList.remove('hidden');
  } else {
    $('suppNameInput').value = '';
    selectedSuppPayment = 'Cash';
    $('moSuppTitle').textContent = 'مورد جديد';
    $('saveSuppBtn').textContent = 'إضافة المورد';
    $('delSuppBtn').classList.add('hidden');
  }
  renderSuppPay();
  openModal('moSupp');
  setTimeout(function() { $('suppNameInput').focus(); }, 350);
}

function renderSuppPay() {
  document.querySelectorAll('#suppPaySeg .seg-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-m') === selectedSuppPayment);
  });
}
function selectSuppPay(m) { selectedSuppPayment = m; renderSuppPay(); }

async function saveSupplier() {
  var name = $('suppNameInput').value.trim();
  if (!name) return;
  if (editingSupplierId) {
    var idx = suppliers.findIndex(function(s) { return s.id === editingSupplierId; });
    if (idx !== -1) {
      suppliers[idx].name = name;
      suppliers[idx].defaultPayment = selectedSuppPayment;
      await dbPut('suppliers', suppliers[idx]);
      for (var ii = 0; ii < invoices.length; ii++) {
        if (invoices[ii].supplierId === editingSupplierId) {
          invoices[ii].supplierName = name;
          await dbPut('invoices', invoices[ii]);
        }
      }
    }
    showToast('تم تحديث المورد');
  } else {
    var n = { id: genId(), name: name, defaultPayment: selectedSuppPayment };
    suppliers.push(n);
    await dbPut('suppliers', n);
    showToast('تمت إضافة المورد');
  }
  closeModal('moSupp');
  if (currentTab === 'suppliers') renderSuppliers();
  if (currentTab === 'home') renderHome();
  updateNav();
}

function delSuppFromModal() {
  if (!editingSupplierId) return;
  var s = suppliers.find(function(x) { return x.id === editingSupplierId; });
  closeModal('moSupp');
  setTimeout(function() {
    showConfirm('حذف المورد', 'حذف "' + (s ? s.name : '') + '"؟ الفواتير ستبقى.', 'حذف', async function() {
      await dbDel('suppliers', editingSupplierId);
      suppliers = suppliers.filter(function(x) { return x.id !== editingSupplierId; });
      if (currentTab === 'suppliers') renderSuppliers();
      if (currentTab === 'home') renderHome();
      updateNav();
      showToast('تم حذف المورد');
    });
  }, 400);
}

// SUPPLIER DETAIL
function openSuppDetail(id) {
  var s = suppliers.find(function(x) { return x.id === id; });
  if (!s) return;
  var inv = invoices.filter(function(v) { return v.supplierId === id; });
  var tot = inv.reduce(function(a, v) { return a + v.amount; }, 0);
  var av = getAv(s.id);

  $('sdBody').innerHTML =
    '<div class="sd-head"><div class="sd-avatar ' + av + '">' + s.name.charAt(0) + '</div>' +
    '<div class="sd-info"><div class="sd-name">' + s.name + '</div>' +
    '<div class="sd-meta"><span class="badge ' + PAY_BADGE[s.defaultPayment] + '">' + PAY_AR[s.defaultPayment] + '</span> الدفع الافتراضي</div></div></div>' +
    '<div class="sd-stats">' +
      '<div class="sd-stat"><span class="sd-stat-v" style="color:var(--green)">' + fmt(tot) + '</span><span class="sd-stat-l">إجمالي (ر.س)</span></div>' +
      '<div class="sd-stat"><span class="sd-stat-v" style="color:var(--blue)">' + toAr(inv.length) + '</span><span class="sd-stat-l">عدد الفواتير</span></div>' +
    '</div>' +
    (inv.length ? '<div class="card" style="margin:0 16px">' + inv.map(function(v) {
      return '<div class="row" onclick="closeModal(\'moSuppDet\');setTimeout(function(){openInvoiceDetail(\'' + v.id + '\')},350)">' +
        '<div class="row-body"><div class="row-t">' + fmtDate(v.date) + '</div>' +
        '<div class="row-s"><span class="badge ' + PAY_BADGE[v.payment] + '">' + PAY_AR[v.payment] + '</span>' + (v.note ? ' ' + v.note : '') + '</div></div>' +
        '<div class="row-end"><span class="row-amt">' + fmt(v.amount) + '</span>' + CHEV + '</div></div>';
    }).join('') + '</div>' : '<div class="no-results">لا توجد فواتير</div>');

  $('editSuppDetBtn').onclick = function() { closeModal('moSuppDet'); setTimeout(function() { openSuppModal(id); }, 350); };
  openModal('moSuppDet');
}

// ================================================================
//  REPORTS
// ================================================================
function renderReports() {
  var fs = $('filterSupplier'), cfs = fs.value;
  fs.innerHTML = '<option value="all">الكل</option>' + suppliers.map(function(s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('');
  if (cfs) fs.value = cfs;

  var fy = $('filterYear'), cfy = fy.value || new Date().getFullYear().toString();
  var yrs = new Set(invoices.map(function(i) { return new Date(i.date).getFullYear(); }));
  yrs.add(new Date().getFullYear());
  fy.innerHTML = '<option value="all">الكل</option>' + Array.from(yrs).sort(function(a, b) { return b - a; }).map(function(y) { return '<option value="' + y + '">' + toAr(y) + '</option>'; }).join('');
  if (cfy) fy.value = cfy;
  applyFilters();
}

function applyFilters() {
  var fS = $('filterSupplier').value, fP = $('filterPayment').value, fM = $('filterMonth').value, fY = $('filterYear').value;
  var filtered = invoices.filter(function(inv) {
    if (fS !== 'all' && inv.supplierId !== fS) return false;
    if (fP !== 'all' && inv.payment !== fP) return false;
    var d = new Date(inv.date);
    if (fY !== 'all' && d.getFullYear().toString() !== fY) return false;
    if (fM !== 'all' && d.getMonth().toString() !== fM) return false;
    return true;
  });

  var total = filtered.reduce(function(s, i) { return s + i.amount; }, 0);
  $('rptLabel').textContent = toAr(filtered.length) + ' فاتورة';
  $('rptAmt').textContent = fmt(total);
  $('exportBtn').classList.toggle('hidden', filtered.length === 0);

  var map = {};
  filtered.forEach(function(inv) {
    if (!map[inv.supplierId]) map[inv.supplierId] = { name: inv.supplierName, total: 0, count: 0 };
    map[inv.supplierId].total += inv.amount;
    map[inv.supplierId].count++;
  });
  var st = Object.entries(map).sort(function(a, b) { return b[1].total - a[1].total; });
  var bd = $('bdList');
  if (st.length) {
    bd.innerHTML = st.map(function(entry) {
      var d = entry[1], p = total > 0 ? (d.total / total) * 100 : 0;
      return '<div class="bd"><div class="bd-top"><span class="bd-name">' + d.name + '</span><span class="bd-amt">' + fmt(d.total) + '</span></div><div class="bd-bar"><div class="bd-fill" style="width:' + p + '%"></div></div><div class="bd-meta"><span>' + toAr(d.count) + ' فاتورة</span><span>' + toAr(p.toFixed(1)) + '٪</span></div></div>';
    }).join('');
    $('bdSec').classList.remove('hidden');
  } else { bd.innerHTML = ''; $('bdSec').classList.add('hidden'); }

  var el = $('rptList');
  if (filtered.length) {
    el.innerHTML = filtered.map(function(inv) {
      return '<div class="row" onclick="openInvoiceDetail(\'' + inv.id + '\')"><div class="row-body"><div class="row-t">' + inv.supplierName + '</div><div class="row-s">' + fmtDate(inv.date) + ' <span class="badge ' + PAY_BADGE[inv.payment] + '">' + PAY_AR[inv.payment] + '</span>' + (inv.note ? ' <span style="color:var(--label3)">' + inv.note + '</span>' : '') + '</div></div><div class="row-end"><span class="row-amt">' + fmt(inv.amount) + '</span>' + CHEV + '</div></div>';
    }).join('');
    $('rptListSec').classList.remove('hidden');
  } else {
    el.innerHTML = invoices.length ? '<div class="no-results">لا توجد فواتير مطابقة</div>' : '';
    $('rptListSec').classList.toggle('hidden', !invoices.length);
  }
  window._filtered = filtered; window._suppTotals = st; window._total = total;
}

// ================================================================
//  SETTINGS
// ================================================================
function renderSettings() {
  $('setSC').textContent = toAr(suppliers.length);
  $('setIC').textContent = toAr(invoices.length);
  $('setT').textContent = fmtK(invoices.reduce(function(s, i) { return s + i.amount; }, 0));
  estimateStorage();
}

async function estimateStorage() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      var e = await navigator.storage.estimate();
      var mb = (e.usage / 1048576).toFixed(2);
      var qmb = (e.quota / 1048576).toFixed(0);
      var p = ((e.usage / e.quota) * 100).toFixed(1);
      $('storUsed').textContent = toAr(mb) + ' م.ب من ' + toAr(qmb) + ' م.ب';
      $('storPct').textContent = toAr(p) + '٪';
      $('storFill').style.width = Math.min(p, 100) + '%';
    } else {
      var kb = (new Blob([JSON.stringify({ suppliers: suppliers, invoices: invoices })]).size / 1024).toFixed(1);
      $('storUsed').textContent = '~' + toAr(kb) + ' ك.ب';
      $('storPct').textContent = '';
      $('storFill').style.width = '2%';
    }
  } catch (err) {
    $('storUsed').textContent = 'غير معروف';
    $('storPct').textContent = '';
  }
}

// EXCEL
function exportExcel() {
  if (typeof ExcelExport !== 'undefined' && ExcelExport.exportFiltered(window._filtered || [], window._suppTotals || [], window._total || 0, $('filterMonth').value, $('filterYear').value)) {
    showToast('تم تصدير Excel');
  } else {
    showToast('لا توجد بيانات');
  }
}
function exportExcelAll() {
  if (typeof ExcelExport !== 'undefined' && ExcelExport.exportAll(suppliers, invoices)) showToast('تم تصدير Excel');
  else showToast('لا توجد بيانات');
}

// CLEAR
function clearAllInv() {
  if (!invoices.length) return showToast('لا توجد فواتير');
  showConfirm('حذف جميع الفواتير', 'حذف ' + toAr(invoices.length) + ' فاتورة؟', 'حذف', async function() {
    await dbClr('invoices'); invoices = []; openAccordions.clear(); updateNav(); renderSettings(); showToast('تم حذف جميع الفواتير');
  });
}
function clearAll() {
  if (!invoices.length && !suppliers.length) return showToast('لا توجد بيانات');
  showConfirm('حذف جميع البيانات', 'حذف ' + toAr(suppliers.length) + ' مورد و ' + toAr(invoices.length) + ' فاتورة؟', 'حذف الكل', async function() {
    await dbClr('suppliers'); await dbClr('invoices'); suppliers = []; invoices = []; openAccordions.clear(); updateNav(); renderSettings(); showToast('تم حذف جميع البيانات');
  });
}

// BACKUP
async function exportData() {
  var d = { version: 4, exportDate: new Date().toISOString(), suppliers: suppliers, invoices: invoices };
  var b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'متتبع_الفواتير_' + today() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('تم حفظ النسخة الاحتياطية');
}

function importData() {
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json';
  inp.onchange = async function(e) {
    var f = e.target.files[0];
    if (!f) return;
    try {
      var d = JSON.parse(await f.text());
      if (!d.suppliers || !d.invoices) return showToast('ملف غير صالح');
      showConfirm('استعادة البيانات', 'استبدال البيانات بـ ' + toAr(d.suppliers.length) + ' مورد و ' + toAr(d.invoices.length) + ' فاتورة؟', 'استعادة', async function() {
        await dbClr('suppliers'); await dbClr('invoices');
        for (var si = 0; si < d.suppliers.length; si++) await dbPut('suppliers', d.suppliers[si]);
        for (var ii = 0; ii < d.invoices.length; ii++) await dbPut('invoices', d.invoices[ii]);
        suppliers = d.suppliers;
        invoices = d.invoices.sort(function(a, b) { return b.date !== a.date ? b.date.localeCompare(a.date) : (b.createdAt || '').localeCompare(a.createdAt || ''); });
        openAccordions.clear();
        switchTab(currentTab);
        updateNav();
        showToast('تمت الاستعادة بنجاح');
      });
    } catch (err) { showToast('خطأ في قراءة الملف'); }
  };
  inp.click();
}

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', init);
