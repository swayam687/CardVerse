/* ============================================================
   ui/ProfileEdit.js — v2.13 (NEW)
   Replaces the profile modal so we can add custom photo upload.
   · Intercepts #btnProfile click (capture phase).
   · Stores image as data URL (max 128×128, JPEG q=0.85).
   · Persists to localStorage 'rv_profile_v2'.
   · Writes back into LobbyView.profile at runtime.
   ============================================================ */
const ProfileEdit = {
  STORAGE: 'rv_profile_v2',
  MAX_DIM: 128,
  _wired: false,

  mount() {
    if (this._wired) return;
    this._wired = true;

    // Load persisted values into LobbyView.profile as soon as we can
    this._hydrate();

    // Intercept the profile button in capture phase so LobbyView's
    // own handler doesn't fire.
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      if (!t.closest('#btnProfile')) return;
      e.stopPropagation();
      e.preventDefault();
      if (typeof Sound !== 'undefined') Sound.click();
      this.open();
    }, true);
  },

  _hydrate() {
    try {
      const raw = localStorage.getItem(this.STORAGE);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof LobbyView === 'undefined' || !LobbyView.profile) return;
      if (data.name) LobbyView.profile.name = data.name;
      if (data.avatar) LobbyView.profile.avatar = data.avatar;
      if (data.avatarImage) LobbyView.profile.avatarImage = data.avatarImage;
      this._paintChip();
    } catch (e) {}
  },

  _save() {
    if (typeof LobbyView === 'undefined' || !LobbyView.profile) return;
    const p = LobbyView.profile;
    try {
      localStorage.setItem(this.STORAGE, JSON.stringify({
        name: p.name,
        avatar: p.avatar,
        avatarImage: p.avatarImage || null
      }));
    } catch (e) {}
    this._paintChip();
  },

  _paintChip() {
    const av = document.getElementById('myAvatar');
    const nm = document.getElementById('myName');
    if (!av || !nm) return;
    const p = LobbyView.profile || {};
    if (p.avatarImage) {
      av.innerHTML = `<img src="${p.avatarImage}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      av.style.overflow = 'hidden';
    } else {
      av.textContent = p.avatar || '🙂';
      av.style.overflow = '';
    }
    nm.textContent = p.name || 'Player';
  },

  open() {
    if (typeof Modal === 'undefined') return;
    const p = LobbyView.profile || {};
    const emojis = (typeof AVATARS !== 'undefined' && Array.isArray(AVATARS))
      ? AVATARS
      : ['🙂','😎','🦊','🐼','🐸','🐙','🦄','🐯','🤖','👾','🐲','🐺'];

    const m = Modal.open(`
      <h2>Your Profile</h2>
      <div class="hint">Shown to everyone in the room.</div>

      <label class="fl" style="margin-top:14px">Display Name</label>
      <input id="peName" maxlength="16" value="${esc(p.name || 'Player')}" autocomplete="off">

      <label class="fl" style="margin-top:14px">Avatar</label>
      <div class="pe-av-row">
        <div class="pe-av-preview" id="peAvPreview">
          ${p.avatarImage
            ? `<img src="${p.avatarImage}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : `<span style="font-size:38px">${esc(p.avatar || '🙂')}</span>`}
        </div>
        <div style="flex:1;min-width:0">
          <button class="btn primary" id="peUploadBtn" style="width:100%">📷 Change Photo</button>
          <button class="btn ghost" id="peClearBtn" style="width:100%;margin-top:6px;display:${p.avatarImage ? '' : 'none'}">Use Emoji Instead</button>
          <input type="file" id="peFile" accept="image/*" style="display:none">
          <div class="hint" style="margin-top:8px;font-size:11px">Photo is resized to ${this.MAX_DIM}×${this.MAX_DIM} and stored on this device.</div>
        </div>
      </div>

      <label class="fl" style="margin-top:14px">Or Pick an Emoji</label>
      <div class="pe-emoji-grid" id="peEmojiGrid"></div>

      <button class="btn primary big" id="peSave" style="width:100%;margin-top:16px">Save</button>
      <button class="btn ghost big" id="peCancel" style="width:100%;margin-top:8px">Cancel</button>
    `);
    if (!m) return;

    let pendingImage = p.avatarImage || null;
    let pendingEmoji = p.avatar || '🙂';

    const preview  = m.querySelector('#peAvPreview');
    const fileIn   = m.querySelector('#peFile');
    const clearBtn = m.querySelector('#peClearBtn');
    const emojiGrid= m.querySelector('#peEmojiGrid');

    emojis.forEach(em => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pe-emoji-btn' + (em === pendingEmoji && !pendingImage ? ' active' : '');
      b.textContent = em;
      b.onclick = () => {
        pendingEmoji = em;
        pendingImage = null;
        preview.innerHTML = `<span style="font-size:38px">${esc(em)}</span>`;
        clearBtn.style.display = 'none';
        emojiGrid.querySelectorAll('.pe-emoji-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        if (typeof Sound !== 'undefined') Sound.click();
      };
      emojiGrid.appendChild(b);
    });

    m.querySelector('#peUploadBtn').onclick = () => {
      if (typeof Sound !== 'undefined') Sound.click();
      fileIn.click();
    };

    fileIn.onchange = async () => {
      const f = fileIn.files && fileIn.files[0];
      if (!f) return;
      try {
        const dataUrl = await this._resize(f, this.MAX_DIM);
        pendingImage = dataUrl;
        preview.innerHTML = `<img src="${dataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        clearBtn.style.display = '';
        emojiGrid.querySelectorAll('.pe-emoji-btn').forEach(x => x.classList.remove('active'));
      } catch (e) {
        if (typeof Toast !== 'undefined') Toast.show('Could not read image');
      }
    };

    clearBtn.onclick = () => {
      pendingImage = null;
      preview.innerHTML = `<span style="font-size:38px">${esc(pendingEmoji)}</span>`;
      clearBtn.style.display = 'none';
      emojiGrid.querySelectorAll('.pe-emoji-btn').forEach(x => {
        x.classList.toggle('active', x.textContent === pendingEmoji);
      });
    };

    m.querySelector('#peSave').onclick = () => {
      const name = (m.querySelector('#peName').value || 'Player').slice(0, 16);
      if (typeof LobbyView !== 'undefined' && LobbyView.profile) {
        LobbyView.profile.name = name;
        LobbyView.profile.avatar = pendingEmoji;
        LobbyView.profile.avatarImage = pendingImage;
      }
      this._save();
      Modal.close();
      if (typeof Toast !== 'undefined') Toast.show('Profile saved');
    };

    m.querySelector('#peCancel').onclick = () => Modal.close();
  },

  _resize(file, max) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('decode failed'));
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          const c = document.createElement('canvas');
          c.width = max; c.height = max;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, sx, sy, side, side, 0, 0, max, max);
          try { resolve(c.toDataURL('image/jpeg', 0.85)); }
          catch (e) { reject(e); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  },

  _css() {
    return `
      .pe-av-row {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .pe-av-preview {
        width: 84px; height: 84px;
        flex: 0 0 auto;
        background: var(--bg-surface-2);
        border: 2px solid var(--border);
        border-radius: 50%;
        display: grid;
        place-items: center;
        overflow: hidden;
      }
      .pe-emoji-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 6px;
        margin-top: 4px;
      }
      .pe-emoji-btn {
        aspect-ratio: 1;
        background: var(--bg-surface-2);
        border: 2px solid var(--border);
        border-radius: var(--r-sm);
        font-size: 22px;
        cursor: pointer;
        transition: transform .12s, border-color .12s, background .12s;
        display: grid;
        place-items: center;
        padding: 0;
      }
      .pe-emoji-btn:hover { background: var(--bg-surface-3); }
      .pe-emoji-btn.active {
        border-color: var(--accent);
        background: var(--accent-soft);
        transform: scale(1.05);
      }
    `;
  },

  _injectCss() {
    if (document.getElementById('peStyles')) return;
    const st = document.createElement('style');
    st.id = 'peStyles';
    st.textContent = this._css();
    document.head.appendChild(st);
  }
};

(function bootProfileEdit() {
  const go = () => {
    try {
      if (typeof ProfileEdit !== 'undefined') {
        ProfileEdit._injectCss();
        ProfileEdit.mount();
      }
    } catch (e) { console.error('[ProfileEdit] boot', e); }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', go, { once: true });
  } else {
    setTimeout(go, 0);
  }
})();