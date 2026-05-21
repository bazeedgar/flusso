// ===== LOCAL OCR (Tesseract.js - gratis, locale, nessuna API) =====
const OcrProcessor = {
  _worker: null,
  _initPromise: null,

  async _loadTesseract() {
    if (window.Tesseract) return;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/tesseract.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  },

  async _ensureWorker(onStatus) {
    if (this._worker) return this._worker;
    if (this._initPromise) return this._initPromise;
    this._initPromise = (async () => {
      onStatus?.('Avvio motore OCR…');
      await this._loadTesseract();
      const worker = await Tesseract.createWorker(['ita', 'eng'], 1, {
        logger: m => {
          if (m.status === 'loading tesseract core')            onStatus?.('Caricamento OCR…');
          else if (m.status === 'loading language traineddata') onStatus?.('Download dati lingua…\n(~10MB, solo la prima volta)');
          else if (m.status === 'initializing api')             onStatus?.('Inizializzazione…');
        }
      });
      this._worker = worker;
      return worker;
    })();
    return this._initPromise;
  },

  // ── Preprocessing: grayscale + contrasto + resize per migliorare OCR ──────
  async _preprocess(dataUrl) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const id = ctx.getImageData(0, 0, w, h);
        const d  = id.data;

        // Calcola luminosità media per scegliere strategia
        let sumG = 0;
        for (let i = 0; i < d.length; i += 4)
          sumG += 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        const avgG = sumG / (d.length / 4);

        for (let i = 0; i < d.length; i += 4) {
          const g = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
          // Soglia adattiva: se immagine scura (display digitale) usa binarizzazione forte,
          // se chiara (scontrino cartaceo) usa contrasto moderato
          let val;
          if (avgG < 100) {
            // Display digitale / sfondo scuro → binarizza
            val = g > 80 ? 255 : 0;
          } else {
            // Scontrino / documento cartaceo → contrasto aumentato
            val = Math.max(0, Math.min(255, (g - 128) * 1.8 + 128));
          }
          d[i] = d[i+1] = d[i+2] = val;
        }
        ctx.putImageData(id, 0, 0);
        resolve(canvas.toDataURL('image/png')); // PNG senza compressione per OCR migliore
      };
      img.onerror = () => resolve(dataUrl); // fallback immagine originale
      img.src = dataUrl;
    });
  },

  async recognize(imageDataUrl, onStatus) {
    onStatus?.('Elaborazione immagine…');
    const processed = await this._preprocess(imageDataUrl);
    const worker = await this._ensureWorker(onStatus);
    onStatus?.('Analisi testo…');
    const result = await worker.recognize(processed);
    return result.data.text;
  },

  parse(rawText, context) {
    // Pulizia base
    const lines = rawText.split('\n')
      .map(l => l.trim())
      .filter(l => l.replace(/\W/g, '').length > 1);
    const text  = lines.join('\n');
    const lower = text.toLowerCase();

    // ── Tipo documento ───────────────────────────────────────────────────────
    const isFuel = /\b(benz|diesel|gasolio|carburant|litri|€\/l|eur\/l|self\s*serv|distributore|rifornimento)\b|\d+[,\.]\d{3}\s*(l|lt|ltr)\b/i.test(text);
    const isUtility = /\b(kwh|energia\s+elett|enel|a2a|engie|eni\s+gas|snam|italgas|acqua\s+potab|acquedotto|bolletta|utenza|hera|iren|acea|estra|2i\s*rete)\b/i.test(text);
    const isPharmacy = /\b(farmaci[ae]|parafarmaci[ae]|lloyds\s*pharma|farmacia\s+comunale|croce\s+verde)\b/i.test(text);
    const isSupermarket = /\b(supermercato|ipermercato|esselunga|lidl|conad|coop|carrefour|eurospin|penny|aldi|despar|sisa|sigma|pam\b|in\s*s\b|bennet|panorama|tosano|gs\s+supermercati|simply|naturasi|dok|md\s+discount|tigros|iper\b|famila|spar\b|interspar|ok\s*mercato)\b/i.test(lower);
    const isClothing = /\b(zara|h&m|h\s*&\s*m|primark|pull\s*&\s*bear|bershka|stradivarius|uniqlo|mango|ovs|calliope|piazza\s*italia|coin|rinascente|foot\s*locker|nike\s*store|adidas\s*store|abbigliamento|vestiario|scarpe|sneaker)\b/i.test(lower);
    const isElectronics = /\b(mediaworld|unieuro|euronics|trony|expert\b|apple\s*store|samsung\s*store|fnac|ibox|smartphone|tablet\s+[a-z]|notebook|laptop|monitor|cuffi[ae]|auricolari|elettronic[ao])\b/i.test(lower);
    const isBar = /\b(bar\b|caffè|caffe\b|cornetto|cappuccino|espresso|brioche|aperitivo|colazione\s+bar|gelateria|pasticceria|cremeria)\b/i.test(lower);
    const isFastFood = /\b(mc\s*donald|burger\s*king|kfc\b|subway\b|dominos|pizza\s*hut|old\s*wild\s*west|spizzico|autogrill)\b/i.test(lower);
    const isGym = /\b(palestra|fitness|gym\b|wellness|piscina\s+|nuoto|mcfit|virgin\s*active|bodytime|world\s*gym|anytime\s*fitness)\b/i.test(lower);
    const isSalon = /\b(parrucchier[ae]|salone\s|barbier[ae]|salon\b|oreal|hair\b|nails|unghie|estetist[ae]|centro\s*estetico|beauty)\b/i.test(lower);
    const isRestaurant = /\b(ristoran|pizzer|trattor|osteria|tavola\s*calda|bar\s*ristorante|coperto|tavolo\s*n|comanda|pasti|portate|sushi|hamburgeria|braceria)\b/i.test(lower);

    // ── Importo ──────────────────────────────────────────────────────────────
    let importo = null;
    const rev = [...lines].reverse();

    // Helper: estrae il primo numero (con o senza decimali) da una riga
    const extractAmt = line => {
      let m = line.match(/(\d{1,6})[,\.](\d{2})\b/);
      if (m) return parseFloat(m[1] + '.' + m[2]);
      m = line.match(/(\d{1,6})[,\.](\d{1})\b/);
      if (m) return parseFloat(m[1] + '.' + m[2] + '0');
      m = line.match(/\b(\d{1,6})\b/);
      if (m && parseInt(m[1]) >= 1) return parseInt(m[1]);
      return null;
    };

    // 1. Riga con keyword totale (dalla fine — il totale è sempre in fondo)
    const totalRe = /\b(totale?|tot\.?|da\s*pagar[ei]|importo|netto|subtotale?|pagat[oi]|versato|complessivo|riepilogo|amount|total)\b/i;
    for (const line of rev) {
      if (totalRe.test(line)) {
        const a = extractAmt(line);
        if (a && a >= 0.5) { importo = a; break; }
      }
    }

    // 2. Riga con € o £ vicino a un numero (ultime 12 righe)
    if (!importo) {
      for (const line of rev.slice(0, 12)) {
        if (/[€£]/.test(line)) {
          const a = extractAmt(line);
          if (a && a >= 0.5) { importo = a; break; }
        }
      }
    }

    // 3. Numero più grande con 2 decimali nel documento
    if (!importo) {
      const amounts = [...text.matchAll(/(\d{1,5})[,\.](\d{2})\b/g)]
        .map(m => parseFloat(m[1] + '.' + m[2]))
        .filter(n => n >= 0.5 && n <= 9999);
      if (amounts.length) importo = Math.max(...amounts);
    }

    // 4. Fallback ultime 10 righe: numero più grande qualsiasi
    if (!importo) {
      const lastNums = rev.slice(0, 10).flatMap(l =>
        [...l.matchAll(/\b(\d{1,5})[,\.]?(\d{0,2})\b/g)]
          .map(m => parseFloat(m[1] + (m[2] ? '.' + m[2] : '')))
          .filter(n => n >= 1 && n <= 9999)
      );
      if (lastNums.length) importo = Math.max(...lastNums);
    }

    // ── Data ─────────────────────────────────────────────────────────────────
    let data = null;
    // Prova DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    const dateRe = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g;
    for (const dm of text.matchAll(dateRe)) {
      const d = dm[1].padStart(2, '0'), mo = dm[2].padStart(2, '0');
      const y = dm[3].length === 2 ? '20' + dm[3] : dm[3];
      if (+mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31 && +y >= 2000 && +y <= 2099) {
        data = `${y}-${mo}-${d}`;
        break;
      }
    }

    // ── Merchant (nome attività) ──────────────────────────────────────────────
    const isJunk = l =>
      l.replace(/\W/g, '').length < 3 ||
      /^[\d\s\W]+$/.test(l) ||
      /^[*\-=_#]+$/.test(l) ||
      /p\.?\s*iva|c\.?\s*f\.|cod\s*fis|www\.|http|tel\.|fax/i.test(l);
    const rawMerchant = lines.slice(0, 8).find(l => !isJunk(l) && /[a-zA-ZàèéìòùÀÈÉÌÒÙ]{3}/.test(l)) || '';
    // Rimuovi suffissi societari e caratteri OCR-rumore finali
    const merchant = rawMerchant
      .replace(/\s+[s$][,.]?[r$][,.]?[l$]\.?\s*$/i, '')
      .replace(/\s+[s$][,.]?[p$][,.]?[a$]\.?\s*$/i, '')
      .replace(/\s+snc\.?\s*$/i, '')
      .replace(/[€$#@|\\]+/g, '')
      .trim();

    const entry = {
      data:    data    || undefined,
      importo: importo || undefined,
    };

    // ── Routing ──────────────────────────────────────────────────────────────
    if (isFuel) {
      const litersM  = text.match(/(\d{1,3}[,\.]\d{3})\s*(l|lt|ltr|litri)\b/i);
      const pplM     = text.match(/(\d)[,\.](\d{3})\s*(€\/l|eur\/l)/i);
      const fuelType = /diesel|gasolio/i.test(text) ? 'Diesel' : /gpl/i.test(text) ? 'GPL' : 'Benzina';
      const vehicle  = context.vehicles?.[0];
      return {
        section: 'veicoli',
        category: { vehicleId: vehicle?.id, subCategory: 'rifornimenti' },
        entry: {
          ...entry,
          tipo:         fuelType,
          litri:        litersM ? parseFloat(litersM[1].replace(',', '.')) : undefined,
          prezzo_litro: pplM    ? parseFloat(pplM[1] + '.' + pplM[2])     : undefined,
          note:         merchant || undefined,
        },
        summary: `⛽ ${importo ? importo.toFixed(2) + '€' : 'carburante'}`,
      };
    }

    if (isUtility) {
      let subCategory = 'altro_casa';
      if (/\b(kwh|energia|enel|a2a|engie)\b/i.test(text))             subCategory = 'elettricita';
      else if (/\b(gas|metano|snam|italgas)\b/i.test(text))            subCategory = 'gas';
      else if (/\b(acqua|idrica|acquedotto)\b/i.test(text))            subCategory = 'acqua';
      else if (/\b(internet|fibra|adsl|tim|vodafone|wind|fastweb)\b/i.test(lower)) subCategory = 'internet_telefono';
      const immobile = context.immobili?.[0];
      return {
        section: 'casa',
        category: { immobileId: immobile?.id, subCategory },
        entry: { ...entry, fornitore: merchant || undefined },
        summary: `🏠 ${importo ? importo.toFixed(2) + '€' : 'bolletta'}`,
      };
    }

    if (isRestaurant) {
      return {
        section: 'intrattenimento',
        category: 'ristoranti',
        entry: { ...entry, locale: merchant || undefined },
        summary: `🍽️ ${importo ? importo.toFixed(2) + '€' : 'ristorante'}`,
      };
    }

    if (isPharmacy) {
      return {
        section: 'spesa',
        category: 'farmacia',
        entry: { ...entry, descrizione: merchant || undefined },
        summary: `💊 ${importo ? importo.toFixed(2) + '€' : 'farmacia'}`,
      };
    }

    if (isSupermarket) {
      return {
        section: 'spesa',
        category: 'supermercato',
        entry: { ...entry, negozio: merchant || undefined },
        summary: `🛒 ${importo ? importo.toFixed(2) + '€' : 'supermercato'}`,
      };
    }

    if (isFastFood) {
      const brand = text.match(/\b(McDonald|Burger\s*King|KFC|Subway|Dominos|Old\s*Wild\s*West|Spizzico|Autogrill)\b/i);
      return {
        section: 'intrattenimento',
        category: 'ristoranti',
        entry: { ...entry, tipo: 'Fast food', locale: (brand ? brand[0] : merchant) || undefined },
        summary: `🍔 ${importo ? importo.toFixed(2) + '€' : 'fast food'}`,
      };
    }

    if (isBar) {
      return {
        section: 'intrattenimento',
        category: 'bar_caffe',
        entry: { ...entry, locale: merchant || undefined },
        summary: `☕ ${importo ? importo.toFixed(2) + '€' : 'bar/caffè'}`,
      };
    }

    if (isGym) {
      return {
        section: 'intrattenimento',
        category: 'sport_palestra',
        entry: { ...entry, tipo: 'Abbonamento palestra', struttura: merchant || undefined },
        summary: `🏋️ ${importo ? importo.toFixed(2) + '€' : 'palestra'}`,
      };
    }

    if (isClothing) {
      const brand = text.match(/\b(Zara|H&M|Primark|Pull\s*&\s*Bear|Bershka|Stradivarius|Uniqlo|Mango|OVS|Foot\s*Locker|Nike|Adidas)\b/i);
      return {
        section: 'spesa',
        category: 'abbigliamento',
        entry: { ...entry, negozio: (brand ? brand[0] : merchant) || undefined },
        summary: `👗 ${importo ? importo.toFixed(2) + '€' : 'abbigliamento'}`,
      };
    }

    if (isElectronics) {
      const brand = text.match(/\b(MediaWorld|Unieuro|Euronics|Trony|Expert|Apple\s*Store|Fnac)\b/i);
      return {
        section: 'spesa',
        category: 'elettronica',
        entry: { ...entry, negozio: (brand ? brand[0] : merchant) || undefined },
        summary: `💻 ${importo ? importo.toFixed(2) + '€' : 'elettronica'}`,
      };
    }

    if (isSalon) {
      return {
        section: 'spesa',
        category: 'cura_persona',
        entry: { ...entry, descrizione: merchant || undefined },
        summary: `💇 ${importo ? importo.toFixed(2) + '€' : 'cura persona'}`,
      };
    }

    // Generico
    return {
      section: 'spesa',
      category: 'altro_spesa',
      entry: { ...entry, descrizione: merchant || undefined },
      summary: `🛍️ ${importo ? importo.toFixed(2) + '€' : 'spesa'}`,
    };
  },
};
