// ===== VOICE COMMAND (AI) + OCR =====
const VoiceCommand = {
  _recognition: null,
  _isListening: false,
  _capacitorSRHandles: null,
  _dialOpen: false,

  init() { this._createUI(); },

  _createUI() {
    // ── Speed Dial (+ button con sub-azioni) ─────────────────────────────────
    const dial = document.createElement('div');
    dial.id = 'speed-dial';
    dial.className = 'speed-dial';
    dial.innerHTML = `
      <div class="speed-dial-items" id="speed-dial-items">
        <div class="speed-dial-item">
          <span class="speed-dial-label">${Lang.t('voice.scan')}</span>
          <button class="speed-dial-action-btn" id="ocr-dial-btn" title="Scansione OCR">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/>
            </svg>
          </button>
        </div>
        <div class="speed-dial-item">
          <span class="speed-dial-label">${Lang.t('voice.command')}</span>
          <button class="speed-dial-action-btn" id="voice-dial-btn" title="Comando vocale">
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm-1.25 18.94V22h2.5v-2.06A7.002 7.002 0 0 0 19 13h-2a5 5 0 0 1-10 0H5a7.002 7.002 0 0 0 6.75 6.94z"/>
            </svg>
          </button>
        </div>
      </div>`;
    document.body.appendChild(dial);
    // Il trigger (#speed-dial-main) è nella barra in basso, slot destro: vedi index.html

    // ── Voice Panel (bottom sheet) ────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = 'voice-panel';
    panel.className = 'voice-panel hidden';
    panel.innerHTML = `
      <div class="voice-panel-inner">
        <div class="voice-panel-header">
          <span class="voice-panel-title">${Lang.t('voice.title')}</span>
          <button class="voice-panel-close" id="voice-panel-close">&times;</button>
        </div>
        <div class="voice-panel-hint" id="voice-hint">${Lang.t('voice.hint')}</div>
        <div class="voice-panel-input-row">
          <input type="text" id="voice-text-input" class="voice-text-input" placeholder="${Lang.t('voice.input_ph')}" autocomplete="off" />
          <button id="voice-mic-btn" class="voice-mic-btn" title="Parla">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm-1.25 18.94V22h2.5v-2.06A7.002 7.002 0 0 0 19 13h-2a5 5 0 0 1-10 0H5a7.002 7.002 0 0 0 6.75 6.94z"/>
            </svg>
          </button>
        </div>
        <button id="voice-send-btn" class="btn btn-primary voice-send-btn" disabled>${Lang.t('voice.send')}</button>
      </div>`;
    document.body.appendChild(panel);

    // ── Toast ─────────────────────────────────────────────────────────────────
    const toast = document.createElement('div');
    toast.id = 'voice-toast';
    toast.className = 'voice-toast hidden';
    document.body.appendChild(toast);

    // ── Backdrop trasparente (chiude il dial) ─────────────────────────────────
    const backdrop = document.createElement('div');
    backdrop.id = 'speed-dial-backdrop';
    backdrop.className = 'speed-dial-backdrop hidden';
    document.body.appendChild(backdrop);

    // ── Events ────────────────────────────────────────────────────────────────
    document.getElementById('speed-dial-main').addEventListener('click', () => this._toggleDial());
    document.getElementById('voice-dial-btn').addEventListener('click', () => { this._closeDial(); this._openPanel(); });
    document.getElementById('ocr-dial-btn').addEventListener('click', () => this._startOcr());
    backdrop.addEventListener('click', () => this._closeDial());

    document.getElementById('voice-panel-close').addEventListener('click', () => this._closePanel());
    panel.addEventListener('click', e => { if (e.target === panel) this._closePanel(); });

    const input = document.getElementById('voice-text-input');
    const sendBtn = document.getElementById('voice-send-btn');
    input.addEventListener('input', () => { sendBtn.disabled = !input.value.trim(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && input.value.trim()) this._submit(); });
    sendBtn.addEventListener('click', () => this._submit());
    document.getElementById('voice-mic-btn').addEventListener('click', () => this._toggleMic());
  },

  // ── Speed Dial ───────────────────────────────────────────────────────────────
  _toggleDial() { this._dialOpen ? this._closeDial() : this._openDial(); },

  _openDial() {
    App?._closeFan?.();               // le due aperture si escludono a vicenda
    this._dialOpen = true;
    const items = document.getElementById('speed-dial-items');
    if (items) { items.style.display = 'flex'; }
    requestAnimationFrame(() => {
      document.getElementById('speed-dial')?.classList.add('open');
    });
    document.getElementById('speed-dial-backdrop')?.classList.remove('hidden');
    // La barra deve stare sopra il backdrop, altrimenti il trigger resta oscurato
    document.getElementById('bottom-nav')?.classList.add('nav-open', 'dial-open');
  },

  _closeDial() {
    this._dialOpen = false;
    document.getElementById('speed-dial')?.classList.remove('open');
    document.getElementById('speed-dial-backdrop')?.classList.add('hidden');
    document.getElementById('bottom-nav')?.classList.remove('nav-open', 'dial-open');
    const items = document.getElementById('speed-dial-items');
    if (items) {
      // Guard: only hide if dial wasn't re-opened before the callback fires
      const hide = () => { if (!this._dialOpen) items.style.display = 'none'; };
      items.addEventListener('transitionend', hide, { once: true });
      setTimeout(hide, 300);
    }
  },

  // ── Voice Panel ──────────────────────────────────────────────────────────────
  _openPanel() {
    Utils.lockScroll();
    document.getElementById('voice-panel')?.classList.remove('hidden');
    const input = document.getElementById('voice-text-input');
    if (input) { input.value = ''; input.focus(); }
    document.getElementById('voice-send-btn').disabled = true;
    this._setHint(Lang.t('voice.hint'));
  },

  _closePanel() {
    Utils.unlockScroll();
    document.getElementById('voice-panel')?.classList.add('hidden');
    this._stopListening();
  },

  // ── OCR ──────────────────────────────────────────────────────────────────────
  async _startOcr() {
    this._closeDial();
    let imageDataUrl = null;

    if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.Camera) {
      try {
        BiometricAuth.suppressNext();
        const photo = await Capacitor.Plugins.Camera.getPhoto({
          quality: 90, allowEditing: false, resultType: 'dataUrl',
          source: 'CAMERA', saveToGallery: false
        });
        imageDataUrl = photo.dataUrl;
      } catch { return; }
    } else {
      imageDataUrl = await this._captureFromInput();
    }
    if (!imageDataUrl) return;

    this._showOcrLoading(Lang.t('ocr.starting'), '');
    try {
      if (typeof Tesseract === 'undefined') {
        this._updateOcrLoading(Lang.t('ocr.downloading'), Lang.t('ocr.first_time'));
        const ok = await this._loadTesseract();
        if (!ok) throw new Error('Impossibile caricare il motore OCR. Controlla la connessione.');
      }

      const text = await OcrProcessor.recognize(imageDataUrl, msg => this._updateOcrLoading(msg, ''));
      this._updateOcrLoading(Lang.t('ocr.extracting'), '');

      const context = this._buildContext();
      const result  = OcrProcessor.parse(text, context);
      this._hideOcrLoading();

      const tempId = 'tmp_ocr_' + Date.now();
      await ImageStore.add(tempId, imageDataUrl, 'documento_' + Date.now() + '.jpg', 'image/jpeg');

      this._showOcrPreview(text, result, tempId);
    } catch (e) {
      this._hideOcrLoading();
      this._showToast('❌ ' + (e.message || 'Errore OCR'));
    }
  },

  _ocrCategories() {
    const firstVehicle  = DB.getAll().veicoli?.vehicles?.[0];
    const firstImmobile = DB.getAll().casa?.immobili?.[0];
    return [
      { label: Lang.t('ocr.cat.fuel'),         section: 'veicoli',          category: { vehicleId: firstVehicle?.id,  subCategory: 'rifornimenti' } },
      { label: Lang.t('ocr.cat.grocery'),       section: 'spesa',            category: 'supermercato' },
      { label: Lang.t('ocr.cat.pharmacy'),      section: 'spesa',            category: 'farmacia' },
      { label: Lang.t('ocr.cat.restaurant'),    section: 'intrattenimento',  category: 'ristoranti' },
      { label: Lang.t('ocr.cat.cinema'),        section: 'intrattenimento',  category: 'eventi_cinema' },
      { label: Lang.t('ocr.cat.home'),          section: 'casa',             category: { immobileId: firstImmobile?.id, subCategory: 'altro_casa' } },
      { label: Lang.t('ocr.cat.clothing'),      section: 'spesa',            category: 'abbigliamento' },
      { label: Lang.t('ocr.cat.electronics'),   section: 'spesa',            category: 'elettronica' },
      { label: Lang.t('ocr.cat.other'),         section: 'spesa',            category: 'altro_spesa' },
    ];
  },

  _showOcrPreview(rawText, result, tempId) {
    const sectionLabels = { spesa:'Spesa', intrattenimento:'Svago', casa:'Casa', veicoli:'Veicoli' };
    const catLabel   = result?.category && typeof result.category === 'string'
      ? result.category : (result?.category?.subCategory || '');
    const importoStr = result?.entry?.importo ? Number(result.entry.importo).toFixed(2) + ' €' : '—';
    const dataStr    = result?.entry?.data    ? Utils.fmtDate(result.entry.data) : '—';
    const preview    = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 1).slice(0, 12).join('\n');
    const sezLabel   = (sectionLabels[result?.section] || '?') + (catLabel ? ' › ' + catLabel : '');
    const cats       = this._ocrCategories();

    Utils.showModal(Lang.t('ocr.result_title'),
      `<div class="form-grid" style="margin-bottom:10px">
        <div class="form-group">
          <label>${Lang.t('ocr.detected_cat')}</label>
          <input type="text" readonly value="${Utils.esc(sezLabel)}" style="background:var(--surface2)" />
        </div>
        <div class="form-group">
          <label>${Lang.t('ocr.amount')}</label>
          <input type="text" readonly value="${Utils.esc(importoStr)}" style="background:var(--surface2)" />
        </div>
      </div>
      <div class="form-group full" style="margin-bottom:10px">
        <label>${Lang.t('ocr.ocr_text')}</label>
        <textarea readonly rows="4" style="font-size:11px;font-family:monospace;background:var(--surface2);resize:none;width:100%;padding:6px">${Utils.esc(preview || Lang.t('ocr.no_text'))}</textarea>
      </div>
      <div class="form-group full" style="margin-bottom:14px">
        <label>${Lang.t('ocr.manual_cat')}</label>
        <select id="ocr-manual-cat">
          <option value="">${Lang.t('ocr.use_detected')}</option>
          ${cats.map((c, i) => `<option value="${i}">${Utils.esc(c.label)}</option>`).join('')}
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="ocr-cancel-btn">${Lang.t('common.cancel')}</button>
        <button type="button" class="btn btn-primary" id="ocr-confirm-btn">${Lang.t('ocr.open_form')}</button>
      </div>`,
      null
    );

    document.getElementById('ocr-cancel-btn')?.addEventListener('click', () => {
      Utils.closeModal();
      ImageStore.removeAll(tempId);
    });
    document.getElementById('ocr-confirm-btn')?.addEventListener('click', () => {
      Utils.closeModal();
      const manualIdx = document.getElementById('ocr-manual-cat')?.value;
      let finalResult = result;
      if (manualIdx !== '' && manualIdx != null) {
        const chosen = cats[parseInt(manualIdx)];
        if (chosen) finalResult = { section: chosen.section, category: chosen.category, entry: result?.entry || {} };
      }
      if (!finalResult?.section) {
        this._showToast(Lang.t('ocr.select_first'));
        return;
      }
      this._insertEntry(finalResult, tempId);
    });
  },

  async _loadTesseract() {
    if (typeof Tesseract !== 'undefined') return true;
    return new Promise(res => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = () => res(true);
      s.onerror = () => res(false);
      document.head.appendChild(s);
    });
  },

  _captureFromInput() {
    return new Promise(res => {
      const input = document.getElementById('ocr-capture-input');
      if (!input) { res(null); return; }
      BiometricAuth.suppressNext();
      input.value = '';
      const handler = e => {
        input.removeEventListener('change', handler);
        const file = e.target.files?.[0];
        if (!file) { res(null); return; }
        const reader = new FileReader();
        reader.onload = ev => res(ev.target.result);
        reader.onerror  = () => res(null);
        reader.readAsDataURL(file);
        input.value = '';
      };
      input.addEventListener('change', handler);
      input.click();
    });
  },

  _showOcrLoading(msg, sub) {
    let overlay = document.getElementById('ocr-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ocr-loading-overlay';
      overlay.className = 'ocr-loading-overlay';
      overlay.innerHTML = `
        <div class="ocr-spinner"></div>
        <div class="ocr-loading-text" id="ocr-msg"></div>
        <div class="ocr-loading-sub" id="ocr-sub"></div>`;
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    document.getElementById('ocr-msg').textContent = msg;
    document.getElementById('ocr-sub').textContent = sub;
  },

  _updateOcrLoading(msg, sub) {
    const m = document.getElementById('ocr-msg'); if (m) m.textContent = msg;
    const s = document.getElementById('ocr-sub'); if (s && sub !== undefined) s.textContent = sub;
  },

  _hideOcrLoading() {
    const overlay = document.getElementById('ocr-loading-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  _buildContext() {
    const data = DB.getAll();
    const _now = new Date();
    return {
      vehicles: (data.veicoli?.vehicles || []).map(v => ({
        id: v.id, nome: [v.nome, v.marca, v.modello].filter(Boolean).join(' ')
      })),
      immobili: (data.casa?.immobili || []).map(im => ({ id: im.id, nome: im.nome })),
      today: `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`
    };
  },

  // ── Capacitor Speech Recognition ─────────────────────────────────────────────
  async _toggleMic() {
    if (this._isListening) { this._stopListening(); return; }
    window.Capacitor?.isNativePlatform?.() ? await this._startCapacitorSR() : await this._startWebSR();
  },

  async _startCapacitorSR() {
    const SR = window.Capacitor?.Plugins?.SpeechRecognition;
    if (!SR) { this._setHint('❌ Plugin riconoscimento vocale non trovato. Reinstalla l\'app.'); return; }
    try {
      const { available } = await SR.available();
      if (!available) { this._setHint('❌ Riconoscimento vocale non supportato su questo dispositivo.'); return; }
      const perm = await SR.requestPermissions();
      if (perm.speechRecognition !== 'granted') {
        this._setHint('❌ Permesso microfono negato.<br>Vai in Impostazioni → App → Flusso → Autorizzazioni → Microfono.');
        return;
      }
      const partialHandle = await SR.addListener('partialResults', (data) => {
        if (data.matches?.length > 0) this._setInput(data.matches[0]);
      });
      const stateHandle = await SR.addListener('listeningState', ({ status }) => {
        if (status === 'stopped' && this._isListening) this._stopListening();
      });
      this._capacitorSRHandles = [partialHandle, stateHandle];
      this._isListening = true;
      document.getElementById('voice-mic-btn')?.classList.add('voice-mic-btn--listening');
      this._setHint(Lang.t('voice.listening'));
      await SR.start({ language: 'it-IT', maxResults: 1, partialResults: true, popup: false });
    } catch(e) {
      this._isListening = false;
      document.getElementById('voice-mic-btn')?.classList.remove('voice-mic-btn--listening');
      this._setHint('❌ Errore microfono: ' + (e.message || 'sconosciuto'));
    }
  },

  // ── Web Speech API ───────────────────────────────────────────────────────────
  async _startWebSR() {
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!isSecure) {
      const httpsUrl = location.href.replace(/^http:/, 'https:').replace(/:(\d+)/, (_, p) => ':' + (parseInt(p) + 443));
      this._setHint(`❌ Il microfono richiede HTTPS.<br>Apri: <a href="${httpsUrl}" style="color:#818cf8">${httpsUrl}</a><br><small>Accetta l'avviso certificato → Avanzate → Procedi</small>`);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this._setHint('❌ Browser non supportato. Su Android usa <strong>Chrome</strong>, su iOS usa <strong>Safari</strong>.');
      return;
    }
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach(t => t.stop());
      } catch {
        this._setHint('❌ Permesso microfono negato. Vai nelle impostazioni del browser e consenti il microfono per questo sito.');
        return;
      }
    }
    if (this._recognition) { try { this._recognition.abort(); } catch {} }
    const r = new SR();
    r.lang = 'it-IT'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
    let final = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
        else interim = e.results[i][0].transcript;
      }
      this._setInput(final + interim);
    };
    r.onerror = (e) => {
      this._stopListening();
      if (e.error === 'network' || e.error === 'service-not-allowed') {
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile) {
          this._setHint('❌ Riconoscimento vocale non raggiungibile.<br>Assicurati di avere connessione internet, poi riprova.');
        } else {
          this._setHint('❌ Server vocale Google non raggiungibile dalla tua rete.<br>Apri l\'app in <strong>Microsoft Edge</strong> — usa il riconoscimento vocale locale di Windows senza internet.');
        }
      } else if (e.error === 'not-allowed') {
        this._setHint('❌ Permesso microfono negato. Vai nelle impostazioni del browser → sito → microfono → consenti.');
      } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
        this._setHint('❌ Errore: ' + e.error);
      }
    };
    r.onend = () => { if (this._isListening) this._stopListening(); };
    r.start();
    this._recognition = r;
    this._isListening = true;
    document.getElementById('voice-mic-btn')?.classList.add('voice-mic-btn--listening');
    this._setHint(Lang.t('voice.listening'));
  },

  _stopListening() {
    this._isListening = false;
    document.getElementById('voice-mic-btn')?.classList.remove('voice-mic-btn--listening');
    if (this._capacitorSRHandles) { this._capacitorSRHandles.forEach(h => h.remove()); this._capacitorSRHandles = null; }
    const capSR = window.Capacitor?.Plugins?.SpeechRecognition;
    if (capSR) { capSR.stop().catch(() => {}); }
    if (this._recognition) { try { this._recognition.stop(); } catch {} this._recognition = null; }
  },

  _setInput(text) {
    const input = document.getElementById('voice-text-input');
    if (input) { input.value = text; document.getElementById('voice-send-btn').disabled = !text.trim(); }
  },

  // ── Submit (comando vocale testo) ────────────────────────────────────────────
  async _submit() {
    const input = document.getElementById('voice-text-input');
    const text  = input?.value.trim();
    if (!text) return;

    this._stopListening();
    const sendBtn = document.getElementById('voice-send-btn');
    sendBtn.disabled = true;
    sendBtn.textContent = Lang.t('voice.processing');
    this._setHint(`💬 "<em>${text}</em>"`);

    const context    = this._buildContext();
    const isCapacitor = !!(window.Capacitor?.isNativePlatform?.());

    if (!isCapacitor && DB._serverAvailable) {
      try {
        const res = await fetch('/api/ai-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, context })
        });
        if (res.ok) {
          const result = await res.json();
          if (!result.error) { this._closePanel(); this._insertEntry(result); return; }
          this._setHint('❌ ' + result.error);
          sendBtn.disabled = false; sendBtn.textContent = Lang.t('voice.send'); return;
        }
      } catch {}
    }

    const result = LocalParser.parse(text, context);
    sendBtn.disabled = false;
    sendBtn.textContent = Lang.t('voice.send');
    if (result.error) { this._setHint('❌ ' + result.error); return; }
    this._closePanel();
    this._insertEntry(result);
  },

  _insertEntry({ section, category, entry, summary }, photoId = null) {
    if (section === 'agenda') {
      App._activateTab('agenda');
      setTimeout(() => Agenda._showForm({ ...entry, _prefill: true }), 120);
      return;
    }
    if (App.currentTab !== section) App._activateTab(section);
    setTimeout(() => App.modules[section]?.openPrefilled(category, entry, photoId), 120);
  },

  _setHint(html) {
    const el = document.getElementById('voice-hint');
    if (el) el.innerHTML = html;
  },

  _showToast(msg) {
    const toast = document.getElementById('voice-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'voice-toast voice-toast--visible';
    setTimeout(() => { toast.className = 'voice-toast hidden'; }, 5000);
  }
};
