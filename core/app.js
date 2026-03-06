// core/app.js — Main app logic
let allSheets = [];

function renderSheets(sheets) {
  const container = document.getElementById('sheets-container');
  const isSearchEmpty = allSheets.length > 0 && sheets.length === 0;
  const isDataEmpty   = allSheets.length === 0;

  if (sheets.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          ${isDataEmpty ? Icons.get('fileEmpty') : Icons.get('searchEmpty')}
        </div>
        <div class="empty-title">${isDataEmpty ? AppI18n.t('emptyState') : AppI18n.t('noResults')}</div>
        ${isDataEmpty ? `<div class="empty-hint">${AppI18n.t('emptyStateHint')}</div>` : ''}
      </div>
    `;
    return;
  }

  // Chevron direction: RTL = left, LTR = right
  const chevron = AppI18n.lang === 'ar' ? Icons.get('chevronLeft', 16) : Icons.get('chevronRight', 16);

  container.innerHTML = `
    <div class="sheets-list">
      ${sheets.map(s => `
        <div class="sheet-card" data-id="${s.id}">
          <div class="sheet-card-left">
            <div class="sheet-icon">${Icons.get('file', 16)}</div>
            <div>
              <div class="sheet-name">${s.name}</div>
              <div class="sheet-meta">${s.year}</div>
            </div>
          </div>
          <span class="sheet-chevron">${chevron}</span>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadSheets() {
  allSheets = await AppDB.getAll('sheets');
  allSheets.sort((a, b) => b.createdAt - a.createdAt);
  renderSheets(allSheets);
}

function openCreateModal() {
  const year = new Date().getFullYear();
  AppModal.open(`
    <div class="modal-drag"></div>
    <div class="modal-header">
      <span class="modal-title">${AppI18n.t('createSheet')}</span>
      <button class="modal-close" data-close>${Icons.get('close', 14)}</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">${AppI18n.t('sheetName')}</label>
        <input class="form-input" id="new-sheet-name" type="text"
          placeholder="${AppI18n.t('sheetNamePlaceholder')}" autocomplete="off" />
      </div>
      <div class="form-group">
        <label class="form-label">${AppI18n.t('sheetYear')}</label>
        <input class="form-input" id="new-sheet-year" type="number"
          value="${year}" min="2000" max="2099" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" data-close>${AppI18n.t('cancel')}</button>
      <button class="btn btn-primary" id="confirm-create">${AppI18n.t('create')}</button>
    </div>
  `);

  setTimeout(() => document.getElementById('new-sheet-name')?.focus(), 120);

  document.getElementById('confirm-create').addEventListener('click', async () => {
    const name = document.getElementById('new-sheet-name').value.trim();
    const year = document.getElementById('new-sheet-year').value;

    if (!name) {
      AppToast.show(AppI18n.t('sheetNameRequired'), 'error');
      return;
    }

    await AppDB.add('sheets', { name, year });
    AppModal.close();
    await loadSheets();
    AppToast.show(AppI18n.t('sheetCreated'), 'success');
  });
}

function refreshUI() {
  document.getElementById('app-title').textContent = AppI18n.t('appName');
  document.getElementById('search-input').placeholder = AppI18n.t('searchPlaceholder');
  document.getElementById('fab-label').textContent = AppI18n.t('createSheet');
  document.getElementById('lang-btn').textContent = AppI18n.lang === 'ar' ? 'EN' : 'عربي';
  renderSheets(allSheets);
}

async function init() {
  AppI18n.init();
  AppModal.init();
  await AppDB.open();
  await loadSheets();

  // Inject search icon
  document.querySelector('.search-icon').innerHTML = Icons.get('search', 16);

  // Inject FAB icon
  document.getElementById('fab-icon').innerHTML = Icons.get('plus', 18);

  AppSearch.bind('search-input', (q) => {
    renderSheets(AppSearch.filter(allSheets, q, ['name', 'year']));
  });

  document.getElementById('fab').addEventListener('click', openCreateModal);

  document.getElementById('lang-btn').addEventListener('click', () => {
    AppI18n.setLang(AppI18n.lang === 'ar' ? 'en' : 'ar');
  });

  document.addEventListener('langChange', refreshUI);
  refreshUI();
}

init();
