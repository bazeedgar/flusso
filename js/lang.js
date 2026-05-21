const Lang = {
  _current: localStorage.getItem('financeApp_lang') || 'it',

  init() {
    this._current = localStorage.getItem('financeApp_lang') || 'it';
  },

  get current() { return this._current; },

  t(key, vars = {}) {
    const dict = Translations[this._current] || Translations.it;
    let str = dict[key];
    if (str === undefined) str = Translations.it[key] ?? key;
    for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
    return str;
  },

  set(lang) {
    this._current = lang;
    localStorage.setItem('financeApp_lang', lang);
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = this.t(el.dataset.i18nPh);
    });
    if (typeof DB !== 'undefined' && DB._lastStatus) DB._setSaveStatus(DB._lastStatus);
    if (typeof App !== 'undefined') App._activateTab(App.currentTab);
  }
};
