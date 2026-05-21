// ===== TAB INTRATTENIMENTO =====
const Intrattenimento = {
  categories: [
    {
      key: 'streaming',
      icon: '📺',
      label: 'int.cat.streaming',
      fields: [
        { name: 'data', label: 'int.streaming.renewal', type: 'date', required: true },
        { name: 'servizio', label: 'int.streaming.service', type: 'select', options: ['Netflix', 'Amazon Prime', 'Disney+', 'NOW TV', 'Apple TV+', 'Spotify', 'Apple Music', 'YouTube Premium', 'Dazn', 'Sky', 'spesa.cat.altro'], required: true },
        { name: 'nome_custom', label: 'int.streaming.name_other', type: 'text' },
        { name: 'importo', label: 'common.amount', type: 'number', step: '0.01', required: true },
        { name: 'frequenza', label: 'int.streaming.freq', type: 'select', options: ['int.streaming.freq.monthly', 'int.streaming.freq.annual', 'int.streaming.freq.quarterly'] },
        { name: 'note', label: 'common.notes', type: 'text', full: true }
      ]
    },
    {
      key: 'ristoranti',
      icon: '🍽️',
      label: 'int.cat.ristoranti',
      fields: [
        { name: 'data', label: 'common.date', type: 'date', required: true },
        { name: 'locale', label: 'int.restaurant.name', type: 'text' },
        { name: 'importo', label: 'common.amount', type: 'number', step: '0.01', required: true },
        { name: 'persone', label: 'int.restaurant.people', type: 'number', min: '1' },
        { name: 'tipo', label: 'common.type', type: 'select', options: ['int.restaurant.restaurant', 'int.restaurant.pizza', 'int.restaurant.trattoria', 'int.restaurant.sushi', 'int.restaurant.fastfood', 'int.restaurant.takeaway', 'int.restaurant.delivery', 'spesa.cat.altro'] },
        { name: 'note', label: 'common.notes', type: 'text', full: true }
      ]
    },
    {
      key: 'bar_caffe',
      icon: '☕',
      label: 'int.cat.bar',
      fields: [
        { name: 'data', label: 'common.date', type: 'date', required: true },
        { name: 'importo', label: 'common.amount', type: 'number', step: '0.01', required: true },
        { name: 'locale', label: 'int.bar.venue', type: 'text' },
        { name: 'note', label: 'common.notes', type: 'text', full: true }
      ]
    },
    {
      key: 'cinema_teatro',
      icon: '🎭',
      label: 'int.cat.cinema',
      fields: [
        { name: 'data', label: 'common.date', type: 'date', required: true },
        { name: 'evento', label: 'int.cinema.event', type: 'text', required: true, full: true },
        { name: 'importo', label: 'common.amount', type: 'number', step: '0.01', required: true },
        { name: 'tipo', label: 'common.type', type: 'select', options: ['int.cinema.cinema', 'int.cinema.theatre', 'int.cinema.concert', 'int.cinema.opera', 'int.cinema.show', 'int.cinema.museum', 'int.cinema.exhibition', 'int.cinema.amusement', 'spesa.cat.altro'] },
        { name: 'biglietti', label: 'int.cinema.tickets', type: 'number', min: '1' },
        { name: 'note', label: 'common.notes', type: 'text', full: true }
      ]
    },
    {
      key: 'sport_palestra',
      icon: '🏋️',
      label: 'int.cat.sport',
      fields: [
        { name: 'data', label: 'common.date', type: 'date', required: true },
        { name: 'importo', label: 'common.amount', type: 'number', step: '0.01', required: true },
        { name: 'tipo', label: 'common.type', type: 'select', options: ['int.sport.gym', 'int.sport.course', 'int.sport.equipment', 'int.sport.subscription', 'int.sport.race', 'int.sport.physio', 'spesa.cat.altro'] },
        { name: 'struttura', label: 'int.sport.venue', type: 'text' },
        { name: 'note', label: 'common.notes', type: 'text', full: true }
      ]
    },
    {
      key: 'hobby',
      icon: '🎮',
      label: 'int.cat.hobby',
      fields: [
        { name: 'data', label: 'common.date', type: 'date', required: true },
        { name: 'descrizione', label: 'int.hobby.desc', type: 'text', required: true, full: true },
        { name: 'importo', label: 'common.amount', type: 'number', step: '0.01', required: true },
        { name: 'categoria', label: 'int.hobby.category', type: 'select', options: ['int.hobby.games', 'int.hobby.books', 'int.hobby.music', 'int.hobby.photo', 'int.hobby.art', 'int.hobby.cooking', 'int.hobby.modeling', 'int.hobby.clothing', 'int.hobby.tech', 'spesa.cat.altro'] },
        { name: 'note', label: 'common.notes', type: 'text', full: true }
      ]
    },
    {
      key: 'viaggi_vacanze',
      icon: '✈️',
      label: 'int.cat.viaggi',
      fields: [
        { name: 'data', label: 'int.travel.departure', type: 'date', required: true },
        { name: 'destinazione', label: 'int.travel.destination', type: 'text', required: true, full: true },
        { name: 'importo', label: 'int.travel.total', type: 'number', step: '0.01', required: true },
        { name: 'tipo', label: 'int.travel.expense_type', type: 'select', options: ['int.travel.flight', 'int.travel.train', 'int.travel.bus', 'int.travel.hotel', 'int.travel.apartment', 'int.travel.package', 'int.travel.excursion', 'int.travel.food', 'spesa.cat.altro'] },
        { name: 'persone', label: 'int.travel.people', type: 'number', min: '1' },
        { name: 'note', label: 'common.notes', type: 'text', full: true }
      ]
    },
    {
      key: 'feste_eventi',
      icon: '🎉',
      label: 'int.cat.feste',
      fields: [
        { name: 'data', label: 'common.date', type: 'date', required: true },
        { name: 'evento', label: 'int.party.event', type: 'text', required: true, full: true },
        { name: 'importo', label: 'common.amount', type: 'number', step: '0.01', required: true },
        { name: 'tipo', label: 'common.type', type: 'select', options: ['int.party.birthday', 'int.party.wedding', 'int.party.gift', 'int.party.dinner', 'int.party.party', 'int.party.baptism', 'int.party.graduation', 'spesa.cat.altro'] },
        { name: 'note', label: 'common.notes', type: 'text', full: true }
      ]
    },
    {
      key: 'altro_intrattenimento',
      icon: '🛍️',
      label: 'int.cat.altro',
      fields: [
        { name: 'data', label: 'common.date', type: 'date', required: true },
        { name: 'descrizione', label: 'common.description', type: 'text', required: true, full: true },
        { name: 'importo', label: 'common.amount', type: 'number', step: '0.01', required: true },
        { name: 'note', label: 'common.notes', type: 'text', full: true }
      ]
    }
  ],

  _pageState: {},

  _state(key) {
    if (!this._pageState[key]) this._pageState[key] = { page: 0, filter: '' };
    return this._pageState[key];
  },

  init() { this._pageState = {}; this._bindEvents(); this.render(); },

  render() {
    const { month, year } = Utils.getPeriod();
    const data = DB.getAll().intrattenimento;
    let html = `<div class="categories-grid">`;

    for (const cat of this.categories) {
      const entries = Utils.filterByPeriod(data[cat.key] || [], month, year);
      const total = Utils.sum(entries);
      html += this._renderCard(cat, entries, total);
    }

    html += `</div>`;
    document.getElementById('tab-intrattenimento').innerHTML = html;
  },

  _renderCard(cat, entries, total) {
    const st = this._state(cat.key);
    const sorted = [...entries].sort((a, b) => (b.data || b.date || '') > (a.data || a.date || '') ? 1 : -1);
    const filtered = Utils.filterEntries(sorted, st.filter);
    const { items: shown, page, totalPages } = Utils.paginate(filtered, st.page);
    const filterHtml = entries.length > 0 ? `
      <div class="card-filter">
        <input class="card-filter-input" type="text" data-action="filter" data-cat="${cat.key}"
          placeholder="🔍 ${Lang.t('common.search')}" value="${Utils.esc(st.filter)}">
      </div>` : '';
    return `
      <div class="category-card" data-card="${cat.key}">
        <div class="card-header">
          <span class="card-title">${cat.icon} ${Lang.t(cat.label)}</span>
          <div class="card-actions">
            ${total > 0 ? `<span class="card-total">${Utils.fmt(total)}</span>` : ''}
            <button class="btn btn-primary btn-sm" data-action="add" data-cat="${cat.key}">+ ${Lang.t('common.add')}</button>
          </div>
        </div>
        ${filterHtml}
        <div class="card-body">
          ${shown.length === 0
            ? `<div class="f-empty-state"><div class="f-empty-icon">${cat.icon}</div>${st.filter ? Lang.t('common.no_results') : Lang.t('common.none_recorded')}</div>`
            : `<div class="f-entry-list">${shown.map(e => this._renderEntry(e, cat)).join('')}</div>`
          }
          ${Utils.renderPager(page, totalPages, `data-cat="${cat.key}"`)}
        </div>
      </div>`;
  },

  _renderEntry(e, cat) {
    const date = e.data || e.date || '';
    const isAltro = Utils.valueToKey(e.servizio || '') === 'spesa.cat.altro';
    const desc = isAltro ? (e.nome_custom || Lang.t('spesa.cat.altro')) : (e.servizio || e.locale || e.evento || e.destinazione || e.descrizione || Lang.t(cat.label));
    return `
      <div class="f-entry-row">
        <div class="f-entry-top">
          <span class="f-entry-date">${Utils.fmtDate(date)}</span>
          <span class="f-entry-desc f-trunc">${Utils.esc(desc)}</span>
        </div>
        <div class="f-entry-bottom">
          ${e.frequenza ? `<span class="f-pill f-pill-green">${Utils.esc(Lang.t(Utils.valueToKey(e.frequenza)))}</span>` : ''}
          ${e.tipo && !e.frequenza ? `<span class="f-pill f-pill-green">${Utils.esc(Lang.t(Utils.valueToKey(e.tipo)))}</span>` : ''}
          ${e.ricorrente ? `<span class="f-pill f-pill-amber">🔄 ${e.ricorrente}</span>` : ''}
          ${e._recurInstance ? `<span class="f-pill f-pill-amber">↩</span>` : ''}
          <span class="f-spacer"></span>
          <span class="f-entry-amount">${Utils.fmt(e.importo)}</span>
          <div class="f-entry-actions">
            <button class="f-btn-edit" data-action="edit-entry" data-cat="${cat.key}" data-id="${e.id}" title="${Lang.t('common.edit')}">✏️</button>
            <button class="f-btn-delete" data-action="del-entry" data-cat="${cat.key}" data-id="${e.id}" title="${Lang.t('common.delete')}">🗑️</button>
          </div>
        </div>
      </div>`;
  },

  _buildForm(cat, existing = null) {
    const isEdit = !!existing;
    let rows = '';
    let pair = [];
    let fulls = [];

    for (const f of cat.fields) {
      const val = existing ? (existing[f.name] || '') : (f.name === 'data' ? Utils.today() : '');
      if (f.full) {
        if (pair.length) { rows += `<div class="form-grid">${pair.join('')}</div>`; pair = []; }
        fulls.push(this._fieldHtml(f, val, true, cat.key));
      } else {
        pair.push(this._fieldHtml(f, val, false, cat.key));
        if (pair.length === 2) { rows += `<div class="form-grid">${pair.join('')}</div>`; pair = []; }
      }
    }
    if (pair.length) rows += `<div class="form-grid">${pair.join('')}</div>`;
    rows += fulls.join('');

    return `<form id="intr-form">
      ${rows}
      <div class="ricorrente-section">
        <label class="ricorrente-row">
          <input type="checkbox" onchange="var s=document.getElementById('recur-freq');s.disabled=!this.checked;s.style.display=this.checked?'inline-block':'none'" ${existing?.ricorrente ? 'checked' : ''} />
          <span>${Lang.t('common.recurring')}</span>
        </label>
        <select name="ricorrente" id="recur-freq" style="display:${existing?.ricorrente ? 'inline-block' : 'none'}" ${existing?.ricorrente ? '' : 'disabled'}>
          <option value="mensile"     ${existing?.ricorrente === 'mensile'     ? 'selected' : ''}>${Lang.t('freq.monthly')}</option>
          <option value="bimestrale"  ${existing?.ricorrente === 'bimestrale'  ? 'selected' : ''}>${Lang.t('freq.bimonthly')}</option>
          <option value="trimestrale" ${existing?.ricorrente === 'trimestrale' ? 'selected' : ''}>${Lang.t('freq.quarterly')}</option>
          <option value="semestrale"  ${existing?.ricorrente === 'semestrale'  ? 'selected' : ''}>${Lang.t('freq.semiannual')}</option>
          <option value="annuale"     ${existing?.ricorrente === 'annuale'     ? 'selected' : ''}>${Lang.t('freq.annual')}</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">${Lang.t('common.cancel')}</button>
        <button type="submit" class="btn btn-primary">${isEdit ? Lang.t('common.save') : Lang.t('common.add')}</button>
      </div>
    </form>`;
  },

  _fieldHtml(f, val, full, catKey = '') {
    const cls = full ? 'form-group full' : 'form-group';
    let input = '';
    if (f.type === 'select') {
      const matchKey = f.options.find(k => k === val || Translations.it?.[k] === val || Translations.en?.[k] === val);
      const normVal = matchKey ? Lang.t(matchKey) : val;
      input = Utils.selectWithAdd(f.name, f.options.map(o => Lang.t(o)), normVal, `intr_${catKey}_${f.name}`, f.required);
    } else {
      const req = f.required ? 'required' : '';
      const attrs = [f.step ? `step="${f.step}"` : '', f.min ? `min="${f.min}"` : ''].filter(Boolean).join(' ');
      input = `<input type="${f.type}" name="${f.name}" value="${Utils.esc(val)}" ${attrs} ${req} />`;
    }
    return `<div class="${cls}"><label>${Lang.t(f.label)}</label>${input}</div>`;
  },

  _bindEvents() {
    document.getElementById('tab-intrattenimento').addEventListener('input', (e) => {
      if (!e.target.matches('.card-filter-input')) return;
      const catKey = e.target.dataset.cat;
      const st = this._state(catKey);
      st.filter = e.target.value;
      st.page = 0;
      const { month, year } = Utils.getPeriod();
      const entries = Utils.filterByPeriod(DB.getAll().intrattenimento[catKey] || [], month, year);
      const cat = this.categories.find(c => c.key === catKey);
      const sorted = [...entries].sort((a, b) => (b.data || b.date || '') > (a.data || a.date || '') ? 1 : -1);
      const filtered = Utils.filterEntries(sorted, st.filter);
      const { items: shown, page, totalPages } = Utils.paginate(filtered, 0);
      const card = document.querySelector(`[data-card="${catKey}"] .card-body`);
      if (!card) return;
      card.innerHTML = (shown.length === 0
        ? `<div class="f-empty-state"><div class="f-empty-icon">${cat.icon}</div>${st.filter ? Lang.t('common.no_results') : Lang.t('common.none_recorded')}</div>`
        : `<div class="f-entry-list">${shown.map(e => this._renderEntry(e, cat)).join('')}</div>`) +
        Utils.renderPager(page, totalPages, `data-cat="${catKey}"`);
    });
    document.getElementById('tab-intrattenimento').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const catKey = btn.dataset.cat;
      const cat = this.categories.find(c => c.key === catKey);

      if (action === 'add') {
        const tempId = 'tmp_' + Date.now();
        Utils.showModal(`${Lang.t('common.add')} - ${Lang.t(cat.label)}`, this._buildForm(cat), (form) => {
          const fd = new FormData(form);
          const entry = {};
          for (const [k, v] of fd.entries()) { if (v.trim()) entry[k] = v.trim(); }
          const saved = DB.addEntry('intrattenimento', catKey, entry);
          ImageStore.move(tempId, saved.id);
          Utils.closeModal();
          this.render();
          App.refreshPeriodSelectors();
        }, tempId);
      } else if (action === 'page-prev') {
        const st = this._state(catKey);
        st.page = Math.max(0, st.page - 1);
        this.render();
      } else if (action === 'page-next') {
        const st = this._state(catKey);
        st.page++;
        this.render();
      } else if (action === 'del-entry') {
        const entryId = btn.dataset.id;
        Utils.confirm(Lang.t('common.delete_entry'), () => {
          DB.removeEntry('intrattenimento', catKey, entryId);
          ImageStore.removeAll(entryId);
          this.render();
        });
      } else if (action === 'edit-entry') {
        const data = DB.getAll().intrattenimento[catKey];
        const existing = data.find(e => e.id === btn.dataset.id);
        if (!existing) return;
        Utils.showModal(`${Lang.t('common.edit')} - ${Lang.t(cat.label)}`, this._buildForm(cat, existing), (form) => {
          const fd = new FormData(form);
          const updates = {};
          for (const [k, v] of fd.entries()) { updates[k] = v.trim(); }
          DB.updateEntry('intrattenimento', catKey, existing.id, updates);
          Utils.closeModal();
          this.render();
        }, existing.id);
      }
    });
  },

  openPrefilled(categoryKey, entry, photoId = null) {
    const cat = this.categories.find(c => c.key === categoryKey);
    if (!cat) return;
    const tempId = photoId || ('tmp_' + Date.now());
    Utils.showModal(`${Lang.t('common.add')} - ${Lang.t(cat.label)}`, this._buildForm(cat, entry), (form) => {
      const fd = new FormData(form);
      const e = {};
      for (const [k, v] of fd.entries()) { if (v.trim()) e[k] = v.trim(); }
      const saved = DB.addEntry('intrattenimento', categoryKey, e);
      ImageStore.move(tempId, saved.id);
      Utils.closeModal();
      this.render();
      App.refreshPeriodSelectors();
    }, tempId);
  },

  getTotal(month, year) {
    const data = DB.getAll().intrattenimento;
    let total = 0;
    for (const key of Object.keys(data)) {
      total += Utils.sum(Utils.filterByPeriod(data[key] || [], month, year));
    }
    return total;
  },

  getTotalByCategory(month, year) {
    const data = DB.getAll().intrattenimento;
    const result = {};
    for (const cat of this.categories) {
      const t = Utils.sum(Utils.filterByPeriod(data[cat.key] || [], month, year));
      if (t > 0) result[Lang.t(cat.label)] = t;
    }
    return result;
  }
};
