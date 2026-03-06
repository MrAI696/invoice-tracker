// core/i18n.js — Translation system
const AppI18n = {
  lang: localStorage.getItem('lang') || 'ar',

  translations: {
    ar: {
      appName: 'كشوفاتي',
      emptyState: 'لا توجد كشوفات بعد',
      emptyStateHint: 'اضغط على الزر أدناه لإنشاء كشف جديد',
      createSheet: 'إنشاء كشف',
      searchPlaceholder: 'ابحث عن كشف...',
      sheetName: 'اسم الكشف',
      sheetYear: 'السنة',
      sheetNamePlaceholder: 'مثال: كشف يناير',
      cancel: 'إلغاء',
      create: 'إنشاء',
      sheetCreated: 'تم إنشاء الكشف بنجاح ✓',
      sheetNameRequired: 'الرجاء إدخال اسم الكشف',
      noResults: 'لا توجد نتائج للبحث',
    },
    en: {
      appName: 'My Sheets',
      emptyState: 'No sheets yet',
      emptyStateHint: 'Press the button below to create a new sheet',
      createSheet: 'Create Sheet',
      searchPlaceholder: 'Search sheets...',
      sheetName: 'Sheet Name',
      sheetYear: 'Year',
      sheetNamePlaceholder: 'e.g. January Sheet',
      cancel: 'Cancel',
      create: 'Create',
      sheetCreated: 'Sheet created successfully ✓',
      sheetNameRequired: 'Please enter a sheet name',
      noResults: 'No results found',
    }
  },

  t(key) {
    return AppI18n.translations[AppI18n.lang][key] || key;
  },

  setLang(lang) {
    AppI18n.lang = lang;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.dispatchEvent(new CustomEvent('langChange'));
  },

  init() {
    document.documentElement.lang = AppI18n.lang;
    document.documentElement.dir = AppI18n.lang === 'ar' ? 'rtl' : 'ltr';
  }
};
