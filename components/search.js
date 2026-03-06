// components/search.js — Reusable search with debounce
const AppSearch = {
  /**
   * Attach search behavior to an input
   * @param {string} inputId
   * @param {function} onSearch - called with query string
   * @param {number} debounce - ms delay (default 250)
   */
  bind(inputId, onSearch, debounce = 250) {
    const input = document.getElementById(inputId);
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => onSearch(input.value.trim()), debounce);
    });
  },

  /**
   * Filter an array by query across given keys
   * @param {Array} items
   * @param {string} query
   * @param {string[]} keys
   */
  filter(items, query, keys) {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(item =>
      keys.some(key => String(item[key] || '').toLowerCase().includes(q))
    );
  }
};
