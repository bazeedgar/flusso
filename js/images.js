// ===== FILE/IMAGE STORE (IndexedDB) =====
const ImageStore = {
  _DB: 'financeAttach_v1',
  _db: null,
  cache: {}, // entryId -> count (sync, refreshed at startup)

  async _open() {
    if (this._db) return this._db;
    return new Promise((res, rej) => {
      const r = indexedDB.open(this._DB, 1);
      r.onupgradeneeded = e => {
        const s = e.target.result.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
        s.createIndex('eid', 'entryId', { unique: false });
      };
      r.onsuccess = e => { this._db = e.target.result; res(this._db); };
      r.onerror = () => rej(r.error);
    });
  },

  async add(entryId, dataUrl, name, type) {
    const db = await this._open();
    return new Promise((res, rej) => {
      const tx = db.transaction('files', 'readwrite');
      const req = tx.objectStore('files').add({ entryId, dataUrl, name, type, ts: Date.now() });
      req.onsuccess = () => { this.cache[entryId] = (this.cache[entryId] || 0) + 1; res(req.result); };
      req.onerror = () => rej(req.error);
    });
  },

  async getAll(entryId) {
    const db = await this._open();
    return new Promise((res, rej) => {
      const req = db.transaction('files').objectStore('files').index('eid').getAll(entryId);
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
  },

  async remove(fileId) {
    const db = await this._open();
    return new Promise((res, rej) => {
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      const g = store.get(fileId);
      g.onsuccess = () => {
        if (!g.result) { res(); return; }
        const eid = g.result.entryId;
        store.delete(fileId).onsuccess = () => { if (this.cache[eid] > 0) this.cache[eid]--; res(); };
      };
      g.onerror = () => rej(g.error);
    });
  },

  async removeAll(entryId) {
    const files = await this.getAll(entryId);
    if (!files.length) return;
    const db = await this._open();
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    files.forEach(f => store.delete(f.id));
    delete this.cache[entryId];
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  },

  async move(fromId, toId) {
    if (!fromId || fromId === toId) return;
    const files = await this.getAll(fromId);
    if (!files.length) return;
    const db = await this._open();
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    files.forEach(f => {
      store.delete(f.id);
      const nf = { ...f, entryId: toId }; delete nf.id;
      store.add(nf);
    });
    delete this.cache[fromId];
    this.cache[toId] = (this.cache[toId] || 0) + files.length;
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  },

  async loadCache() {
    try {
      const db = await this._open();
      return new Promise(res => {
        const req = db.transaction('files').objectStore('files').getAll();
        req.onsuccess = () => {
          this.cache = {};
          (req.result || []).forEach(f => { this.cache[f.entryId] = (this.cache[f.entryId] || 0) + 1; });
          res();
        };
        req.onerror = () => res();
      });
    } catch { }
  },

  hasFiles(entryId) { return (this.cache[entryId] || 0) > 0; }
};

// ===== ATTACH UI =====
const AttachUI = {
  _attachId: null,

  async open(attachId) {
    this._attachId = attachId;
    const section = document.getElementById('modal-attach-section');
    if (!section) return;
    section.style.display = '';
    const files = await ImageStore.getAll(attachId);
    this._renderPreview(files);
  },

  close() {
    this._attachId = null;
    const section = document.getElementById('modal-attach-section');
    if (section) section.style.display = 'none';
    const preview = document.getElementById('modal-attach-preview');
    if (preview) preview.innerHTML = '';
  },

  _renderPreview(files) {
    const preview = document.getElementById('modal-attach-preview');
    if (!preview) return;
    if (!files.length) { preview.innerHTML = '<span class="attach-empty">Nessun allegato</span>'; return; }
    preview.innerHTML = '';
    files.forEach(f => preview.appendChild(this._makeCard(f)));
  },

  _makeCard(f) {
    const isImg = f.type && f.type.startsWith('image/');
    const card = document.createElement('div');
    card.className = 'attach-item';
    card.dataset.fid = f.id;

    if (isImg) {
      const img = document.createElement('img');
      img.src = f.dataUrl; img.className = 'attach-thumb-img';
      img.addEventListener('click', () => Utils.showLightbox(f.dataUrl));
      card.appendChild(img);
    } else {
      const icon = document.createElement('div');
      icon.className = 'attach-file-icon';
      icon.textContent = this._fileIcon(f.name, f.type);
      icon.addEventListener('click', () => Utils.downloadFile(f.dataUrl, f.name));
      card.appendChild(icon);
    }

    const name = document.createElement('div');
    name.className = 'attach-item-name';
    name.textContent = f.name || 'file';
    card.appendChild(name);

    const del = document.createElement('button');
    del.type = 'button'; del.className = 'attach-del-btn'; del.title = 'Rimuovi'; del.textContent = '×';
    del.addEventListener('click', () => {
      Utils.confirm('Eliminare questo allegato?', async () => {
        await ImageStore.remove(f.id);
        card.remove();
        const preview = document.getElementById('modal-attach-preview');
        if (preview && !preview.querySelectorAll('.attach-item').length) {
          preview.innerHTML = '<span class="attach-empty">Nessun allegato</span>';
        }
      });
    });
    card.appendChild(del);
    return card;
  },

  _fileIcon(name, type) {
    if (!type) return '📎';
    if (type.includes('pdf')) return '📕';
    if (type.includes('word') || (name || '').match(/\.docx?$/i)) return '📘';
    if (type.includes('excel') || (name || '').match(/\.xlsx?$/i)) return '📗';
    if (type.includes('text') || (name || '').match(/\.txt$/i)) return '📄';
    if (type.includes('zip') || (name || '').match(/\.(zip|rar|7z)$/i)) return '🗜️';
    return '📎';
  },

  async _addFile(file) {
    if (!file || !this._attachId) return;
    let dataUrl;
    if (file.type.startsWith('image/')) {
      const raw = await this._readFile(file);
      dataUrl = await this._resize(raw, 1200);
    } else {
      dataUrl = await this._readFile(file);
    }
    const fid = await ImageStore.add(this._attachId, dataUrl, file.name, file.type);
    const preview = document.getElementById('modal-attach-preview');
    if (!preview) return;
    const placeholder = preview.querySelector('.attach-empty');
    if (placeholder) placeholder.remove();
    const card = this._makeCard({ id: fid, dataUrl, name: file.name, type: file.type });
    preview.appendChild(card);
  },

  // Usato da Capacitor Camera (dataUrl già disponibile, senza File object)
  async _addFromDataUrl(dataUrl, name, type) {
    if (!this._attachId) return;
    const resized = type.startsWith('image/') ? await this._resize(dataUrl, 1200) : dataUrl;
    const fid = await ImageStore.add(this._attachId, resized, name, type);
    const preview = document.getElementById('modal-attach-preview');
    if (!preview) return;
    const placeholder = preview.querySelector('.attach-empty');
    if (placeholder) placeholder.remove();
    preview.appendChild(this._makeCard({ id: fid, dataUrl: resized, name, type }));
  },

  _readFile(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  },

  _resize(dataUrl, maxW) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * ratio); c.height = Math.round(img.height * ratio);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => res(dataUrl);
      img.src = dataUrl;
    });
  }
};

