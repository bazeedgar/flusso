// ===== DATA LAYER =====
// Salvataggio primario: server Node.js → file su disco (data/finance-data.json)
// Fallback: localStorage del browser
// Backup automatici: data/backups/ (ultimi 20)
const DB = {
  KEY: 'financeApp_v1',
  _data: null,
  _saveTimer: null,
  _serverAvailable: false,

  // True se l'app gira su Android (Capacitor) o come PWA installata — usa solo localStorage
  _isPWA() {
    return !!(window.Capacitor?.isNativePlatform?.())
      || window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  },

  // Chiamato una volta all'avvio — carica dal server o dal localStorage
  async load() {
    // In modalità PWA (installata sul telefono) → solo localStorage, nessuna chiamata al server
    if (this._isPWA()) {
      this._serverAvailable = false;
      try {
        const raw = localStorage.getItem(this.KEY);
        this._data = this._migrate(raw ? JSON.parse(raw) : this._defaultData());
      } catch {
        this._data = this._defaultData();
      }
      this._setSaveStatus('local');
      return;
    }

    try {
      const res = await fetch('/api/data', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const serverData = await res.json();
        if (serverData) {
          this._data = this._migrate(serverData);
          this._serverAvailable = true;
          localStorage.setItem(this.KEY, JSON.stringify(this._data));
          this.checkAndApplyRecurring();
          return;
        }
        this._serverAvailable = true;
      }
    } catch {
      // Server non disponibile
      this._serverAvailable = false;
    }

    // Fallback a localStorage
    try {
      const raw = localStorage.getItem(this.KEY);
      this._data = this._migrate(raw ? JSON.parse(raw) : this._defaultData());
    } catch {
      this._data = this._defaultData();
    }
    this.checkAndApplyRecurring();
  },

  // Migrazione da strutture dati vecchie
  _migrate(data) {
    if (!data) return this._defaultData();
    const def = this._defaultData();
    if (!data.casa || !Array.isArray(data.casa.immobili)) data.casa = def.casa;
    if (!data.spesa)           data.spesa           = def.spesa;
    if (!data.intrattenimento) data.intrattenimento = def.intrattenimento;
    if (!data.veicoli)         data.veicoli         = def.veicoli;
    if (!data.finanze)         data.finanze         = def.finanze;
    if (!data.agenda)          data.agenda          = [];
    if (!data.budgets)         data.budgets         = { spesa: {}, intrattenimento: {} };
    if (!data.obiettivi)       data.obiettivi       = [];
    return data;
  },

  getAll() {
    return this._data || this._defaultData();
  },

  saveAll(data) {
    this._data = data;

    // Salva subito su localStorage (sempre, come safety net)
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch {}

    // Debounce salvataggio su server (500ms)
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveToServer(data), 500);

    // Aggiorna indicatore UI
    this._setSaveStatus('saving');
  },

  async _saveToServer(data) {
    if (!this._serverAvailable) {
      this._setSaveStatus('local');
      return;
    }
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        this._setSaveStatus('saved');
      } else {
        this._setSaveStatus('error');
      }
    } catch {
      this._setSaveStatus('error');
    }
  },

  _lastStatus: null,

  _setSaveStatus(status) {
    this._lastStatus = status;
    const el = document.getElementById('save-status');
    if (!el) return;
    const map = {
      saving: { text: Lang.t('status.saving'), cls: 'status-saving' },
      saved:  { text: Lang.t('status.saved'),  cls: 'status-saved' },
      local:  { text: Lang.t('status.local'),  cls: 'status-local' },
      error:  { text: Lang.t('status.error'),  cls: 'status-error' }
    };
    const s = map[status] || map.saved;
    el.textContent = s.text;
    el.className = 'save-status ' + s.cls;
    if (status === 'saved') setTimeout(() => { if (el.className.includes('saved')) el.textContent = ''; }, 2500);

    el.onclick = null;
    el.style.cursor = '';
    if (status === 'local') {
      el.style.cursor = 'pointer';
      el.onclick = () => Utils.showModal(Lang.t('local.title'), `
        <p>${Lang.t('local.msg1')}</p>
        <p style="margin-top:12px">${Lang.t('local.msg2')}</p>
        <p style="margin-top:12px">${Lang.t('local.msg3')}</p>
        <p style="margin-top:12px; color:var(--text-muted); font-size:13px">${Lang.t('local.msg4')}</p>
      `);
    }
  },

  _defaultData() {
    return {
      casa: { immobili: [] },
      spesa: {
        supermercato: [], farmacia: [], abbigliamento: [], elettronica: [],
        casa_oggetti: [], cura_persona: [], animali: [], altro_spesa: []
      },
      intrattenimento: {
        streaming: [], ristoranti: [], bar_caffe: [], cinema_teatro: [],
        sport_palestra: [], hobby: [], viaggi_vacanze: [], feste_eventi: [], altro_intrattenimento: []
      },
      veicoli: { vehicles: [] },
      finanze: { entrate: [], budget_mensile: 0 },
      agenda: [],
      budgets: { spesa: {}, intrattenimento: {} },
      obiettivi: []
    };
  },

  _immobileCategories() {
    return ['mutuo_affitto','elettricita','gas','acqua','internet_telefono',
            'condominio','assicurazione_casa','manutenzione_ordinaria',
            'manutenzione_straordinaria','altro_casa'];
  },

  // ===== IMMOBILI (CASA) =====
  addImmobile(immobile) {
    const data = this.getAll();
    immobile.id = Date.now().toString();
    this._immobileCategories().forEach(k => { immobile[k] = []; });
    data.casa.immobili.push(immobile);
    this.saveAll(data);
    return immobile;
  },

  removeImmobile(immobileId) {
    const data = this.getAll();
    data.casa.immobili = data.casa.immobili.filter(i => i.id !== immobileId);
    this.saveAll(data);
  },

  updateImmobile(immobileId, updates) {
    const data = this.getAll();
    const idx = data.casa.immobili.findIndex(i => i.id === immobileId);
    if (idx !== -1) data.casa.immobili[idx] = { ...data.casa.immobili[idx], ...updates };
    this.saveAll(data);
  },

  // ===== VEICOLI =====
  addVehicle(vehicle) {
    const data = this.getAll();
    vehicle.id = Date.now().toString();
    vehicle.rifornimenti = [];
    vehicle.assicurazioni = [];
    vehicle.bolli = [];
    vehicle.ordinarie = [];
    vehicle.straordinarie = [];
    data.veicoli.vehicles.push(vehicle);
    this.saveAll(data);
    return vehicle;
  },

  removeVehicle(vehicleId) {
    const data = this.getAll();
    data.veicoli.vehicles = data.veicoli.vehicles.filter(v => v.id !== vehicleId);
    this.saveAll(data);
  },

  updateVehicle(vehicleId, updates) {
    const data = this.getAll();
    const idx = data.veicoli.vehicles.findIndex(v => v.id === vehicleId);
    if (idx !== -1) data.veicoli.vehicles[idx] = { ...data.veicoli.vehicles[idx], ...updates };
    this.saveAll(data);
  },

  // ===== GENERIC ENTRIES =====
  addEntry(section, category, entry) {
    const data = this.getAll();
    entry.id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    entry.createdAt = new Date().toISOString();
    if (section === 'veicoli') {
      const vehicle = data.veicoli.vehicles.find(v => v.id === category.vehicleId);
      if (vehicle) vehicle[category.subCategory].push(entry);
    } else if (section === 'casa') {
      const im = data.casa.immobili.find(i => i.id === category.immobileId);
      if (im) im[category.subCategory].push(entry);
    } else {
      data[section][category].push(entry);
    }
    this.saveAll(data);
    return entry;
  },

  removeEntry(section, category, entryId) {
    const data = this.getAll();
    if (section === 'veicoli') {
      const vehicle = data.veicoli.vehicles.find(v => v.id === category.vehicleId);
      if (vehicle) vehicle[category.subCategory] = vehicle[category.subCategory].filter(e => e.id !== entryId);
    } else if (section === 'casa') {
      const im = data.casa.immobili.find(i => i.id === category.immobileId);
      if (im) im[category.subCategory] = im[category.subCategory].filter(e => e.id !== entryId);
    } else {
      data[section][category] = data[section][category].filter(e => e.id !== entryId);
    }
    this.saveAll(data);
  },

  updateEntry(section, category, entryId, updates) {
    const data = this.getAll();
    if (section === 'veicoli') {
      const vehicle = data.veicoli.vehicles.find(v => v.id === category.vehicleId);
      if (vehicle) {
        const idx = vehicle[category.subCategory].findIndex(e => e.id === entryId);
        if (idx !== -1) vehicle[category.subCategory][idx] = { ...vehicle[category.subCategory][idx], ...updates };
      }
    } else if (section === 'casa') {
      const im = data.casa.immobili.find(i => i.id === category.immobileId);
      if (im) {
        const idx = im[category.subCategory].findIndex(e => e.id === entryId);
        if (idx !== -1) im[category.subCategory][idx] = { ...im[category.subCategory][idx], ...updates };
      }
    } else {
      const idx = data[section][category].findIndex(e => e.id === entryId);
      if (idx !== -1) data[section][category][idx] = { ...data[section][category][idx], ...updates };
    }
    this.saveAll(data);
  },

  // ===== AGENDA =====
  addAgendaItem(item) {
    const data = this.getAll();
    item.id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    item.createdAt = new Date().toISOString();
    if (!data.agenda) data.agenda = [];
    data.agenda.push(item);
    this.saveAll(data);
    return item;
  },

  removeAgendaItem(id) {
    const data = this.getAll();
    data.agenda = (data.agenda || []).filter(i => i.id !== id);
    this.saveAll(data);
  },

  updateAgendaItem(id, updates) {
    const data = this.getAll();
    const idx = (data.agenda || []).findIndex(i => i.id === id);
    if (idx !== -1) data.agenda[idx] = { ...data.agenda[idx], ...updates };
    this.saveAll(data);
  },

  // Restituisce tutte le voci di spesa da tutte le sezioni con metadati _section/_cat/_parentName
  getAllEntries() {
    const data = this.getAll();
    const result = [];
    const push = (e, section, cat, parentName) =>
      result.push({ ...e, _section: section, _cat: cat, _parentName: parentName || '' });

    (data.casa?.immobili || []).forEach(im =>
      this._immobileCategories().forEach(cat =>
        (im[cat] || []).forEach(e => push(e, 'casa', cat, im.nome || 'Casa'))));

    Object.entries(data.spesa || {}).forEach(([cat, arr]) =>
      (arr || []).forEach(e => push(e, 'spesa', cat, '')));

    Object.entries(data.intrattenimento || {}).forEach(([cat, arr]) =>
      (arr || []).forEach(e => push(e, 'intrattenimento', cat, '')));

    (data.veicoli?.vehicles || []).forEach(v =>
      ['rifornimenti','assicurazioni','bolli','ordinarie','straordinarie'].forEach(cat =>
        (v[cat] || []).forEach(e => push(e, 'veicoli', cat, v.nome || v.targa || 'Veicolo'))));

    (data.finanze?.entrate || []).forEach(e => push(e, 'finanze', 'entrate', ''));

    return result.sort((a, b) => {
      const da = a.date || a.data || a.scadenza || '';
      const db = b.date || b.data || b.scadenza || '';
      return db.localeCompare(da);
    });
  },

  // ===== EXPORT / IMPORT =====
  async exportJSON() {
    const entries = this.getAllEntries();
    if (entries.length === 0) {
      Utils.showModal(Lang.t('export.title'), `
        <p style="margin-bottom:16px">${Lang.t('export.no_data')}<br>${Lang.t('export.no_data_sub')}</p>
        <div class="form-actions">
          <button class="btn btn-primary" style="width:100%" onclick="Utils.closeModal()">${Lang.t('common.ok')}</button>
        </div>
      `);
      return;
    }

    const data = this.getAll();
    const json = JSON.stringify(data, null, 2);
    const filename = `flusso-backup-${new Date().toISOString().slice(0,10)}.json`;

    if (window.Capacitor?.isNativePlatform?.()) {
      // Prova plugin nativo SaveFile → salva direttamente in Download
      const SaveFile = window.Capacitor?.Plugins?.SaveFile;
      if (SaveFile) {
        try {
          await SaveFile.saveToDownloads({ content: json, filename, mimeType: 'application/json' });
          Utils.showModal(Lang.t('export.title'), `
            <p style="margin-bottom:16px">${Lang.t('export.saved')}<br><code>${filename}</code></p>
            <div class="form-actions">
              <button class="btn btn-primary" style="width:100%" onclick="Utils.closeModal()">${Lang.t('common.ok')}</button>
            </div>
          `);
        } catch (e) {
          Utils.showModal(Lang.t('export.title'), `
            <p style="margin-bottom:8px">${Lang.t('export.fail')} <em>${e.message || e}</em>.</p>
            <div class="form-actions">
              <button class="btn btn-primary" style="width:100%" onclick="Utils.closeModal()">${Lang.t('common.ok')}</button>
            </div>
          `);
        }
        return;
      }
      // Fallback Web Share API
      try {
        const file = new File([json], filename, { type: 'application/json' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Esporta dati Flusso' });
        } else if (navigator.share) {
          await navigator.share({ title: filename, text: json });
        } else {
          throw new Error('condivisione non supportata');
        }
      } catch (e) {
        if (e?.name === 'AbortError') return;
        try { await navigator.clipboard.writeText(json); } catch (_) {}
        Utils.showModal(Lang.t('export.title'), `
          <p style="margin-bottom:8px">${Lang.t('export.share_fail')}</p>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">${Lang.t('export.clipboard')}</p>
          <div class="form-actions">
            <button class="btn btn-primary" style="width:100%" onclick="Utils.closeModal()">${Lang.t('common.ok')}</button>
          </div>
        `);
      }
      return;
    }

    // Browser desktop: blob download
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (typeof data !== 'object' || Array.isArray(data)) throw new Error(Lang.t('import.invalid'));
          this._data = this._migrate(data);
          this.saveAll(this._data);
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },

  // ===== SPESE RICORRENTI =====
  checkAndApplyRecurring() {
    const now = new Date();
    const curM    = now.getMonth() + 1; // 1-12
    const curY    = now.getFullYear();
    const curYStr = String(curY);
    const curMStr = String(curM).padStart(2, '0');
    const data = this.getAll();
    let changed = false;

    // Controlla se una data cade nel periodo corrente della frequenza data
    const inPeriod = (dateStr, freq) => {
      if (!dateStr) return false;
      if (parseInt(dateStr.slice(0, 4)) !== curY) return false;
      const m = parseInt(dateStr.slice(5, 7));
      switch (freq) {
        case 'mensile':    return m === curM;
        case 'bimestrale': return Math.ceil(m / 2) === Math.ceil(curM / 2);
        case 'trimestrale':return Math.ceil(m / 3) === Math.ceil(curM / 3);
        case 'semestrale': return Math.ceil(m / 6) === Math.ceil(curM / 6);
        case 'annuale':    return true;
        default:           return m === curM;
      }
    };

    // Calcola la data dell'istanza nel periodo corrente (stesso giorno, mese di inizio periodo)
    const instanceDate = (srcDate, freq) => {
      const day = srcDate ? parseInt(srcDate.slice(8, 10)) : 1;
      let targetM;
      switch (freq) {
        case 'mensile':    targetM = curM; break;
        case 'bimestrale': targetM = (Math.ceil(curM / 2) - 1) * 2 + 1; break;
        case 'trimestrale':targetM = (Math.ceil(curM / 3) - 1) * 3 + 1; break;
        case 'semestrale': targetM = (Math.ceil(curM / 6) - 1) * 6 + 1; break;
        case 'annuale':    targetM = srcDate ? parseInt(srcDate.slice(5, 7)) : curM; break;
        default:           targetM = curM;
      }
      const lastDay = new Date(curY, targetM, 0).getDate();
      const d = String(Math.min(day, lastDay)).padStart(2, '0');
      return `${curYStr}-${String(targetM).padStart(2, '0')}-${d}`;
    };

    // Processa un array di voci ricorrenti e aggiunge le istanze mancanti
    const process = (entries, push) => {
      if (!Array.isArray(entries)) return;
      for (const src of entries.filter(e => e.ricorrente && !e._recurInstance)) {
        const freq    = src.ricorrente;
        const recurId = src.id;
        const covered = entries.some(e =>
          (e.id === recurId || e._recurId === recurId) && inPeriod(e.data, freq)
        );
        if (!covered) {
          const inst = { ...src };
          inst.id             = Date.now().toString() + Math.random().toString(36).slice(2, 6);
          inst.createdAt      = new Date().toISOString();
          inst.data           = instanceDate(src.data, freq);
          inst._recurId       = recurId;
          inst._recurInstance = true;
          delete inst.ricorrente;
          push(inst);
          changed = true;
        }
      }
    };

    // spesa e intrattenimento
    for (const section of ['spesa', 'intrattenimento']) {
      for (const [cat, entries] of Object.entries(data[section] || {})) {
        if (Array.isArray(entries))
          process(entries, inst => data[section][cat].push(inst));
      }
    }

    // casa → immobili → subcategorie
    const casaSubs = ['mutuo_affitto','elettricita','gas','acqua','internet_telefono',
                      'condominio','assicurazione_casa','manutenzione_ordinaria',
                      'manutenzione_straordinaria','altro_casa'];
    for (const im of (data.casa?.immobili || [])) {
      for (const sc of casaSubs) {
        if (Array.isArray(im[sc]))
          process(im[sc], inst => im[sc].push(inst));
      }
    }

    // veicoli → vehicles → subcategorie
    const veicoliSubs = ['rifornimenti','assicurazioni','bolli','ordinarie','straordinarie'];
    for (const v of (data.veicoli?.vehicles || [])) {
      for (const sc of veicoliSubs) {
        if (Array.isArray(v[sc]))
          process(v[sc], inst => v[sc].push(inst));
      }
    }

    if (changed) this.saveAll(data);
  },

  // ===== OBIETTIVI RISPARMIO =====
  addObietivo(obj) {
    const data = this.getAll();
    obj.id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    obj.createdAt = new Date().toISOString();
    if (!data.obiettivi) data.obiettivi = [];
    data.obiettivi.push(obj);
    this.saveAll(data);
    return obj;
  },

  updateObietivo(id, updates) {
    const data = this.getAll();
    const idx = (data.obiettivi || []).findIndex(o => o.id === id);
    if (idx !== -1) data.obiettivi[idx] = { ...data.obiettivi[idx], ...updates };
    this.saveAll(data);
  },

  removeObietivo(id) {
    const data = this.getAll();
    data.obiettivi = (data.obiettivi || []).filter(o => o.id !== id);
    this.saveAll(data);
  },

  // ===== EXPORT CSV =====
  exportCSV() {
    const { month, year } = Utils.getPeriod();
    const all = this.getAllEntries();
    const filtered = all.filter(e => {
      const d = e.data || e.date || '';
      if (year !== 'all' && Utils.getYear(d) !== year) return false;
      if (month !== 'all' && Utils.getMonth(d) !== month) return false;
      return true;
    });

    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const sectionLabels = {
      spesa: Lang.t('nav.spesa'), intrattenimento: Lang.t('nav.svago'),
      casa: Lang.t('nav.casa'), veicoli: Lang.t('nav.veicoli'), finanze: Lang.t('nav.finanze')
    };
    const headers = [Lang.t('common.date'), Lang.t('csv.section'), Lang.t('csv.category'),
                     Lang.t('common.description'), Lang.t('common.amount'), Lang.t('common.notes')];
    const rows = filtered.map(e => [
      e.data || e.date || '',
      sectionLabels[e._section] || e._section || '',
      e._parentName || e._cat || '',
      e.descrizione || e.negozio || e.servizio || e.locale || e.evento || e.destinazione || e.tipo || '',
      (parseFloat(e.importo) || 0).toFixed(2),
      e.note || ''
    ].map(esc).join(';'));

    const csv = '﻿' + [headers.map(esc).join(';'), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const label = (month !== 'all' ? `${month}-` : '') + (year !== 'all' ? year : Lang.t('csv.all'));
    a.download = `finance-report-${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};
