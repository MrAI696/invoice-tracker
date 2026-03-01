/* ============================================
   Invoice Tracker — App Logic
   IndexedDB Storage + Import/Export
   ============================================ */

// ===== DATABASE =====
const DB_NAME = 'InvoiceTrackerDB';
const DB_VERSION = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupg...