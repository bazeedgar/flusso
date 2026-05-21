// ===== TAB VEICOLI =====
const Veicoli = {
  subCategories: [
    { key: 'rifornimenti',  icon: '⛽', label: 'veicoli.cat.rifornimenti' },
    { key: 'assicurazioni', icon: '🛡️', label: 'veicoli.cat.assicurazione' },
    { key: 'bolli',         icon: '📄', label: 'veicoli.cat.bollo' },
    { key: 'ordinarie',     icon: '🔧', label: 'veicoli.cat.ordinarie' },
    { key: 'straordinarie', icon: '🚨', label: 'veicoli.cat.straordinarie' }
  ],

  _pageState: {},

  _state(key) {
    if (!this._pageState[key]) this._pageState[key] = { page: 0, filter: '' };
    return this._pageState[key];
  },

  init() { this._pageState = {}; this._bindEvents(); this.render(); },

  render() {
    const { month, year } = Utils.getPeriod();
    const vehicles = DB.getAll().veicoli.vehicles;

    let html = `<div class="f-modules-list">`;

    for (const v of vehicles) {
      html += this._renderVehicle(v, month, year);
    }

    html += `
      <div style="padding:0 14px 14px">
        <button class="add-vehicle-card" id="add-vehicle-btn" data-action="add-vehicle">
          <div style="font-size:32px;margin-bottom:8px">🚗</div>
          <div style="font-weight:600">${Lang.t('veicoli.add')}</div>
          <div style="font-size:12px;margin-top:4px;opacity:.7">${Lang.t('veicoli.empty')}</div>
        </button>
      </div>
    </div>`;

    document.getElementById('tab-veicoli').innerHTML = html;
  },

  _renderVehicle(v, month, year) {
    const totalAll = this._vehicleTotal(v, month, year);
    const rifsFiltered = Utils.filterByPeriod(v.rifornimenti || [], month, year);
    const totalLitri = rifsFiltered.reduce((a, e) => a + (parseFloat(e.litri) || 0), 0);
    const costMedio = rifsFiltered.length > 0
      ? rifsFiltered.reduce((a, e) => a + (parseFloat(e.costo_litro) || 0), 0) / rifsFiltered.filter(e => e.costo_litro).length
      : 0;

    const subtitle = [v.targa, v.anno ? v.anno : null, v.carburante].filter(Boolean).join(' · ');
    return `
      <div class="f-module-wrapper" data-vid="${v.id}">
        <div class="f-module-header">
          <div class="f-module-header-top">
            <div>
              <div class="f-module-title">${Utils.esc(v.nome)}</div>
              <div class="f-module-subtitle">${Utils.esc(subtitle)}</div>
            </div>
            <div class="f-module-header-actions">
              <button class="f-header-btn edit" data-action="edit-vehicle" data-vid="${v.id}" title="${Lang.t('common.edit')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="f-header-btn delete" data-action="del-vehicle" data-vid="${v.id}" title="${Lang.t('common.delete')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
            </div>
          </div>
          <div class="f-module-total">${Utils.fmt(totalAll)} <span class="f-module-total-label">${Lang.t('veicoli.total')}</span></div>
          <div class="f-module-stats cols-3">
            <div class="f-stat-chip"><div class="f-stat-label">${Lang.t('veicoli.stats.fuel')}</div><div class="f-stat-value">${Utils.fmt(Utils.sum(rifsFiltered))}</div></div>
            <div class="f-stat-chip"><div class="f-stat-label">${Lang.t('veicoli.stats.liters')}</div><div class="f-stat-value">${totalLitri > 0 ? totalLitri.toFixed(1) + ' L' : '-'}</div></div>
            <div class="f-stat-chip"><div class="f-stat-label">${Lang.t('veicoli.stats.avg_cost')}</div><div class="f-stat-value">${costMedio > 0 ? '€' + costMedio.toFixed(3) : '-'}</div></div>
          </div>
        </div>

        <div class="f-tab-row">
          ${this.subCategories.map((sc, i) => `
            <button class="f-tab-btn ${i===0?'active':''}" data-action="vtab" data-vid="${v.id}" data-sub="${sc.key}">
              ${sc.icon} ${Lang.t(sc.label)}
            </button>`).join('')}
        </div>

        ${this.subCategories.map((sc, i) => `
          <div class="f-tab-panel ${i===0?'active':''}" id="vtp-${v.id}-${sc.key}">
            ${this._renderSubTab(v, sc, month, year)}
          </div>`).join('')}
      </div>`;
  },

  _renderSubTab(v, sc, month, year) {
    const entries = Utils.filterByPeriod(v[sc.key] || [], month, year);
    const stateKey = v.id + '_' + sc.key;
    const st = this._state(stateKey);
    const sorted = [...entries].sort((a, b) => (b.data || '') > (a.data || '') ? 1 : -1);
    const filtered = Utils.filterEntries(sorted, st.filter);
    const { items: shown, page, totalPages } = Utils.paginate(filtered, st.page);

    const addBtn = `<div class="f-section-header">
      <span class="f-section-title">${sc.icon} ${Lang.t(sc.label)}</span>
      <button class="f-btn-add" data-action="add-ventry" data-vid="${v.id}" data-sub="${sc.key}">+ ${Lang.t('common.add')}</button>
    </div>`;

    const filterHtml = entries.length > 0 ? `
      <div class="f-filter-wrap">
        <input class="card-filter-input" type="text" data-action="vfilter" data-cat="${sc.key}" data-vid="${v.id}"
          placeholder="🔍 ${Lang.t('common.search')}" value="${Utils.esc(st.filter)}">
      </div>` : '';

    const bodyContent = shown.length === 0
      ? `<div class="f-empty-state"><div class="f-empty-icon">🚗</div>${st.filter ? Lang.t('common.no_results') : Lang.t('common.none_recorded')}</div>`
      : `<div class="f-entry-list">${shown.map(e => this._renderVEntry(e, v.id, sc)).join('')}</div>`;

    return `<div class="f-sub-card" data-card="${stateKey}">
      ${addBtn}
      ${filterHtml}
      <div class="card-body">
        ${bodyContent}
        ${Utils.renderPager(page, totalPages, `data-cat="${sc.key}" data-vid="${v.id}"`)}
      </div>
    </div>`;
  },

  _renderVEntry(e, vid, sc) {
    let desc = '', badge = '', extra = '';

    if (sc.key === 'rifornimenti') {
      desc = e.carburante || Lang.t('veicoli.stats.fuel');
      badge = e.tipo_carburante || '';
      if (e.litri) extra = `<span class="f-pill f-pill-green">${parseFloat(e.litri).toFixed(1)} L</span>`;
      if (e.costo_litro) extra += `<span class="f-pill f-pill-amber">€${parseFloat(e.costo_litro).toFixed(3)}/L</span>`;
    } else if (sc.key === 'assicurazioni') {
      desc = e.compagnia || Lang.t('veicoli.cat.assicurazione');
      if (e.scadenza) badge = Lang.t('casa.ins.expiry_short') + ' ' + Utils.fmtDate(e.scadenza);
    } else if (sc.key === 'bolli') {
      desc = Lang.t('veicoli.cat.bollo') + ' ' + (e.anno || '');
      if (e.scadenza) badge = Lang.t('casa.ins.expiry_short') + ' ' + Utils.fmtDate(e.scadenza);
    } else if (sc.key === 'ordinarie') {
      desc = e.tipo || Lang.t('veicoli.cat.ordinarie');
      if (e.km) badge = e.km + ' km';
    } else if (sc.key === 'straordinarie') {
      desc = e.tipo || Lang.t('veicoli.cat.straordinarie');
      if (e.km) badge = e.km + ' km';
    }

    const pills = extra
      + (badge ? `<span class="f-pill f-pill-green">${Utils.esc(badge)}</span>` : '')
      + (e.ricorrente ? `<span class="f-pill f-pill-amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" style="vertical-align:middle"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> ${e.ricorrente}</span>` : '')
      + (e._recurInstance ? `<span class="f-pill f-pill-amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" style="vertical-align:middle"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></span>` : '')
      + (e.note ? `<span class="f-pill f-pill-amber" title="${Utils.esc(e.note)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" style="vertical-align:middle"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>` : '');
    const actions = `<div class="f-entry-actions">
            <button class="f-btn-edit" data-action="edit-ventry" data-vid="${vid}" data-sub="${sc.key}" data-id="${e.id}" title="${Lang.t('common.edit')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="f-btn-delete" data-action="del-ventry" data-vid="${vid}" data-sub="${sc.key}" data-id="${e.id}" title="${Lang.t('common.delete')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
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

  _vehicleTotal(v, month, year) {
    let total = 0;
    for (const sc of this.subCategories) {
      total += Utils.sum(Utils.filterByPeriod(v[sc.key] || [], month, year));
    }
    return total;
  },

  // ===== FORMS =====
  _vehicleForm(existing = null) {
    const v = existing || {};
    const carburanti = [Lang.t('veicoli.fuel.benzina'), Lang.t('veicoli.fuel.diesel'), Lang.t('veicoli.fuel.gpl'), Lang.t('veicoli.fuel.metano'), Lang.t('veicoli.fuel.elettrico'), Lang.t('veicoli.fuel.ibrido_b'), Lang.t('veicoli.fuel.ibrido_d')];
    return `<form id="vehicle-form">
      <div class="form-grid">
        <div class="form-group">
          <label>${Lang.t('veicoli.form.name')}</label>
          <input type="text" name="nome" value="${Utils.esc(v.nome||'')}" required placeholder="${Lang.t('veicoli.form.name_ph')}" />
        </div>
        <div class="form-group">
          <label>${Lang.t('veicoli.form.plate')}</label>
          <input type="text" name="targa" value="${Utils.esc(v.targa||'')}" placeholder="${Lang.t('veicoli.form.plate_ph')}" />
        </div>
        <div class="form-group">
          <label>${Lang.t('veicoli.form.year')}</label>
          <input type="number" name="anno" value="${Utils.esc(v.anno||'')}" min="1900" max="2099" placeholder="${Lang.t('veicoli.form.year_ph')}" />
        </div>
        <div class="form-group">
          <label>${Lang.t('veicoli.form.fuel')}</label>
          ${Utils.selectWithAdd('carburante', carburanti, v.carburante||'', 'veicoli_carburante')}
        </div>
        <div class="form-group">
          <label>${Lang.t('veicoli.form.km')}</label>
          <input type="number" name="km_attuali" value="${Utils.esc(v.km_attuali||'')}" placeholder="${Lang.t('veicoli.form.km_ph')}" />
        </div>
        <div class="form-group">
          <label>${Lang.t('veicoli.form.color')}</label>
          <input type="text" name="colore" value="${Utils.esc(v.colore||'')}" placeholder="${Lang.t('veicoli.form.color_ph')}" />
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">${Lang.t('common.cancel')}</button>
        <button type="submit" class="btn btn-primary">${existing ? Lang.t('common.save') : Lang.t('veicoli.add')}</button>
      </div>
    </form>`;
  },

  _subEntryForm(subKey, existing = null) {
    const e = existing || {};
    const isEdit = !!existing;
    const carburanti = [Lang.t('veicoli.fuel.benzina'), Lang.t('veicoli.fuel.diesel'), Lang.t('veicoli.fuel.gpl'), Lang.t('veicoli.fuel.metano'), Lang.t('veicoli.fuel.elettrico'), Lang.t('veicoli.fuel.ibrido')];
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

    let fields = '';
    if (subKey === 'rifornimenti') {
      fields = `
        <div class="form-grid">
          <div class="form-group">
            <label>${Lang.t('common.date')} *</label>
            <input type="date" name="data" value="${e.data||Utils.today()}" required />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.form.fuel')}</label>
            ${Utils.selectWithAdd('tipo_carburante', carburanti, e.tipo_carburante||'', 'veicoli_tipo_carburante')}
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.rif.liters')}</label>
            <input type="number" name="litri" value="${e.litri||''}" step="0.01" min="0" placeholder="${Lang.t('veicoli.rif.liters_ph')}" />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.rif.cost_l')}</label>
            <input type="number" name="costo_litro" value="${e.costo_litro||''}" step="0.001" min="0" placeholder="${Lang.t('veicoli.rif.cost_ph')}" id="costo-litro-inp" />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.rif.total')}</label>
            <input type="number" name="importo" value="${e.importo||''}" step="0.01" min="0" required id="importo-inp" />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.rif.km')}</label>
            <input type="number" name="km" value="${e.km||''}" placeholder="${Lang.t('veicoli.rif.km_ph')}" />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.rif.station')}</label>
            <input type="text" name="distributore" value="${Utils.esc(e.distributore||'')}" placeholder="${Lang.t('veicoli.rif.station_ph')}" />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.rif.full')}</label>
            <select name="pieno"><option value="">--</option><option value="Si" ${e.pieno==='Si'?'selected':''}>${Lang.t('common.yes')}</option><option value="No" ${e.pieno==='No'?'selected':''}>${Lang.t('common.no')}</option></select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group full"><label>${Lang.t('common.notes')}</label><input type="text" name="note" value="${Utils.esc(e.note||'')}" /></div>
        </div>`;
    } else if (subKey === 'assicurazioni') {
      fields = `
        <div class="form-grid">
          <div class="form-group">
            <label>${Lang.t('veicoli.ass.payment')}</label>
            <input type="date" name="data" value="${e.data||Utils.today()}" required />
          </div>
          <div class="form-group">
            <label>${Lang.t('common.amount')}</label>
            <input type="number" name="importo" value="${e.importo||''}" step="0.01" required />
          </div>
          <div class="form-group">
            <label>${Lang.t('common.company')}</label>
            <input type="text" name="compagnia" value="${Utils.esc(e.compagnia||'')}" placeholder="${Lang.t('veicoli.ass.company_ph')}" />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.ass.expiry')}</label>
            <input type="date" name="scadenza" value="${e.scadenza||''}" />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.ass.number')}</label>
            <input type="text" name="polizza" value="${Utils.esc(e.polizza||'')}" />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.ass.coverage')}</label>
            ${Utils.selectWithAdd('tipo_copertura', [Lang.t('veicoli.ass.rca'),Lang.t('veicoli.ass.theft'),Lang.t('veicoli.ass.kasko'),Lang.t('veicoli.ass.full_kasko'),Lang.t('veicoli.ass.glass'),Lang.t('veicoli.ass.breakdown')], e.tipo_copertura||'', 'veicoli_tipo_copertura')}
          </div>
          <div class="form-group full"><label>${Lang.t('common.notes')}</label><input type="text" name="note" value="${Utils.esc(e.note||'')}" /></div>
        </div>`;
    } else if (subKey === 'bolli') {
      fields = `
        <div class="form-grid">
          <div class="form-group">
            <label>${Lang.t('veicoli.bollo.year')}</label>
            <input type="number" name="anno" value="${e.anno||new Date().getFullYear()}" min="2000" max="2099" required />
          </div>
          <div class="form-group">
            <label>${Lang.t('common.amount')}</label>
            <input type="number" name="importo" value="${e.importo||''}" step="0.01" required />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.ass.payment')}</label>
            <input type="date" name="data" value="${e.data||Utils.today()}" required />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.bollo.expiry')}</label>
            <input type="date" name="scadenza" value="${e.scadenza||''}" />
          </div>
          <div class="form-group full"><label>${Lang.t('common.notes')}</label><input type="text" name="note" value="${Utils.esc(e.note||'')}" /></div>
        </div>`;
    } else if (subKey === 'ordinarie') {
      fields = `
        <div class="form-grid">
          <div class="form-group">
            <label>${Lang.t('common.date')} *</label>
            <input type="date" name="data" value="${e.data||Utils.today()}" required />
          </div>
          <div class="form-group">
            <label>${Lang.t('common.amount')}</label>
            <input type="number" name="importo" value="${e.importo||''}" step="0.01" required />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.ord.type')}</label>
            ${Utils.selectWithAdd('tipo', [Lang.t('veicoli.ord.service'),Lang.t('veicoli.ord.oil_change'),Lang.t('veicoli.ord.oil_filter'),Lang.t('veicoli.ord.air_filter'),Lang.t('veicoli.ord.spark_plugs'),Lang.t('veicoli.ord.tyres'),Lang.t('veicoli.ord.brakes'),Lang.t('veicoli.ord.mot'),Lang.t('veicoli.ord.wash'),Lang.t('veicoli.ord.brake_fluid'),Lang.t('veicoli.ord.timing'),Lang.t('veicoli.ord.battery'),Lang.t('veicoli.ord.bulbs'),'Altro'], e.tipo||'', 'veicoli_ord_tipo', true)}
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.ord.km')}</label>
            <input type="number" name="km" value="${e.km||''}" placeholder="es. 45200" />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.ord.workshop')}</label>
            <input type="text" name="officina" value="${Utils.esc(e.officina||'')}" />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.ord.next_km')}</label>
            <input type="number" name="prossimi_km" value="${e.prossimi_km||''}" placeholder="${Lang.t('veicoli.ord.next_km_ph')}" />
          </div>
          <div class="form-group full"><label>${Lang.t('common.notes')}</label><input type="text" name="note" value="${Utils.esc(e.note||'')}" /></div>
        </div>`;
    } else if (subKey === 'straordinarie') {
      fields = `
        <div class="form-grid">
          <div class="form-group">
            <label>${Lang.t('common.date')} *</label>
            <input type="date" name="data" value="${e.data||Utils.today()}" required />
          </div>
          <div class="form-group">
            <label>${Lang.t('common.amount')}</label>
            <input type="number" name="importo" value="${e.importo||''}" step="0.01" required />
          </div>
          <div class="form-group full">
            <label>${Lang.t('veicoli.str.type')}</label>
            <input type="text" name="tipo" value="${Utils.esc(e.tipo||'')}" required placeholder="${Lang.t('veicoli.str.type_ph')}" />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.ord.km')}</label>
            <input type="number" name="km" value="${e.km||''}" />
          </div>
          <div class="form-group">
            <label>${Lang.t('veicoli.str.workshop')}</label>
            <input type="text" name="officina" value="${Utils.esc(e.officina||'')}" />
          </div>
          <div class="form-group full"><label>${Lang.t('common.notes')}</label><input type="text" name="note" value="${Utils.esc(e.note||'')}" /></div>
        </div>`;
    }

    return `<form id="ventry-form">${fields}
      ${recurField}
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">${Lang.t('common.cancel')}</button>
        <button type="submit" class="btn btn-primary">${isEdit ? Lang.t('common.save') : Lang.t('common.add')}</button>
      </div>
    </form>`;
  },

  _bindEvents() {
    const panel = document.getElementById('tab-veicoli');

    panel.addEventListener('input', (e) => {
      if (!e.target.matches('.card-filter-input')) return;
      const subKey = e.target.dataset.cat;
      const vid = e.target.dataset.vid;
      const stateKey = vid + '_' + subKey;
      const st = this._state(stateKey);
      st.filter = e.target.value;
      st.page = 0;
      const { month, year } = Utils.getPeriod();
      const vehicle = DB.getAll().veicoli.vehicles.find(v => v.id === vid);
      if (!vehicle) return;
      const entries = Utils.filterByPeriod(vehicle[subKey] || [], month, year);
      const sc = this.subCategories.find(s => s.key === subKey);
      const sorted = [...entries].sort((a, b) => (b.data || '') > (a.data || '') ? 1 : -1);
      const filtered = Utils.filterEntries(sorted, st.filter);
      const { items: shown, page, totalPages } = Utils.paginate(filtered, 0);
      const card = document.querySelector(`[data-card="${stateKey}"] .card-body`);
      if (!card) return;
      card.innerHTML = (shown.length === 0
        ? `<div class="f-empty-state"><div class="f-empty-icon">🚗</div>${st.filter ? Lang.t('common.no_results') : Lang.t('common.none_recorded')}</div>`
        : `<div class="f-entry-list">${shown.map(e => this._renderVEntry(e, vid, sc)).join('')}</div>`) +
        Utils.renderPager(page, totalPages, `data-cat="${subKey}" data-vid="${vid}"`);
    });

    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const vid = btn.dataset.vid;
      const sub = btn.dataset.sub;

      // Vehicle sub-tab switching
      if (action === 'vtab') {
        const card = btn.closest('.f-module-wrapper');
        card.querySelectorAll('.f-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
        card.querySelectorAll('.f-tab-panel').forEach(p => {
          p.classList.toggle('active', p.id === `vtp-${vid}-${sub}`);
        });
        return;
      }

      if (action === 'page-prev') {
        const catKey = btn.dataset.cat;
        const btnVid = btn.dataset.vid;
        const stateKey = btnVid + '_' + catKey;
        const st = this._state(stateKey);
        st.page = Math.max(0, st.page - 1);
        this.render();
        return;
      }

      if (action === 'page-next') {
        const catKey = btn.dataset.cat;
        const btnVid = btn.dataset.vid;
        const stateKey = btnVid + '_' + catKey;
        const st = this._state(stateKey);
        st.page++;
        this.render();
        return;
      }

      if (action === 'add-vehicle' || btn.id === 'add-vehicle-btn') {
        Utils.showModal(Lang.t('veicoli.add'), this._vehicleForm(), (form) => {
          const fd = new FormData(form);
          const vehicle = {};
          for (const [k, v] of fd.entries()) { if (v.trim()) vehicle[k] = v.trim(); }
          DB.addVehicle(vehicle);
          Utils.closeModal();
          this.render();
        });
        return;
      }

      if (action === 'edit-vehicle') {
        const vehicles = DB.getAll().veicoli.vehicles;
        const vehicle = vehicles.find(v => v.id === vid);
        if (!vehicle) return;
        Utils.showModal(Lang.t('veicoli.edit'), this._vehicleForm(vehicle), (form) => {
          const fd = new FormData(form);
          const updates = {};
          for (const [k, v] of fd.entries()) { updates[k] = v.trim(); }
          DB.updateVehicle(vid, updates);
          Utils.closeModal();
          this.render();
        });
        return;
      }

      if (action === 'del-vehicle') {
        const vehicles = DB.getAll().veicoli.vehicles;
        const vehicle = vehicles.find(v => v.id === vid);
        Utils.confirm(Lang.t('veicoli.delete', { name: vehicle?.nome || vehicle?.targa || '' }), () => {
          DB.removeVehicle(vid);
          this.render();
        });
        return;
      }

      if (action === 'add-ventry') {
        const sc = this.subCategories.find(s => s.key === sub);
        const tempId = 'tmp_' + Date.now();
        Utils.showModal(`${Lang.t('common.add')} - ${sc.icon} ${Lang.t(sc.label)}`, this._subEntryForm(sub), (form) => {
          const fd = new FormData(form);
          const entry = {};
          for (const [k, v] of fd.entries()) { if (v.trim()) entry[k] = v.trim(); }
          const saved = DB.addEntry('veicoli', { vehicleId: vid, subCategory: sub }, entry);
          ImageStore.move(tempId, saved.id);
          Utils.closeModal();
          this.render();
          App.refreshPeriodSelectors();
          setTimeout(() => {
            const card = document.querySelector(`[data-vid="${vid}"]`);
            if (card) {
              card.querySelectorAll('.f-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
              card.querySelectorAll('.f-tab-panel').forEach(p => p.classList.toggle('active', p.id === `vtp-${vid}-${sub}`));
            }
          }, 50);
        }, tempId);
        return;
      }

      if (action === 'del-ventry') {
        const entryId = btn.dataset.id;
        Utils.confirm(Lang.t('common.delete_entry'), () => {
          DB.removeEntry('veicoli', { vehicleId: vid, subCategory: sub }, entryId);
          ImageStore.removeAll(entryId);
          this.render();
        });
        return;
      }

      if (action === 'edit-ventry') {
        const vehicles = DB.getAll().veicoli.vehicles;
        const vehicle = vehicles.find(v => v.id === vid);
        if (!vehicle) return;
        const existing = vehicle[sub].find(e => e.id === btn.dataset.id);
        if (!existing) return;
        const sc = this.subCategories.find(s => s.key === sub);
        Utils.showModal(`${Lang.t('common.edit')} - ${sc.icon} ${Lang.t(sc.label)}`, this._subEntryForm(sub, existing), (form) => {
          const fd = new FormData(form);
          const updates = {};
          for (const [k, v] of fd.entries()) { updates[k] = v.trim(); }
          DB.updateEntry('veicoli', { vehicleId: vid, subCategory: sub }, existing.id, updates);
          Utils.closeModal();
          this.render();
          setTimeout(() => {
            const card = document.querySelector(`[data-vid="${vid}"]`);
            if (card) {
              card.querySelectorAll('.f-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
              card.querySelectorAll('.f-tab-panel').forEach(p => p.classList.toggle('active', p.id === `vtp-${vid}-${sub}`));
            }
          }, 50);
        }, existing.id);
        return;
      }
    });


    // Auto-calculate importo for rifornimenti
    panel.addEventListener('input', (e) => {
      const litriInp = document.querySelector('#ventry-form [name="litri"]');
      const costoInp = document.querySelector('#ventry-form [name="costo_litro"]');
      const importoInp = document.querySelector('#ventry-form [name="importo"]');
      if (!litriInp || !costoInp || !importoInp) return;
      if (e.target === litriInp || e.target === costoInp) {
        const l = parseFloat(litriInp.value) || 0;
        const c = parseFloat(costoInp.value) || 0;
        if (l > 0 && c > 0) importoInp.value = (l * c).toFixed(2);
      }
    });
  },

  getTotal(month, year) {
    const vehicles = DB.getAll().veicoli.vehicles;
    return vehicles.reduce((acc, v) => acc + this._vehicleTotal(v, month, year), 0);
  },

  getTotalByVehicle(month, year) {
    const vehicles = DB.getAll().veicoli.vehicles;
    const result = {};
    for (const v of vehicles) {
      const t = this._vehicleTotal(v, month, year);
      if (t > 0) result[v.nome || v.id] = t;
    }
    return result;
  },

  openPrefilled(category, entry, photoId = null) {
    let { vehicleId, subCategory } = category;
    const sc = this.subCategories.find(s => s.key === subCategory);
    if (!sc) return;
    // fallback: usa il primo veicolo se vehicleId non specificato
    if (!vehicleId) {
      vehicleId = DB.getAll().veicoli?.vehicles?.[0]?.id;
      if (!vehicleId) {
        Utils.showToast?.('⚠️ Aggiungi prima un veicolo nella sezione Veicoli.');
        return;
      }
    }
    const tempId = photoId || ('tmp_' + Date.now());
    Utils.showModal(`${Lang.t('common.add')} - ${sc.icon} ${Lang.t(sc.label)}`, this._subEntryForm(subCategory, entry), (form) => {
      const fd = new FormData(form);
      const e = {};
      for (const [k, v] of fd.entries()) { if (v.trim()) e[k] = v.trim(); }
      const saved = DB.addEntry('veicoli', { vehicleId, subCategory }, e);
      ImageStore.move(tempId, saved.id);
      Utils.closeModal();
      this.render();
      App.refreshPeriodSelectors();
    }, tempId);
  }
};
