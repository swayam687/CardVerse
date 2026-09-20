/* ============================================================
   ui/ShareRoom.js — v2.12 (NEW)
   · Renders QR + copy/share link on the room screen.
   · Hooks Net room_update. Self-contained (injects its CSS).
   ============================================================ */
const ShareRoom = {
  _lastCode: null,
  _wired: false,

  _css() {
    return `
      .share-box {
        margin-top: 14px;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--r-md);
        padding: 14px;
      }
      .share-inner {
        display: flex;
        gap: 14px;
        align-items: center;
      }
      .share-qr {
        width: 140px; height: 140px;
        background: #fff;
        border-radius: 8px;
        padding: 6px;
        flex: 0 0 auto;
        display: block;
      }
      .share-side { flex: 1; min-width: 0; }
      .share-label {
        font-size: 10px; font-weight: 900; letter-spacing: 1.6px;
        color: var(--text-secondary); text-transform: uppercase;
        margin-bottom: 6px;
      }
      .share-url {
        font-family: ui-monospace, Menlo, monospace;
        font-size: 11px;
        padding: 6px 8px;
        background: var(--code-bg, #0F0F18);
        color: var(--code-fg, #E9C46A);
        border-radius: 6px;
        margin-bottom: 8px;
        word-break: break-all;
        font-weight: 700;
      }
      @media (max-width: 420px) {
        .share-inner { flex-direction: column; align-items: stretch; }
        .share-qr { align-self: center; }
      }
    `;
  },

  mount() {
    if (this._wired) return;
    this._wired = true;

    if (!document.getElementById('shareRoomStyles')) {
      const st = document.createElement('style');
      st.id = 'shareRoomStyles';
      st.textContent = this._css();
      document.head.appendChild(st);
    }

    if (typeof Net === 'undefined') return;

    Net.on('room_update', () => this._refresh());
    Net.on('rejoined',    () => this._refresh());
    Net.on('room_closed', () => this._hide());
    Net.on('kicked',      () => this._hide());
  },

  _joinUrl(code) {
    return `${location.origin}/r/${code}`;
  },

  _hide() {
    const box = document.getElementById('shareBox');
    if (box) box.style.display = 'none';
    this._lastCode = null;
  },

  _refresh() {
    const room = (typeof Net !== 'undefined') ? Net.room : null;
    if (!room || !room.code) return;
    if (this._lastCode === room.code) return;
    this._lastCode = room.code;
    this._render(room.code);
  },

  _render(code) {
    const box = document.getElementById('shareBox');
    if (!box) return;

    const url = this._joinUrl(code);
    const qr  = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data='
              + encodeURIComponent(url);

    box.innerHTML = `
      <div class="share-inner">
        <img class="share-qr" src="${qr}" alt="QR code to join room ${esc(code)}" width="140" height="140" loading="lazy">
        <div class="share-side">
          <div class="share-label">Invite Link</div>
          <div class="share-url">${esc(url)}</div>
          <button class="btn primary" id="shareCopy" style="width:100%">Copy Link</button>
          <button class="btn ghost" id="shareNative" style="width:100%;margin-top:6px;display:none">Share…</button>
        </div>
      </div>
    `;
    box.style.display = '';

    const copyBtn = box.querySelector('#shareCopy');
    if (copyBtn) {
      copyBtn.onclick = async () => {
        if (typeof Sound !== 'undefined') Sound.click();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
          } else {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            ta.remove();
          }
          copyBtn.textContent = '✓ Copied';
          setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 1500);
        } catch (e) {
          if (typeof Toast !== 'undefined') Toast.show('Copy failed — select manually');
        }
      };
    }

    const shareBtn = box.querySelector('#shareNative');
    if (shareBtn && navigator.share) {
      shareBtn.style.display = '';
      shareBtn.onclick = async () => {
        try {
          await navigator.share({
            title: 'RuleVerse',
            text: `Join my RuleVerse room ${code}`,
            url
          });
        } catch (e) {}
      };
    }
  }
};