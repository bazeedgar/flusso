// ===== UTILITIES =====

const Utils = {
  // Format currency
  fmt(amount) {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(parseFloat(amount) || 0);
  },

  // Format date
  fmtDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
  },

  fmtDateFull(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  },

  // Get month/year from date string
  getMonth(dateStr) { return dateStr ? dateStr.slice(5, 7) : ''; },
  getYear(dateStr) { return dateStr ? dateStr.slice(0, 4) : ''; },

  // Filter entries by period
  filterByPeriod(entries, month, year) {
    return entries.filter(e => {
      const d = e.date || e.data || e.scadenza || '';
      if (year !== 'all' && this.getYear(d) !== year) return false;
      if (month !== 'all' && this.getMonth(d) !== month) return false;
      return true;
    });
  },

  // Sum amounts
  sum(entries, field = 'importo') {
    return entries.reduce((acc, e) => acc + (parseFloat(e[field]) || 0), 0);
  },

  // Today in YYYY-MM-DD
  today() {
    return new Date().toISOString().slice(0, 10);
  },

  // All years from entries
  yearsFromEntries(entries) {
    const years = new Set();
    entries.forEach(e => {
      const d = e.date || e.data || e.scadenza || '';
      if (d) years.add(d.slice(0, 4));
    });
    return [...years].sort().reverse();
  },

  // Month names (static, used for date parsing — do not translate)
  MONTHS: ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'],

  // Translated month names for UI display
  get MONTH_NAMES() {
    return Array.from({length: 12}, (_, i) => Lang.t(`month.${i}`));
  },

  // ── Scroll lock (previene lo scroll del body quando un overlay è aperto) ──────
  // Su iOS overflow:hidden non ferma lo scroll da touch: serve body position:fixed,
  // che però azzera lo scroll → va salvato e ripristinato allo sblocco.
  _scrollLocks: 0,
  _scrollY: 0,
  lockScroll() {
    if (++this._scrollLocks !== 1) return;
    this._scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = `-${this._scrollY}px`;
    document.body.classList.add('no-scroll');
  },
  unlockScroll(force = false) {
    if (force) this._scrollLocks = 0;
    else if (--this._scrollLocks > 0) return;
    this._scrollLocks = 0;
    if (!document.body.classList.contains('no-scroll')) return;
    document.body.classList.remove('no-scroll');
    document.body.style.top = '';
    window.scrollTo(0, this._scrollY);
  },

  // Show modal (attachId: pass entry id or temp id to enable attachment section)
  showModal(title, bodyHtml, onSubmit, attachId = null) {
    if (this._modalCloseTimer) { clearTimeout(this._modalCloseTimer); this._modalCloseTimer = null; }
    this.lockScroll();
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    const _ov = document.getElementById('modal-overlay');
    _ov.classList.remove('hidden');
    requestAnimationFrame(() => _ov.classList.add('open'));
    if (onSubmit) {
      const form = document.getElementById('modal-body').querySelector('form');
      if (form) form.addEventListener('submit', (e) => { e.preventDefault(); onSubmit(form); });
    }
    if (attachId) { AttachUI?.open(attachId); }
    else { AttachUI?.close(); }
  },

  closeModal() {
    CustomSelectPicker?._closeImmediate?.();
    document.querySelectorAll('.csel-overlay').forEach(el => el.remove());
    this.unlockScroll(true);
    const _ov = document.getElementById('modal-overlay');
    _ov.classList.remove('open');
    this._modalCloseTimer = setTimeout(() => {
      this._modalCloseTimer = null;
      _ov.classList.add('hidden');
      AttachUI?.close();
    }, 300);
  },

  showLightbox(src) {
    this.lockScroll();
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox-overlay').classList.remove('hidden');
  },

  closeLightbox() {
    this.unlockScroll();
    document.getElementById('lightbox-overlay').classList.add('hidden');
    document.getElementById('lightbox-img').src = '';
  },

  downloadFile(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = filename || 'allegato'; a.click();
  },

  // Confirm dialog
  confirm(message, onConfirm) {
    this.lockScroll();
    document.querySelectorAll('#modal-overlay select').forEach(s => {
      s.dataset.wasDisabled = s.disabled ? '1' : '0';
      s.disabled = true;
    });
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-overlay').classList.remove('hidden');
    const yesBtn = document.getElementById('confirm-yes');
    const noBtn = document.getElementById('confirm-no');
    const overlay = document.getElementById('confirm-overlay');
    const cleanup = () => {
      this.unlockScroll();
      document.querySelectorAll('#modal-overlay select').forEach(s => {
        if (s.dataset.wasDisabled !== '1') s.disabled = false;
        delete s.dataset.wasDisabled;
      });
      overlay.classList.add('hidden');
      overlay.removeEventListener('click', overlayHandler);
    };
    const yesHandler = () => { cleanup(); onConfirm(); yesBtn.removeEventListener('click', yesHandler); noBtn.removeEventListener('click', noHandler); };
    const noHandler = () => { cleanup(); yesBtn.removeEventListener('click', yesHandler); noBtn.removeEventListener('click', noHandler); };
    const overlayHandler = (e) => { if (e.target === overlay) noHandler(); };
    yesBtn.addEventListener('click', yesHandler);
    noBtn.addEventListener('click', noHandler);
    overlay.addEventListener('click', overlayHandler);
  },

  // Get period filter values
  getPeriod() {
    return {
      month: document.getElementById('globalMonth')?.value || 'all',
      year: document.getElementById('globalYear')?.value || 'all'
    };
  },

  // Escapes html
  esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};