// Camera button — Capacitor Camera (Android nativo), getUserMedia (browser), fallback input
document.getElementById('btn-attach-camera')?.addEventListener('click', async () => {
  // Android: usa Capacitor Camera plugin (gestisce permessi automaticamente)
  if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.Camera) {
    try {
      BiometricAuth.suppressNext();
      const photo = await Capacitor.Plugins.Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: 'dataUrl',
        source: 'CAMERA',
        saveToGallery: false
      });
      if (photo.dataUrl) {
        await AttachUI._addFromDataUrl(photo.dataUrl, 'foto_' + Date.now() + '.jpg', 'image/jpeg');
      }
    } catch(e) {
      // Utente ha annullato o errore — non mostrare nulla
    }
    return;
  }

  // Browser: usa getUserMedia con overlay in-app
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      const overlay = document.getElementById('camera-overlay');
      const video = document.getElementById('camera-video');
      video.srcObject = stream;
      Utils.lockScroll();
      overlay.classList.remove('hidden');

      const stopStream = () => stream.getTracks().forEach(t => t.stop());

      document.getElementById('camera-capture-btn').onclick = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob(async blob => {
          stopStream();
          Utils.unlockScroll();
          overlay.classList.add('hidden');
          const file = new File([blob], 'foto_' + Date.now() + '.jpg', { type: 'image/jpeg' });
          await AttachUI._addFile(file);
        }, 'image/jpeg', 0.9);
      };

      document.getElementById('camera-cancel-btn').onclick = () => {
        stopStream();
        Utils.unlockScroll();
        overlay.classList.add('hidden');
      };
    } catch {
      BiometricAuth.suppressNext();
      document.getElementById('attach-camera-input').click();
    }
  } else {
    BiometricAuth.suppressNext();
    document.getElementById('attach-camera-input').click();
  }
});

// Archive button
document.getElementById('btn-attach-archive')?.addEventListener('click', () => {
  BiometricAuth.suppressNext();
  document.getElementById('attach-archive-input').click();
});
document.getElementById('attach-camera-input')?.addEventListener('change', async e => {
  for (const f of [...e.target.files]) await AttachUI._addFile(f);
  e.target.value = '';
});
document.getElementById('attach-archive-input')?.addEventListener('change', async e => {
  for (const f of [...e.target.files]) await AttachUI._addFile(f);
  e.target.value = '';
});

// Lightbox close
document.getElementById('lightbox-overlay')?.addEventListener('click', e => {
  if (e.target === e.currentTarget || e.target.id === 'lightbox-close') Utils.closeLightbox();
});
