# Flusso — Istruzioni redesign per Claude Code

## Stato attuale
I file CSS del nuovo design system sono GIA' presenti in `css/`.
Il file `css/fixes.css` è già linkato come ultimo CSS in `index.html`.
**Non modificare** `index.html`, `css/style.css` o i file JS.

## File CSS presenti
```
css/tokens.css      → variabili --f-* (colori, raggi, durate)
css/base.css        → reset, font, animazioni
css/components.css  → f-hero-card, f-module-header, f-entry-row, f-btn-*, f-pill, ecc.
css/toggle.css      → toggle neumorfic f-switch
css/speeddial.css   → f-topbar, f-bottom-nav, f-speeddial (non usato direttamente)
css/bottomnav.css   → alias vuoto
css/topbar.css      → alias vuoto
css/themes.css      → override per custom/dark/dark-grey
css/style.css       → CSS LEGACY dell'app — NON TOCCARE
css/fixes.css       → override chirurgici: risolve tutti i conflitti
```

## Classi HTML già in uso (generate dai JS)

### Struttura principale
- `f-app-root` → div#app
- `f-topbar` + `app-header` → header dell'app
- `f-topbar-inner` + `header-inner` → riga logo/azioni
- `f-logo` + `app-title` → titolo Flusso
- `f-menu-btn` + `sidebar-toggle-inner` → hamburger
- `f-topbar-actions` + `header-right` → lato destro header
- `f-period-row` → riga selettori mese/anno
- `f-period-pill` → singolo selettore (contiene <select>)
- `f-bottom-nav` + `bottom-nav` → nav bar in basso
- `f-nav-item` + `bottom-nav-btn` → singolo tab

### Moduli (Casa, Veicoli, Spesa, Svago)
- `f-module-wrapper` → wrapper per ogni modulo (veicoli, casa)
- `f-module-header` → header scuro gradiente
- `f-module-header-top` → riga titolo + azioni
- `f-module-title` → nome immobile/veicolo
- `f-module-subtitle` → dettagli (targa, indirizzo)
- `f-module-header-actions` → bottoni edit/delete header
- `f-header-btn edit` → bottone modifica (emoji ✏️)
- `f-header-btn delete` → bottone elimina (emoji 🗑️)
- `f-module-total` → importo totale
- `f-module-total-label` → etichetta "spese totali"
- `f-module-stats cols-2/cols-3/cols-4` → grid stat chip
- `f-stat-chip` → singolo chip stat
- `f-stat-label` → etichetta stat
- `f-stat-value` → valore stat
- `f-tab-row` → riga tab (Rifornimenti, Assicurazione, ecc.)
- `f-tab-btn` + opz. `active` → singolo tab
- `f-tab-panel` + opz. `active` → pannello tab

### Entry rows (lista voci)
```html
<div class="f-entry-row">
  <div class="f-entry-top">
    <span class="f-entry-date">17/05/26</span>
    <span class="f-entry-desc f-trunc">Descrizione</span>
  </div>
  <div class="f-entry-bottom">
    <span class="f-pill f-pill-green">Tag</span>
    <span class="f-pill f-pill-amber">Info</span>
    <span class="f-spacer"></span>
    <span class="f-entry-amount">75,00 €</span>
    <div class="f-entry-actions">
      <button class="f-btn-edit" ...>✏️</button>
      <button class="f-btn-delete" ...>🗑️</button>
    </div>
  </div>
</div>
```

### Finanze
- `f-hero-card` → card saldo principale
- `f-hero-label` → etichetta "Saldo attivo"
- `f-hero-amount` → importo grande
- `f-hero-currency` → simbolo €
- `f-hero-chips` → grid entrate/uscite
- `f-hero-chip` → singolo chip
- `f-hero-chip-label` → etichetta chip
- `f-hero-chip-value income/expense` → valore colorato

### Speed dial (generato da voice.js)
Classi esistenti usate: `speed-dial`, `speed-dial-main`, `speed-dial-items`,
`speed-dial-item`, `speed-dial-label`, `speed-dial-action-btn`, `speed-dial-backdrop`

### Toggle (impostazioni)
```html
<label class="f-switch">
  <input type="checkbox" checked>
  <div class="f-switch-track"></div>
  <div class="f-switch-border"></div>
  <div class="f-switch-thumb"></div>
</label>
```

### Sidebar
Usa le classi esistenti: `sidebar`, `sidebar-header`, `sidebar-title`, `sidebar-nav`,
`sidebar-nav-btn`, `sidebar-divider`, `theme-opt`, `theme-swatch`, `palette-swatch`,
`lang-opt`, `mod-toggle-row`, `mod-label`.
Tutti stilizzati tramite `fixes.css` con selettori `#sidebar .classname`.

## Cosa NON fare
- Non modificare `index.html` (l'ordine dei CSS è già corretto)
- Non modificare `css/style.css` (CSS legacy intoccabile)
- Non modificare i file JS
- Non aggiungere classi HTML ai template JS (già usano le classi f-*)
- Non creare nuovi file CSS

## Cosa fare se qualcosa non funziona
Aggiungere/correggere regole solo in `css/fixes.css`, sempre con `!important`
per sovrascrivere style.css. Identificare prima la classe esatta con DevTools.

## Tema
L'app usa `localStorage.getItem('financeApp_theme')` con valori:
`light` | `dark` | `dark-grey` | `custom` | `auto`
Il `data-theme` viene settato su `<html>` all'avvio dal codice inline in index.html.
