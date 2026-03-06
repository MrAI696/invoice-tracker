// components/modal.js — Bottom sheet modal
const AppModal = {
  overlay: null,
  sheet: null,
  _startY: 0,
  _currentY: 0,
  _scrollY: 0,

  init() {
    AppModal.overlay = document.getElementById('modal-overlay');
    AppModal.sheet   = document.getElementById('modal-sheet');

    // Close on backdrop tap
    AppModal.overlay.addEventListener('click', (e) => {
      if (e.target === AppModal.overlay) AppModal.close();
    });

    // Swipe down on the drag handle / sheet to close
    AppModal.sheet.addEventListener('touchstart', (e) => {
      AppModal._startY   = e.touches[0].clientY;
      AppModal._currentY = e.touches[0].clientY;
    }, { passive: true });

    AppModal.sheet.addEventListener('touchmove', (e) => {
      AppModal._currentY = e.touches[0].clientY;
      const diff = AppModal._currentY - AppModal._startY;

      // Only drag down, not up
      if (diff > 0) {
        e.preventDefault(); // stops page from scrolling behind modal
        AppModal.sheet.style.transform = `translateY(${diff}px)`;
      }
    }, { passive: false }); // passive: false so we can call preventDefault

    AppModal.sheet.addEventListener('touchend', () => {
      const diff = AppModal._currentY - AppModal._startY;
      if (diff > 80) {
        AppModal.close();
      } else {
        AppModal.sheet.style.transform = '';
      }
    });
  },

  _lockScroll() {
    AppModal._scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top      = `-${AppModal._scrollY}px`;
    document.body.style.width    = '100%';
  },

  _unlockScroll() {
    document.body.style.position = '';
    document.body.style.top      = '';
    document.body.style.width    = '';
    window.scrollTo(0, AppModal._scrollY);
  },

  open(html) {
    AppModal.sheet.innerHTML = html;
    AppModal.sheet.style.transform = '';
    AppModal._lockScroll();
    AppModal.overlay.classList.add('active');

    AppModal.sheet.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', AppModal.close);
    });
  },

  close() {
    AppModal.overlay.classList.remove('active');
    AppModal.sheet.style.transform = 'translateY(100%)';
    AppModal._unlockScroll();
    setTimeout(() => {
      AppModal.sheet.innerHTML = '';
      AppModal.sheet.style.transform = '';
    }, 380);
  }
};