// Custom dropdown options (persisted in localStorage)
const CustomOptions = {
  KEY: 'financeApp_customOptions',
  get(key) {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '{}')[key] || []; } catch { return []; }
  },
  add(key, value) {
    try {
      const all = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      if (!all[key]) all[key] = [];
      if (!all[key].includes(value)) all[key].push(value);
      localStorage.setItem(this.KEY, JSON.stringify(all));
    } catch {}
  },
  remove(key, value) {
    try {
      const all = JSON.parse(localStorage.getItem(this.KEY) || '{}');
      if (all[key]) all[key] = all[key].filter(v => v !== value);
      localStorage.setItem(this.KEY, JSON.stringify(all));
    } catch {}
  }
};

// Build a <select> + [+] button wrapper; custom options are merged from storage, sorted A-Z
Utils.selectWithAdd = function(name, baseOptions, selectedValue, optionKey, required = false) {
  const custom = CustomOptions.get(optionKey);
  const all = [...baseOptions, ...custom.filter(c => !baseOptions.includes(c))];
  all.sort((a, b) => a.localeCompare(b, 'it'));
  const req = required ? 'required' : '';
  const opts = all.map(o => `<option value="${Utils.esc(o)}" ${selectedValue === o ? 'selected' : ''}>${Utils.esc(o)}</option>`).join('');
  return `<div class="select-with-add">
    <select name="${Utils.esc(name)}" ${req}><option value="">${Lang.t('common.select_ph')}</option>${opts}</select>
    <button type="button" class="btn btn-icon btn-add-opt" data-opt-key="${Utils.esc(optionKey)}" title="${Lang.t('opts.title')}">＋</button>
  </div>`;
};

// Sort a select's options alphabetically (keeps placeholder at position 0)
Utils._sortSelect = function(select) {
  const selected = select.value;
  const placeholder = select.options[0]?.value === '' ? select.options[0].cloneNode(true) : null;
  const opts = [...select.options].filter(o => o.value !== '').sort((a, b) => a.text.localeCompare(b.text, 'it'));
  while (select.options.length > 0) select.remove(0);
  if (placeholder) select.appendChild(placeholder);
  opts.forEach(o => select.appendChild(o));
  select.value = selected;
};

