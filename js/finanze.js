// ===== TAB FINANZE =====
const Finanze = {
  _hiddenCards: new Set(JSON.parse(localStorage.getItem('financeApp_hiddenCards') || '[]')),

  init() { this.render(); this._bindDelegated(); },

  _bindDelegated() {
    document.getElementById('tab-finanze').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === 'toggle-card') {
        const cardId = btn.dataset.card;
        const card   = document.querySelector(`[data-card-id="${cardId}"]`);
        if (!card) return;
        const isNowHidden = card.classList.toggle('card-collapsed');
        if (isNowHidden) this._hiddenCards.add(cardId);
        else             this._hiddenCards.delete(cardId);
        this._saveHiddenCards();
        btn.innerHTML = `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${isNowHidden ? '<polyline points="3,5 8,10 13,5"/>' : '<polyline points="3,10 8,5 13,10"/>'}
        </svg>`;
        btn.title = isNowHidden ? Lang.t('common.show') : Lang.t('common.hide');
        return;
      }

      if (action === 'del-entrata') {
        Utils.confirm(Lang.t('fin.delete_income'), () => {
          DB.removeEntry('finanze', 'entrate', btn.dataset.id);
          ImageStore.removeAll(btn.dataset.id);
          this.render();
        });
      } else if (action === 'edit-entrata') {
        const existing = (DB.getAll().finanze.entrate || []).find(e => e.id === btn.dataset.id);
        if (!existing) return;
        Utils.showModal(Lang.t('fin.edit_income'), this._entrataForm(existing), (form) => {
          const fd = new FormData(form);
          const updates = {};
          for (const [k, v] of fd.entries()) { if (k !== '_ricorrente_active') updates[k] = v.trim(); }
          if (!form.querySelector('[name="_ricorrente_active"]')?.checked) delete updates.ricorrente;
          DB.updateEntry('finanze', 'entrate', existing.id, updates);
          Utils.closeModal();
          this.render();
        }, existing.id);
      } else if (action === 'del-obietivo') {
        Utils.confirm(Lang.t('fin.goal.delete'), () => {
          DB.removeObietivo(btn.dataset.id);
          this.render();
        });
      } else if (action === 'edit-obietivo') {
        const existing = (DB.getAll().obiettivi || []).find(o => o.id === btn.dataset.id);
        if (!existing) return;
        Utils.showModal(Lang.t('fin.goal.edit'), this._obiettivForm(existing), (form) => {
          const fd = new FormData(form);
          const updates = {};
          for (const [k, v] of fd.entries()) { if (v.trim()) updates[k] = v.trim(); }
          DB.updateObietivo(existing.id, updates);
          Utils.closeModal();
          this.render();
        });
      }
    });
  },

  _saveHiddenCards() {
    localStorage.setItem('financeApp_hiddenCards', JSON.stringify([...this._hiddenCards]));
  },

  _toggleBtn(cardId) {
    const isHidden = this._hiddenCards.has(cardId);
    return `<button class="card-hide-btn" data-action="toggle-card" data-card="${cardId}" title="${isHidden ? Lang.t('common.show') : Lang.t('common.hide')}">
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${isHidden ? '<polyline points="3,5 8,10 13,5"/>' : '<polyline points="3,10 8,5 13,10"/>'}
      </svg>
    </button>`;
  },

  _card(cardId, title, bodyHtml, actionsHtml = '') {
    const isHidden = this._hiddenCards.has(cardId);
    return `
      <div class="category-card${isHidden ? ' card-collapsed' : ''}" data-card-id="${cardId}">
        <div class="card-header">
          <span class="card-title">${title}</span>
          <div class="card-actions">
            ${actionsHtml}
            ${this._toggleBtn(cardId)}
          </div>
        </div>
        <div class="card-body">${bodyHtml}</div>
      </div>`;
  },

  render() {
    const { month, year } = Utils.getPeriod();
    const data = DB.getAll().finanze;

    const totCasa   = Casa.getTotal(month, year);
    const totSpesa  = Spesa.getTotal(month, year);
    const totIntr   = Intrattenimento.getTotal(month, year);
    const totVeic   = Veicoli.getTotal(month, year);
    const totUscite = totCasa + totSpesa + totIntr + totVeic;

    const entrateFiltered = Utils.filterByPeriod(data.entrate || [], month, year);
    const totEntrate = Utils.sum(entrateFiltered);
    const saldo = totEntrate - totUscite;
    const saldoAmt = Utils.fmt(Math.abs(saldo));
    const [saldoEuro, saldoCent] = saldoAmt.replace('€','').trim().split(',');
    let html = `
      <div class="f-hero-card">
        <div class="f-hero-label">${saldo >= 0 ? Lang.t('fin.balance') + ' ' + Lang.t('fin.positive') : Lang.t('fin.balance') + ' ' + Lang.t('fin.negative')}</div>
        <div class="f-hero-amount"><span class="f-hero-currency">€</span>${saldoEuro}${saldoCent !== undefined ? ',' + saldoCent : ''}</div>
        <div class="f-hero-chips">
          <div class="f-hero-chip">
            <div class="f-hero-chip-label">${Lang.t('fin.chart_income')}</div>
            <div class="f-hero-chip-value income">${Utils.fmt(totEntrate)}</div>
          </div>
          <div class="f-hero-chip">
            <div class="f-hero-chip-label">${Lang.t('fin.chart_expenses')}</div>
            <div class="f-hero-chip-value expense">${Utils.fmt(totUscite)}</div>
          </div>
        </div>
      </div>

      <div class="category-card chart-card${this._hiddenCards.has('chart') ? ' card-collapsed' : ''}" data-card-id="chart">
        <div class="card-header">
          <span class="card-title">${Lang.t('fin.trend')}</span>
          <div class="card-actions">${this._toggleBtn('chart')}</div>
        </div>
        <div class="card-body">${this._renderChart()}</div>
      </div>

      <div class="categories-grid" style="margin-bottom:24px">`;

    html += this._card('breakdown', Lang.t('fin.breakdown'),
      this._renderBreakdown(totCasa, totSpesa, totIntr, totVeic, totUscite, month, year));

    const entrateBody = entrateFiltered.length === 0
      ? `<div class="f-empty-state"><div class="f-empty-icon">💰</div>${Lang.t('fin.no_income')}</div>`
      : `<div class="f-entry-list">${[...entrateFiltered].sort((a,b)=>(b.data||'')>(a.data||'')?1:-1).map(e => this._renderEntrata(e)).join('')}</div>`;
    html += this._card('entrate', Lang.t('fin.income_section'), entrateBody,
      `${totEntrate > 0 ? `<span class="card-total">${Utils.fmt(totEntrate)}</span>` : ''}
       <button class="btn btn-success btn-sm" id="add-entrata-btn">+ ${Lang.t('common.add')}</button>`);

    html += this._card('obiettivi', Lang.t('fin.goals'),
      this._renderObiettivi(),
      `<button class="btn btn-primary btn-sm" id="add-obietivo-btn">+ ${Lang.t('common.add')}</button>`);

    if (Object.keys(Casa.getTotalByImmobile(month, year)).length > 0) {
      html += this._card('immobili', Lang.t('fin.property_exp'),
        this._renderImmobileDetail(month, year));
    }

    if (Object.keys(Veicoli.getTotalByVehicle(month, year)).length > 0) {
      html += this._card('veicoli', Lang.t('fin.vehicle_exp'),
        this._renderVehicleDetail(month, year));
    }

    html += `</div>`;

    document.getElementById('tab-finanze').innerHTML = html;
    this._bindEvents();
  },

  // ── Grafico andamento ────────────────────────────────────────────────────
  _renderChart() {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: String(d.getMonth() + 1).padStart(2, '0'),
        year:  String(d.getFullYear()),
        label: Lang.t('month.' + d.getMonth()).slice(0, 3)
      });
    }

    const series = months.map(({ month, year, label }) => {
      const uscite = Casa.getTotal(month, year) + Spesa.getTotal(month, year) +
                     Intrattenimento.getTotal(month, year) + Veicoli.getTotal(month, year);
      const finData = DB.getAll().finanze;
      const entrate = Utils.sum(Utils.filterByPeriod(finData.entrate || [], month, year));
      return { label, entrate, uscite };
    });

    const maxVal = Math.max(...series.flatMap(s => [s.entrate, s.uscite]), 1);
    const W = 340, H = 160, PL = 10, PR = 10, PT = 18, PB = 28;
    const cW = W - PL - PR, cH = H - PT - PB;
    const slotW = cW / 6, barW = Math.max(8, Math.floor(slotW * 0.32)), gap = 2;

    const yLines = [0.25, 0.5, 0.75, 1.0].map(pct => {
      const y = (PT + cH * (1 - pct)).toFixed(1);
      const val = Math.round(maxVal * pct);
      const label = val >= 1000 ? `${(val/1000).toFixed(1)}k` : String(val);
      return `<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3,3"/>
              <text x="${PL}" y="${(parseFloat(y)-2).toFixed(1)}" font-size="8" fill="var(--text-muted)">${label}</text>`;
    }).join('');

    const bars = series.map((s, i) => {
      const cx = PL + i * slotW + slotW / 2;
      const yBase = PT + cH;
      const hE = s.entrate > 0 ? Math.max(2, (s.entrate / maxVal) * cH) : 0;
      const hU = s.uscite  > 0 ? Math.max(2, (s.uscite  / maxVal) * cH) : 0;
      return `<rect x="${(cx-barW-gap).toFixed(1)}" y="${(yBase-hE).toFixed(1)}" width="${barW}" height="${hE.toFixed(1)}" fill="var(--success)" rx="2" opacity="0.85"/>
              <rect x="${(cx+gap).toFixed(1)}" y="${(yBase-hU).toFixed(1)}" width="${barW}" height="${hU.toFixed(1)}" fill="var(--danger)" rx="2" opacity="0.85"/>
              <text x="${cx.toFixed(1)}" y="${(yBase+13).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${s.label}</text>`;
    }).join('');

    return `<div class="chart-wrap">
      <div class="chart-legend">
        <span class="chart-legend-dot" style="background:var(--success)"></span><span>${Lang.t('fin.chart_income')}</span>
        <span class="chart-legend-dot" style="background:var(--danger)"></span><span>${Lang.t('fin.chart_expenses')}</span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">
        ${yLines}
        <line x1="${PL}" y1="${PT+cH}" x2="${W-PR}" y2="${PT+cH}" stroke="var(--border)" stroke-width="1"/>
        ${bars}
      </svg>
    </div>`;
  },

  // ── Obiettivi risparmio ──────────────────────────────────────────────────
  _renderObiettivi() {
    const obiettivi = DB.getAll().obiettivi || [];
    if (obiettivi.length === 0) return `<div class="empty-state">${Lang.t('fin.no_goals')}</div>`;

    const avgSaldo = this._avgMonthlySaldo();

    return obiettivi.map(o => {
      const acc    = parseFloat(o.importoAccumulato) || 0;
      const target = parseFloat(o.importoTarget) || 1;
      const pct    = Math.min(100, Math.round(acc / target * 100));
      const color  = pct >= 100 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--primary)';
      const remaining = Math.max(0, target - acc);
      let eta = '';
      if (avgSaldo > 0 && pct < 100) {
        const months = Math.ceil(remaining / avgSaldo);
        eta = `<div class="obiettivo-eta">📅 A questo ritmo: ~${Lang.t('fin.goal.eta', { n: months, unit: months === 1 ? Lang.t('fin.goal.month') : Lang.t('fin.goal.months') })}</div>`;
      }
      return `
        <div class="obiettivo-item">
          <div class="obiettivo-header">
            <span class="obiettivo-nome">${Utils.esc(o.nome)}</span>
            <span class="obiettivo-target">${Utils.fmt(target)}</span>
          </div>
          <div class="obiettivo-progress-row">
            <div class="progress-bar-wrap" style="flex:1;height:8px">
              <div class="progress-bar" style="width:${pct}%;height:8px;background:${color}"></div>
            </div>
            <span class="obiettivo-pct" style="color:${color}">${pct}%</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${Utils.fmt(acc)} ${Lang.t('fin.goal.saved_label')}${o.dataTarget ? ` · ${Lang.t('fin.goal.due')} ${Utils.fmtDate(o.dataTarget)}` : ''}</div>
          ${eta}
          <div class="obiettivo-actions">
            <button class="btn btn-secondary btn-sm" data-action="edit-obietivo" data-id="${o.id}">${Lang.t('fin.goal.update')}</button>
            <button class="btn btn-icon danger" data-action="del-obietivo" data-id="${o.id}">🗑️</button>
          </div>
        </div>`;
    }).join('');
  },

  _avgMonthlySaldo() {
    const now = new Date();
    let total = 0, count = 0;
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const y = String(d.getFullYear());
      const uscite  = Casa.getTotal(m, y) + Spesa.getTotal(m, y) + Intrattenimento.getTotal(m, y) + Veicoli.getTotal(m, y);
      const entrate = Utils.sum(Utils.filterByPeriod(DB.getAll().finanze.entrate || [], m, y));
      if (entrate > 0 || uscite > 0) { total += entrate - uscite; count++; }
    }
    return count > 0 ? total / count : 0;
  },

  _obiettivForm(existing = null) {
    const o = existing || {};
    return `<form id="obietivo-form">
      <div class="form-grid">
        <div class="form-group full">
          <label>${Lang.t('fin.goal.name')}</label>
          <input type="text" name="nome" value="${Utils.esc(o.nome||'')}" required placeholder="${Lang.t('fin.goal.name_ph')}" />
        </div>
        <div class="form-group">
          <label>${Lang.t('fin.goal.target')}</label>
          <input type="number" name="importoTarget" value="${o.importoTarget||''}" step="100" min="0" required />
        </div>
        <div class="form-group">
          <label>${Lang.t('fin.goal.saved')}</label>
          <input type="number" name="importoAccumulato" value="${o.importoAccumulato||''}" step="0.01" min="0" />
        </div>
        <div class="form-group">
          <label>${Lang.t('fin.goal.date')}</label>
          <input type="date" name="dataTarget" value="${o.dataTarget||''}" />
        </div>
        <div class="form-group full">
          <label>${Lang.t('common.notes')}</label>
          <input type="text" name="note" value="${Utils.esc(o.note||'')}" />
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">${Lang.t('common.cancel')}</button>
        <button type="submit" class="btn btn-primary">${existing ? Lang.t('common.save') : Lang.t('fin.goal.create')}</button>
      </div>
    </form>`;
  },

  // ── Breakdown ────────────────────────────────────────────────────────────
  _renderBreakdown(totCasa, totSpesa, totIntr, totVeic, totUscite, month, year) {
    const rows = [
      { icon: '🏠', label: Lang.t('nav.casa'),    total: totCasa,  color: 'var(--casa)',            detail: Casa.getTotalByImmobile(month, year) },
      { icon: '🛒', label: Lang.t('nav.spesa'),   total: totSpesa, color: 'var(--spesa)',           detail: Spesa.getTotalByCategory(month, year) },
      { icon: '🎬', label: Lang.t('nav.svago'),   total: totIntr,  color: 'var(--intrattenimento)', detail: Intrattenimento.getTotalByCategory(month, year) },
      { icon: '🚗', label: Lang.t('nav.veicoli'), total: totVeic,  color: 'var(--veicoli)',         detail: Veicoli.getTotalByVehicle(month, year) }
    ].filter(r => r.total > 0);

    if (rows.length === 0) return `<div class="f-empty-state"><div class="f-empty-icon">💸</div>${Lang.t('fin.no_expenses')}</div>`;

    const colors = { 'var(--casa)': 'rgba(29,158,117,.12)', 'var(--spesa)': 'rgba(239,159,39,.12)', 'var(--intrattenimento)': 'rgba(99,102,241,.12)', 'var(--veicoli)': 'rgba(14,165,233,.12)' };
    return rows.map(r => {
      const pct = totUscite > 0 ? Math.round(r.total / totUscite * 100) : 0;
      const bg = colors[r.color] || 'rgba(29,158,117,.1)';
      return `
        <div class="f-cat-row">
          <div class="f-cat-icon" style="background:${bg}">${r.icon}</div>
          <div class="f-cat-info">
            <div class="f-cat-name">${r.label}</div>
            <div class="f-cat-bar-wrap"><div class="f-cat-bar-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="f-cat-amount">
            <div class="f-cat-value">${Utils.fmt(r.total)}</div>
            <div class="f-cat-pct">${pct}%</div>
          </div>
        </div>`;
    }).join('') + `
      <div style="border-top:.5px solid var(--f-bg-card-border);margin:4px 12px 0;padding:10px 0;display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:var(--f-text-primary)">
        <span>${Lang.t('fin.breakdown.total')}</span><span>${Utils.fmt(totUscite)}</span>
      </div>`;
  },

  _renderEntrata(e) {
    return `
      <div class="f-entry-row">
        <div class="f-entry-top">
          <span class="f-entry-date">${Utils.fmtDate(e.data)}</span>
          <span class="f-entry-desc f-trunc">${Utils.esc(e.descrizione || e.tipo || Lang.t('fin.income'))}</span>
        </div>
        <div class="f-entry-bottom">
          ${e.tipo ? `<span class="f-pill f-pill-green">${Utils.esc(e.tipo)}</span>` : ''}
          ${e.ricorrente ? `<span class="f-pill f-pill-amber">🔄 ${e.ricorrente}</span>` : ''}
          <span class="f-spacer"></span>
          <span class="f-entry-amount" style="color:var(--f-mint)">${Utils.fmt(e.importo)}</span>
          <div class="f-entry-actions">
            <button class="f-btn-edit" data-action="edit-entrata" data-id="${e.id}" title="${Lang.t('common.edit')}">✏️</button>
            <button class="f-btn-delete" data-action="del-entrata" data-id="${e.id}" title="${Lang.t('common.delete')}">🗑️</button>
          </div>
        </div>
      </div>`;
  },

  _renderImmobileDetail(month, year) {
    const immobili = DB.getAll().casa.immobili || [];
    const rows = immobili.map(im => {
      const totIm = Casa._immobileTotal(im, month, year);
      if (totIm === 0) return '';
      const subTotals = Casa.subCategories.map(sc => {
        const t = Utils.sum(Utils.filterByPeriod(im[sc.key] || [], month, year));
        return t > 0 ? `<span style="font-size:11px;color:var(--text-muted)">${sc.icon} ${Utils.fmt(t)}</span>` : '';
      }).filter(Boolean).join(' &bull; ');
      return `
        <div style="padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-weight:600">🏠 ${Utils.esc(im.nome)}</span>
            <span style="font-weight:700;color:var(--casa)">${Utils.fmt(totIm)}</span>
          </div>
          <div>${subTotals}</div>
        </div>`;
    }).join('');
    return rows || `<div class="empty-state">${Lang.t('fin.no_property')}</div>`;
  },

  _renderVehicleDetail(month, year) {
    const vehicles = DB.getAll().veicoli.vehicles;
    const rows = vehicles.map(v => {
      const totV = Veicoli._vehicleTotal(v, month, year);
      if (totV === 0) return '';
      const subTotals = Veicoli.subCategories.map(sc => {
        const t = Utils.sum(Utils.filterByPeriod(v[sc.key] || [], month, year));
        return t > 0 ? `<span style="font-size:11px;color:var(--text-muted)">${sc.icon} ${Utils.fmt(t)}</span>` : '';
      }).filter(Boolean).join(' &bull; ');
      return `
        <div style="padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-weight:600">🚗 ${Utils.esc(v.nome)}</span>
            <span style="font-weight:700;color:var(--veicoli)">${Utils.fmt(totV)}</span>
          </div>
          <div>${subTotals}</div>
        </div>`;
    }).join('');
    return rows || `<div class="empty-state">${Lang.t('fin.no_vehicle')}</div>`;
  },

  _entrataForm(existing = null) {
    const e = existing || {};
    return `<form id="entrata-form">
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
          <label>${Lang.t('common.description')} *</label>
          <input type="text" name="descrizione" value="${Utils.esc(e.descrizione||'')}" required placeholder="${Lang.t('fin.income.desc_ph')}" />
        </div>
        <div class="form-group">
          <label>${Lang.t('common.type')}</label>
          ${Utils.selectWithAdd('tipo', [Lang.t('fin.income.salary'),Lang.t('fin.income.freelance'),Lang.t('fin.income.rental'),Lang.t('fin.income.investments'),Lang.t('fin.income.refund'),Lang.t('fin.income.gift'),Lang.t('fin.income.bonus'),Lang.t('fin.income.pension'),'Altro'], e.tipo||'', 'finanze_entrata_tipo')}
        </div>
        <div class="form-group">
          <label>${Lang.t('common.notes')}</label>
          <input type="text" name="note" value="${Utils.esc(e.note||'')}" />
        </div>
        <div class="ricorrente-section">
          <label class="ricorrente-row">
            <input type="checkbox" name="_ricorrente_active" value="1" ${e.ricorrente ? 'checked' : ''} onchange="var s=document.getElementById('recur-freq');s.disabled=!this.checked;s.style.display=this.checked?'inline-block':'none'" />
            <span>${Lang.t('common.recurring')}</span>
          </label>
          <select name="ricorrente" id="recur-freq" style="display:${e.ricorrente ? 'inline-block' : 'none'}" ${e.ricorrente ? '' : 'disabled'}>
            <option value="mensile"     ${e.ricorrente === 'mensile'     ? 'selected' : ''}>${Lang.t('freq.monthly')}</option>
            <option value="bimestrale"  ${e.ricorrente === 'bimestrale'  ? 'selected' : ''}>${Lang.t('freq.bimonthly')}</option>
            <option value="trimestrale" ${e.ricorrente === 'trimestrale' ? 'selected' : ''}>${Lang.t('freq.quarterly')}</option>
            <option value="semestrale"  ${e.ricorrente === 'semestrale'  ? 'selected' : ''}>${Lang.t('freq.semiannual')}</option>
            <option value="annuale"     ${e.ricorrente === 'annuale'     ? 'selected' : ''}>${Lang.t('freq.annual')}</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="Utils.closeModal()">${Lang.t('common.cancel')}</button>
        <button type="submit" class="btn btn-success">${existing ? Lang.t('common.save') : Lang.t('fin.add_income')}</button>
      </div>
    </form>`;
  },

  _bindEvents() {
    document.getElementById('add-entrata-btn')?.addEventListener('click', () => {
      const tempId = 'tmp_' + Date.now();
      Utils.showModal(Lang.t('fin.add_income'), this._entrataForm(), (form) => {
        const fd = new FormData(form);
        const entry = {};
        for (const [k, v] of fd.entries()) { if (k !== '_ricorrente_active' && v.trim()) entry[k] = v.trim(); }
        if (!form.querySelector('[name="_ricorrente_active"]')?.checked) delete entry.ricorrente;
        const saved = DB.addEntry('finanze', 'entrate', entry);
        ImageStore.move(tempId, saved.id);
        Utils.closeModal();
        this.render();
        App.refreshPeriodSelectors();
      }, tempId);
    });

    document.getElementById('add-obietivo-btn')?.addEventListener('click', () => {
      Utils.showModal(Lang.t('fin.goal.new'), this._obiettivForm(), (form) => {
        const fd = new FormData(form);
        const obj = {};
        for (const [k, v] of fd.entries()) { if (v.trim()) obj[k] = v.trim(); }
        DB.addObietivo(obj);
        Utils.closeModal();
        this.render();
      });
    });
  },

  openPrefilled(category, entry) {
    Utils.showModal(Lang.t('fin.add_income'), this._entrataForm(entry), (form) => {
      const fd = new FormData(form);
      const e = {};
      for (const [k, v] of fd.entries()) { if (k !== '_ricorrente_active' && v.trim()) e[k] = v.trim(); }
      if (!form.querySelector('[name="_ricorrente_active"]')?.checked) delete e.ricorrente;
      DB.addEntry('finanze', 'entrate', e);
      Utils.closeModal();
      this.render();
      App.refreshPeriodSelectors();
    });
  }
};
