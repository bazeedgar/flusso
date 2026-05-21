// ===== AGENDA MODULE =====
const Agenda = {
  _filter: 'arrivo',
  _calSelectedDay: null,
  _calYear: new Date().getFullYear(),
  _calMonth: new Date().getMonth(),

  init() {
    this._initChannel();
    this.render();
  },

  async _initChannel() {
    const p = window.Capacitor?.Plugins?.LocalNotifications;
    if (!p) return;
    try {
      await p.createChannel({ id: 'finance_agenda', name: 'Agenda – Flusso', importance: 4, vibration: true });
    } catch {}
  },

  render() {
    const panel = document.getElementById('tab-agenda');
    if (!panel) return;
    const items = DB.getAll().agenda || [];
    const today = Utils.today();

    // Lista eventi: per giorno selezionato o per filtro
    let listItems;
    if (this._calSelectedDay) {
      const d = this._calSelectedDay;
      listItems = items.filter(i => i.dataInizio <= d && (!i.dataFine || i.dataFine >= d) || i.dataInizio === d);
      listItems = items.filter(i => i.dataInizio === d || (i.dataFine && i.dataInizio <= d && i.dataFine >= d));
      listItems.sort((a, b) => a.dataInizio.localeCompare(b.dataInizio));
    } else {
      listItems = [...items];
      if (this._filter === 'arrivo')     listItems = listItems.filter(i => !i.completato && i.dataInizio >= today);
      else if (this._filter === 'passati')    listItems = listItems.filter(i => !i.completato && i.dataInizio < today);
      else if (this._filter === 'completati') listItems = listItems.filter(i => i.completato);
      listItems.sort((a, b) => (this._filter === 'passati' ? -1 : 1) * a.dataInizio.localeCompare(b.dataInizio));
    }

    const emptyMsgs = {
      arrivo:      Lang.t('agenda.no_upcoming'),
      passati:     Lang.t('agenda.no_past'),
      completati:  Lang.t('agenda.no_done'),
      tutti:       Lang.t('agenda.no_all')
    };
    const filters = [
      ['arrivo',     Lang.t('agenda.filter.upcoming')],
      ['passati',    Lang.t('agenda.filter.past')],
      ['completati', Lang.t('agenda.filter.done')],
      ['tutti',      Lang.t('agenda.filter.all')]
    ];

    panel.innerHTML = `
      <div class="section-header" style="padding-bottom:0">
        <h2 class="section-title">📅 Agenda</h2>
        <button class="btn btn-primary btn-sm" id="add-agenda-btn">${Lang.t('agenda.new')}</button>
      </div>

      ${this._calHTML()}

      ${this._calSelectedDay
        ? `<div class="agenda-day-bar">
            <span class="agenda-day-label">${this._fmtDay(this._calSelectedDay)}</span>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="btn btn-primary btn-sm" id="add-for-day">${Lang.t('agenda.add_day')}</button>
              <button class="btn btn-secondary btn-sm" id="clear-day">${Lang.t('agenda.filter.all')}</button>
            </div>
          </div>`
        : `<div class="agenda-tabs">
            ${filters.map(([f,l]) => `<button class="agenda-tab-btn${this._filter===f?' active':''}" data-f="${f}">${l}</button>`).join('')}
          </div>`
      }

      <div class="agenda-list">
        ${listItems.length
          ? listItems.map(i => this._cardHTML(i)).join('')
          : `<div class="empty-state">${this._calSelectedDay ? Lang.t('agenda.no_day') + '\n<small>' + Lang.t('agenda.no_day_sub') + '</small>' : (emptyMsgs[this._filter]||Lang.t('agenda.no_all'))}</div>`
        }
      </div>`;

    this._bindCalendar(panel);

    panel.querySelector('#add-for-day')?.addEventListener('click', () => this._showFormForDate(this._calSelectedDay));
    panel.querySelector('#clear-day')?.addEventListener('click', () => { this._calSelectedDay = null; this.render(); });
    panel.querySelectorAll('.agenda-tab-btn').forEach(b =>
      b.addEventListener('click', () => { this._filter = b.dataset.f; this.render(); }));
    panel.querySelector('#add-agenda-btn')?.addEventListener('click', () => this._showForm());

    panel.querySelectorAll('[data-agenda-id]').forEach(card => {
      const id = card.dataset.agendaId;
      card.querySelector('.btn-ag-edit')?.addEventListener('click', e => {
        e.stopPropagation();
        const item = (DB.getAll().agenda||[]).find(i => i.id === id);
        if (item) this._showForm(item);
      });
      card.querySelector('.btn-ag-done')?.addEventListener('click', e => {
        e.stopPropagation();
        const item = (DB.getAll().agenda||[]).find(i => i.id === id);
        if (!item) return;
        DB.updateAgendaItem(id, { completato: !item.completato });
        if (!item.completato) this._cancelNotif(id);
        this.render();
      });
      card.querySelector('.btn-ag-del')?.addEventListener('click', e => {
        e.stopPropagation();
        Utils.confirm(Lang.t('agenda.delete'), async () => {
          await this._cancelNotif(id);
          DB.removeAgendaItem(id);
          this.render();
        });
      });
    });
  },

  // ── Calendario ─────────────────────────────────────────────────────────────
  _calHTML() {
    const { _calYear: year, _calMonth: month } = this;
    const todayDate = new Date();
    const dowLabels = Array.from({length:7},(_,i)=>Lang.t('day.'+i));
    const isCurrentMonth = todayDate.getFullYear() === year && todayDate.getMonth() === month;

    const items = DB.getAll().agenda || [];
    // Mappa data → array di tipi evento (per i dot)
    const byDay = {};
    items.forEach(item => {
      const d = item.dataInizio;
      if (!d) return;
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(item);
      // Segna anche i giorni intermedi per eventi multi-giorno
      if (item.dataFine && item.dataFine !== d) {
        let cur = new Date(d + 'T00:00:00');
        const end = new Date(item.dataFine + 'T00:00:00');
        cur.setDate(cur.getDate() + 1);
        while (cur <= end) {
          const ds = cur.toISOString().slice(0,10);
          if (!byDay[ds]) byDay[ds] = [];
          byDay[ds].push(item);
          cur.setDate(cur.getDate() + 1);
        }
      }
    });

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1; // lunedì = 0

    let cells = '';
    for (let i = 0; i < startDow; i++) cells += '<div class="cal-cell cal-cell--empty"></div>';

    const todayStr = Utils.today();
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayItems = byDay[ds] || [];
      const isTd = ds === todayStr;
      const isSel = this._calSelectedDay === ds;
      const isPast = ds < todayStr;

      // Massimo 3 dot, colori per tipo
      const dots = [...new Map(dayItems.map(i => [i.tipo, i])).values()]
        .slice(0, 3)
        .map(item => { const [color] = this._typeConfig(item.tipo); return `<span class="cal-dot" style="background:${color}"></span>`; })
        .join('');

      cells += `<div class="cal-cell${isTd?' cal-today':''}${isSel?' cal-selected':''}${isPast&&!isTd?' cal-past':''}" data-date="${ds}" data-count="${dayItems.length}">
        <span class="cal-day-num">${d}</span>
        <div class="cal-dots">${dots}</div>
      </div>`;
    }

    // Celle vuote finali per completare l'ultima riga
    const totalCells = startDow + daysInMonth;
    const remainder = totalCells % 7;
    if (remainder !== 0) for (let i = 0; i < 7 - remainder; i++) cells += '<div class="cal-cell cal-cell--empty"></div>';

    return `<div class="cal-widget">
      <div class="cal-header">
        <button class="cal-nav" id="cal-prev">‹</button>
        <div class="cal-title-group">
          <span class="cal-month-label">${Lang.t('month.' + month)} ${year}</span>
          ${!isCurrentMonth ? `<button class="cal-today-btn" id="cal-today-btn">${Lang.t('agenda.today_btn')}</button>` : ''}
        </div>
        <button class="cal-nav" id="cal-next">›</button>
      </div>
      <div class="cal-dow">${dowLabels.map(l => `<div class="cal-dow-cell">${l}</div>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
    </div>`;
  },

  _bindCalendar(panel) {
    panel.querySelector('#cal-prev')?.addEventListener('click', () => {
      if (--this._calMonth < 0) { this._calMonth = 11; this._calYear--; }
      this._calSelectedDay = null; this.render();
    });
    panel.querySelector('#cal-next')?.addEventListener('click', () => {
      if (++this._calMonth > 11) { this._calMonth = 0; this._calYear++; }
      this._calSelectedDay = null; this.render();
    });
    panel.querySelector('#cal-today-btn')?.addEventListener('click', () => {
      this._calYear = new Date().getFullYear();
      this._calMonth = new Date().getMonth();
      this._calSelectedDay = null; this.render();
    });

    panel.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        const date = cell.dataset.date;
        const count = parseInt(cell.dataset.count || '0');

        if (this._calSelectedDay === date) {
          // Secondo tap sullo stesso giorno senza eventi → form
          if (count === 0) { this._showFormForDate(date); return; }
          this._calSelectedDay = null; this.render(); return;
        }

        this._calSelectedDay = date;
        this.render();

        // Giorno senza eventi → apri form direttamente
        if (count === 0) {
          this._showFormForDate(date);
        } else {
          // Scorri alla lista
          setTimeout(() => panel.querySelector('.agenda-day-bar')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
        }
      });
    });
  },

  _fmtDay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return `${Lang.t('day.full.' + d.getDay())} ${Utils.fmtDateFull(dateStr)}`;
  },

  _showFormForDate(date) {
    this._showForm({ titolo:'', tipo:'Promemoria', dataInizio: date, notifiche:[], vociCollegate:[], completato:false, _prefill:true });
  },

  openPrefilled(category, item) {
    this._showForm({ ...item, _prefill: true });
  },

  // ── Card evento ────────────────────────────────────────────────────────────
  _typeConfig(tipo) {
    const cal = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="vertical-align:middle"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const bell = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="vertical-align:middle"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
    const clk  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="vertical-align:middle"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    return { Evento:['#6366f1',cal], Promemoria:['#10b981',bell], Scadenza:['#ef4444',clk] }[tipo] || ['#10b981',bell];
  },

  _getNotifiche(item) {
    if (item.notifiche?.length) return item.notifiche;
    if (item.notifica?.attiva) return [{ id:'n0', anticipo:item.notifica.anticipo||1, unita:item.notifica.unita||'giorni' }];
    return [];
  },

  _cardHTML(item) {
    const [color, icon] = this._typeConfig(item.tipo);
    const cd = this._countdown(item.dataInizio);
    const linked = (item.vociCollegate||[]).length;
    const rawLabel = Lang.t('agenda.type.' + item.tipo.toLowerCase());
    const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
    const nc = this._getNotifiche(item).length;
    const notifBadge = nc > 0 && !item.completato
      ? `<span class="agenda-notif-dot" title="${nc} notific${nc>1?'he':'a'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" style="vertical-align:middle"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>${nc > 1 ? ' <b>'+nc+'</b>' : ''}</span>`
      : '';
    return `<div class="agenda-card${item.completato?' agenda-done':''}" data-agenda-id="${item.id}" style="border-left-color:${color}">
      <div class="agenda-card-top">
        <span class="agenda-badge" style="background:${color}20;color:${color}">${icon} ${label}</span>
        ${notifBadge}
        <span class="agenda-cd ${cd.cls}">${cd.text}</span>
      </div>
      <div class="agenda-title">${Utils.esc(item.titolo)}</div>
      <div class="agenda-dates">${Utils.fmtDate(item.dataInizio)}${item.ora?' · '+item.ora:''}${item.dataFine&&item.dataFine!==item.dataInizio?' → '+Utils.fmtDate(item.dataFine):''}</div>
      ${item.descrizione ? `<div class="agenda-desc">${Utils.esc(item.descrizione)}</div>` : ''}
      ${linked ? `<div class="agenda-linked"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" style="vertical-align:middle"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> ${linked} ${linked===1?Lang.t('agenda.linked.single'):Lang.t('agenda.linked.plural')}</div>` : ''}
      <div class="agenda-actions">
        <button class="btn btn-sm ${item.completato?'btn-secondary':'btn-success'} btn-ag-done">${item.completato?Lang.t('agenda.reopen'):Lang.t('agenda.done')}</button>
        <button class="btn btn-sm btn-secondary btn-ag-edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn btn-sm btn-danger btn-ag-del"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
      </div>
    </div>`;
  },

  _countdown(dateStr) {
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(dateStr + 'T00:00:00');
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0)  return { text: Lang.t('agenda.today'),     cls:'cd-today' };
    if (diff === 1)  return { text: Lang.t('agenda.tomorrow'),  cls:'cd-soon' };
    if (diff > 0 && diff <= 7) return { text: Lang.t('agenda.in_days', { n: diff }), cls:'cd-soon' };
    if (diff > 7)    return { text: Utils.fmtDate(dateStr),     cls:'cd-future' };
    if (diff === -1) return { text: Lang.t('agenda.yesterday'), cls:'cd-past' };
    return { text: Lang.t('agenda.days_ago', { n: Math.abs(diff) }), cls:'cd-past' };
  },

  // Crea promemoria da voce di spesa (es. bollo auto con scadenza)
  createFromEntry(entry, sectionLabel) {
    const scadenza = entry.scadenza || entry.data || entry.date || Utils.today();
    const desc = entry.descrizione || entry.desc || entry.tipo || '';
    const importoStr = entry.importo ? ' – ' + Utils.fmt(entry.importo) : '';
    this._showForm({
      titolo: `${desc}${importoStr}`.trim() || sectionLabel || Lang.t('agenda.type.scadenza'),
      tipo: 'Scadenza', dataInizio: scadenza,
      descrizione: sectionLabel ? `Da: ${sectionLabel}` : '',
      notifiche: [{ id:'n0', anticipo:7, unita:'giorni' }, { id:'n1', anticipo:1, unita:'giorni' }],
      vociCollegate: entry.id ? [entry.id] : [],
      completato: false, _prefill: true
    });
  },

  // ── Riga notifica nel form ─────────────────────────────────────────────────
  _notifRowHTML(n) {
    const unitas = ['minuti','ore','giorni','settimane'];
    return `<div class="notif-row" data-nid="${n.id}">
      <input type="number" class="notif-anticipo" value="${n.anticipo||1}" min="1" max="999" />
      <select class="notif-unita">
        ${unitas.map(u=>`<option value="${u}"${(n.unita||'giorni')===u?' selected':''}>${Lang.t('agenda.notifs.'+({'minuti':'minutes','ore':'hours','giorni':'days','settimane':'weeks'}[u]||u))}</option>`).join('')}
      </select>
      <span class="notif-row-before">${Lang.t('agenda.notifs.before_unit')}</span>
      <button type="button" class="btn-rm-notif" title="${Lang.t('agenda.notif.remove')}">✕</button>
    </div>`;
  },

  _bindNotifRows() {
    document.querySelectorAll('.btn-rm-notif').forEach(btn => {
      if (btn._bound) return;
      btn._bound = true;
      btn.addEventListener('click', () => btn.closest('.notif-row').remove());
    });
  },

  // ── Form inserimento / modifica ────────────────────────────────────────────
  _showForm(existing = null) {
    const isEdit = !!existing && !existing._prefill;
    const linkedIds = new Set(existing?.vociCollegate || []);
    const notifiche = this._getNotifiche(existing || {});
    const notifOn = notifiche.length > 0;
    const tipos = ['Promemoria','Evento','Scadenza'];
    const defaultRow = this._notifRowHTML({ id:'n'+Date.now(), anticipo:1, unita:'giorni' });

    const html = `<form id="agenda-form">
      <div class="form-group">
        <label>${Lang.t('agenda.form.title')}</label>
        <input type="text" name="titolo" value="${Utils.esc(existing?.titolo||'')}" required placeholder="${Lang.t('agenda.form.title_ph')}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>${Lang.t('common.type')}</label>
          <select name="tipo">
            ${tipos.map(t=>`<option value="${t}"${(existing?.tipo||'Promemoria')===t?' selected':''}>${Lang.t('agenda.type.'+t.toLowerCase())}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>${Lang.t('agenda.form.time')}</label>
          <input type="time" name="ora" value="${existing?.ora||''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>${Lang.t('agenda.form.date')}</label>
          <input type="date" name="dataInizio" value="${existing?.dataInizio||Utils.today()}" required />
        </div>
        <div class="form-group">
          <label>${Lang.t('agenda.form.end_date')}</label>
          <input type="date" name="dataFine" value="${existing?.dataFine||''}" />
        </div>
      </div>
      <div class="form-group">
        <label>${Lang.t('agenda.form.description')}</label>
        <textarea name="descrizione" rows="2" placeholder="${Lang.t('agenda.form.desc_ph')}">${Utils.esc(existing?.descrizione||'')}</textarea>
      </div>

      <div class="form-section-divider">${Lang.t('agenda.notifs')}</div>
      <label class="toggle-row">
        <input type="checkbox" id="notif-toggle" ${notifOn?'checked':''} />
        <span>${Lang.t('agenda.notifs.enable')}</span>
      </label>
      <div id="notif-rows-wrap" ${notifOn?'':'style="display:none"'}>
        <div class="notif-rows-label">${Lang.t('agenda.notifs.before')}</div>
        <div id="notif-rows">
          ${notifiche.length ? notifiche.map(n=>this._notifRowHTML(n)).join('') : defaultRow}
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="add-notif-row">${Lang.t('agenda.notifs.add')}</button>
      </div>

      <div class="form-section-divider">${Lang.t('agenda.linked')}</div>
      <div id="linked-preview" class="linked-preview">${this._linkedPreview([...linkedIds])}</div>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-link-voci" style="margin-bottom:14px">${Lang.t('agenda.add_linked')}</button>
      <input type="hidden" id="linked-ids-val" name="vociCollegate" value="${[...linkedIds].join(',')}" />

      <div class="form-actions">
        <button type="submit" class="btn btn-primary">${isEdit?Lang.t('common.save'):Lang.t('common.add')}</button>
        <button type="button" class="btn btn-secondary" id="cancel-ag">${Lang.t('common.cancel')}</button>
      </div>
    </form>`;

    Utils.showModal(isEdit ? Lang.t('agenda.edit') : Lang.t('agenda.new_event'), html, async form => {
      const notificheOut = [];
      if (form.querySelector('#notif-toggle')?.checked) {
        form.querySelectorAll('.notif-row').forEach(row => {
          notificheOut.push({
            id: row.dataset.nid,
            anticipo: parseInt(row.querySelector('.notif-anticipo')?.value) || 1,
            unita: row.querySelector('.notif-unita')?.value || 'giorni'
          });
        });
      }
      const fd = new FormData(form);
      const item = {
        titolo:       fd.get('titolo')?.trim(),
        tipo:         fd.get('tipo') || 'Promemoria',
        dataInizio:   fd.get('dataInizio'),
        dataFine:     fd.get('dataFine') || null,
        ora:          fd.get('ora') || null,
        descrizione:  fd.get('descrizione')?.trim() || '',
        notifiche:    notificheOut,
        vociCollegate:(fd.get('vociCollegate')||'').split(',').filter(Boolean),
        completato:   existing?.completato || false
      };
      if (!item.titolo || !item.dataInizio) return;

      if (isEdit) {
        await this._cancelNotif(existing.id);
        DB.updateAgendaItem(existing.id, item);
        if (item.notifiche.length && !item.completato) await this._scheduleNotif({ ...item, id:existing.id });
      } else {
        const saved = DB.addAgendaItem(item);
        if (saved.notifiche.length) await this._scheduleNotif(saved);
      }
      Utils.closeModal();
      this.render();
    });

    document.getElementById('notif-toggle')?.addEventListener('change', e => {
      document.getElementById('notif-rows-wrap').style.display = e.target.checked ? '' : 'none';
      if (e.target.checked && !document.querySelectorAll('#notif-rows .notif-row').length) {
        document.getElementById('notif-rows').insertAdjacentHTML('beforeend', this._notifRowHTML({ id:'n'+Date.now(), anticipo:1, unita:'giorni' }));
        this._bindNotifRows();
      }
    });
    document.getElementById('add-notif-row')?.addEventListener('click', () => {
      document.getElementById('notif-rows').insertAdjacentHTML('beforeend', this._notifRowHTML({ id:'n'+Date.now(), anticipo:1, unita:'giorni' }));
      this._bindNotifRows();
    });
    this._bindNotifRows();
    document.getElementById('cancel-ag')?.addEventListener('click', Utils.closeModal);
    document.getElementById('btn-link-voci')?.addEventListener('click', () => {
      this._openLinkPicker(linkedIds, newIds => {
        linkedIds.clear(); newIds.forEach(id => linkedIds.add(id));
        document.getElementById('linked-ids-val').value = [...linkedIds].join(',');
        document.getElementById('linked-preview').innerHTML = this._linkedPreview([...linkedIds]);
      });
    });
  },

  // ── Link picker (bottom sheet) ─────────────────────────────────────────────
  _linkedPreview(ids) {
    if (!ids.length) return `<span class="linked-empty">${Lang.t('agenda.no_linked')}</span>`;
    const all = DB.getAllEntries();
    return ids.map(id => {
      const e = all.find(x => x.id === id);
      if (!e) return '';
      const label = e.descrizione || e.desc || e.tipo || id;
      return `<span class="linked-chip">${Utils.esc(label)}${e.importo?' · '+Utils.fmt(e.importo):''}</span>`;
    }).filter(Boolean).join('');
  },

  _openLinkPicker(selectedIds, onConfirm) {
    const all = DB.getAllEntries();
    const sel = new Set(selectedIds);
    const icons = { casa:'🏠', spesa:'🛒', intrattenimento:'🎬', veicoli:'🚗', finanze:'💰' };
    const catLabels = {
      mutuo_affitto: Lang.t('casa.cat.mutuo'), elettricita: Lang.t('casa.cat.elettricita'),
      gas: Lang.t('casa.cat.gas'), acqua: Lang.t('casa.cat.acqua'),
      internet_telefono: Lang.t('casa.cat.internet'), condominio: Lang.t('casa.cat.condominio'),
      assicurazione_casa: Lang.t('casa.cat.assicurazione'), manutenzione_ordinaria: Lang.t('casa.cat.manutenzione'),
      manutenzione_straordinaria: Lang.t('casa.cat.straordinaria'), altro_casa: Lang.t('casa.cat.altro'),
      supermercato: Lang.t('spesa.cat.supermercato'), farmacia: Lang.t('spesa.cat.farmacia'),
      abbigliamento: Lang.t('spesa.cat.abbigliamento'), elettronica: Lang.t('spesa.cat.elettronica'),
      casa_oggetti: Lang.t('spesa.cat.casa_oggetti'), cura_persona: Lang.t('spesa.cat.cura_persona'),
      animali: Lang.t('spesa.cat.animali'), altro_spesa: Lang.t('spesa.cat.altro'),
      streaming: Lang.t('int.cat.streaming'), ristoranti: Lang.t('int.cat.ristoranti'),
      bar_caffe: Lang.t('int.cat.bar'), cinema_teatro: Lang.t('int.cat.cinema'),
      sport_palestra: Lang.t('int.cat.sport'), hobby: Lang.t('int.cat.hobby'),
      viaggi_vacanze: Lang.t('int.cat.viaggi'), feste_eventi: Lang.t('int.cat.feste'),
      altro_intrattenimento: Lang.t('int.cat.altro'), rifornimenti: Lang.t('veicoli.cat.rifornimenti'),
      assicurazioni: Lang.t('veicoli.cat.assicurazione'), bolli: Lang.t('veicoli.cat.bollo'),
      ordinarie: Lang.t('veicoli.cat.ordinarie'), straordinarie: Lang.t('veicoli.cat.straordinarie'),
      entrate: Lang.t('fin.income')
    };
    const grouped = {};
    all.forEach(e => { (grouped[e._section] = grouped[e._section]||[]).push(e); });

    const listHTML = Object.entries(grouped).map(([sec, entries]) =>
      `<div class="link-group-hdr">${icons[sec]||''} ${sec.charAt(0).toUpperCase()+sec.slice(1)}</div>` +
      entries.slice(0,40).map(e => {
        const label = e.descrizione||e.desc||e.tipo||'—';
        const d = e.date||e.data||e.scadenza||'';
        return `<label class="link-row${sel.has(e.id)?' lsel':''}" data-eid="${e.id}">
          <input type="checkbox" value="${e.id}"${sel.has(e.id)?' checked':''}>
          <span class="link-label">${Utils.esc(label)}</span>
          <span class="link-meta">${e._parentName?e._parentName+' · ':''}${catLabels[e._cat]||e._cat}${d?' · '+Utils.fmtDate(d):''}${e.importo?' · '+Utils.fmt(e.importo):''}</span>
        </label>`;
      }).join('')
    ).join('');

    const overlay = document.createElement('div');
    overlay.className = 'link-picker-overlay';
    overlay.innerHTML = `<div class="link-picker-sheet">
      <div class="csel-handle"></div>
      <div class="link-picker-hdr">
        <span class="link-picker-title">${Lang.t('agenda.link.title')}</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-primary" id="lp-ok">${Lang.t('agenda.link.confirm')}</button>
          <button class="btn btn-sm btn-secondary" id="lp-cancel">${Lang.t('common.cancel')}</button>
        </div>
      </div>
      <div class="link-picker-body">${all.length ? listHTML : `<div class="empty-state">${Lang.t('agenda.link.empty')}</div>`}</div>
    </div>`;
    document.body.appendChild(overlay);

    const close = () => { overlay.classList.remove('open'); overlay.addEventListener('transitionend', () => overlay.remove(), { once:true }); };
    overlay.addEventListener('change', e => {
      const cb = e.target; if (cb.type!=='checkbox') return;
      if (cb.checked) sel.add(cb.value); else sel.delete(cb.value);
      cb.closest('label')?.classList.toggle('lsel', cb.checked);
    });
    overlay.querySelector('#lp-ok').addEventListener('click', () => { onConfirm([...sel]); close(); });
    overlay.querySelector('#lp-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));
  },

  // ── Notifiche ──────────────────────────────────────────────────────────────
  async _scheduleNotif(item) {
    const p = window.Capacitor?.Plugins?.LocalNotifications;
    if (!p) return;
    const notifiche = this._getNotifiche(item);
    if (!notifiche.length) return;
    try {
      const perms = await p.requestPermissions();
      if (perms.display !== 'granted') return;
      const [color] = this._typeConfig(item.tipo);
      const rawType = Lang.t('agenda.type.' + item.tipo.toLowerCase());
      const title = `${rawType.charAt(0).toUpperCase()+rawType.slice(1)} – Flusso`;
      const toSchedule = notifiche.map(n => {
        const ms = this._calcNotifMs(item, n);
        if (!ms || ms <= Date.now()) return null;
        return { id:this._notifId(item.id, n.id), title, body:`${item.titolo} · ${n.anticipo} ${n.unita} prima`, schedule:{ at:new Date(ms), allowWhileIdle:true }, channelId:'finance_agenda', smallIcon:'ic_launcher', iconColor:color };
      }).filter(Boolean);
      if (toSchedule.length) await p.schedule({ notifications:toSchedule });
    } catch (e) { console.warn('Notifica:', e); }
  },

  async _cancelNotif(itemId) {
    const p = window.Capacitor?.Plugins?.LocalNotifications;
    if (!p) return;
    const item = (DB.getAll().agenda||[]).find(i => i.id === itemId);
    const notifiche = this._getNotifiche(item||{});
    if (!notifiche.length) return;
    try { await p.cancel({ notifications: notifiche.map(n => ({ id:this._notifId(itemId, n.id) })) }); } catch {}
  },

  _calcNotifMs(item, notif) {
    if (!item.dataInizio) return null;
    const [h, m] = (item.ora||'09:00').split(':').map(Number);
    const ev = new Date(item.dataInizio + 'T00:00:00');
    ev.setHours(h, m, 0, 0);
    const mult = { minuti:60e3, ore:3600e3, giorni:86400e3, settimane:604800e3 };
    return ev.getTime() - (notif.anticipo||1) * (mult[notif.unita]||mult.giorni);
  },

  _notifId(itemId, subId = 'n0') {
    const key = itemId + ':' + subId;
    let h = 5381;
    for (const c of key) h = ((h<<5)+h+c.charCodeAt(0)) & 0x7fffffff;
    return h || 1;
  }
};