// Options manager overlay (add + delete custom options)
Utils.showOptionsManager = function(optKey, select) {
  function _render() {
    const custom = CustomOptions.get(optKey);
    let html = '';

    if (custom.length > 0) {
      html += `<div style="margin-bottom:14px">
        <div style="font-weight:600;font-size:13px;margin-bottom:8px">${Lang.t('opts.custom')}</div>
        <div style="display:flex;flex-direction:column;gap:4px">`;
      [...custom].sort((a, b) => a.localeCompare(b, 'it')).forEach(opt => {
        html += `<div class="opts-row">
          <span>${Utils.esc(opt)}</span>
          <button class="btn btn-icon danger btn-del-copt" data-val="${Utils.esc(opt)}" title="${Lang.t('common.delete_entry')}">🗑️</button>
        </div>`;
      });
      html += `</div></div>`;
    } else {
      html += `<p style="color:var(--text-muted);font-size:13px;margin-bottom:14px">${Lang.t('opts.none')}</p>`;
    }

    html += `<div style="border-top:1px solid var(--border);padding-top:12px">
      <div style="font-weight:600;font-size:13px;margin-bottom:8px">${Lang.t('opts.add')}</div>
      <div style="display:flex;gap:8px">
        <input type="text" id="new-copt-input" placeholder="${Lang.t('opts.add_ph')}" style="flex:1" />
        <button class="btn btn-primary btn-sm" id="add-copt-btn">${Lang.t('opts.add_btn')}</button>
      </div>
    </div>`;

    document.getElementById('opts-body').innerHTML = html;

    document.querySelectorAll('.btn-del-copt').forEach(btn => {
      btn.addEventListener('click', () => {
        CustomOptions.remove(optKey, btn.dataset.val);
        [...select.options].forEach(o => { if (o.value === btn.dataset.val) o.remove(); });
        _render();
      });
    });

    const addBtn = document.getElementById('add-copt-btn');
    const input = document.getElementById('new-copt-input');
    if (addBtn && input) {
      addBtn.addEventListener('click', () => {
        const val = input.value.trim();
        if (!val) return;
        CustomOptions.add(optKey, val);
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = val; opt.selected = true;
        select.appendChild(opt);
        Utils._sortSelect(select);
        input.value = '';
        _render();
        setTimeout(() => document.getElementById('new-copt-input')?.focus(), 50);
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); }
      });
      setTimeout(() => input.focus(), 50);
    }
  }

  _render();
  Utils.lockScroll();
  // Disabilita tutti i <select> nel modal sottostante (su Android ignorano z-index e inert)
  document.querySelectorAll('#modal-overlay select').forEach(s => {
    s.dataset.wasDisabled = s.disabled ? '1' : '0';
    s.disabled = true;
  });
  document.getElementById('opts-overlay').classList.remove('hidden');
};

// Global handler: [+] button opens the options manager
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-add-opt');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  btn.classList.remove('popping');
  void btn.offsetWidth;
  btn.classList.add('popping');
  btn.addEventListener('animationend', () => btn.classList.remove('popping'), { once: true });
  const select = btn.closest('.select-with-add')?.querySelector('select');
  if (select) Utils.showOptionsManager(btn.dataset.optKey, select);
});

// Custom select bottom sheet — sostituisce il popup nativo Android
Utils.initCustomSelects = function() {
  document.addEventListener('pointerdown', function(e) {
    const sel = e.target.closest('select');
    if (!sel) return;
    e.preventDefault();
    e.stopPropagation();
    Utils._openCustomSelect(sel);
  }, { capture: true });
};

Utils._openCustomSelect = function(selectEl) {
  const overlay = document.createElement('div');
  overlay.className = 'csel-overlay';

  const sheet = document.createElement('div');
  sheet.className = 'csel-sheet';
  sheet.innerHTML = '<div class="csel-handle"></div>';

  // Trova il testo dell'etichetta associata
  let labelText = '';
  const fg = selectEl.closest('.form-group, .form-row');
  if (fg) labelText = fg.querySelector('label')?.textContent?.trim() || '';
  if (!labelText && selectEl.id)
    labelText = document.querySelector(`label[for="${selectEl.id}"]`)?.textContent?.trim() || '';
  if (labelText) {
    const t = document.createElement('div');
    t.className = 'csel-title';
    t.textContent = labelText;
    sheet.appendChild(t);
  }

  const list = document.createElement('div');
  list.className = 'csel-list';

  let selectedEl = null;
  [...selectEl.options].forEach(opt => {
    const isSel = opt.value === selectEl.value;
    const item = document.createElement('div');
    item.className = 'csel-option' + (isSel ? ' is-sel' : '');
    item.innerHTML = `<span>${Utils.esc(opt.text)}</span><span class="csel-check">✓</span>`;
    if (isSel) selectedEl = item;
    item.addEventListener('click', () => {
      selectEl.value = opt.value;
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      close();
    });
    list.appendChild(item);
  });

  sheet.appendChild(list);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  const close = () => {
    overlay.classList.remove('open');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  };
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    setTimeout(() => selectedEl?.scrollIntoView({ block: 'center', behavior: 'instant' }), 60);
  });
};

