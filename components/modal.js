// components/modal.js — Bottom sheet modal
const AppModal = {
  overlay: null,
  sheet: null,
  _startY: 0,
  _currentY: 0,

  init() {
    AppModal.overlay = document.getElementById('modal-overlay');
    AppModal.sheet = document.getElementById('modal-sheet');

    // Close on backdrop click
    AppModal.overlay.addEventListener('click', (e) => {
      if (e.target === AppModal.overlay) AppModal.close();
    });

    // Swipe down to close
    AppModal.sheet.addEventListener('touchstart', (e) => {
      AppModal._startY = e.touches[0].clientY;
    }, { passive: true });

    AppModal.sheet.addEventListener('touchmove', (e) => {
      AppModal._currentY = e.touches[0].clientY;
      const diff = AppModal._currentY - AppModal._startY;
      if (diff > 0) AppModal.sheet.style.transform = `translateY(${diff}px)`;
    }, { passive: true });

    AppModal.sheet.addEventListener('touchend', () => {
      const diff = AppModal._currentY - AppModal._startY;
      if (diff > 80) AppModal.close();
      else AppModal.sheet.style.transform = '';
    });
  },

  open(html) {
    AppModal.sheet.innerHTML = html;
    AppModal.sheet.style.transform = '';
    AppModal.overlay.classList.add('active');

    // Bind all [data-close] buttons
    AppModal.sheet.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', AppModal.close);
    });
  },

  close() {
    AppModal.overlay.classList.remove('active');
    AppModal.sheet.style.transform = 'translateY(100%)';
    setTimeout(() => {
      AppModal.sheet.innerHTML = '';
      AppModal.sheet.style.transform = '';
    }, 380);
  }
};
