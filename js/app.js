// ===== MAIN APP =====
const App = {
  currentTab: 'finanze',
  modules: { casa: Casa, spesa: Spesa, intrattenimento: Intrattenimento, veicoli: Veicoli, finanze: Finanze, agenda: Agenda },

  async init() {
    Lang.init();
    // Carica dati (server → localStorage → default)
    await DB.load();
    await ImageStore.loadCache();

    // Disabilita pinch-to-zoom e keyboard-zoom su iOS via viewport meta (JS è network-first, HTML è cache-first)
    const _isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const _vp = document.querySelector('meta[name="viewport"]');
    if (_vp) {
      if (_isIOS) {
        _vp.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      } else {
        _vp.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover';
      }
    }
    // Blocca pinch su Android via touchmove (non touchstart — interferirebbe con lo scroll)
    if (!_isIOS) {
      document.addEventListener('touchmove', e => {
        if (e.touches.length >= 2) e.preventDefault();
      }, { passive: false });
    }

    this._initDarkMode();
    this._applyThemeToBars();
    Utils.initCustomSelects();
    this._initSidebar();
    this._initModuleVisibility();
    this.refreshPeriodSelectors();
    this._bindTabNav();
    this._bindTabSwipe();
    this._bindPeriodSelectors();
    this._bindSidebarSettings();
    this._bindImportInput();
    this._initBackButton();

    for (const mod of Object.values(this.modules)) mod.init();
    this._activateTab('finanze');

    // Sync static [data-i18n] labels to the saved language (non-Italian startup)
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = Lang.t(el.dataset.i18n);
    });

    VoiceCommand.init();
    await BiometricAuth.init();
    this._initAutoTheme();
    setTimeout(() => this._requestAndroidPermissions(), 1500);
    setTimeout(() => this._initWidget(), 800);
    this._initInstallPrompt();

  },

  async _initWidget() {
    const plugin = window.Capacitor?.Plugins?.WidgetData;
    if (!plugin) return;
    this._updateWidget();
    const checkAction = async () => {
      try {
        const { action } = await plugin.getStartAction();
        if (action === 'SCAN') VoiceCommand._startOcr?.();
      } catch {}
    };
    await checkAction();
    const CapApp = window.Capacitor?.Plugins?.App;
    if (CapApp) {
      CapApp.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) { await checkAction(); this._updateWidget(); }
      });
    }
  },

  _updateWidget() {
    const plugin = window.Capacitor?.Plugins?.WidgetData;
    if (!plugin) return;
    try {
      const now  = new Date();
      const mesi = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

      // Mirror _renderChart() exactly — use the same module methods
      const series = [];
      for (let i = 5; i >= 0; i--) {
        const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mm    = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy  = String(d.getFullYear());
        const label = mesi[d.getMonth()];
        const uscite  = Casa.getTotal(mm, yyyy) + Spesa.getTotal(mm, yyyy) +
                        Intrattenimento.getTotal(mm, yyyy) + Veicoli.getTotal(mm, yyyy);
        const entrate = Utils.sum(
          Utils.filterByPeriod(DB.getAll().finanze?.entrate || [], mm, yyyy));
        series.push({ label, entrate, uscite });
      }

      const currentMonth = series[5].uscite.toFixed(2).replace('.', ',') + ' €';
      const period       = mesi[now.getMonth()] + ' ' + now.getFullYear();

      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      const widgetTheme = (theme === 'dark' || theme === 'dark-grey') ? 'dark' : 'light';

      plugin.updateData({
        currentMonth,
        period,
        entrateMonths: JSON.stringify(series.map(s => Math.round(s.entrate))),
        usciteMonths:  JSON.stringify(series.map(s => Math.round(s.uscite))),
        monthLabels:   JSON.stringify(series.map(s => s.label)),
        widgetTheme,
      });
    } catch {}
  },

  // ── Tasto Back Android (Capacitor) ───────────────────────────────────────
  _initBackButton() {
    if (!window.Capacitor?.isNativePlatform?.()) return;
    const CapApp = window.Capacitor?.Plugins?.App;
    if (!CapApp) return;
    CapApp.addListener('backButton', () => this._handleBack());
  },

  _handleBack() {
    // Chiude i layer aperti dall'alto verso il basso
    const id = (s) => document.getElementById(s);

    if (!id('camera-overlay')?.classList.contains('hidden')) {
      id('camera-cancel-btn')?.click(); return;
    }
    if (!id('lightbox-overlay')?.classList.contains('hidden')) {
      Utils.closeLightbox?.(); return;
    }
    if (!id('opts-overlay')?.classList.contains('hidden')) {
      id('opts-close-btn')?.click(); return;
    }
    const lp = document.querySelector('.link-picker-overlay.open');
    if (lp) { lp.querySelector('#lp-cancel')?.click(); return; }
    if (!id('confirm-overlay')?.classList.contains('hidden')) {
      id('confirm-no')?.click(); return;
    }
    if (!id('modal-overlay')?.classList.contains('hidden')) {
      Utils.closeModal?.(); return;
    }
    if (!id('voice-panel')?.classList.contains('hidden')) {
      VoiceCommand._closePanel?.(); return;
    }
    // Sidebar aperta su mobile → chiude
    const sidebar = id('sidebar');
    if (sidebar && !sidebar.classList.contains('collapsed')) {
      sidebar.classList.add('collapsed');
      document.getElementById('sidebar-backdrop')?.classList.remove('visible');
      localStorage.setItem('financeApp_sidebar', 'collapsed'); return;
    }
    // Tab non home → torna a Finanze
    if (this.currentTab !== 'finanze') {
      this._activateTab('finanze'); return;
    }
    // Lock biometrico visibile → ignora il back button
    if (!id('biometric-lock')?.classList.contains('hidden')) return;
    // Già su home → esce dall'app
    window.Capacitor.Plugins.App.exitApp();
  },

  _applyThemeToBars() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    let isDark = theme === 'dark' || theme === 'dark-grey';
    let color = '#F4EFE4';
    if (theme === 'dark') color = '#111C17';
    else if (theme === 'dark-grey') color = '#141414';
    else if (theme === 'custom') {
      const hex = localStorage.getItem('financeApp_customColor') || '#c7b8ea';
      const [h, s] = this._hexToHSL(hex);
      const customMode = localStorage.getItem('financeApp_customMode') || 'light';
      if (customMode === 'dark') {
        color = this._hslToHex(h, Math.max(s, 20), 9);
        isDark = true;
      } else if (customMode === 'black') {
        color = '#0a0a0a';
        isDark = true;
      } else {
        color = this._hslToHex(h, Math.min(s, 45), 94);
      }
    }

    // PWA / browser — aggiorna status bar
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = color;
    // color-scheme segnala a Chrome il modo chiaro/scuro per la barra di navigazione
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

    // App nativa Capacitor — usa plugin ThemeBars
    if (!window.Capacitor?.isNativePlatform?.()) return;
    const plugin = window.Capacitor?.Plugins?.ThemeBars;
    if (!plugin) return;
    // Se sidebar aperta → mantieni icons bianche con colore forest
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('collapsed')) {
      const forestHex = getComputedStyle(document.documentElement).getPropertyValue('--forest-hex').trim() || '#0D2B1E';
      try { plugin.setColor({ color: forestHex, lightIcons: true }); } catch {}
      return;
    }
    try { plugin.setColor({ color, lightIcons: isDark }); } catch {}
  },

  _setTheme(theme, save = true) {
    const applied = theme === 'auto' ? this._resolveAutoTheme() : (theme || 'light');
    if (applied !== 'custom') {
      ['--bg','--surface','--surface2','--border','--primary','--primary-light','--primary-dark',
       '--text','--text-muted','--text-light','--shadow','--shadow-md',
       '--grad-top','--grad-btm','--emerald','--emerald-l','--mint',
       '--forest','--forest-mid','--forest-deep','--forest-hex',
       '--emerald-rgb','--icon-hue-rotate','--bar-bg'].forEach(v =>
        document.documentElement.style.removeProperty(v));
      document.documentElement.classList.remove('custom-dark');
    }
    document.documentElement.setAttribute('data-theme', applied);

    const autoRow   = document.getElementById('auto-theme-row');
    const autoMode  = localStorage.getItem('financeApp_auto_mode') || 'system';
    const autoFrom  = localStorage.getItem('financeApp_auto_from') || '20:00';
    const autoTo    = localStorage.getItem('financeApp_auto_to')   || '07:00';
    if (autoRow) {
      autoRow.style.display = theme === 'auto' ? '' : 'none';
      document.querySelectorAll('.auto-mode-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === autoMode));
      const timeRow = document.getElementById('auto-time-row');
      if (timeRow) timeRow.style.display = autoMode === 'time' ? '' : 'none';
      const fromI = document.getElementById('auto-dark-from');
      const toI   = document.getElementById('auto-dark-to');
      if (fromI) fromI.value = autoFrom;
      if (toI)   toI.value   = autoTo;
    }

    const row = document.getElementById('custom-color-row');
    // Aggiorna sempre swatch e dot con il colore salvato, indipendentemente dal tema attivo
    const savedCustomColor = localStorage.getItem('financeApp_customColor') || '#c7b8ea';
    const dotEl    = document.getElementById('custom-theme-dot');
    const swatchEl = document.getElementById('custom-theme-swatch');
    if (dotEl)    dotEl.style.background    = savedCustomColor;
    if (swatchEl) swatchEl.style.background = savedCustomColor;
    if (applied === 'custom') {
      const color = savedCustomColor;
      this._applyCustomThemeVars(color);
      const swatch = document.getElementById('custom-theme-swatch');
      const input  = document.getElementById('custom-color-input');
      if (swatch) swatch.style.background = color;
      if (input)  input.value = color;
      if (dotEl)  dotEl.style.background = color;
      if (row)    row.style.display = '';
      this._updatePaletteActive(color);
      this._syncSlidersToColor(color);
      const customMode = localStorage.getItem('financeApp_customMode') || 'light';
      document.querySelectorAll('.custom-mode-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === customMode));
    } else {
      if (row) row.style.display = 'none';
    }

    document.querySelectorAll('.theme-opt').forEach(b =>
      b.classList.toggle('active', b.dataset.theme === (theme || 'light')));
    if (save) localStorage.setItem('financeApp_theme', theme);
    this._applyThemeToBars();
    if (save) this._updateWidget();
  },

  _applyPaletteColor(color) {
    localStorage.setItem('financeApp_customColor', color);
    const swatch = document.getElementById('custom-theme-swatch');
    const input  = document.getElementById('custom-color-input');
    const dot    = document.getElementById('custom-theme-dot');
    if (swatch) swatch.style.background = color;
    if (input)  input.value = color;
    if (dot)    dot.style.background = color;
    this._applyCustomThemeVars(color);
    this._applyThemeToBars();
    this._updatePaletteActive(color);
    this._syncSlidersToColor(color);
  },

  _syncSlidersToColor(color) {
    const [h, , l] = this._hexToHSL(color);
    const hSlider = document.getElementById('hue-slider');
    const lSlider = document.getElementById('light-slider');
    if (hSlider) hSlider.value = h;
    if (lSlider) lSlider.value = Math.min(80, Math.max(30, l));
  },

  _updatePaletteActive(color) {
    document.querySelectorAll('.palette-swatch').forEach(b =>
      b.classList.toggle('active', b.dataset.color.toLowerCase() === color.toLowerCase()));
  },

  _applyCustomThemeVars(hex) {
    const [h, s] = this._hexToHSL(hex);
    const sat = Math.min(s, 45);
    const set = (k, v) => document.documentElement.style.setProperty(k, v);
    const mode = localStorage.getItem('financeApp_customMode') || 'light';
    const isDark = mode === 'dark';
    const isBlack = mode === 'black';

    if (isDark) {
      // Dark variant
      set('--bg',            `hsl(${h},${Math.max(s,20)}%,9%)`);
      set('--surface',       `hsl(${h},${Math.max(s,18)}%,13%)`);
      set('--surface2',      `hsl(${h},${Math.max(s,20)}%,7%)`);
      set('--border',        `rgba(255,255,255,.1)`);
      set('--primary',       `hsl(${h},${Math.max(s,58)}%,58%)`);
      set('--primary-light', `hsl(${h},${Math.max(s,48)}%,72%)`);
      set('--primary-dark',  `hsl(${h},${Math.max(s,55)}%,44%)`);
      set('--text',          `hsl(${h},15%,92%)`);
      set('--text-muted',    `hsl(${h},12%,58%)`);
      set('--text-light',    `hsl(${h},10%,38%)`);
      set('--shadow',        '0 1px 4px rgba(0,0,0,.4)');
      set('--shadow-md',     '0 4px 16px rgba(0,0,0,.5)');
      set('--grad-top', `hsla(${h},${Math.max(s,55)}%,50%,.22)`);
      set('--grad-btm', `rgba(210,183,118,.30)`);
      set('--emerald',   `hsl(${h},${Math.max(s,58)}%,58%)`);
      set('--emerald-l', `hsl(${h},${Math.max(s,50)}%,72%)`);
      set('--mint',      `hsl(${h},${Math.max(s,40)}%,78%)`);
      set('--forest',      `hsl(${h},${Math.max(s,42)}%,7%)`);
      set('--forest-mid',  `hsl(${h},${Math.max(s,38)}%,12%)`);
      set('--forest-deep', `hsl(${h},${Math.max(s,38)}%,16%)`);
      set('--forest-hex',  this._hslToHex(h, Math.max(s,42), 7));
      set('--bar-bg',      `hsla(${h},${Math.max(s,42)}%,7%,.50)`);
      document.documentElement.classList.add('custom-dark');
    } else if (isBlack) {
      // Black variant — near-pure-black surfaces, full custom accent
      set('--bg',            `hsl(${h},8%,6%)`);
      set('--surface',       `hsl(${h},6%,10%)`);
      set('--surface2',      `hsl(${h},8%,4%)`);
      set('--border',        `rgba(255,255,255,.07)`);
      set('--primary',       `hsl(${h},${Math.max(s,58)}%,58%)`);
      set('--primary-light', `hsl(${h},${Math.max(s,48)}%,72%)`);
      set('--primary-dark',  `hsl(${h},${Math.max(s,55)}%,44%)`);
      set('--text',          `hsl(${h},8%,92%)`);
      set('--text-muted',    `hsl(${h},6%,55%)`);
      set('--text-light',    `hsl(${h},5%,35%)`);
      set('--shadow',        '0 1px 4px rgba(0,0,0,.6)');
      set('--shadow-md',     '0 4px 16px rgba(0,0,0,.7)');
      set('--grad-top', `hsla(${h},${Math.max(s,55)}%,50%,.18)`);
      set('--grad-btm', `rgba(210,183,118,.20)`);
      set('--emerald',   `hsl(${h},${Math.max(s,58)}%,58%)`);
      set('--emerald-l', `hsl(${h},${Math.max(s,50)}%,72%)`);
      set('--mint',      `hsl(${h},${Math.max(s,40)}%,78%)`);
      set('--forest',      `hsl(${h},${Math.max(s,42)}%,5%)`);
      set('--forest-mid',  `hsl(${h},${Math.max(s,38)}%,8%)`);
      set('--forest-deep', `hsl(${h},${Math.max(s,38)}%,12%)`);
      set('--forest-hex',  this._hslToHex(h, Math.max(s,42), 5));
      set('--bar-bg',      `rgba(10,10,10,.50)`);
      document.documentElement.classList.add('custom-dark');
    } else {
      // Light variant
      set('--bg',            `hsl(${h},${sat}%,94%)`);
      set('--surface',       `hsl(${h},${Math.max(1, Math.round(sat * 0.4))}%,99%)`);
      set('--surface2',      `hsl(${h},${Math.round(sat * 0.7)}%,91%)`);
      set('--border',        `hsl(${h},${Math.round(sat * 0.55)}%,85%)`);
      set('--primary',       `hsl(${h},${Math.max(s,58)}%,44%)`);
      set('--primary-light', `hsl(${h},${Math.max(s,48)}%,62%)`);
      set('--primary-dark',  `hsl(${h},${Math.max(s,62)}%,34%)`);
      set('--text',          `hsl(${h},15%,17%)`);
      set('--text-muted',    `hsl(${h},10%,47%)`);
      set('--text-light',    `hsl(${h},8%,67%)`);
      set('--shadow',        '0 1px 3px rgba(0,0,0,.1),0 1px 2px rgba(0,0,0,.06)');
      set('--shadow-md',     '0 4px 6px rgba(0,0,0,.07),0 2px 4px rgba(0,0,0,.06)');
      set('--grad-top', `hsla(${h},${Math.max(s,55)}%,38%,.75)`);
      set('--emerald',   `hsl(${h},${Math.max(s,55)}%,40%)`);
      set('--emerald-l', `hsl(${h},${Math.max(s,50)}%,52%)`);
      set('--mint',      `hsl(${h},${Math.max(s,38)}%,72%)`);
      set('--forest',      `hsl(${h},${Math.max(s,42)}%,10%)`);
      set('--forest-mid',  `hsl(${h},${Math.max(s,38)}%,16%)`);
      set('--forest-deep', `hsl(${h},${Math.max(s,38)}%,20%)`);
      set('--forest-hex',  this._hslToHex(h, Math.max(s,42), 10));
      document.documentElement.style.removeProperty('--bar-bg');
      document.documentElement.style.removeProperty('--grad-btm');
      document.documentElement.classList.remove('custom-dark');
    }

    // Variabile RGB per rgba() dinamici
    const eLightness = (isDark || isBlack) ? 58 : 40;
    const eHex = this._hslToHex(h, Math.max(s,55), eLightness);
    const eR = parseInt(eHex.slice(1,3),16), eG = parseInt(eHex.slice(3,5),16), eB = parseInt(eHex.slice(5,7),16);
    set('--emerald-rgb', `${eR},${eG},${eB}`);
    // Rotazione hue per SVG hardcoded (sorgente verde = ~160°)
    set('--icon-hue-rotate', `${((h - 160) % 360 + 360) % 360}deg`);
  },

  _hexToHSL(hex) {
    let r = parseInt(hex.slice(1,3),16)/255;
    let g = parseInt(hex.slice(3,5),16)/255;
    let b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  },

  _hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, '0'); };
    return `#${f(0)}${f(8)}${f(4)}`;
  },

  _resolveAutoTheme() {
    const mode = localStorage.getItem('financeApp_auto_mode') || 'system';
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    // time-based
    const from = parseInt((localStorage.getItem('financeApp_auto_from') || '20:00').split(':')[0]);
    const to   = parseInt((localStorage.getItem('financeApp_auto_to')   || '07:00').split(':')[0]);
    const h    = new Date().getHours();
    const isDark = from > to ? (h >= from || h < to) : (h >= from && h < to);
    return isDark ? 'dark' : 'light';
  },

  _initDarkMode() {
    const saved = localStorage.getItem('financeApp_theme');
    const validThemes = ['light', 'dark', 'dark-grey', 'custom', 'auto'];
    const theme = validThemes.includes(saved) ? saved : 'light';
    this._setTheme(theme, false);
  },

  _initInstallPrompt() {
    if (window.Capacitor?.isNativePlatform?.()) return;

    const banner = document.getElementById('install-banner');
    const btnOk  = document.getElementById('install-btn-ok');
    const btnX   = document.getElementById('install-btn-dismiss');
    if (!banner) return;

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });

    const isIOS     = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari  = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (installed) return;

    const iosHint    = document.getElementById('install-ios-hint');
    const manualHint = document.getElementById('install-manual-hint');

    if (isIOS) {
      // Su iOS nessun browser supporta beforeinstallprompt — solo Safari può installare
      if (btnOk) btnOk.style.display = 'none';
      if (isSafari) {
        if (iosHint) iosHint.style.display = '';
      } else {
        // Chrome/Firefox/Edge su iOS — suggerisci Safari
        if (iosHint) {
          iosHint.textContent = '';
          iosHint.innerHTML = 'Per installare su iPhone apri questa pagina in <strong>Safari</strong>, poi tocca <strong>⎙ → Aggiungi a schermata Home</strong>';
          iosHint.style.display = '';
        }
      }
    }

    setTimeout(() => { banner.style.display = ''; banner.classList.add('visible'); }, 1000);

    btnOk?.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        banner.classList.remove('visible');
      } else {
        if (manualHint) manualHint.style.display = '';
        if (btnOk) btnOk.style.display = 'none';
      }
    });
    btnX?.addEventListener('click', () => banner.classList.remove('visible'));
  },

  _initAutoTheme() {
    // Reagisce ai cambi di sistema quando il tema è auto+system
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (localStorage.getItem('financeApp_theme') === 'auto' &&
          (localStorage.getItem('financeApp_auto_mode') || 'system') === 'system') {
        document.documentElement.setAttribute('data-theme', this._resolveAutoTheme());
        this._applyThemeToBars();
        this._updateWidget();
      }
    });
    // Ricontrolla l'ora quando l'app torna in primo piano (tema time-based)
    const CapApp = window.Capacitor?.Plugins?.App;
    if (CapApp) {
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive && localStorage.getItem('financeApp_theme') === 'auto') {
          document.documentElement.setAttribute('data-theme', this._resolveAutoTheme());
          this._applyThemeToBars();
        }
      });
    }
  },

  _initSidebar() {
    const isElectron = navigator.userAgent.includes('Electron');
    const sidebar   = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const backdrop  = document.getElementById('sidebar-backdrop');

    if (isElectron) {
      if (sidebar) sidebar.style.display = 'none';
      document.body.classList.add('no-sidebar');
      return;
    }

    const sidebarBars = () => {
      const plugin = window.Capacitor?.Plugins?.ThemeBars;
      if (!plugin) return;
      const s = getComputedStyle(document.documentElement);
      const color = s.getPropertyValue('--forest-hex').trim() || '#0D2B1E';
      try { plugin.setColor({ color, lightIcons: true }); } catch {}
    };
    const collapse = () => {
      sidebar.classList.add('collapsed');
      backdrop?.classList.remove('visible');
      localStorage.setItem('financeApp_sidebar', 'collapsed');
      Utils.unlockScroll();
      this._applyThemeToBars();
    };
    this._collapseSidebar = collapse;
    const expand = () => {
      sidebar.classList.remove('collapsed');
      backdrop?.classList.add('visible');
      localStorage.setItem('financeApp_sidebar', 'expanded');
      Utils.lockScroll();
      sidebarBars();
    };

    const saved = localStorage.getItem('financeApp_sidebar');
    const isMobile = window.Capacitor?.isNativePlatform?.() || window.matchMedia('(max-width: 768px)').matches;
    if (saved === 'expanded' && !isMobile) {
      expand();
    }

    toggleBtn?.addEventListener('click', () => {
      sidebar.classList.contains('collapsed') ? expand() : collapse();
    });

    backdrop?.addEventListener('click', () => collapse());
    backdrop?.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    // Swipe per chiudere la sidebar (scorri verso sinistra)
    const SIDEBAR_W = 240;
    const THRESHOLD = 60;
    let tx0 = 0, ty0 = 0, swiping = false, dirLocked = false, scroller = null;

    // Antenato scrollabile verticalmente dentro la sidebar (null = niente da scrollare)
    const findScroller = (node) => {
      while (node && node !== sidebar) {
        if (node.scrollHeight > node.clientHeight + 1) {
          const oy = getComputedStyle(node).overflowY;
          if (oy === 'auto' || oy === 'scroll') return node;
        }
        node = node.parentElement;
      }
      return null;
    };

    sidebar.addEventListener('touchstart', (e) => {
      if (sidebar.classList.contains('collapsed')) return;
      tx0 = e.touches[0].clientX;
      ty0 = e.touches[0].clientY;
      swiping = false; dirLocked = false;
      scroller = findScroller(e.target);
    }, { passive: true });

    sidebar.addEventListener('touchmove', (e) => {
      if (sidebar.classList.contains('collapsed')) return;
      const dx = e.touches[0].clientX - tx0;
      const dy = e.touches[0].clientY - ty0;
      if (!dirLocked && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        dirLocked = true;
        swiping = Math.abs(dx) > Math.abs(dy) && dx < 0;
      }
      if (!swiping) {
        // iOS ignora overflow:hidden sul body: senza un contenitore scrollabile sotto
        // il dito, il gesto verticale trascinerebbe la pagina dietro la sidebar.
        // Se invece c'è (menu lungo), lo scroll nativo resta + overscroll-behavior:contain.
        if (!scroller) e.preventDefault();
        return;
      }
      e.preventDefault();
      const w = Math.max(0, SIDEBAR_W + dx);
      sidebar.style.transition = 'none';
      sidebar.style.width = w + 'px';
      if (backdrop) backdrop.style.opacity = String(w / SIDEBAR_W);
    }, { passive: false });

    sidebar.addEventListener('touchend', (e) => {
      if (!swiping) return;
      swiping = false; dirLocked = false;
      const dx = e.changedTouches[0].clientX - tx0;
      sidebar.style.transition = '';
      if (dx < -THRESHOLD) {
        sidebar.style.width = '';
        if (backdrop) backdrop.style.opacity = '';
        collapse();
      } else {
        sidebar.style.width = '';
        if (backdrop) backdrop.style.opacity = '';
      }
    }, { passive: true });
  },

  _bindTabNav() {
    document.querySelectorAll('.sidebar-nav-btn[data-tab], .bottom-nav-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => this._activateTab(btn.dataset.tab));
    });
  },

  _bindTabSwipe() {
    const content = document.querySelector('.tab-content');
    if (!content) return;
    const ALL = ['finanze','casa','spesa','intrattenimento','veicoli','agenda'];
    let sx = 0, sy = 0, phase = 'idle', cur = null, adj = null, dir = 0, W = 0;
    let padL = 0, padT = 0, padR = 0;

    const clearPanel = p => {
      if (!p) return;
      ['display','boxSizing','paddingTop','paddingLeft','paddingRight',
       'position','top','left','width','transform','transition'].forEach(k => p.style[k] = '');
    };

    content.addEventListener('touchstart', e => {
      if (e.touches.length !== 1 || phase !== 'idle') return;
      if (e.target.closest('.f-tab-row')) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      phase = 'init';
    }, { passive: true });

    content.addEventListener('touchmove', e => {
      if (phase === 'idle') return;
      if (e.touches.length > 1) {
        if (phase === 'drag') {
          cur.style.transition = adj.style.transition = '';
          cur.style.transform  = 'translateX(0)';
          adj.style.transform  = `translateX(${dir * W}px)`;
          clearPanel(cur); clearPanel(adj);
          content.style.height = content.style.overflow = content.style.clipPath = content.style.position = '';
        }
        phase = 'idle';
        return;
      }
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;

      if (phase === 'init') {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dy) >= Math.abs(dx)) { phase = 'idle'; return; }

        const hidden = this._getHiddenModules();
        const order  = ALL.filter(t => t === 'finanze' || !hidden.includes(t));
        const i      = order.indexOf(this.currentTab);
        dir = dx < 0 ? 1 : -1;
        if (i + dir < 0 || i + dir >= order.length) { phase = 'idle'; return; }

        cur = document.getElementById('tab-' + this.currentTab);
        adj = document.getElementById('tab-' + order[i + dir]);
        if (!cur || !adj) { phase = 'idle'; return; }

        // Capture content padding via getBoundingClientRect before any changes
        const cR = content.getBoundingClientRect();
        const pR = cur.getBoundingClientRect();
        padL = Math.round(pR.left  - cR.left);
        padT = Math.round(pR.top   - cR.top);
        padR = Math.round(cR.right - pR.right);
        W    = Math.round(cR.width); // slide distance = full content width

        this.modules[order[i + dir]]?.render();

        content.style.height   = content.offsetHeight + 'px';
        content.style.overflow = 'hidden';
        content.style.clipPath = 'inset(0)'; // clip GPU-composited layers too
        content.style.position = 'relative';
        // Panels fill the full content box (left:0, width:W) with padding
        // injected to match content padding — keeps inner layout identical
        // to normal flow and avoids GPU-compositing bypass of overflow:hidden
        [cur, adj].forEach(p => {
          p.style.boxSizing    = 'border-box';
          p.style.paddingTop   = padT + 'px';
          p.style.paddingLeft  = padL + 'px';
          p.style.paddingRight = padR + 'px';
          p.style.display      = 'block';
          p.style.position     = 'absolute';
          p.style.top          = '0';
          p.style.left         = '0';
          p.style.width        = W + 'px';
          p.style.transition   = 'none';
        });
        cur.style.transform = 'translateX(0)';
        adj.style.transform = `translateX(${dir * W}px)`;
        phase = 'drag';
      }

      if (phase === 'drag') {
        e.preventDefault();
        const d = e.touches[0].clientX - sx;
        cur.style.transform = `translateX(${d}px)`;
        adj.style.transform = `translateX(${dir * W + d}px)`;
      }
    }, { passive: false });

    const onEnd = e => {
      if (phase !== 'drag') { phase = 'idle'; return; }
      const dx   = (e.changedTouches?.[0]?.clientX ?? sx) - sx;
      const snap = Math.abs(dx) > W * 0.20;
      const T    = 220;
      const ease = `transform ${T}ms cubic-bezier(0.4,0,0.2,1)`;
      cur.style.transition = adj.style.transition = ease;

      if (snap) {
        cur.style.transform = `translateX(${-dir * W}px)`;
        adj.style.transform = 'translateX(0)';
        setTimeout(() => {
          const hidden = this._getHiddenModules();
          const order  = ALL.filter(t => t === 'finanze' || !hidden.includes(t));
          const newTab = order[order.indexOf(this.currentTab) + dir];
          cur.classList.remove('active');
          adj.classList.add('active');
          clearPanel(cur); clearPanel(adj);
          content.style.height = content.style.overflow = content.style.clipPath = content.style.position = '';
          this.currentTab = newTab;
          document.querySelectorAll('.sidebar-nav-btn,.bottom-nav-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.tab === newTab));
          phase = 'idle';
        }, T);
      } else {
        cur.style.transform = 'translateX(0)';
        adj.style.transform = `translateX(${dir * W}px)`;
        setTimeout(() => {
          clearPanel(cur); clearPanel(adj);
          content.style.height = content.style.overflow = content.style.clipPath = content.style.position = '';
          phase = 'idle';
        }, T);
      }
    };

    content.addEventListener('touchend',    onEnd, { passive: true });
    content.addEventListener('touchcancel', onEnd, { passive: true });
  },

  _activateTab(tabName) {
    const TAB_ORDER = ['finanze','casa','spesa','intrattenimento','veicoli','agenda'];
    if (tabName !== 'finanze' && this._getHiddenModules().includes(tabName)) tabName = 'finanze';
    const prevName = this.currentTab;
    const animate  = prevName !== tabName;
    this.currentTab = tabName;
    document.querySelectorAll('.sidebar-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    if (animate) {
      const goFwd   = TAB_ORDER.indexOf(tabName) > TAB_ORDER.indexOf(prevName);
      const cls     = goFwd ? 'tab-fwd' : 'tab-bwd';
      const prev    = document.getElementById(`tab-${prevName}`);
      const next    = document.getElementById(`tab-${tabName}`);
      const content = document.querySelector('.tab-content');
      if (prev) prev.classList.remove('active');
      if (next) {
        if (content) content.style.overflow = 'hidden';
        next.classList.add('active', cls);
        next.addEventListener('animationend', () => {
          next.classList.remove(cls);
          if (content) content.style.overflow = '';
        }, { once: true });
      }
    } else {
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tabName}`));
    }
    this.modules[tabName]?.render();
  },

  _bindPeriodSelectors() {
    document.getElementById('globalMonth').addEventListener('change', () => this.modules[this.currentTab]?.render());
    document.getElementById('globalYear').addEventListener('change', () => this.modules[this.currentTab]?.render());
  },

  _bindImportInput() {
    document.getElementById('import-file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await DB.importJSON(file);
        this.refreshPeriodSelectors();
        for (const mod of Object.values(this.modules)) mod.init();
        this._activateTab(this.currentTab);
        alert('✅ ' + Lang.t('import.success'));
      } catch (err) {
        alert('❌ ' + Lang.t('import.error') + ' ' + err.message);
      }
      e.target.value = '';
    });
  },

  _bindSidebarSettings() {
    document.querySelectorAll('.theme-opt').forEach(btn => {
      btn.addEventListener('click', () => this._setTheme(btn.dataset.theme));
    });

    // Auto tema: modalità sistema/orario
    document.querySelectorAll('.auto-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        localStorage.setItem('financeApp_auto_mode', btn.dataset.mode);
        document.querySelectorAll('.auto-mode-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.mode === btn.dataset.mode));
        const timeRow = document.getElementById('auto-time-row');
        if (timeRow) timeRow.style.display = btn.dataset.mode === 'time' ? '' : 'none';
        if (localStorage.getItem('financeApp_theme') === 'auto') {
          document.documentElement.setAttribute('data-theme', this._resolveAutoTheme());
          this._applyThemeToBars();
        }
      });
    });
    const saveAutoTime = () => {
      const f = document.getElementById('auto-dark-from')?.value;
      const t = document.getElementById('auto-dark-to')?.value;
      if (f) localStorage.setItem('financeApp_auto_from', f);
      if (t) localStorage.setItem('financeApp_auto_to', t);
      if (localStorage.getItem('financeApp_theme') === 'auto') {
        document.documentElement.setAttribute('data-theme', this._resolveAutoTheme());
        this._applyThemeToBars();
      }
    };
    document.getElementById('auto-dark-from')?.addEventListener('change', saveAutoTime);
    document.getElementById('auto-dark-to')?.addEventListener('change', saveAutoTime);

    document.querySelectorAll('.custom-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        localStorage.setItem('financeApp_customMode', btn.dataset.mode);
        document.querySelectorAll('.custom-mode-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.mode === btn.dataset.mode));
        const color = localStorage.getItem('financeApp_customColor') || '#c7b8ea';
        this._applyCustomThemeVars(color);
        this._applyThemeToBars();
      });
    });

    document.getElementById('palette-grid')?.addEventListener('click', e => {
      const btn = e.target.closest('.palette-swatch');
      if (!btn) return;
      this._applyPaletteColor(btn.dataset.color);
    });

    document.getElementById('custom-color-input')?.addEventListener('input', e => {
      const v = e.target.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        this._applyPaletteColor(v);
        this._syncSlidersToColor(v);
      }
    });
    document.getElementById('custom-color-input')?.addEventListener('blur', e => {
      const v = e.target.value.trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
        const fallback = localStorage.getItem('financeApp_customColor') || '#c7b8ea';
        e.target.value = fallback;
      }
    });

    const _onSlider = () => {
      const h = parseInt(document.getElementById('hue-slider')?.value || 250);
      const l = parseInt(document.getElementById('light-slider')?.value || 55);
      const color = this._hslToHex(h, 65, l);
      this._applyPaletteColor(color);
    };
    const _attachSliderTouch = (el) => {
      const updateFromTouch = (touch) => {
        const rect = el.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
        el.value = Math.round(parseInt(el.min) + ratio * (parseInt(el.max) - parseInt(el.min)));
        _onSlider();
      };
      el.addEventListener('input', _onSlider);
      el.addEventListener('touchstart', e => { e.stopPropagation(); updateFromTouch(e.touches[0]); }, { passive: true });
      el.addEventListener('touchmove', e => { e.stopPropagation(); e.preventDefault(); updateFromTouch(e.touches[0]); }, { passive: false });
    };
    [document.getElementById('hue-slider'), document.getElementById('light-slider')]
      .filter(Boolean).forEach(_attachSliderTouch);

    document.getElementById('stg-export-btn')?.addEventListener('click', () => {
      this._collapseSidebar?.();
      DB.exportJSON();
    });
    document.getElementById('stg-import-btn')?.addEventListener('click', () => {
      this._collapseSidebar?.();
      document.getElementById('import-file-input').click();
    });
    document.getElementById('stg-backups-btn')?.addEventListener('click', () => {
      this._collapseSidebar?.();
      this._showBackups();
    });

    document.querySelectorAll('.lang-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === Lang.current);
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lang-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Lang.set(btn.dataset.lang);
        this.refreshPeriodSelectors();
      });
    });

    document.querySelectorAll('.mod-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const hidden = this._getHiddenModules();
        const tab = cb.dataset.tab;
        if (cb.checked) {
          const idx = hidden.indexOf(tab);
          if (idx > -1) hidden.splice(idx, 1);
        } else {
          if (!hidden.includes(tab)) hidden.push(tab);
        }
        localStorage.setItem('financeApp_hiddenModules', JSON.stringify(hidden));
        this._applyModuleVisibility(hidden);
      });
    });

    if (window.Capacitor?.isNativePlatform?.()) {
      const permsBtn = document.getElementById('stg-perms-btn');
      if (permsBtn) {
        permsBtn.style.display = '';
        permsBtn.addEventListener('click', () => {
          this._collapseSidebar?.();
          this._showPermissionsModal(null);
        });
      }
      const bioCB = document.getElementById('biometric-cb');
      if (bioCB) {
        bioCB.checked = BiometricAuth.isEnabled();
        bioCB.addEventListener('change', () => BiometricAuth.setEnabled(bioCB.checked));
      }
    }
  },


  async _showBackups() {
    if (window.Capacitor?.isNativePlatform?.()) {
      Utils.showModal(Lang.t('backup.title'), `
        <p style="margin-bottom:12px">${Lang.t('backup.android_msg')}</p>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">${Lang.t('backup.android_hint')}</p>
        <div class="form-actions">
          <button class="btn btn-primary" style="width:100%" onclick="Utils.closeModal()">${Lang.t('common.ok')}</button>
        </div>
      `);
      return;
    }

    let html = '<div style="font-size:13px">';
    try {
      const res = await fetch('/api/backups');
      const list = await res.json();
      if (list.length === 0) {
        html += `<div class="empty-state">${Lang.t('backup.none')}</div>`;
      } else {
        html += `<p style="color:var(--text-muted);margin-bottom:12px">${Lang.t('backup.list_header', {n: list.length})}</p>`;
        html += list.map(b => `
          <div class="entry-row">
            <span class="entry-desc">${b.name.replace('backup-','').replace('.json','').replace(/T/,' ').replace(/-/g,b.name.indexOf('T') > -1 ? ':' : '-')}</span>
            <span class="entry-badge">${(b.size/1024).toFixed(1)} KB</span>
            <a href="/api/backups/${encodeURIComponent(b.name)}" download class="btn btn-secondary btn-sm">⬇️ ${Lang.t('backup.download')}</a>
          </div>`).join('');
      }
    } catch {
      html += `<div class="empty-state">${Lang.t('backup.unavailable')}</div>`;
    }
    html += '</div>';
    Utils.showModal(Lang.t('backup.title'), html);
  },

  async _requestAndroidPermissions() {
    if (!window.Capacitor?.isNativePlatform?.()) return;

    const LN = window.Capacitor?.Plugins?.LocalNotifications;
    if (LN) { try { await LN.requestPermissions(); } catch {} }

    const TB = window.Capacitor?.Plugins?.ThemeBars;
    if (!TB) return;

    let perms;
    try { perms = await TB.checkAndroidPermissions(); } catch { return; }

    const needsBattery = !perms.batteryOptimizationExcluded;
    const needsAlarm   = !perms.canScheduleExactAlarms;
    if (!needsBattery && !needsAlarm) return;

    // Throttle automatico: al massimo ogni 3 giorni
    const lastAsked = parseInt(localStorage.getItem('financeApp_permsAsked') || '0');
    if (Date.now() - lastAsked < 3 * 24 * 3600 * 1000) return;
    localStorage.setItem('financeApp_permsAsked', String(Date.now()));

    this._showPermissionsModal(perms);
  },

  async _showPermissionsModal(perms) {
    if (!window.Capacitor?.isNativePlatform?.()) return;

    const TB = window.Capacitor?.Plugins?.ThemeBars;
    if (!TB) return;

    // Se non ci sono dati di stato passati, li recupera ora
    if (!perms) {
      try { perms = await TB.checkAndroidPermissions(); } catch { return; }
    }

    const needsBattery = !perms.batteryOptimizationExcluded;
    const needsAlarm   = !perms.canScheduleExactAlarms;

    const row = (icon, title, desc, btnId, ok) => `
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:14px">
        <span style="font-size:22px">${icon}</span>
        <div style="flex:1">
          <div style="font-weight:600;margin-bottom:2px">${title}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">${desc}</div>
          ${ok
            ? `<span style="font-size:12px;color:var(--success);font-weight:600">${Lang.t('perms.configured')}</span>`
            : `<button class="btn btn-primary btn-sm" id="${btnId}">${Lang.t('perms.configure')}</button>`
          }
        </div>
      </div>`;

    Utils.showModal(Lang.t('perms.title'), `
      <p style="margin-bottom:16px;color:var(--text-muted);font-size:13px">${Lang.t('perms.intro')}</p>
      ${row('🔋', Lang.t('perms.battery'), Lang.t('perms.battery_desc'), 'perm-battery-btn', !needsBattery)}
      ${row('⏰', Lang.t('perms.alarm'), Lang.t('perms.alarm_desc'), 'perm-alarm-btn', !needsAlarm)}
      <button class="btn btn-secondary" style="width:100%;margin-top:4px" onclick="Utils.closeModal()">${Lang.t('perms.close')}</button>
    `);

    const CapApp = window.Capacitor?.Plugins?.App;

    const registerResumeRefresh = async () => {
      if (!CapApp) return;
      let handle;
      try {
        handle = await CapApp.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive) return;
          try { await handle?.remove(); } catch {}
          await new Promise(r => setTimeout(r, 500));
          const fresh = await TB.checkAndroidPermissions().catch(() => null);
          if (!fresh) return;
          if (fresh.batteryOptimizationExcluded && fresh.canScheduleExactAlarms) {
            Utils.closeModal();
          } else {
            this._showPermissionsModal(fresh);
          }
        });
      } catch {}
    };

    document.getElementById('perm-battery-btn')?.addEventListener('click', async () => {
      await registerResumeRefresh();
      await TB.requestBatteryOptimization().catch(() => {});
    });
    document.getElementById('perm-alarm-btn')?.addEventListener('click', async () => {
      await registerResumeRefresh();
      await TB.openAlarmSettings().catch(() => {});
    });
  },

  _getHiddenModules() {
    try { return JSON.parse(localStorage.getItem('financeApp_hiddenModules') || '[]'); }
    catch { return []; }
  },

  _initModuleVisibility() {
    const hidden = this._getHiddenModules();
    document.querySelectorAll('.mod-cb').forEach(cb => {
      cb.checked = !hidden.includes(cb.dataset.tab);
    });
    this._applyModuleVisibility(hidden);
  },

  _applyModuleVisibility(hidden) {
    ['casa','spesa','intrattenimento','veicoli','agenda'].forEach(tab => {
      const isHidden = hidden.includes(tab);
      document.querySelectorAll(`.bottom-nav-btn[data-tab="${tab}"]`).forEach(btn => {
        btn.style.display = isHidden ? 'none' : '';
      });
      if (isHidden && this.currentTab === tab) this._activateTab('finanze');
    });
  },

  refreshPeriodSelectors() {
    const data = DB.getAll();
    const allEntries = [];
    const collect = (obj) => {
      if (Array.isArray(obj)) { allEntries.push(...obj); return; }
      if (obj && typeof obj === 'object') Object.values(obj).forEach(collect);
    };
    collect(data);

    const years = Utils.yearsFromEntries(allEntries);
    const thisYear = String(new Date().getFullYear());
    if (!years.includes(thisYear)) years.unshift(thisYear);
    const yearSel = document.getElementById('globalYear');
    const curYear = yearSel.value !== 'all' ? yearSel.value : thisYear;
    yearSel.innerHTML = `<option value="all">${Lang.t('period.all_years')}</option>` +
      years.map(y => `<option value="${y}" ${y === curYear ? 'selected' : ''}>${y}</option>`).join('');

    const monthSel = document.getElementById('globalMonth');
    const curMonth = monthSel.value;
    monthSel.innerHTML = `<option value="all">${Lang.t('period.all_months')}</option>` +
      Array.from({length: 12}, (_, i) => {
        const val = String(i + 1).padStart(2, '0');
        return `<option value="${val}" ${val === curMonth ? 'selected' : ''}>${Lang.t('month.' + i)}</option>`;
      }).join('');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