// Global modal close
document.getElementById('modal-close-btn').addEventListener('click', () => Utils.closeModal());
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) Utils.closeModal();
});

// Options manager close
Utils.closeOptionsManager = function() {
  Utils.unlockScroll();
  document.getElementById('opts-overlay').classList.add('hidden');
  // Ripristina i <select> del modal
  document.querySelectorAll('#modal-overlay select').forEach(s => {
    if (s.dataset.wasDisabled !== '1') s.disabled = false;
    delete s.dataset.wasDisabled;
  });
};
document.getElementById('opts-close-btn').addEventListener('click', Utils.closeOptionsManager);
document.getElementById('opts-overlay').addEventListener('click', function(e) {
  if (e.target === this) Utils.closeOptionsManager();
});

// Blocca touchmove sui backdrop degli overlay (previene scroll background su Android)
(function() {
  const pairs = [
    ['modal-overlay',   '.modal'],
    ['confirm-overlay', '.confirm-box'],
    ['lightbox-overlay','.lightbox-inner, #lightbox-img'],
    ['opts-overlay',    '.opts-panel'],
    ['camera-overlay',  '.camera-inner, video, button'],
  ];
  pairs.forEach(([id, sel]) => {
    document.getElementById(id)?.addEventListener('touchmove', (e) => {
      if (!e.target.closest(sel)) e.preventDefault();
    }, { passive: false });
  });
})();

// ===== CUSTOM SELECT PICKER =====
// Sostituisce il picker nativo Android (grigio con radio button) con uno styled Flusso
const CustomSelectPicker = {
  _overlay: null,
  _panel:   null,
  _list:    null,
  _current: null,

  init() {
    const el = document.createElement('div');
    el.id = 'csp-overlay';
    el.innerHTML = `<div id="csp-panel"><div id="csp-list"></div></div>`;
    document.body.appendChild(el);
    this._overlay = el;
    this._panel   = el.querySelector('#csp-panel');
    this._list    = el.querySelector('#csp-list');

    el.addEventListener('click', (e) => { if (!e.target.closest('#csp-panel')) this.close(); });
    el.addEventListener('touchmove', (e) => { if (!e.target.closest('#csp-panel')) e.preventDefault(); }, { passive: false });

    // Approccio coordinate: i <select> hanno pointer-events:none (CSS), quindi il touch
    // arriva al loro parent. Controlliamo se il punto tocca il bounding rect di un select.
    const findSelectAt = (x, y) => {
      for (const sel of document.querySelectorAll('.modal-body select, .modal .ricorrente-section select')) {
        if (sel.disabled) continue;
        const r = sel.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue; // nascosto
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return sel;
      }
      return null;
    };

    document.addEventListener('touchstart', (e) => {
      if (this._overlay.style.display !== 'none' && this._overlay.style.display !== '') return;
      const t = e.touches[0];
      const sel = findSelectAt(t.clientX, t.clientY);
      if (!sel) return;
      e.preventDefault();
      e.stopPropagation();
      this.open(sel);
    }, { capture: true, passive: false });

    // Blocca anche click/mousedown sulle stesse aree (eventi sintetici Android)
    document.addEventListener('click', (e) => {
      const sel = findSelectAt(e.clientX, e.clientY);
      if (sel) { e.preventDefault(); e.stopPropagation(); }
    }, { capture: true });
    document.addEventListener('mousedown', (e) => {
      const sel = findSelectAt(e.clientX, e.clientY);
      if (sel) { e.preventDefault(); e.stopPropagation(); }
    }, { capture: true });
  },

  open(select) {
    if (this._current && this._current !== select) this._closeImmediate();
    this._current = select;

    // Trova il titolo dalla <label> più vicina
    const fg = select.closest('.form-group, .ricorrente-section, .palette-slider-row');
    const labelEl = fg?.querySelector('label, .palette-slider-label');
    const title = labelEl ? labelEl.textContent.replace('*','').trim() : '';

    // Costruisce il pannello
    let html = title ? `<div class="csp-title">${Utils.esc(title)}</div>` : '';
    this._list.innerHTML = html;
    [...select.options].forEach(opt => {
      const item = document.createElement('div');
      item.className = 'csp-item' + (opt.value === select.value ? ' csp-selected' : '');
      item.textContent = opt.text || '—';
      item.addEventListener('click', () => {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        this.close();
      });
      this._list.appendChild(item);
    });

    Utils.lockScroll();
    this._closing = false;
    this._overlay.style.display = 'flex';
    // Doppio rAF: assicura che display:flex sia applicato prima di aggiungere la classe
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this._overlay.classList.add('csp-open');
      this._panel.classList.add('csp-open');
      const sel = this._list.querySelector('.csp-selected');
      if (sel) setTimeout(() => sel.scrollIntoView({ block: 'nearest' }), 100);
    }));
  },

  close() {
    if (!this._current || this._closing) return;
    this._closing = true;
    this._panel.classList.remove('csp-open');
    this._overlay.classList.remove('csp-open');
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      this._overlay.style.display = 'none';
      Utils.unlockScroll();
      this._current = null;
      this._closing = false;
    };
    this._panel.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 320);
  },

  _closeImmediate() {
    if (!this._current) return;
    this._panel.classList.remove('csp-open');
    this._overlay.classList.remove('csp-open');
    this._overlay.style.display = 'none';
    if (!this._closing) Utils.unlockScroll();
    this._current = null;
    this._closing = false;
  },
};

