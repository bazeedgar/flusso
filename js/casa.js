// ===== TAB CASA =====
const Casa = {
  subCategories: [
    { key: 'mutuo_affitto',             icon: '🏠', label: 'casa.cat.mutuo' },
    { key: 'elettricita',               icon: '⚡', label: 'casa.cat.elettricita' },
    { key: 'gas',                       icon: '🔥', label: 'casa.cat.gas' },
    { key: 'acqua',                     icon: '💧', label: 'casa.cat.acqua' },
    { key: 'internet_telefono',         icon: '📡', label: 'casa.cat.internet' },
    { key: 'condominio',                icon: '🏢', label: 'casa.cat.condominio' },
    { key: 'assicurazione_casa',        icon: '🛡️', label: 'casa.cat.assicurazione' },
    { key: 'manutenzione_ordinaria',    icon: '🔧', label: 'casa.cat.manutenzione' },
    { key: 'manutenzione_straordinaria',icon: '🏗️', label: 'casa.cat.straordinaria' },
    { key: 'altro_casa',               icon: '📦', label: 'casa.cat.altro' }
  ],

  _pageState: {},

  _state(key) {
    if (!this._pageState[key]) this._pageState[key] = { page: 0, filter: '' };
    return this._pageState[key];
  },

  init() { this._pageState = {}; this._bindEvents(); this.render(); },

  render() {
    const { month, year } = Utils.getPeriod();
    const immobili = DB.getAll().casa.immobili;

    let html = `<div class="f-modules-list">`;
    for (const im of immobili) {
      html += this._renderImmobile(im, month, year);
    }
    html += `
      <div style="padding:0 14px 14px">
        <button class="add-vehicle-card" id="add-immobile-btn" data-action="add-immobile">
          <div style="font-size:32px;margin-bottom:8px">🏠</div>
          <div style="font-weight:600">${Lang.t('casa.add')}</div>
          <div style="font-size:12px;margin-top:4px;opacity:.7">${Lang.t('casa.empty')}</div>
        </button>
      </div>
    </div>`;

    document.getElementById('tab-casa').innerHTML = html;
  },

  _renderImmobile(im, month, year) {
    const totalAll = this._immobileTotal(im, month, year);
    const mutuo = Utils.sum(Utils.filterByPeriod(im.mutuo_affitto || [], month, year));
    const utenze = Utils.sum(Utils.filterByPeriod(im.elettricita || [], month, year))
                 + Utils.sum(Utils.filterByPeriod(im.gas || [], month, year))
                 + Utils.sum(Utils.filterByPeriod(im.acqua || [], month, year));
    const manut  = Utils.sum(Utils.filterByPeriod(im.manutenzione_ordinaria || [], month, year))
                 + Utils.sum(Utils.filterByPeriod(im.manutenzione_straordinaria || [], month, year));
    const altro  = Math.max(0, totalAll - mutuo - utenze - manut);

    return `
      <div class="f-module-wrapper" data-imid="${im.id}">
        <div class="f-module-header">
          <div class="f-module-header-top">
            <div>
              <div class="f-module-title">${Utils.esc(im.nome)}</div>
              <div class="f-module-subtitle">${Utils.esc(im.tipo || '')}${im.indirizzo ? ' · ' + Utils.esc(im.indirizzo) : ''}</div>
            </div>
            <div class="f-module-header-actions">
              <button class="f-header-btn edit" data-action="edit-immobile" data-imid="${im.id}" title="${Lang.t('common.edit')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="f-header-btn delete" data-action="del-immobile" data-imid="${im.id}" title="${Lang.t('common.delete')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
            </div>
          </div>
          <div class="f-module-total">${Utils.fmt(totalAll)} <span class="f-module-total-label">${Lang.t('casa.total')}</span></div>
          <div class="f-module-stats cols-4">
            <div class="f-stat-chip"><div class="f-stat-label">${Lang.t('casa.cat.mutuo')}</div><div class="f-stat-value">${Utils.fmt(mutuo)}</div></div>
            <div class="f-stat-chip"><div class="f-stat-label">${Lang.t('casa.stat.utilities')}</div><div class="f-stat-value">${Utils.fmt(utenze)}</div></div>
            <div class="f-stat-chip"><div class="f-stat-label">${Lang.t('casa.cat.manutenzione')}</div><div class="f-stat-value">${Utils.fmt(manut)}</div></div>
            <div class="f-stat-chip"><div class="f-stat-label">${Lang.t('casa.stat.other')}</div><div class="f-stat-value">${Utils.fmt(altro)}</div></div>
          </div>
        </div>

        <div class="f-tab-row">
          ${this.subCategories.map((sc, i) => `
            <button class="f-tab-btn ${i===0?'active':''}" data-action="ctab" data-imid="${im.id}" data-sub="${sc.key}">
              ${sc.icon} ${Lang.t(sc.label)}
            </button>`).join('')}
        </div>

        ${this.subCategories.map((sc, i) => `
          <div class="f-tab-panel ${i===0?'active':''}" id="ctp-${im.id}-${sc.key}">
            ${this._renderSubTab(im, sc, month, year)}
          </div>`).join('')}
      </div>`;
  },

  _renderSubTab(im, sc, month, year) {
    const entries = Utils.filterByPeriod(im[sc.key] || [], month, year);
    const stateKey = im.id + '_' + sc.key;
    const st = this._state(stateKey);
    const sorted = [...entries].sort((a, b) => (b.data || '') > (a.data || '') ? 1 : -1);
    const filtered = Utils.filterEntries(sorted, st.filter);
    const { items: shown, page, totalPages } = Utils.paginate(filtered, st.page);

    const addBtn = `<div class="f-section-header">
      <span class="f-section-title">${sc.icon} ${Lang.t(sc.label)}</span>
      <button class="f-btn-add" data-action="add-centry" data-imid="${im.id}" data-sub="${sc.key}">+ ${Lang.t('common.add')}</button>
    </div>`;

    const filterHtml = entries.length > 0 ? `
      <div class="f-filter-wrap">
        <input class="card-filter-input" type="text" data-action="cfilter" data-cat="${sc.key}" data-imid="${im.id}"
          placeholder="🔍 ${Lang.t('common.search')}" value="${Utils.esc(st.filter)}">
      </div>` : '';

    const bodyContent = shown.length === 0
      ? `<div class="f-empty-state"><div class="f-empty-icon">📋</div>${st.filter ? Lang.t('common.no_results') : Lang.t('common.none_recorded')}</div>`
      : `<div class="f-entry-list">${shown.map(e => this._renderCEntry(e, im.id, sc)).join('')}</div>`;

    return `<div class="f-sub-card" data-card="${stateKey}">
      ${addBtn}
      ${filterHtml}
      <div class="card-body">
        ${bodyContent}
        ${Utils.renderPager(page, totalPages, `data-cat="${sc.key}" data-imid="${im.id}"`)}
      </div>
    </div>`;
  },

  _renderCEntry(e, imid, sc) {
    let desc = '', badge = '';
    switch (sc.key) {
      case 'mutuo_affitto':             desc = e.tipo || Lang.t('casa.cat.mutuo'); break;
      case 'elettricita':               desc = e.fornitore || Lang.t('casa.cat.elettricita'); badge = e.kwh ? e.kwh + ' kWh' : ''; break;
      case 'gas':                       desc = e.fornitore || Lang.t('casa.cat.gas');         badge = e.smc ? e.smc + ' Sm³' : ''; break;
      case 'acqua':                     desc = Lang.t('casa.cat.acqua');                       badge = e.mc ? e.mc + ' mc' : ''; break;
      case 'internet_telefono':         desc = e.gestore || e.tipo || Lang.t('casa.cat.internet'); break;
      case 'condominio':                desc = e.tipo || Lang.t('casa.cat.condominio'); break;
      case 'assicurazione_casa':        desc = e.compagnia || Lang.t('casa.cat.assicurazione'); badge = e.scadenza ? Lang.t('casa.ins.expiry_short') + ' ' + Utils.fmtDate(e.scadenza) : ''; break;
      case 'manutenzione_ordinaria':    desc = e.tipo || Lang.t('casa.cat.manutenzione'); badge = e.fornitore || ''; break;
      case 'manutenzione_straordinaria':desc = e.tipo || Lang.t('casa.cat.straordinaria'); badge = e.fornitore || ''; break;
      case 'altro_casa':                desc = e.descrizione || e.categoria || Lang.t('casa.cat.altro'); break;
    }
    const pills = (badge ? `<span class="f-pill f-pill-green">${Utils.esc(badge)}</span>` : '')
      + (e.periodicita ? `<span class="f-pill f-pill-purple">${Utils.esc(e.periodicita)}</span>` : '')
      + (e.ricorrente ? `<span class="f-pill f-pill-amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" style="vertical-align:middle"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> ${e.ricorrente}</span>` : '')
      + (e._recurInstance ? `<span class="f-pill f-pill-amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" style="vertical-align:middle"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></span>` : '')
      + (e.note ? `<span class="f-pill f-pill-amber" title="${Utils.esc(e.note)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" style="vertical-align:middle"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>` : '');
    const actions = `<div class="f-entry-actions">
            <button class="f-btn-edit" data-action="edit-centry" data-imid="${imid}" data-sub="${sc.key}" data-id="${e.id}" title="${Lang.t('common.edit')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="f-btn-delete" data-action="del-centry" data-imid="${imid}" data-sub="${sc.key}" data-id="${e.id}" title="${Lang.t('common.delete')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
          </div>`;
    return `
      <div class="f-entry-row">
        <div class="f-entry-top">
          <span class="f-entry-date">${Utils.fmtDate(e.data)}</span>
          <span class="f-entry-desc f-trunc">${Utils.esc(desc)}</span>
          <span class="f-entry-amount">${Utils.fmt(e.importo)}</span>
          ${!pills ? actions : ''}
        </div>
        ${pills ? `<div class="f-entry-bottom">${pills}<span class="f-spacer"></span>${actions}</div>` : ''}
      </div>`;
  },

  _immobileTotal(im, month, year) {
    return this.subCategories.reduce((acc, sc) =>
      acc + Utils.sum(Utils.filterByPeriod(im[sc.key] || [], month, year)), 0);
  },

  // ===== FORMS =====
  _immobileForm(existing = null) {
    const im = existing || {};
    const tipi = [Lang.t('casa.tipo.main'), Lang.t('casa.tipo.second'), Lang.t('casa.tipo.rental'), Lang.t('casa.tipo.office'), Lang.t('casa.tipo.garage'), Lang.t('casa.tipo.other')];
    return `<form id="immobile-form">
      <div class="form-grid">
        <div class="form-group">
          <label>${Lang.t('casa.form.name')}</label>
          <input type="text" name="nome" value="${Utils.esc(im.nome||'')}" required placeholder="${Lang.t('casa.form.name_ph')}" />
        </div>
        <div class="form-group">
          <label>${Lang.t('casa.form.type')}</label>
          ${Utils.selectWithAdd('tipo', tipi, im.tipo||'', 'casa_immobile_tipo')}
        </div>
        <div class="form-group full">
          <label>${Lang.t('casa.form.address')}</label>
          <input type="text" name="indirizzo" value="${Utils.esc(im.indirizzo||'')}" placeholder="${Lang.t('casa.form.address_ph')}" />
        </div>
        <div class="form-group">
          <label>${Lang.t('casa.form.surface')}</label>
          <input type="number" name="superficie" value="${Utils.esc(im.superficie||'')}" placeholder="${Lang.t('casa.form.surface_ph')}" />
        </div>
        <div class="form-group">
          <label>${Lang.t('casa.form.year')}</label>
          <input type="number" name="anno_acquisto" value="${Utils.esc(im.anno_acquisto||'')}" placeholder="${Lang.t('casa.form.year_ph')}" />
        </div>
        <div class="form-group full">
          <label>${Lang.t('common.notes')}</label>
          <input type="text" name="note" value="${Utils.esc(im.note||'')}" />
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">${Lang.t('common.cancel')}</button>
        <button type="submit" class="btn btn-primary">${existing ? Lang.t('common.save') : Lang.t('casa.add')}</button>
      </div>
    </form>`;
  },

  _entryForm(subKey, existing = null) {
    const e = existing || {};
    const isEdit = !!existing;
    let fields = '';

    const dateField    = `<div class="form-group"><label>${Lang.t('common.date')} *</label><input type="date" name="data" value="${e.data||Utils.today()}" required /></div>`;
    const importoField = `<div class="form-group"><label>${Lang.t('common.amount')} *</label><input type="number" name="importo" value="${e.importo||''}" step="0.01" required /></div>`;
    const periOpts  = [Lang.t('freq.monthly'), Lang.t('freq.bimonthly'), Lang.t('freq.quarterly'), Lang.t('freq.semiannual'), Lang.t('freq.annual'), Lang.t('freq.one_time')];
    const periField = `<div class="form-group"><label>${Lang.t('common.frequency')}</label>${Utils.selectWithAdd('periodicita', periOpts, e.periodicita||'', 'casa_periodicita')}</div>`;
    const noteField    = `<div class="form-group full"><label>${Lang.t('common.notes')}</label><input type="text" name="note" value="${Utils.esc(e.note||'')}" /></div>`;
    const recurField = `<div class="ricorrente-section">
      <label class="ricorrente-row">
        <input type="checkbox" onchange="var s=document.getElementById('recur-freq');s.disabled=!this.checked;s.style.display=this.checked?'inline-block':'none'" ${e.ricorrente ? 'checked' : ''} />
        <span>${Lang.t('common.recurring')}</span>
      </label>
      <select name="ricorrente" id="recur-freq" style="display:${e.ricorrente ? 'inline-block' : 'none'}" ${e.ricorrente ? '' : 'disabled'}>
        <option value="mensile"     ${e.ricorrente === 'mensile'     ? 'selected' : ''}>${Lang.t('freq.monthly')}</option>
        <option value="bimestrale"  ${e.ricorrente === 'bimestrale'  ? 'selected' : ''}>${Lang.t('freq.bimonthly')}</option>
        <option value="trimestrale" ${e.ricorrente === 'trimestrale' ? 'selected' : ''}>${Lang.t('freq.quarterly')}</option>
        <option value="semestrale"  ${e.ricorrente === 'semestrale'  ? 'selected' : ''}>${Lang.t('freq.semiannual')}</option>
        <option value="annuale"     ${e.ricorrente === 'annuale'     ? 'selected' : ''}>${Lang.t('freq.annual')}</option>
      </select>
    </div>`;

    if (subKey === 'mutuo_affitto') {
      fields = `<div class="form-grid">
        ${dateField}${importoField}
        <div class="form-group"><label>${Lang.t('common.type')}</label>${Utils.selectWithAdd('tipo',[Lang.t('casa.mutuo.mortgage'),Lang.t('casa.mutuo.rent'),Lang.t('casa.mutuo.deposit'),Lang.t('casa.cat.altro')],e.tipo||'','casa_mutuo_tipo')}</div>
        ${periField}${noteField}</div>`;
    } else if (subKey === 'elettricita') {
      fields = `<div class="form-grid">
        ${dateField}${importoField}
        <div class="form-group"><label>${Lang.t('casa.electric.kwh')}</label><input type="number" name="kwh" value="${e.kwh||''}" step="0.1" /></div>
        <div class="form-group"><label>${Lang.t('common.supplier')}</label><input type="text" name="fornitore" value="${Utils.esc(e.fornitore||'')}" /></div>
        ${periField}${noteField}</div>`;
    } else if (subKey === 'gas') {
      fields = `<div class="form-grid">
        ${dateField}${importoField}
        <div class="form-group"><label>${Lang.t('casa.gas.sm3')}</label><input type="number" name="smc" value="${e.smc||''}" step="0.1" /></div>
        <div class="form-group"><label>${Lang.t('common.supplier')}</label><input type="text" name="fornitore" value="${Utils.esc(e.fornitore||'')}" /></div>
        ${periField}${noteField}</div>`;
    } else if (subKey === 'acqua') {
      fields = `<div class="form-grid">
        ${dateField}${importoField}
        <div class="form-group"><label>${Lang.t('casa.water.mc')}</label><input type="number" name="mc" value="${e.mc||''}" step="0.01" /></div>
        ${periField}${noteField}</div>`;
    } else if (subKey === 'internet_telefono') {
      fields = `<div class="form-grid">
        ${dateField}${importoField}
        <div class="form-group"><label>${Lang.t('casa.internet.provider')}</label><input type="text" name="gestore" value="${Utils.esc(e.gestore||'')}" /></div>
        <div class="form-group"><label>${Lang.t('common.type')}</label>${Utils.selectWithAdd('tipo',[Lang.t('casa.internet.fiber'),Lang.t('casa.internet.mobile'),Lang.t('casa.internet.bundle'),Lang.t('casa.internet.landline'),Lang.t('casa.cat.altro')],e.tipo||'','casa_internet_tipo')}</div>
        ${periField}${noteField}</div>`;
    } else if (subKey === 'condominio') {
      fields = `<div class="form-grid">
        ${dateField}${importoField}
        <div class="form-group"><label>${Lang.t('common.type')}</label>${Utils.selectWithAdd('tipo',[Lang.t('casa.condo.fees'),Lang.t('casa.condo.imu'),Lang.t('casa.condo.tari'),Lang.t('casa.condo.extra'),Lang.t('casa.cat.altro')],e.tipo||'','casa_condominio_tipo')}</div>
        ${periField}${noteField}</div>`;
    } else if (subKey === 'assicurazione_casa') {
      fields = `<div class="form-grid">
        ${dateField}${importoField}
        <div class="form-group"><label>${Lang.t('casa.ins.company')}</label><input type="text" name="compagnia" value="${Utils.esc(e.compagnia||'')}" /></div>
        <div class="form-group"><label>${Lang.t('casa.ins.expiry')}</label><input type="date" name="scadenza" value="${e.scadenza||''}" /></div>
        <div class="form-group"><label>${Lang.t('casa.ins.number')}</label><input type="text" name="polizza" value="${Utils.esc(e.polizza||'')}" /></div>
        ${periField}${noteField}</div>`;
    } else if (subKey === 'manutenzione_ordinaria') {
      fields = `<div class="form-grid">
        ${dateField}${importoField}
        <div class="form-group"><label>${Lang.t('casa.mnt.type')}</label>${Utils.selectWithAdd('tipo',[Lang.t('casa.mnt.cleaning'),Lang.t('casa.mnt.garden'),Lang.t('casa.mnt.plumber'),Lang.t('casa.mnt.electrician'),Lang.t('casa.mnt.builder'),Lang.t('casa.mnt.painting'),Lang.t('casa.mnt.boiler'),Lang.t('casa.mnt.ac'),Lang.t('casa.cat.altro')],e.tipo||'','casa_manut_ord_tipo')}</div>
        <div class="form-group"><label>${Lang.t('casa.mnt.supplier')}</label><input type="text" name="fornitore" value="${Utils.esc(e.fornitore||'')}" /></div>
        ${periField}${noteField}</div>`;
    } else if (subKey === 'manutenzione_straordinaria') {
      fields = `<div class="form-grid">
        ${dateField}${importoField}
        <div class="form-group full"><label>${Lang.t('casa.extra.works')}</label><input type="text" name="tipo" value="${Utils.esc(e.tipo||'')}" required placeholder="${Lang.t('casa.extra.works_ph')}" /></div>
        <div class="form-group"><label>${Lang.t('casa.extra.supplier')}</label><input type="text" name="fornitore" value="${Utils.esc(e.fornitore||'')}" /></div>
        ${periField}${noteField}</div>`;
    } else if (subKey === 'altro_casa') {
      fields = `<div class="form-grid">
        ${dateField}${importoField}
        <div class="form-group full"><label>${Lang.t('casa.other.desc')}</label><input type="text" name="descrizione" value="${Utils.esc(e.descrizione||'')}" required /></div>
        <div class="form-group"><label>${Lang.t('casa.other.cat')}</label>${Utils.selectWithAdd('categoria',[Lang.t('casa.other.furniture'),Lang.t('casa.other.appliance'),Lang.t('casa.other.decoration'),Lang.t('casa.other.tools'),Lang.t('casa.other.garden'),Lang.t('casa.other.security'),Lang.t('casa.cat.altro')],e.categoria||'','casa_altro_categoria')}</div>
        ${periField}${noteField}</div>`;
    }

    return `<form id="centry-form">${fields}
      ${recurField}
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">${Lang.t('common.cancel')}</button>
        <button type="submit" class="btn btn-primary">${isEdit ? Lang.t('common.save') : Lang.t('common.add')}</button>
      </div>
    </form>`;
  },

  _bindEvents() {
    const panel = document.getElementById('tab-casa');

    panel.addEventListener('input', (e) => {
      if (!e.target.matches('.card-filter-input')) return;
      const subKey = e.target.dataset.cat;
      const imid = e.target.dataset.imid;
      const stateKey = imid + '_' + subKey;
      const st = this._state(stateKey);
      st.filter = e.target.value;
      st.page = 0;
      const { month, year } = Utils.getPeriod();
      const im = DB.getAll().casa.immobili.find(i => i.id === imid);
      if (!im) return;
      const entries = Utils.filterByPeriod(im[subKey] || [], month, year);
      const sc = this.subCategories.find(s => s.key === subKey);
      const sorted = [...entries].sort((a, b) => (b.data || '') > (a.data || '') ? 1 : -1);
      const filtered = Utils.filterEntries(sorted, st.filter);
      const { items: shown, page, totalPages } = Utils.paginate(filtered, 0);
      const card = document.querySelector(`[data-card="${stateKey}"] .card-body`);
      if (!card) return;
      card.innerHTML = (shown.length === 0
        ? `<div class="f-empty-state"><div class="f-empty-icon">📋</div>${st.filter ? Lang.t('common.no_results') : Lang.t('common.none_recorded')}</div>`
        : `<div class="f-entry-list">${shown.map(e => this._renderCEntry(e, imid, sc)).join('')}</div>`) +
        Utils.renderPager(page, totalPages, `data-cat="${subKey}" data-imid="${imid}"`);
    });

    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const imid = btn.dataset.imid;
      const sub  = btn.dataset.sub;

      if (action === 'ctab') {
        const card = btn.closest('.f-module-wrapper');
        card.querySelectorAll('.f-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
        card.querySelectorAll('.f-tab-panel').forEach(p => p.classList.toggle('active', p.id === `ctp-${imid}-${sub}`));
        return;
      }

      if (action === 'page-prev') {
        const catKey = btn.dataset.cat;
        const btnImid = btn.dataset.imid;
        const stateKey = btnImid + '_' + catKey;
        const st = this._state(stateKey);
        st.page = Math.max(0, st.page - 1);
        this.render();
        return;
      }

      if (action === 'page-next') {
        const catKey = btn.dataset.cat;
        const btnImid = btn.dataset.imid;
        const stateKey = btnImid + '_' + catKey;
        const st = this._state(stateKey);
        st.page++;
        this.render();
        return;
      }

      if (action === 'add-immobile' || btn.id === 'add-immobile-btn') {
        Utils.showModal(Lang.t('casa.add'), this._immobileForm(), (form) => {
          const fd = new FormData(form);
          const im = {};
          for (const [k, v] of fd.entries()) { if (v.trim()) im[k] = v.trim(); }
          DB.addImmobile(im);
          Utils.closeModal();
          this.render();
        });
        return;
      }

      if (action === 'edit-immobile') {
        const existing = DB.getAll().casa.immobili.find(i => i.id === imid);
        if (!existing) return;
        Utils.showModal(Lang.t('common.edit'), this._immobileForm(existing), (form) => {
          const fd = new FormData(form);
          const updates = {};
          for (const [k, v] of fd.entries()) { updates[k] = v.trim(); }
          DB.updateImmobile(imid, updates);
          Utils.closeModal();
          this.render();
        });
        return;
      }

      if (action === 'del-immobile') {
        const im = DB.getAll().casa.immobili.find(i => i.id === imid);
        Utils.confirm(Lang.t('casa.delete', {name: im?.nome || ''}), () => {
          DB.removeImmobile(imid);
          this.render();
        });
        return;
      }

      if (action === 'add-centry') {
        const sc = this.subCategories.find(s => s.key === sub);
        const tempId = 'tmp_' + Date.now();
        Utils.showModal(`${Lang.t('common.add')} - ${sc.icon} ${Lang.t(sc.label)}`, this._entryForm(sub), (form) => {
          const fd = new FormData(form);
          const entry = {};
          for (const [k, v] of fd.entries()) { if (v.trim()) entry[k] = v.trim(); }
          const saved = DB.addEntry('casa', { immobileId: imid, subCategory: sub }, entry);
          ImageStore.move(tempId, saved.id);
          Utils.closeModal();
          this.render();
          App.refreshPeriodSelectors();
          setTimeout(() => {
            const card = document.querySelector(`[data-imid="${imid}"]`);
            if (card) {
              card.querySelectorAll('.f-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
              card.querySelectorAll('.f-tab-panel').forEach(p => p.classList.toggle('active', p.id === `ctp-${imid}-${sub}`));
            }
          }, 50);
        }, tempId);
        return;
      }

      if (action === 'del-centry') {
        const entryId = btn.dataset.id;
        Utils.confirm(Lang.t('common.delete_entry'), () => {
          DB.removeEntry('casa', { immobileId: imid, subCategory: sub }, entryId);
          ImageStore.removeAll(entryId);
          this.render();
        });
        return;
      }

      if (action === 'edit-centry') {
        const im = DB.getAll().casa.immobili.find(i => i.id === imid);
        if (!im) return;
        const existing = im[sub].find(e => e.id === btn.dataset.id);
        if (!existing) return;
        const sc = this.subCategories.find(s => s.key === sub);
        Utils.showModal(`${Lang.t('common.edit')} - ${sc.icon} ${Lang.t(sc.label)}`, this._entryForm(sub, existing), (form) => {
          const fd = new FormData(form);
          const updates = {};
          for (const [k, v] of fd.entries()) { updates[k] = v.trim(); }
          DB.updateEntry('casa', { immobileId: imid, subCategory: sub }, existing.id, updates);
          Utils.closeModal();
          this.render();
          setTimeout(() => {
            const card = document.querySelector(`[data-imid="${imid}"]`);
            if (card) {
              card.querySelectorAll('.f-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
              card.querySelectorAll('.f-tab-panel').forEach(p => p.classList.toggle('active', p.id === `ctp-${imid}-${sub}`));
            }
          }, 50);
        }, existing.id);
        return;
      }
    });

  },

  getTotal(month, year) {
    return DB.getAll().casa.immobili.reduce((acc, im) => acc + this._immobileTotal(im, month, year), 0);
  },

  getTotalByImmobile(month, year) {
    const result = {};
    for (const im of DB.getAll().casa.immobili) {
      const t = this._immobileTotal(im, month, year);
      if (t > 0) result[im.nome || im.id] = t;
    }
    return result;
  },

  openPrefilled(category, entry, photoId = null) {
    const { immobileId, subCategory } = category;
    const sc = this.subCategories.find(s => s.key === subCategory);
    if (!sc) return;
    const tempId = photoId || ('tmp_' + Date.now());
    Utils.showModal(`${Lang.t('common.add')} - ${sc.icon} ${Lang.t(sc.label)}`, this._entryForm(subCategory, entry), (form) => {
      const fd = new FormData(form);
      const e = {};
      for (const [k, v] of fd.entries()) { if (v.trim()) e[k] = v.trim(); }
      const saved = DB.addEntry('casa', { immobileId, subCategory }, e);
      ImageStore.move(tempId, saved.id);
      Utils.closeModal();
      this.render();
      App.refreshPeriodSelectors();
    }, tempId);
  }
};
