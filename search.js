/* search.js — Smart Search with Fuzzy Matching (Arabic-aware) */

const Search = (() => {

  // Arabic normalizations: remove diacritics, normalize alef/taa/yaa variants
  function normalizeAr(str) {
    return str
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, '') // diacritics
      .replace(/[إأآا]/g, 'ا')  // alef variants
      .replace(/ة/g, 'ه')       // taa marbuta → haa
      .replace(/ى/g, 'ي')       // alef maqsura → yaa
      .replace(/ؤ/g, 'و')       // waw hamza
      .replace(/ئ/g, 'ي')       // yaa hamza
      .toLowerCase()
      .trim();
  }

  // Levenshtein distance
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const d = Array.from({ length: m + 1 }, (_, i) => {
      const row = new Array(n + 1);
      row[0] = i;
      return row;
    });
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      }
    }
    return d[m][n];
  }

  // Fuzzy match score: 0 = no match, higher = better match
  function fuzzyScore(query, target) {
    const q = normalizeAr(query);
    const t = normalizeAr(target);

    if (!q || !t) return 0;

    // Exact match
    if (t === q) return 100;

    // Contains
    if (t.includes(q)) return 80;

    // Starts with
    if (t.startsWith(q)) return 90;

    // Word-level: any word starts with query
    const words = t.split(/\s+/);
    for (const w of words) {
      if (w.startsWith(q)) return 75;
      if (w.includes(q)) return 65;
    }

    // Fuzzy: check each word
    let bestWordScore = 0;
    for (const w of words) {
      const dist = levenshtein(q, w);
      const maxLen = Math.max(q.length, w.length);
      if (maxLen === 0) continue;
      const similarity = 1 - (dist / maxLen);
      if (similarity > 0.5) {
        const score = similarity * 60;
        if (score > bestWordScore) bestWordScore = score;
      }
    }
    if (bestWordScore > 0) return bestWordScore;

    // Subsequence match (letters appear in order)
    let qi = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) qi++;
    }
    if (qi === q.length) return 40;

    // Partial prefix on full string
    const prefixLen = commonPrefix(q, t);
    if (prefixLen >= 2) return 20 + prefixLen * 3;

    return 0;
  }

  function commonPrefix(a, b) {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  }

  // Arabic numeral conversion for searching amounts
  function toWestern(str) {
    return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  }

  /**
   * Search invoices with smart fuzzy matching
   * @param {string} query - search term
   * @param {Array} invoices - invoice objects
   * @param {Array} suppliers - supplier objects
   * @returns {Array} sorted results with scores: [{item, score, matchField}]
   */
  function searchInvoices(query, invoices, suppliers) {
    if (!query || !query.trim()) return [];

    const q = query.trim();
    const qWestern = toWestern(q);
    const results = [];

    for (const inv of invoices) {
      let bestScore = 0;
      let matchField = '';

      // Match supplier name
      const nameScore = fuzzyScore(q, inv.supplierName);
      if (nameScore > bestScore) { bestScore = nameScore; matchField = 'المورد'; }

      // Match note
      if (inv.note) {
        const noteScore = fuzzyScore(q, inv.note);
        if (noteScore > bestScore) { bestScore = noteScore; matchField = 'ملاحظة'; }
      }

      // Match payment method (Arabic)
      const payAr = { Cash: 'نقد', Card: 'بطاقة', Transfer: 'تحويل', Transferred: 'تم التحويل' };
      const payScore = fuzzyScore(q, payAr[inv.payment] || inv.payment);
      if (payScore > bestScore) { bestScore = payScore; matchField = 'طريقة الدفع'; }

      // Match amount (as string)
      const amtStr = String(inv.amount);
      if (qWestern && amtStr.includes(qWestern)) {
        const s = 70;
        if (s > bestScore) { bestScore = s; matchField = 'المبلغ'; }
      }

      // Match date
      if (inv.date && inv.date.includes(qWestern || q)) {
        const s = 60;
        if (s > bestScore) { bestScore = s; matchField = 'التاريخ'; }
      }

      if (bestScore > 15) {
        results.push({ item: inv, score: bestScore, matchField });
      }
    }

    // Sort by score descending, then by date descending
    results.sort((a, b) => b.score - a.score || b.item.date.localeCompare(a.item.date));
    return results;
  }

  /**
   * Search suppliers with fuzzy matching
   * @param {string} query
   * @param {Array} suppliers
   * @returns {Array} sorted results
   */
  function searchSuppliers(query, suppliers) {
    if (!query || !query.trim()) return suppliers;

    const q = query.trim();
    const results = [];

    for (const s of suppliers) {
      const score = fuzzyScore(q, s.name);

      // Also check payment method
      const payAr = { Cash: 'نقد', Card: 'بطاقة', Transfer: 'تحويل', Transferred: 'تم التحويل' };
      const payScore = fuzzyScore(q, payAr[s.defaultPayment] || '');
      const best = Math.max(score, payScore);

      if (best > 15) {
        results.push({ item: s, score: best });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.map(r => r.item);
  }

  /**
   * Universal search across both invoices and suppliers
   */
  function searchAll(query, invoices, suppliers) {
    const invResults = searchInvoices(query, invoices, suppliers);
    const suppResults = searchSuppliers(query, suppliers);
    return { invoices: invResults, suppliers: suppResults };
  }

  return { searchInvoices, searchSuppliers, searchAll, normalizeAr, fuzzyScore };
})();