CustomSelectPicker.init();

// ── Pagination helpers ────────────────────────────────────────────────────
Utils.PAGE_SIZE = 5;

Utils.paginate = function(items, page, pageSize) {
  pageSize = pageSize || Utils.PAGE_SIZE;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  return {
    items: items.slice(safePage * pageSize, (safePage + 1) * pageSize),
    page: safePage,
    totalPages,
    total
  };
};

Utils.renderPager = function(page, totalPages, dataAttrs) {
  if (totalPages <= 1) return '';
  return `<div class="pager">
    <button class="pager-btn" data-action="page-prev" ${dataAttrs} ${page === 0 ? 'disabled' : ''}>&#8249;</button>
    <span class="pager-info">${page + 1}&thinsp;/&thinsp;${totalPages}</span>
    <button class="pager-btn" data-action="page-next" ${dataAttrs} ${page === totalPages - 1 ? 'disabled' : ''}>&#8250;</button>
  </div>`;
};

// Reverse-translation index: "Ristorante" → "int.restaurant.restaurant", built once at startup
Utils._reverseTranslations = (function() {
  const rev = {};
  for (const dict of Object.values(Translations)) {
    for (const [key, val] of Object.entries(dict)) {
      if (typeof val === 'string' && !(val in rev)) rev[val] = key;
    }
  }
  return rev;
})();

// Resolve any stored value (translated string OR i18n key) to its i18n key
Utils.valueToKey = function(val) {
  if (!val) return val;
  for (const dict of Object.values(Translations)) {
    if (Object.prototype.hasOwnProperty.call(dict, val)) return val;
  }
  return Utils._reverseTranslations[val] || val;
};

Utils.filterEntries = function(entries, query) {
  if (!query) return entries;
  const q = query.toLowerCase();
  return entries.filter(e =>
    Object.values(e).some(v => {
      if (typeof v !== 'string') return false;
      if (v.toLowerCase().includes(q)) return true;
      const tr = Lang.t(Utils.valueToKey(v));
      return tr !== v && tr.toLowerCase().includes(q);
    })
  );
};
