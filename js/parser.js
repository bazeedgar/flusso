// ===== LOCAL AI PARSER (fallback senza server, funziona offline) =====
const LocalParser = {

  // ── Date helpers (UTC puro per evitare bug timezone UTC+1/+2) ────────────
  _addDays(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  },

  _addMonths(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10);
  },

  _nextWeekday(today, targetDow) {
    const [y, m, d] = today.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const cur = date.getUTCDay();
    let diff = targetDow - cur;
    if (diff <= 0) diff += 7;
    date.setUTCDate(date.getUTCDate() + diff);
    return date.toISOString().slice(0, 10);
  },

  // Parses Italian time expressions from normalized lowercase text.
  // Returns HH:MM (24h) or null.
  _parseTime(t) {
    // Digital: "alle 14:30" / "alle 14.30" / "alle 14,30"
    const digitalM = t.match(/\balle?\s+(\d{1,2})[:.,](\d{2})\b/);
    if (digitalM) {
      const h = parseInt(digitalM[1]), m = parseInt(digitalM[2]);
      if (h < 24 && m < 60) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }

    // Fixed references
    if (/\bmezzogiorno\b/.test(t)) return '12:00';
    if (/\bmezzanotte\b/.test(t)) return '00:00';
    if (/\bora\s+(?:di\s+)?pranzo\b/.test(t)) return '13:00';

    const numWords = {
      uno:1, una:1, due:2, tre:3, quattro:4, cinque:5, sei:6, sette:7, otto:8, nove:9,
      dieci:10, undici:11, dodici:12, tredici:13, quattordici:14, quindici:15,
      sedici:16, diciassette:17, diciotto:18, diciannove:19, venti:20,
      ventuno:21, ventidue:22, ventitre:23, ventitré:23
    };

    const isPM = /\b(?:del\s+)?pomeriggio\b|\bdi\s+sera\b|\bstasera\b|\bsera\b/.test(t);
    const isAM = /\b(?:di\s+)?(?:mattina|mattino)\b|\bstamattina\b/.test(t);
    const min0 = /\be\s+mezz/.test(t) ? 30 : /\be\s+(?:un\s+)?quarto\b/.test(t) ? 15 : /\be\s+tre\s+quarti\b/.test(t) ? 45 : 0;

    // "alle N" — digit or written number
    const alleMatcher = t.match(/\balle?\s+(\d{1,2}|[a-z]+)\b/);
    if (alleMatcher) {
      let h = parseInt(alleMatcher[1]);
      if (isNaN(h)) h = numWords[alleMatcher[1]];
      if (h !== undefined && h < 24) {
        if (h < 13 && isPM) h += 12;
        else if (h >= 1 && h <= 6 && !isAM) h += 12; // ore ambigue 1-6 → pomeriggio per default
        if (h === 24) h = 0;
        return `${String(h).padStart(2,'0')}:${String(min0).padStart(2,'0')}`;
      }
    }

    // Pure context defaults (no explicit "alle")
    if (isAM) return '09:00';
    if (isPM) return '15:00';

    return null;
  },

  // Parses Italian date expressions from normalized lowercase text.
  // Returns YYYY-MM-DD or null.
  _parseDate(t, originalText, today) {
    if (/\boggi\b/.test(t))        return today;
    if (/\bdomani\b/.test(t))      return this._addDays(today, 1);
    if (/\bdopodomani\b/.test(t))  return this._addDays(today, 2);

    // "tra N giorni / settimane / mesi"
    const traM = t.match(/\btra\s+(\d+)\s*(giorn|settiman|mes)/i);
    if (traM) {
      const n = parseInt(traM[1]);
      const u = traM[2].toLowerCase();
      if (u.startsWith('giorn'))    return this._addDays(today, n);
      if (u.startsWith('settiman')) return this._addDays(today, n * 7);
      if (u.startsWith('mes'))      return this._addMonths(today, n);
    }

    // "fine mese" → last day of current month
    if (/fine.{0,6}mese/.test(t)) {
      const [y, m] = today.split('-').map(Number);
      return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    }

    // "prossima settimana" → next Monday
    if (/prossim[ao]\s+settiman/.test(t)) return this._nextWeekday(today, 1);

    // Named weekdays: lunedì, martedì, mercoledì, giovedì, venerdì, sabato, domenica
    const dowNames = [
      ['lun', 1], ['mar', 2], ['mer', 3], ['gio', 4],
      ['ven', 5], ['sab', 6], ['dom', 0]
    ];
    for (const [k, v] of dowNames) {
      if (new RegExp('\\b' + k).test(t)) return this._nextWeekday(today, v);
    }

    // "15 giugno", "il 15 giugno", "il 15 di giugno"
    const monthNames = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
    for (let mi = 0; mi < monthNames.length; mi++) {
      const re = new RegExp('(\\d{1,2})\\s*(?:di\\s*)?' + monthNames[mi], 'i');
      const m = t.match(re);
      if (m) {
        const day = parseInt(m[1]);
        const year = parseInt(today.slice(0, 4));
        const candidate = `${year}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return candidate < today
          ? `${year + 1}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          : candidate;
      }
    }

    // "15/06" or "15-06" or "15/06/2026"
    const slashM = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    if (slashM) {
      const day   = parseInt(slashM[1]);
      const month = parseInt(slashM[2]);
      const rawY  = slashM[3];
      const year  = rawY
        ? (rawY.length === 2 ? 2000 + parseInt(rawY) : parseInt(rawY))
        : new Date(today).getFullYear();
      const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return (!rawY && candidate < today)
        ? `${year + 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : candidate;
    }

    return null;
  },

  // ── Agenda title extraction ────────────────────────────────────────────────
  _extractTitle(text, t) {
    const months = 'gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre';
    let s = text
      // trigger words iniziali
      .replace(/^(?:aggiungi|crea|inserisci|metti|imposta)\s+/i, '')
      .replace(/^(?:promemoria|svegliami|notificami)\s*/i, '')
      .replace(/^ricord(?:ami|a(?:\s+a\s+me)?)\s+(?:di\s+)?/i, '')
      .replace(/^(?:appuntamento|evento|scadenza)\s+(?:per\s+(?:il\s+|la\s+)?)?/i, '')
      // espressioni orarie: "alle 14:30", "alle nove e mezza del pomeriggio"
      .replace(/\b(?:verso\s+le?\s+|alle?\s+)\d+(?:[:.]\d+)?(?:\s+e\s+(?:mezza|quarto|tre\s+quarti))?(?:\s+(?:del|di)\s+\w+)?\s*/gi, '')
      .replace(/\b(?:verso\s+le?\s+|alle?\s+)(?:un[ao]|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti|ventun[ao]|ventidue|ventitre)(?:\s+e\s+(?:mezza|quarto))?(?:\s+(?:del|di)\s+\w+)?\s*/gi, '')
      // date: "il 15 giugno 2026", "15/06/2026", "15 di giugno"
      .replace(new RegExp(`\\b(?:(?:il|la|entro\\s+il|entro\\s+la|per\\s+il|per\\s+la)\\s+)?\\d{1,2}(?:\\s+di)?\\s+(?:${months})(?:\\s+\\d{4})?\\b\\s*`, 'gi'), '')
      .replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b\s*/g, '')
      // date relative
      .replace(/\btra\s+\d+\s*(?:giorni?|settimane?|mesi?)\b\s*/gi, '')
      .replace(/\b(?:prossim[ao]\s+)?(?:lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\b\s*/gi, '')
      .replace(/\bprossim[ao]\s+\w+\b\s*/gi, '')
      .replace(/\b(?:oggi|domani|dopodomani|ieri)\b\s*/gi, '')
      .replace(/\b(?:fine\s+mese|a\s+fine\s+mese)\b\s*/gi, '')
      // momenti del giorno
      .replace(/\b(?:stamattina|stanotte|stasera|domattina)\b\s*/gi, '')
      .replace(/\b(?:di\s+|del\s+)?(?:mattina|mattino|pomeriggio|sera|notte)\b\s*/gi, '')
      .replace(/\b(?:mezzogiorno|mezzanotte|ora\s+di\s+pranzo)\b\s*/gi, '')
      // cleanup
      .replace(/\balle?\b\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    // articoli/preposizioni a inizio
    s = s.replace(/^(?:il|la|lo|un|una|di|per|a|al|alla|dai|dal|dalla|in|su)\s+/i, '');
    // preposizioni orfane a fine
    s = s.replace(/\s+(?:il|la|lo|di|per|a|al|e)\s*$/i, '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  },

  // ── Main parse ────────────────────────────────────────────────────────────
  parse(text, context) {
    const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const today = context.today;

    function findVehicle() {
      for (const v of (context.vehicles || [])) {
        const words = v.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/);
        if (words.some(w => w.length >= 2 && t.includes(w))) return v.id;
      }
      return (context.vehicles || [])[0]?.id || null;
    }

    function findImmobile() {
      for (const im of (context.immobili || [])) {
        const words = im.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/);
        if (words.some(w => w.length >= 2 && t.includes(w))) return im.id;
      }
      return (context.immobili || [])[0]?.id || null;
    }

    function findImporto() {
      const pplM = t.match(/\b([12][.,]\d{3})\b/);
      const ppl = pplM ? pplM[1].replace(',', '.') : null;
      const euroM = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:euro|€|euri)/gi)];
      for (const m of euroM) {
        const n = m[1].replace(',', '.');
        if (n !== ppl) return parseFloat(n);
      }
      const shortM = t.match(/\b(\d+(?:[.,]\d+)?)\s*e\b/);
      if (shortM) { const n = parseFloat(shortM[1].replace(',', '.')); if (n >= 5) return n; }
      const nums = [...t.matchAll(/\b(\d+(?:[.,]\d+)?)\b/g)]
        .map(m => parseFloat(m[1].replace(',', '.')))
        .filter(n => n >= 5 && (!ppl || Math.abs(n - parseFloat(ppl)) > 0.01));
      return nums.length ? nums[nums.length - 1] : null;
    }

    function findPrezzoLitro() {
      const m = t.match(/(?:pieno a|al litro)\s+(\d+[.,]\d+)/i) || t.match(/\b([12][.,]\d{3})\b/);
      return m ? parseFloat(m[1].replace(',', '.')) : null;
    }

    function findLocale() {
      const m = text.match(/(?:\bda\b|\bpresso\b|\bal\b|\balla\b)\s+([A-Z][a-zA-ZÀ-ž&']{1,20}(?:\s+[A-Z][a-zA-ZÀ-ž&']{1,20})*)/);
      return m ? m[1].trim() : null;
    }

    function findPersone() {
      const m = t.match(/(?:in|per|con)\s+(\d+)\s*(?:person|pers\b)/) || t.match(/(\d+)\s*(?:person|pers\b)/);
      return m ? parseInt(m[1]) : null;
    }

    const importo = findImporto();

    // ── AGENDA ── (check first to avoid false positives with 'bollo', 'assicurazione')
    const agendaTrigger = /\b(?:promemoria|ricordami|appuntamento|evento agenda|svegliami|scadenza\s+(?!bollo|assicur)|agenda|notificami)\b/.test(t)
      || /\bricord(?:a(?:mi)?)\b/.test(t);

    if (agendaTrigger) {
      const dataInizio = this._parseDate(t, text, today) || today;
      const ora = this._parseTime(t);
      const tipo = /\bscadenza\b/.test(t) ? 'scadenza'
        : /\b(?:evento|appuntamento|riunione|compleanno|cerimonia|concerto)\b/.test(t) ? 'evento'
        : 'promemoria';
      const titolo = this._extractTitle(text, t) || tipo.charAt(0).toUpperCase() + tipo.slice(1);
      const oraLabel = ora ? ` alle ${ora}` : '';
      return {
        section: 'agenda', category: tipo,
        entry: {
          titolo, tipo, dataInizio,
          ...(ora && { ora }),
          notifiche: [{ id: 'n0', anticipo: 1, unita: 'giorni' }],
          vociCollegate: [], completato: false
        },
        summary: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)}: "${titolo}" — ${dataInizio}${oraLabel}`
      };
    }

    // ── VEICOLI ──
    const fuelMap = { benzina:'Benzina', diesel:'Diesel', gasolio:'Diesel', gpl:'GPL', metano:'Metano', elettric:'Elettrico' };
    const fuelKey = Object.keys(fuelMap).find(k => t.includes(k));

    if (fuelKey || /riforniment|pieno|carburant/.test(t)) {
      const vehicleId = findVehicle();
      const litriM = t.match(/(\d+(?:[.,]\d+)?)\s*litri/i);
      const litri = litriM ? parseFloat(litriM[1].replace(',', '.')) : null;
      const costo_litro = findPrezzoLitro();
      const tipo_carburante = fuelMap[fuelKey] || 'Benzina';
      const imp = importo || (litri && costo_litro ? Math.round(litri * costo_litro * 100) / 100 : null);
      const vNome = (context.vehicles || []).find(v => v.id === vehicleId)?.nome || '';
      const distributore = findLocale();
      const kmM = t.match(/(?:a|ai|km)\s*(\d{4,6})\s*(?:km|chilometri)?/i);
      const km = kmM ? parseInt(kmM[1]) : null;
      const pieno = /\bpieno\b/.test(t) ? 'Si' : null;
      return { section:'veicoli', category:{ vehicleId, subCategory:'rifornimenti' },
        entry:{ data:today, importo:imp, litri, costo_litro, tipo_carburante, ...(distributore&&{distributore}), ...(km&&{km}), ...(pieno&&{pieno}) },
        summary:`Rifornimento ${tipo_carburante} ${imp?imp+'€':''}${vNome?' — '+vNome:''}` };
    }

    if (/assicurazion/.test(t) && !/(casa|immobile|abitazion|appartament)/.test(t)) {
      const vehicleId = findVehicle();
      const compagnia = findLocale();
      return { section:'veicoli', category:{ vehicleId, subCategory:'assicurazioni' },
        entry:{ data:today, importo, ...(compagnia&&{compagnia}) }, summary:`Assicurazione veicolo ${importo?importo+'€':''}` };
    }

    if (/\bbollo\b/.test(t)) {
      const vehicleId = findVehicle();
      return { section:'veicoli', category:{ vehicleId, subCategory:'bolli' },
        entry:{ data:today, importo, anno:new Date().getFullYear() }, summary:`Bollo ${importo?importo+'€':''}` };
    }

    if (/tagliando|cambio (olio|gomm|pastich)|freni|batteria|officina|riparazion|meccanico|revisione/.test(t)) {
      const vehicleId = findVehicle();
      const isStrord = /straordinari|grossa|important|rottura|danno|accident/.test(t);
      const officina = findLocale();
      return { section:'veicoli', category:{ vehicleId, subCategory:isStrord?'straordinarie':'ordinarie' },
        entry:{ data:today, importo, tipo:text.slice(0,50), ...(officina&&{officina}) }, summary:`Manutenzione veicolo ${importo?importo+'€':''}` };
    }

    // ── CASA ──
    if (/\b(affitto|mutuo)\b/.test(t)) {
      const immobileId = findImmobile();
      const tipo = /affitto/.test(t) ? 'Affitto' : 'Mutuo';
      return { section:'casa', category:{ immobileId, subCategory:'mutuo_affitto' },
        entry:{ data:today, importo, tipo }, summary:`${tipo} ${importo?importo+'€':''}` };
    }

    if (/\b(luce|elettricita|enel|a2a)\b/.test(t) && !/auto|moto|veicol/.test(t)) {
      const immobileId = findImmobile();
      const fornitoreM = t.match(/\b(enel|a2a|iren|edison|acea|hera|illumia)\b/i);
      const kwhM = t.match(/(\d+(?:[.,]\d+)?)\s*kwh/i);
      return { section:'casa', category:{ immobileId, subCategory:'elettricita' },
        entry:{ data:today, importo, ...(fornitoreM&&{fornitore:fornitoreM[1]}), ...(kwhM&&{kwh:parseFloat(kwhM[1])}) },
        summary:`Bolletta luce ${importo?importo+'€':''}` };
    }

    if (/\b(gas|riscaldamento|caldaia)\b/.test(t) && !/auto|veicol|benzina/.test(t)) {
      const immobileId = findImmobile();
      const fornitoreM = t.match(/\b(eni|enel|a2a|iren|edison|hera|italgas)\b/i);
      const smcM = t.match(/(\d+(?:[.,]\d+)?)\s*(?:smc|sm3|m3|mc)\b/i);
      return { section:'casa', category:{ immobileId, subCategory:'gas' },
        entry:{ data:today, importo, ...(fornitoreM&&{fornitore:fornitoreM[1]}), ...(smcM&&{smc:parseFloat(smcM[1])}) },
        summary:`Gas ${importo?importo+'€':''}` };
    }

    if (/\b(acqua|idrico)\b/.test(t)) {
      const immobileId = findImmobile();
      const mcM = t.match(/(\d+(?:[.,]\d+)?)\s*(?:mc|m3|metri cubi)\b/i);
      return { section:'casa', category:{ immobileId, subCategory:'acqua' },
        entry:{ data:today, importo, ...(mcM&&{mc:parseFloat(mcM[1])}) }, summary:`Acqua ${importo?importo+'€':''}` };
    }

    if (/\b(internet|wifi|fibra|adsl|telefono|vodafone|tim\b|wind|fastweb|iliad)\b/.test(t)) {
      const immobileId = findImmobile();
      const gestoreM = t.match(/\b(vodafone|tim|wind|fastweb|iliad|tiscali|eolo)\b/i);
      const tipoM = /fibra|adsl/.test(t) ? 'Fibra/ADSL' : /mobile/.test(t) ? 'Mobile' : null;
      return { section:'casa', category:{ immobileId, subCategory:'internet_telefono' },
        entry:{ data:today, importo, ...(gestoreM&&{gestore:gestoreM[1]}), ...(tipoM&&{tipo:tipoM}) },
        summary:`Internet/Telefono ${importo?importo+'€':''}` };
    }

    if (/\bcondomini/.test(t)) {
      const immobileId = findImmobile();
      const tipoM = /imu/.test(t) ? 'IMU' : /tari/.test(t) ? 'TARI' : null;
      return { section:'casa', category:{ immobileId, subCategory:'condominio' },
        entry:{ data:today, importo, ...(tipoM&&{tipo:tipoM}) }, summary:`Condominio ${importo?importo+'€':''}` };
    }

    if (/assicurazion/.test(t) && /(casa|immobile|abitazion|appartament)/.test(t)) {
      const immobileId = findImmobile();
      const compagnia = findLocale();
      return { section:'casa', category:{ immobileId, subCategory:'assicurazione_casa' },
        entry:{ data:today, importo, ...(compagnia&&{compagnia}) }, summary:`Assicurazione casa ${importo?importo+'€':''}` };
    }

    // ── INTRATTENIMENTO ──
    if (/netflix|prime video|amazon prime|disney|hbo|apple tv|sky|dazn|spotify|youtube premium|crunchyroll|mubi/.test(t)) {
      const svcNames = ['Netflix','Amazon Prime','Disney+','HBO Max','Apple TV+','Sky','DAZN','Spotify','YouTube Premium','Crunchyroll','MUBI'];
      const svc = svcNames.find(s => t.includes(s.toLowerCase().replace(/[+]/g, ''))) || 'Streaming';
      const freqM = /annuale|anno/.test(t) ? 'Annuale' : /trimestrale/.test(t) ? 'Trimestrale' : 'Mensile';
      return { section:'intrattenimento', category:'streaming',
        entry:{ data:today, servizio:svc, importo, frequenza:freqM }, summary:`Streaming ${svc} ${importo?importo+'€':''}` };
    }

    if (/pranzo|cena|ristorante|trattoria|osteria|pizzeria|sushi|pizza|hamburgeria|mcdonald|kebab|pasto/.test(t)) {
      const specific = text.match(/(sushi|pizza|trattoria|osteria|pizzeria|hamburgeria|kebab|mcdonald)/i);
      const generic = text.match(/(pranzo|cena|ristorante|pasto)/i);
      const raw = specific ? specific[1] : generic ? generic[1] : 'Ristorante';
      const tipoM = { sushi:'Sushi', pizza:'Pizzeria', trattoria:'Trattoria', osteria:'Trattoria',
                      pizzeria:'Pizzeria', hamburgeria:'Fast food', kebab:'Fast food', mcdonald:'Fast food' };
      const tipo = tipoM[raw.toLowerCase()] || 'Ristorante';
      const locale = findLocale();
      const persone = findPersone();
      return { section:'intrattenimento', category:'ristoranti',
        entry:{ data:today, importo, tipo, ...(locale&&{locale}), ...(persone&&{persone}) },
        summary:`${tipo} ${importo?importo+'€':''}${locale?' — '+locale:''}` };
    }

    if (/caffe|cafe|cornetto|brioche|aperitivo|spritz|colazione/.test(t) || /\bbar\b/.test(t)) {
      const locale = findLocale();
      return { section:'intrattenimento', category:'bar_caffe',
        entry:{ data:today, importo, ...(locale&&{locale}) }, summary:`Bar/Caffè ${importo?importo+'€':''}` };
    }

    if (/cinema|teatro|\bfilm\b|spettacolo|concerto/.test(t)) {
      const tipoM = /cinema/.test(t)?'Cinema':/teatro/.test(t)?'Teatro':/concerto/.test(t)?'Concerto':'Spettacolo';
      const bigliettiM = t.match(/(\d+)\s*(?:bigliett|ticket)/i);
      const biglietti = bigliettiM ? parseInt(bigliettiM[1]) : null;
      const evM = text.match(/(?:cinema|teatro|film|concerto|spettacolo)\s+(.+?)(?:\s+\d|\s*$)/i);
      let evento = evM ? evM[1].trim() : '';
      // rimuovi frammenti di data/orario dal nome evento
      evento = evento
        .replace(/\b(?:oggi|domani|dopodomani)\b.*/i, '')
        .replace(/\b(?:lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\b.*/i, '')
        .replace(/\balle?\s+.*/i, '')
        .replace(/\bdi\s+(?:mattina|pomeriggio|sera)\b.*/i, '')
        .replace(/\b(?:stasera|stamattina)\b.*/i, '')
        .trim().slice(0, 50);
      return { section:'intrattenimento', category:'cinema_teatro',
        entry:{ data:today, evento, importo, tipo:tipoM, ...(biglietti&&{biglietti}) },
        summary:`${tipoM} ${importo?importo+'€':''}${evento?' — '+evento:''}` };
    }

    if (/palestra|fitness|nuoto|piscina|\bcalcio\b|\btennis\b|padel|crossfit|sport/.test(t)) {
      const tipoM = /palestra|fitness|crossfit/.test(t)?'Abbonamento palestra':/piscina|nuoto/.test(t)?'Corso':/padel|tennis/.test(t)?'Abbonamento sport':'Altro';
      const struttura = findLocale();
      return { section:'intrattenimento', category:'sport_palestra',
        entry:{ data:today, importo, tipo:tipoM, ...(struttura&&{struttura}) },
        summary:`Sport/Palestra ${importo?importo+'€':''}` };
    }

    if (/viaggio|vacanza|aereo|\bvolo\b|hotel|albergo|b&b|treno|traghetto|crociera/.test(t)) {
      const tipoM = /aereo|volo/.test(t)?'Volo':/hotel|albergo/.test(t)?'Hotel':/treno/.test(t)?'Treno':/traghetto/.test(t)?'Traghetto':'Altro';
      const destM = text.match(/(?:per|a|verso)\s+([A-Z][a-zA-ZÀ-ž\s]{2,25})(?:\s+\d|\s*,|\s*$)/);
      const destinazione = destM ? destM[1].trim() : '';
      const persone = findPersone();
      return { section:'intrattenimento', category:'viaggi_vacanze',
        entry:{ data:today, importo, tipo:tipoM, ...(destinazione&&{destinazione}), ...(persone&&{persone}) },
        summary:`${tipoM} ${importo?importo+'€':''}${destinazione?' → '+destinazione:''}` };
    }

    if (/festa|compleanno|matrimonio|cerimonia|\bregalo\b/.test(t)) {
      const tipoM = /compleanno/.test(t)?'Compleanno':/matrimonio/.test(t)?'Matrimonio':/regalo/.test(t)?'Regalo':'Festa';
      const evM = text.match(/(?:festa|compleanno|matrimonio|evento|regalo)\s+(?:di\s+)?(.+?)(?:\s+\d|\s*,|\s*$)/i);
      const evento = evM ? evM[1].slice(0,50).trim() : tipoM;
      return { section:'intrattenimento', category:'feste_eventi',
        entry:{ data:today, importo, tipo:tipoM, evento }, summary:`${tipoM} ${importo?importo+'€':''}` };
    }

    if (/hobby|\blibro\b|videogioco|console|acquario|modell/.test(t)) {
      return { section:'intrattenimento', category:'hobby',
        entry:{ data:today, importo, descrizione:text.slice(0,50) }, summary:`Hobby ${importo?importo+'€':''}` };
    }

    // ── SPESA ──
    if (/supermercato|alimentari|esselunga|conad|coop|lidl|eurospin|carrefour|pam\b|iper|spesa al|fare la spesa|spesa di/.test(t)) {
      const negozio = findLocale() || (t.match(/\b(esselunga|conad|coop|lidl|eurospin|carrefour|pam|iper)\b/i)||[])[1] || null;
      return { section:'spesa', category:'supermercato',
        entry:{ data:today, importo, ...(negozio&&{negozio}) }, summary:`Supermercato ${importo?importo+'€':''}${negozio?' — '+negozio:''}` };
    }

    if (/farmacia|parafarmacia|medicinale|medicina|farmaco|pillola|cerotto/.test(t)) {
      const descM = text.match(/(?:farmacia|medicinale|farmaco)\s+([a-zA-ZÀ-ž\s]{2,40}?)(?:\s+\d|\s*€|\s*euro|\s*$)/i);
      return { section:'spesa', category:'farmacia',
        entry:{ data:today, importo, ...(descM&&{descrizione:descM[1].slice(0,50)}) }, summary:`Farmacia ${importo?importo+'€':''}` };
    }

    if (/abbigliamento|vestit|scarpe|camicia|pantalon|giacca|maglietta|jeans|abito|calze|zara|h&m|pull&bear|primark/.test(t)) {
      const negozio = findLocale() || (t.match(/\b(zara|h&m|primark|mango|bershka|uniqlo)\b/i)||[])[1] || null;
      const descM = text.match(/(?:comprat[oa]?|acquistat[oa]?)\s+(.+?)(?:\s+\d|\s*$)/i);
      return { section:'spesa', category:'abbigliamento',
        entry:{ data:today, importo, ...(negozio&&{negozio}), ...(descM&&{descrizione:descM[1].slice(0,50)}) },
        summary:`Abbigliamento ${importo?importo+'€':''}` };
    }

    if (/elettronic|telefono|smartphone|laptop|computer|tablet|cuffi|auricolar|amazon|mediaworld|unieuro/.test(t)) {
      const negozio = findLocale() || (t.match(/\b(amazon|mediaworld|unieuro|apple|samsung)\b/i)||[])[1] || null;
      const descM = text.match(/(?:comprat[oa]?|acquistat[oa]?|nuovo?)\s+(.+?)(?:\s+\d|\s*$)/i);
      return { section:'spesa', category:'elettronica',
        entry:{ data:today, importo, ...(negozio&&{negozio}), ...(descM&&{descrizione:descM[1].slice(0,50)}) },
        summary:`Elettronica ${importo?importo+'€':''}` };
    }

    if (/\bcura\b|parrucchier|barbier|estetist|salone|profumo|cosmet|shampoo|trucco|unghie/.test(t)) {
      const descM = text.match(/(?:da|al|alla)\s+(.+?)(?:\s+\d|\s*$)/i);
      return { section:'spesa', category:'cura_persona',
        entry:{ data:today, importo, ...(descM&&{descrizione:descM[1].slice(0,40)}) }, summary:`Cura persona ${importo?importo+'€':''}` };
    }

    if (/animale|cane|gatto|veterinario|petshop|crocchette|mangime/.test(t)) {
      const tipoM = /veterinario|vet\b/.test(t)?'Veterinario':/crocchette|mangime|cibo/.test(t)?'Cibo':'Accessori';
      return { section:'spesa', category:'animali',
        entry:{ data:today, importo, tipo:tipoM }, summary:`Animali ${tipoM} ${importo?importo+'€':''}` };
    }

    // ── FINANZE ──
    if (/stipendio|salario|bonus|tredicesima|quattordicesima|rimborso|pensione|guadagn|incass|accredit/.test(t)) {
      const tipoMap = { stipendio:'Stipendio', salario:'Stipendio', bonus:'Bonus', tredicesima:'Tredicesima', rimborso:'Rimborso', pensione:'Pensione' };
      const tipoKey = Object.keys(tipoMap).find(k => t.includes(k));
      const tipo = tipoMap[tipoKey] || 'Entrata';
      return { section:'finanze', category:'entrate',
        entry:{ data:today, importo, descrizione:tipo, tipo }, summary:`Entrata ${tipo} ${importo?importo+'€':''}` };
    }

    return { error:`Non ho capito: "${text.slice(0,60)}". Prova: "promemoria visita medica il 15 giugno", "benzina 65 euro", "affitto 900 euro", "pranzo sushi 45 euro".` };
  }
};
