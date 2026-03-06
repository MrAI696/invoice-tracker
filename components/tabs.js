// components/tabs.js — Bottom tab bar logic
const AppTabs = {
  current: 'main',

  init() {
    // Inject tab icons
    document.getElementById('tab-icon-main').innerHTML      = Icons.get('home', 20);
    document.getElementById('tab-icon-suppliers').innerHTML = Icons.get('users', 20);
    document.getElementById('tab-icon-settings').innerHTML  = Icons.get('settings', 20);

    // Render dynamic views
    AppTabs._renderSuppliers();
    AppTabs._renderSettings();

    // Tab click handlers
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => AppTabs.switch(btn.dataset.tab));
    });

    // Re-render on language change
    document.addEventListener('langChange', () => {
      AppTabs._renderSuppliers();
      AppTabs._renderSettings();
      AppTabs._updateLabels();
    });
  },

  switch(tab) {
    AppTabs.current = tab;

    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('tab-btn--active', btn.dataset.tab === tab);
    });

    // Show / hide views
    document.querySelectorAll('.tab-view').forEach(view => {
      if (view.dataset.view === tab) {
        view.removeAttribute('hidden');
      } else {
        view.setAttribute('hidden', '');
      }
    });

    // FAB only on main tab
    document.querySelector('.fab-wrap').style.display = tab === 'main' ? '' : 'none';

    // Search bar and title only on main tab
    document.querySelector('.search-wrap').style.display = tab === 'main' ? '' : 'none';
    document.getElementById('app-title').style.display  = tab === 'main' ? '' : 'none';
  },

  _renderSuppliers() {
    const el = document.getElementById('suppliers-container');
    if (!el) return;
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${Icons.get('users', 28)}</div>
        <div class="empty-title">${AppI18n.t('suppliersEmpty')}</div>
        <div class="empty-hint">${AppI18n.t('suppliersEmptyHint')}</div>
      </div>
    `;
  },

  _renderSettings() {
    const el = document.getElementById('settings-container');
    if (!el) return;
    const isAr = AppI18n.lang === 'ar';
    el.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">${AppI18n.t('settingsGeneral')}</div>
        <div class="settings-card">
          <div class="settings-row">
            <span class="settings-row-label">${AppI18n.t('settingsLanguage')}</span>
            <div class="lang-switch">
              <button class="lang-opt ${isAr  ? 'lang-opt--active' : ''}" data-lang="ar">عربي</button>
              <button class="lang-opt ${!isAr ? 'lang-opt--active' : ''}" data-lang="en">EN</button>
            </div>
          </div>
        </div>
      </div>
    `;
    el.querySelectorAll('.lang-opt').forEach(btn => {
      btn.addEventListener('click', () => AppI18n.setLang(btn.dataset.lang));
    });
  },

  _updateLabels() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const label = btn.querySelector('.tab-label');
      if (label) label.textContent = AppI18n.t('tab_' + btn.dataset.tab);
    });
  }
};
