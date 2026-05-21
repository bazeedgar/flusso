// ===== BIOMETRIC AUTH =====
const BiometricAuth = {
  _KEY:       'flusso_biometric_enabled',
  _ASKED_KEY: 'flusso_biometric_asked',
  _wasActive:       true,
  _pendingSuppress: false,
  _suppressUntil:   0,

  // Chiama prima di camera/file-picker.
  // La finestra parte quando l'app va in background (non subito),
  // così dura 60 secondi dall'inizio della sessione camera/picker.
  suppressNext() { this._pendingSuppress = true; },

  isEnabled()    { return localStorage.getItem(this._KEY) === '1'; },
  setEnabled(v)  { localStorage.setItem(this._KEY, v ? '1' : '0'); },
  hasBeenAsked() { return !!localStorage.getItem(this._ASKED_KEY); },
  markAsked()    { localStorage.setItem(this._ASKED_KEY, '1'); },

  get _plugin() {
    return window.Capacitor?.Plugins?.BiometricAuth;
  },

  async isAvailable() {
    if (!this._plugin) return false;
    try {
      const res = await this._plugin.isAvailable();
      return !!res.available;
    } catch { return false; }
  },

  showLock() {
    const lock = document.getElementById('biometric-lock');
    if (!lock) return;
    lock.classList.remove('hidden');
    document.getElementById('biometric-retry-btn').style.display = 'none';
  },

  hideLock() {
    document.getElementById('biometric-lock')?.classList.add('hidden');
  },

  async tryUnlock() {
    if (!this._plugin) { this.hideLock(); return; }
    this.showLock();
    try {
      await this._plugin.authenticate({
        title:    'Flusso',
        subtitle: Lang.t('biometric.subtitle')
      });
      this.hideLock();
    } catch {
      // Mostra il bottone Riprova — l'utente non può bypassare il lock
      document.getElementById('biometric-retry-btn').style.display = '';
    }
  },

  _promptEnable() {
    return new Promise(resolve => {
      const overlay = document.getElementById('biometric-prompt-overlay');
      const yes     = document.getElementById('biometric-prompt-yes');
      const no      = document.getElementById('biometric-prompt-no');
      overlay.classList.remove('hidden');
      const done = (val) => {
        overlay.classList.add('hidden');
        yes.removeEventListener('click', yesH);
        no.removeEventListener('click', noH);
        overlay.removeEventListener('click', bgH);
        resolve(val);
      };
      const yesH = () => done(true);
      const noH  = () => done(false);
      const bgH  = (e) => { if (e.target === overlay) done(false); };
      yes.addEventListener('click', yesH);
      no.addEventListener('click', noH);
      overlay.addEventListener('click', bgH);
    });
  },

  async init() {
    if (!window.Capacitor?.isNativePlatform?.()) return;

    if (this.isEnabled()) {
      this.showLock();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await this.tryUnlock();
    }

    const available = await this.isAvailable();
    const row = document.getElementById('biometric-toggle-row');
    const div = document.getElementById('biometric-divider');
    if (available && row) {
      row.style.display = '';
      if (div) div.style.display = '';
    }

    // Prima volta: chiede se abilitare
    if (available && !this.hasBeenAsked()) {
      this.markAsked();
      const enable = await this._promptEnable();
      if (enable) {
        this.setEnabled(true);
        const cb = document.getElementById('biometric-cb');
        if (cb) cb.checked = true;
      }
    }

    const CapApp = window.Capacitor?.Plugins?.App;
    if (!CapApp) return;
    await CapApp.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) {
        // App va in background: se era stato chiamato suppressNext(), arma la finestra
        if (this._pendingSuppress) {
          this._suppressUntil   = Date.now() + 60000; // 60 secondi dalla prima backgrounding
          this._pendingSuppress = false;
        }
      } else if (!this._wasActive) {
        // App torna in primo piano
        if (Date.now() < this._suppressUntil) {
          // dentro la finestra camera/picker — non bloccare
        } else if (this.isEnabled()) {
          this._suppressUntil = 0;
          await this.tryUnlock();
        }
      }
      this._wasActive = isActive;
    });
  }
};
