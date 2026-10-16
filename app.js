/* Artemis Lounge: home bar companion.
 * Everything a person enters is kept in this browser (localStorage), so each
 * phone holds its own bar. Backup/Restore in "More" moves it between devices.
 */
(function () {
  'use strict';

  const STORE_KEY = 'artemis-lounge.v1';
  const ING = window.AL_INGREDIENTS;
  const PANTRY = new Set(window.AL_PANTRY);
  const SUBS = window.AL_SUBS;
  const BUILTIN = window.AL_RECIPES;
  const KNOWN_BARCODES = window.AL_KNOWN_BARCODES || {};
  const LEVELS = [['full', 'Full'], ['half', 'Half'], ['low', 'Low'], ['out', 'Out']];
  const GROUP_ORDER = ['Spirits', 'Liqueurs & Aperitifs', 'Wine', 'Mixers', 'Juices', 'Syrups', 'Bitters & Brine', 'Fresh & Pantry', 'Other'];

  // ── State ────────────────────────────────────────────────────────────
  const blank = () => ({ barName: 'Artemis Lounge', bottles: [], learned: {}, custom: [], menu: { title: 'Artemis Lounge', ids: [], notes: {}, printPhotos: true }, shop: [], bigText: false, favs: [], rnotes: {}, wines: [] });
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = Object.assign(blank(), JSON.parse(raw));
        s.menu = Object.assign(blank().menu, s.menu || {});
        return s;
      }
    } catch (e) { /* storage blocked or damaged: start fresh */ }
    return blank();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save on this device. Use More > Backup.'); }
  }
  const uid = () => Math.random().toString(36).slice(2, 9);

  // ── Helpers ──────────────────────────────────────────────────────────
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const label = (key) => (ING[key] ? ING[key].label : key);
  const groupOf = (key) => (ING[key] ? ING[key].group : 'Other');

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ── Photos ───────────────────────────────────────────────────────────
  // Pictures are too big for localStorage, so they live in IndexedDB on this
  // device. photoURL holds a ready-to-show link for each recipe that has one.
  const photoURL = {};
  function photoDB() {
    if (photoDB.p) return photoDB.p;
    photoDB.p = new Promise((res, rej) => {
      const r = indexedDB.open('artemis-lounge-photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return photoDB.p;
  }
  async function photoTx(mode, fn) {
    const db = await photoDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('photos', mode);
      const out = fn(tx.objectStore('photos'));
      tx.oncomplete = () => res(out && out.result);
      tx.onerror = () => rej(tx.error);
    });
  }
  async function loadPhotos() {
    try {
      const db = await photoDB();
      await new Promise((res) => {
        const req = db.transaction('photos').objectStore('photos').openCursor();
        req.onsuccess = () => { const c = req.result; if (!c) return res(); photoURL[c.key] = URL.createObjectURL(c.value); c.continue(); };
        req.onerror = () => res();
      });
    } catch (e) { /* no IndexedDB: photos unavailable */ }
  }
  async function setPhoto(id, blob) {
    if (photoURL[id]) URL.revokeObjectURL(photoURL[id]);
    delete photoURL[id];
    if (blob) { await photoTx('readwrite', (s) => s.put(blob, id)); photoURL[id] = URL.createObjectURL(blob); }
    else await photoTx('readwrite', (s) => s.delete(id));
  }
  // Shrink a camera photo to a sensible size before saving it.
  function shrinkImage(file, max = 1000) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        c.toBlob((b) => (b ? res(b) : rej(new Error('no image'))), 'image/jpeg', 0.82);
      };
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }
  const blobToDataURL = (b) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
  async function photosForBackup() {
    const out = {};
    for (const id of Object.keys(photoURL)) out[id] = await blobToDataURL(await (await fetch(photoURL[id])).blob());
    return out;
  }
  async function restorePhotos(map) {
    for (const [id, url] of Object.entries(map || {})) { try { await setPhoto(id, await (await fetch(url)).blob()); } catch (e) { /* skip bad photo */ } }
  }

  function allRecipes() { return BUILTIN.concat(state.custom); }
  function recipeById(id) { return allRecipes().find((r) => r.id === id); }

  // ── Availability ─────────────────────────────────────────────────────
  // A bottle counts unless it is marked Out. Low still pours.
  function stockedKeys() {
    const s = new Set(PANTRY);
    state.bottles.forEach((b) => { if (b.key && b.level !== 'out') s.add(b.key); });
    // Wine in the rack also counts for cocktails that call for it
    state.wines.forEach((w) => {
      if (w.wish || !(w.count > 0)) return;
      if (w.type === 'Sparkling') s.add('sparkling-wine');
      if (w.type === 'White') s.add('dry-white-wine');
    });
    return s;
  }

  // ── Party batches ────────────────────────────────────────────────────
  const FRAC = { '½': 1 / 2, '¼': 1 / 4, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8 };
  function num(s) {
    const m = String(s).match(/^(\d+(?:\.\d+)?)?([½¼¾⅓⅔⅛])?$/);
    if (!m || (!m[1] && !m[2])) return NaN;
    return (m[1] ? parseFloat(m[1]) : 0) + (m[2] ? FRAC[m[2]] : 0);
  }
  function fmt(x) {
    const whole = Math.floor(x + 1e-9), rest = x - whole;
    const opts = [[0, ''], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1, '']];
    const [v, sym] = opts.reduce((a, b) => (Math.abs(b[0] - rest) < Math.abs(a[0] - rest) ? b : a));
    const w = whole + (v === 1 ? 1 : 0);
    return (w || !sym ? String(w) : '') + sym;
  }
  const PLURAL = { dash: 'dashes', barspoon: 'barspoons', cup: 'cups', bottle: 'bottles', leaf: 'leaves', pinch: 'pinches' };
  function scaleAmt(amt, n) {
    const t = (amt || '').trim();
    if (n === 1 || !t || /^top$/i.test(t)) return t;
    if (/^(dash|pinch)( of)?$/i.test(t)) return `${n} ${PLURAL[t.split(' ')[0].toLowerCase()]}`;
    const m = t.match(/^([\d.]*[½¼¾⅓⅔⅛]?)(?:\s*-\s*([\d.]*[½¼¾⅓⅔⅛]?))?\s*(.*)$/);
    const a = m && num(m[1]);
    if (!m || isNaN(a)) return `${t} × ${n}`;
    const b = m[2] ? num(m[2]) * n : null;
    let unit = m[3];
    const top = b || a * n;
    if (top > 1) unit = unit.replace(/^(dash|barspoon|cup|bottle|pinch)\b/i, (u) => PLURAL[u.toLowerCase()]);
    let out = fmt(a * n) + (b ? '-' + fmt(b) : '') + (unit ? ' ' + unit : '');
    if (/^oz$/i.test(unit) && top >= 8) out += ` (about ${fmt(top / 8)} cup${top / 8 > 1 ? 's' : ''})`;
    return out;
  }

  // Returns {ok, swaps:[{need, use}], missing:[ingredient]}
  function check(recipe, have) {
    const swaps = [], missing = [];
    if (!recipe.ingredients.length) return { ok: false, swaps, missing: [{ name: 'Ingredients not entered yet', keys: [] }] };
    for (const ing of recipe.ingredients) {
      if (ing.optional || !ing.keys.length) continue;
      if (ing.keys.some((k) => have.has(k))) continue;
      const sub = ing.keys.flatMap((k) => (SUBS[k] || []).map((s) => [k, s])).find(([, s]) => have.has(s));
      if (sub) { swaps.push({ need: label(sub[0]), use: label(sub[1]) }); continue; }
      missing.push(ing);
    }
    return { ok: missing.length === 0, swaps, missing };
  }

  // ── Router ───────────────────────────────────────────────────────────
  let tab = 'make';
  const ui = { q: '', base: 'All' };

  function go(name) {
    tab = name;
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    $('#barName').textContent = state.barName || 'Artemis Lounge';
    document.body.classList.toggle('big-text', !!state.bigText);
    const v = $('#view');
    ({ make: renderMake, bar: renderBar, menu: renderMenu, shop: renderShop, more: renderMore })[tab](v);
  }

  // ── Make tab ─────────────────────────────────────────────────────────
  function baseOf(r) {
    const b = (r.base || '').split(/[\/,]/)[0].trim();
    return b || 'Other';
  }
  function renderMake(v) {
    const have = stockedKeys();
    const bases = ['All', '★ Favorites', ...new Set(allRecipes().map(baseOf))];
    const q = ui.q.trim().toLowerCase();
    const rows = allRecipes()
      .filter((r) => ui.base === 'All' || (ui.base === '★ Favorites' ? state.favs.includes(r.id) : baseOf(r) === ui.base))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.ingredients.some((i) => i.name.toLowerCase().includes(q)) || (state.rnotes[r.id] || '').toLowerCase().includes(q))
      .map((r) => ({ r, c: check(r, have) }));
    const ready = rows.filter((x) => x.c.ok);
    const close = rows.filter((x) => !x.c.ok && x.c.missing.length === 1 && x.c.missing[0].keys.length);
    const rest = rows.filter((x) => !x.c.ok && !close.includes(x));

    v.innerHTML = `
      <p class="intro">Drinks you can mix with what’s in My Bar. Tap a drink for the full recipe. Zero Proof holds the mocktails.</p>
      <input class="search" id="q" type="search" placeholder="Search drinks, ingredients or your notes" value="${esc(ui.q)}" autocomplete="off">
      <div class="chips">${bases.map((b) => `<button class="chip ${b === ui.base ? 'on' : ''}" data-base="${esc(b)}">${esc(b)}</button>`).join('')}</div>
      ${state.bottles.length ? '' : `<p class="hint">Your bar is empty, so nothing is ready yet. Add bottles under <b>My Bar</b>, or <a href="#" id="guideLink">see how it works</a>.</p>`}
      <h3>Ready to make <span class="count">${ready.length}</span></h3>
      <div class="list">${ready.map(card).join('') || `<div class="empty">${ui.base === '★ Favorites' && !state.favs.length ? 'No favorites yet. Open any recipe and tap the star.' : 'Nothing yet. Add bottles in My Bar.'}</div>`}</div>
      ${close.length ? `<h3>One bottle away <span class="count">${close.length}</span></h3><div class="list">${close.map(card).join('')}</div>` : ''}
      ${rest.length ? `<h3>Everything else <span class="count">${rest.length}</span></h3><div class="list">${rest.map(card).join('')}</div>` : ''}`;

    const qi = $('#q', v);
    qi.addEventListener('input', () => { ui.q = qi.value; const pos = qi.selectionStart; renderMake(v); const n = $('#q', v); n.focus(); n.setSelectionRange(pos, pos); });
    v.querySelectorAll('[data-base]').forEach((b) => b.addEventListener('click', () => { ui.base = b.dataset.base; renderMake(v); }));
    const gl = $('#guideLink', v); if (gl) gl.onclick = (e) => { e.preventDefault(); openGuide(); };
    v.querySelectorAll('[data-recipe]').forEach((b) => b.addEventListener('click', () => openRecipe(b.dataset.recipe)));
  }
  function card({ r, c }) {
    const facts = [r.base, r.glass].filter(Boolean).join(' · ');
    let extra = '';
    if (!c.ok) extra = `<div class="miss">Need: ${esc(c.missing.map((m) => m.keys.length ? label(m.keys[0]) : m.name).join(', '))}</div>`;
    else if (c.swaps.length) extra = `<div class="swap">Using ${esc(c.swaps.map((s) => `${s.use} for ${s.need}`).join(', '))}</div>`;
    const note = state.rnotes[r.id];
    const fav = state.favs.includes(r.id) ? '<span class="fav" aria-label="Favorite">★</span> ' : '';
    const thumb = photoURL[r.id] ? `<img class="thumb" src="${photoURL[r.id]}" alt="">` : '';
    return `<button class="card" data-recipe="${esc(r.id)}"><div class="row"><div class="grow"><div class="title">${fav}${esc(r.name)}${r.custom ? '<span class="pill">yours</span>' : ''}</div><div class="sub">${esc(facts)}</div>${extra}${note ? `<div class="note-line">${esc(note.length > 90 ? note.slice(0, 88) + '…' : note)}</div>` : ''}</div>${thumb}</div></button>`;
  }

  // ── Recipe detail ────────────────────────────────────────────────────
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
      else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { /* not supported */ }
  }

  function openRecipe(id) {
    const r = recipeById(id);
    if (!r) return;
    const have = stockedKeys();
    const c = check(r, have);
    const onMenu = state.menu.ids.includes(r.id);
    const isFav = state.favs.includes(r.id);
    const n = ui.serves || 1;
    const ingHtml = r.ingredients.map((i) => {
      const ok = !i.keys.length || i.keys.some((k) => have.has(k));
      const swap = !ok && c.swaps.find((s) => i.keys.some((k) => label(k) === s.need));
      const cls = i.optional || ok ? 'ok' : swap ? 'ok' : 'no';
      return `<li class="${cls}"><span class="amt">${amtHtml(scaleAmt(i.amt, n))}</span><span>${esc(i.name)}${i.optional ? ' <span class="pill">optional</span>' : ''}${swap ? `<span class="sub-note">Use ${esc(swap.use)}</span>` : ''}</span></li>`;
    }).join('');
    const used = state.bottles.filter((b) => b.key && r.ingredients.some((i) => i.keys.includes(b.key)) && b.level !== 'out');
    const tops = r.ingredients.filter((i) => /^top$/i.test(i.amt) || /soda|tonic|ginger (beer|ale)|cola|champagne|prosecco|sparkling/i.test(i.name)).map((i) => i.name.toLowerCase());
    const shaken = /shake/i.test(r.method || '');
    const batchTip = n > 1 ? [
      tops.length ? `Mix everything except the ${[...new Set(tops)].join(' and ')} ahead of time and keep it cold. Add ${tops.length > 1 ? 'those' : 'that'} to each glass as you serve so the fizz stays.` : 'Mix it ahead of time and keep it cold.',
      shaken ? 'Shaken drinks still need ice and a shake. Shake two drinks at a time from the batch.' : '',
    ].filter(Boolean).join(' ') : '';

    openSheet(`
      <article class="recipe">
        ${photoURL[r.id] ? `<img class="hero" src="${photoURL[r.id]}" alt="${esc(r.name)}">` : ''}
        <div class="row"><h2 class="grow">${esc(r.name)}</h2><button class="star ${isFav ? 'on' : ''}" id="favBtn" aria-pressed="${isFav}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">${isFav ? '★' : '☆'}</button></div>
        <div class="facts">${esc([r.category, r.glass, r.method, r.difficulty].filter(Boolean).join(' · '))}</div>
        <h3>Ingredients ${n > 1 ? `<span class="count">for ${n}</span>` : ''}</h3>
        <div class="serves" role="group" aria-label="How many drinks">${[1, 2, 4, 6, 8, 12].map((k) => `<button class="${k === n ? 'on' : ''}" data-serves="${k}">${k === 1 ? '1 drink' : k}</button>`).join('')}</div>
        <ul class="ings">${ingHtml || '<li>No ingredients entered.</li>'}</ul>
        ${batchTip ? `<p class="hint batch-tip">${esc(batchTip)}</p>` : ''}
        ${r.garnish ? `<h3>Garnish</h3><p class="steps">${esc(r.garnish)}</p>` : ''}
        ${r.steps ? `<h3>How to make it</h3><p class="steps">${esc(r.steps)}</p>` : ''}
        ${r.source ? `<p class="hint">Recipe from ${esc(r.source)}</p>` : ''}
        <label class="field">Your notes, like who loved it or how you tweaked it<textarea id="rNote" placeholder="Maria loved this. Use less syrup next time.">${esc(state.rnotes[r.id] || '')}</textarea></label>
        <div class="btn-row">
          <button class="btn ${onMenu ? '' : 'primary'}" id="menuToggle">${onMenu ? 'Remove from menu' : 'Add to tonight’s menu'}</button>
          <button class="btn" id="share">Share recipe</button>
        </div>
        <div class="btn-row">
          <button class="btn small" id="bigText">${state.bigText ? 'Normal text' : 'Larger text'}</button>
          ${'wakeLock' in navigator ? `<button class="btn small" id="awake">${wakeLock ? 'Let screen sleep' : 'Keep screen on'}</button>` : ''}
          ${c.missing.some((m) => m.keys.length) ? `<button class="btn small" id="addMissing">Add missing to Shop</button>` : ''}
          <button class="btn small" id="photoBtn">${photoURL[r.id] ? 'Change photo' : 'Add photo'}</button>
          ${photoURL[r.id] ? '<button class="btn small" id="photoDel">Remove photo</button>' : ''}
          ${r.custom ? `<button class="btn small danger" id="delRecipe">Delete recipe</button>` : ''}
        </div>
        <input type="file" id="photoIn" accept="image/*" hidden>
        ${used.length ? `<h3>Bottles used. Running low?</h3>${used.map(bottleRow).join('')}` : ''}
      </article>`);

    const body = $('#sheetBody');
    $('#menuToggle', body).onclick = () => {
      const ids = state.menu.ids;
      if (ids.includes(r.id)) ids.splice(ids.indexOf(r.id), 1); else ids.push(r.id);
      save(); toast(ids.includes(r.id) ? 'Added to menu' : 'Removed from menu'); openRecipe(id); render();
    };
    $('#share', body).onclick = () => shareText(r.name, recipeText(r, n));
    $('#favBtn', body).onclick = () => {
      const f = state.favs;
      if (f.includes(r.id)) f.splice(f.indexOf(r.id), 1); else f.push(r.id);
      save(); toast(f.includes(r.id) ? 'Added to favorites' : 'Removed from favorites'); openRecipe(id); render();
    };
    body.querySelectorAll('[data-serves]').forEach((b) => b.addEventListener('click', () => { ui.serves = +b.dataset.serves; openRecipe(id); }));
    $('#rNote', body).addEventListener('change', (e) => {
      const t = e.target.value.trim();
      if (t) state.rnotes[r.id] = t; else delete state.rnotes[r.id];
      save(); render(); toast('Note saved');
    });
    const pin = $('#photoIn', body);
    $('#photoBtn', body).onclick = () => pin.click();
    pin.addEventListener('change', async () => {
      const f = pin.files[0]; if (!f) return;
      try { await setPhoto(r.id, await shrinkImage(f)); toast('Photo saved'); }
      catch (e) { toast('Could not save that photo'); }
      openRecipe(id); render();
    });
    const pd = $('#photoDel', body);
    if (pd) pd.onclick = async () => { if (confirm('Remove this photo?')) { await setPhoto(r.id, null); openRecipe(id); render(); } };
    $('#bigText', body).onclick = () => { state.bigText = !state.bigText; save(); render(); openRecipe(id); };
    const aw = $('#awake', body);
    if (aw) aw.onclick = async () => { await keepAwake(!wakeLock); openRecipe(id); };
    const am = $('#addMissing', body);
    if (am) am.onclick = () => { c.missing.forEach((m) => m.keys.length && addShop(label(m.keys[0]), m.keys[0])); save(); toast('Added to Shop'); };
    const dr = $('#delRecipe', body);
    if (dr) dr.onclick = () => { if (confirm(`Delete ${r.name}?`)) { state.custom = state.custom.filter((x) => x.id !== r.id); state.menu.ids = state.menu.ids.filter((x) => x !== r.id); state.favs = state.favs.filter((x) => x !== r.id); delete state.rnotes[r.id]; if (photoURL[r.id]) setPhoto(r.id, null); save(); closeSheet(); render(); } };
    wireBottleRows(body, () => { openRecipe(id); render(); });
  }

  function amtHtml(a) {
    const k = a.indexOf(' (about ');
    return k < 0 ? esc(a) : `${esc(a.slice(0, k))}<span class="sub-note">${esc(a.slice(k + 2, -1))}</span>`;
  }
  function recipeText(r, n = 1) {
    const lines = [r.name.toUpperCase() + (n > 1 ? ` (for ${n})` : ''), [r.glass, r.method].filter(Boolean).join(' · '), ''];
    r.ingredients.forEach((i) => { const a = scaleAmt(i.amt, n); lines.push(`${a ? a + ' ' : ''}${i.name}${i.optional ? ' (optional)' : ''}`); });
    if (r.garnish) lines.push('', 'Garnish: ' + r.garnish);
    if (r.steps) lines.push('', r.steps);
    return lines.join('\n');
  }
  async function shareText(title, text) {
    try {
      if (navigator.share) { await navigator.share({ title, text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); toast('Copied. Paste it anywhere.'); }
    catch (e) { prompt('Copy this:', text); }
  }

  // ── My Bar tab ───────────────────────────────────────────────────────
  function bottleRow(b) {
    const typeTxt = b.key ? label(b.key) : '<span class="warn">Pick a type so recipes can use it</span>';
    return `<div class="bottle" data-bottle="${esc(b.id)}">
      <div class="row"><div class="grow"><div class="name">${esc(b.name)}</div><div class="meta">${typeTxt}${b.size ? ' · ' + esc(b.size) : ''}</div></div>
      <button class="btn small" data-edit="${esc(b.id)}" aria-label="Edit ${esc(b.name)}">Edit</button></div>
      <div class="levels" role="group" aria-label="Level">${LEVELS.map(([k, t]) => `<button class="${k} ${b.level === k ? 'on' : ''}" data-level="${k}">${t}</button>`).join('')}</div>
    </div>`;
  }
  function wireBottleRows(root, after) {
    root.querySelectorAll('[data-bottle]').forEach((el) => {
      const b = state.bottles.find((x) => x.id === el.dataset.bottle);
      el.querySelectorAll('[data-level]').forEach((btn) => btn.addEventListener('click', () => {
        b.level = btn.dataset.level; save();
        if (b.level === 'low' || b.level === 'out') toast(`${b.name} is on your Shop list`);
        after ? after() : render();
      }));
      const ed = el.querySelector('[data-edit]');
      if (ed) ed.addEventListener('click', () => editBottle(b));
    });
  }

  function barSwitch() {
    return `<div class="seg" role="tablist"><button role="tab" class="${ui.barView !== 'wine' ? 'on' : ''}" data-view="bar">Bottles</button><button role="tab" class="${ui.barView === 'wine' ? 'on' : ''}" data-view="wine">Wine</button></div>`;
  }
  function wireSwitch(v) { v.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { ui.barView = b.dataset.view; render(); })); }

  function renderBar(v) {
    if (ui.barView === 'wine') return renderWine(v);
    const groups = {};
    state.bottles.forEach((b) => { const g = b.key ? groupOf(b.key) : 'Other'; (groups[g] = groups[g] || []).push(b); });
    const untyped = state.bottles.filter((b) => !b.key).length;
    v.innerHTML = `${barSwitch()}
      <div class="btn-row">
        <button class="btn primary" id="scanBtn">Scan a bottle</button>
        <button class="btn" id="addBtn">Add by name</button>
      </div>
      <p class="intro">Everything in your bar. Set each bottle’s level as you use it. <b>Low</b> adds it to Shop. <b>Out</b> stops recipes counting it.</p>
      <p class="hint">Using a Bluetooth barcode scanner? Tap “Scan a bottle”, then scan. The number fills in by itself.</p>
      ${untyped ? `<p class="hint">${untyped} item${untyped > 1 ? 's need' : ' needs'} a type before recipes can count ${untyped > 1 ? 'them' : 'it'}. Tap Edit.</p>` : ''}
      ${state.bottles.length ? '' : `<div class="empty">Your bar is empty. Scan or add your first bottle.<br><br>Moving from another phone? Use <b>More &gt; Restore</b>.</div>`}
      ${GROUP_ORDER.filter((g) => groups[g]).map((g) => `<h3>${esc(g)} <span class="count">${groups[g].length}</span></h3><div class="list">${groups[g].sort((a, b) => a.name.localeCompare(b.name)).map(bottleRow).join('')}</div>`).join('')}`;
    $('#scanBtn', v).onclick = () => openScanner('bar');
    $('#addBtn', v).onclick = () => editBottle(null);
    wireBottleRows(v);
    wireSwitch(v);
  }

  // ── Wine ─────────────────────────────────────────────────────────────
  const WINE_TYPES = ['Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Other'];
  const WINE_GUESS = [
    ['prosecco|champagne|cava|cr[ée]mant|sparkling|brut|spumante', 'Sparkling'],
    ['ros[ée]\\b', 'Rosé'],
    ['port\\b|sauternes|ice wine|moscato|late harvest', 'Dessert'],
    ['chardonnay|sauvignon blanc|pinot gri|riesling|albari|gr[üu]ner|chenin|viognier|gew[üu]rz|vermentino|white', 'White'],
    ['cabernet|merlot|malbec|pinot noir|syrah|shiraz|tempranillo|chianti|zinfandel|sangiovese|grenache|barbera|rioja|bordeaux|ch[âa]teauneuf|gamay|red', 'Red'],
  ];
  function guessWineType(name) {
    const n = (name || '').toLowerCase();
    for (const [pat, t] of WINE_GUESS) if (new RegExp(pat).test(n)) return t;
    return '';
  }
  const stars = (n) => '★★★★★'.slice(0, n || 0) + '☆☆☆☆☆'.slice(0, 5 - (n || 0));

  function wineRow(w) {
    const meta = [w.grape, w.region, w.vintage].filter(Boolean).join(' · ');
    return `<div class="bottle" data-wine="${esc(w.id)}">
      <div class="row"><div class="grow"><div class="name">${esc(w.name)}</div>
        <div class="meta">${esc(meta || w.type || '')}${w.rating ? ` · <span class="gold">${stars(w.rating)}</span>` : ''}</div>
        ${w.pair ? `<div class="meta">Pair with ${esc(w.pair)}</div>` : ''}
        ${w.notes ? `<div class="note-line">${esc(w.notes)}</div>` : ''}</div>
      <button class="btn small" data-wedit="${esc(w.id)}">Edit</button></div>
      ${w.wish
        ? `<div class="btn-row"><button class="btn small primary" data-got="${esc(w.id)}">Got it</button><button class="btn small" data-wshop="${esc(w.id)}">+ Shop list</button></div>${w.where ? `<div class="meta">Where to buy: ${esc(w.where)}</div>` : ''}`
        : `<div class="counter"><button data-wdec="${esc(w.id)}" aria-label="One less bottle">−</button><span>${w.count} bottle${w.count === 1 ? '' : 's'}</span><button data-winc="${esc(w.id)}" aria-label="One more bottle">+</button></div>`}
    </div>`;
  }

  function renderWine(v) {
    const rack = state.wines.filter((w) => !w.wish && w.count > 0);
    const gone = state.wines.filter((w) => !w.wish && !(w.count > 0));
    const wish = state.wines.filter((w) => w.wish);
    const byType = {};
    rack.forEach((w) => { const t = w.type || 'Other'; (byType[t] = byType[t] || []).push(w); });
    const total = rack.reduce((a, w) => a + w.count, 0);
    v.innerHTML = `${barSwitch()}
      <div class="btn-row"><button class="btn primary" id="wScan">Scan a wine</button><button class="btn" id="wAdd">Add a wine</button></div>
      <p class="intro">Your wine rack, a list of wines to try, and a pairing guide. Use + and − as you buy and open bottles. White and sparkling wine here also count for cocktails.</p>
      <button class="btn block" id="wPair">Wine and food pairing guide</button>
      <h3>In your rack <span class="count">${total}</span></h3>
      ${rack.length ? WINE_TYPES.filter((t) => byType[t]).map((t) => `<h3 class="sub-h">${t}</h3><div class="list">${byType[t].sort((a, b) => a.name.localeCompare(b.name)).map(wineRow).join('')}</div>`).join('') : '<p class="hint">No wine yet. Scan or add a bottle.</p>'}
      <h3>Wines to try <span class="count">${wish.length}</span></h3>
      <p class="hint">Heard about a wine you want? Add it here with <b>Add a wine</b> and pick “Want to try”.</p>
      <div class="list">${wish.map(wineRow).join('')}</div>
      ${gone.length ? `<h3>Finished <span class="count">${gone.length}</span></h3><div class="list">${gone.map(wineRow).join('')}</div>` : ''}`;
    wireSwitch(v);
    $('#wScan', v).onclick = () => openScanner('wine');
    $('#wAdd', v).onclick = () => editWine(null);
    $('#wPair', v).onclick = openPairing;
    const find = (id) => state.wines.find((w) => w.id === id);
    v.querySelectorAll('[data-wedit]').forEach((b) => b.addEventListener('click', () => editWine(find(b.dataset.wedit))));
    v.querySelectorAll('[data-winc]').forEach((b) => b.addEventListener('click', () => { find(b.dataset.winc).count++; save(); render(); }));
    v.querySelectorAll('[data-wdec]').forEach((b) => b.addEventListener('click', () => {
      const w = find(b.dataset.wdec); if (w.count <= 0) return;
      w.count--; save(); render();
      if (w.count === 0 && confirm(`That was the last ${w.name}. Add it to your Shop list?`)) { addShop(w.name); save(); toast('Added to Shop'); }
    }));
    v.querySelectorAll('[data-got]').forEach((b) => b.addEventListener('click', () => { const w = find(b.dataset.got); w.wish = false; w.count = Math.max(1, w.count || 0); save(); render(); toast(`${w.name} is in your rack`); }));
    v.querySelectorAll('[data-wshop]').forEach((b) => b.addEventListener('click', () => { addShop(find(b.dataset.wshop).name); save(); toast('Added to Shop'); }));
  }

  function editWine(w, prefill) {
    const isNew = !w;
    const d = w || Object.assign({ id: uid(), name: '', type: '', grape: '', region: '', vintage: '', count: 1, rating: 0, pair: '', notes: '', where: '', barcode: '', wish: false }, prefill || {});
    if (isNew && !d.type) d.type = guessWineType(d.name);
    openSheet(`
      <h2>${isNew ? 'Add a wine' : 'Edit wine'}</h2>
      ${d.barcode ? `<p class="hint">Barcode ${esc(d.barcode)}</p>` : ''}
      <div class="seg"><button class="${d.wish ? '' : 'on'}" data-wish="0">In my rack</button><button class="${d.wish ? 'on' : ''}" data-wish="1">Want to try</button></div>
      <label class="field">Name<input id="wName" value="${esc(d.name)}" placeholder="e.g. Kirkland Asolo Prosecco Superiore" autocomplete="off"></label>
      <label class="field">Type<select id="wType"><option value="">Choose</option>${WINE_TYPES.map((t) => `<option ${t === d.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="field">Grape (optional)<input id="wGrape" value="${esc(d.grape)}" placeholder="Cabernet Sauvignon"></label>
      <div class="row"><label class="field grow">Region (optional)<input id="wRegion" value="${esc(d.region)}" placeholder="Rioja, Spain"></label>
      <label class="field" style="flex:0 0 7em">Vintage<input id="wVintage" inputmode="numeric" value="${esc(d.vintage)}" placeholder="2021"></label></div>
      <label class="field" id="wCountF" ${d.wish ? 'hidden' : ''}>How many bottles<input id="wCount" type="number" min="0" inputmode="numeric" value="${d.count}"></label>
      <label class="field" id="wWhereF" ${d.wish ? '' : 'hidden'}>Where to buy (optional)<input id="wWhere" value="${esc(d.where)}" placeholder="Total Wine, Spec’s, Costco"></label>
      <div class="field">Your rating<div class="rate">${[1, 2, 3, 4, 5].map((k) => `<button data-rate="${k}" class="${k <= d.rating ? 'on' : ''}" aria-label="${k} star${k > 1 ? 's' : ''}">★</button>`).join('')}</div></div>
      <label class="field">Pair with (optional)<input id="wPairIn" value="${esc(d.pair)}" placeholder="Steak frites, baked brie"></label>
      <label class="field">Notes (optional)<textarea id="wNotes" placeholder="Who liked it, where you had it">${esc(d.notes)}</textarea></label>
      <div class="btn-row"><button class="btn primary" id="wSave">${isNew ? 'Save wine' : 'Save'}</button>${isNew ? '' : '<button class="btn danger" id="wDel">Remove</button>'}</div>`);
    const body = $('#sheetBody');
    const typeIn = $('#wType', body), nameIn = $('#wName', body);
    nameIn.addEventListener('input', () => { if (isNew && !typeIn.dataset.touched) typeIn.value = guessWineType(nameIn.value); });
    typeIn.addEventListener('change', () => { typeIn.dataset.touched = '1'; });
    let wish = !!d.wish, rating = d.rating || 0;
    body.querySelectorAll('[data-wish]').forEach((b) => b.addEventListener('click', () => {
      wish = b.dataset.wish === '1';
      body.querySelectorAll('[data-wish]').forEach((x) => x.classList.toggle('on', x === b));
      $('#wCountF', body).hidden = wish; $('#wWhereF', body).hidden = !wish;
    }));
    body.querySelectorAll('[data-rate]').forEach((b) => b.addEventListener('click', () => {
      rating = +b.dataset.rate === rating ? 0 : +b.dataset.rate;
      body.querySelectorAll('[data-rate]').forEach((x) => x.classList.toggle('on', +x.dataset.rate <= rating));
    }));
    if (isNew && !d.name) setTimeout(() => nameIn.focus(), 250);
    $('#wSave', body).onclick = () => {
      const g = (id) => $('#' + id, body).value.trim();
      d.name = g('wName'); if (!d.name) { toast('Give it a name'); return; }
      Object.assign(d, { type: typeIn.value, grape: g('wGrape'), region: g('wRegion'), vintage: g('wVintage'), where: g('wWhere'), pair: g('wPairIn'), notes: g('wNotes'), rating, wish, count: wish ? 0 : Math.max(0, parseInt(g('wCount'), 10) || 0) });
      if (isNew) { d.added = new Date().toISOString().slice(0, 10); state.wines.push(d); }
      if (d.barcode) state.learned[d.barcode] = { name: d.name, wine: true, type: d.type };
      save(); closeSheet(); render(); toast(isNew ? `${d.name} added` : 'Saved');
    };
    const del = $('#wDel', body);
    if (del) del.onclick = () => { if (confirm(`Remove ${d.name}?`)) { state.wines = state.wines.filter((x) => x.id !== d.id); save(); closeSheet(); render(); } };
  }

  function openPairing() {
    const P = window.AL_PAIRING;
    openSheet(`<h2>Wine and food pairing</h2>
      <p class="hint">From the pairing guide in your original spreadsheet.</p>
      <h3>By sauce</h3>
      ${P.sauces.map(([sauce, wines, why, dishes]) => `<div class="pair"><div class="name">${esc(sauce)}</div><div class="gold">${esc(wines)}</div><p>${esc(why)}</p><div class="meta">Try it with ${esc(dishes)}</div></div>`).join('')}
      <h3>Dinner ideas</h3>
      ${P.foods.map(([food, wine, type]) => `<div class="pair"><div class="name">${esc(food)}</div><div class="meta">${esc(wine)} · ${esc(type)}</div></div>`).join('')}
      <h3>Appetizers</h3>
      ${P.apps.map(([app, what, wines]) => `<div class="pair"><div class="name">${esc(app)}</div><p>${esc(what)}</p><div class="gold">${esc(wines)}</div></div>`).join('')}`);
  }

  function typeOptions(selected) {
    const byGroup = {};
    Object.entries(ING).forEach(([k, v]) => { if (!PANTRY.has(k)) (byGroup[v.group] = byGroup[v.group] || []).push([k, v.label]); });
    return `<option value="">Not used in recipes</option>` + GROUP_ORDER.filter((g) => byGroup[g]).map((g) =>
      `<optgroup label="${esc(g)}">${byGroup[g].sort((a, b) => a[1].localeCompare(b[1])).map(([k, l]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${esc(l)}</option>`).join('')}</optgroup>`).join('');
  }

  // Guess the ingredient type from a product name. Word-boundary matches only,
  // so "Original" is never read as gin and "Ginger Beer" never counts as gin.
  const GUESS = [
    ['kahl[uú]a|coffee liqueur', 'coffee-liqueur'], ['chambord|raspberry liqueur', 'raspberry-liqueur'], ['ginger beer', 'ginger-beer'],
    ['ginger ale', null], ['tonic', 'tonic'], ['club soda|soda water|seltzer', 'club-soda'], ['grapefruit soda|squirt|jarritos toronja', 'grapefruit-soda'],
    ['\\bcola\\b|coca-cola|coke|pepsi', 'cola'], ['lime juice', 'lime-juice'], ['lemon juice', 'lemon-juice'], ['pineapple juice', 'pineapple-juice'],
    ['white cranberry', null], ['cranberry', 'cranberry-juice'], ['orgeat', 'orgeat'], ['honey syrup', 'honey-syrup'], ['strawberry syrup', 'strawberry-syrup'],
    ['grenadine', 'grenadine'], ['simple syrup', 'simple-syrup'], ['peach pur', 'peach-puree'], ['orange bitters', 'orange-bitters'], ['angostura', 'angostura'],
    ['olive brine|olive juice', 'olive-brine'], ['heavy cream|whipping cream', 'heavy-cream'], ['espresso', 'espresso'],
    ['prosecco|champagne|cava|cr[ée]mant|sparkling wine|brut', 'sparkling-wine'], ['sauvignon blanc|pinot grigio|dry white', 'dry-white-wine'],
    ['sweet vermouth|rosso', 'sweet-vermouth'], ['dry vermouth|extra dry', 'dry-vermouth'], ['campari', 'campari'],
    ['cointreau|triple sec|grand marnier|orange liqueur', 'triple-sec'], ['chocolate liqueur|cr[eè]me de cacao|godiva', 'chocolate-liqueur'],
    ['lillet', 'lillet-blanc'], ['cherry heering|cherry liqueur', 'cherry-liqueur'], ['b[ée]n[ée]dictine', 'benedictine'], ['maraschino', 'maraschino'],
    ['violette', 'creme-de-violette'], ['amaretto|disaronno', 'amaretto'], ['galliano', 'galliano'], ['cura[cç]ao', 'blue-curacao'], ['limoncello', 'limoncello'],
    ['cassis', 'creme-de-cassis'], ['absinthe', 'absinthe'], ['cognac|brandy|hennessy|r[ée]my', 'cognac'], ['tequila|blanco|silver', 'tequila'],
    ['bourbon', 'bourbon'], ['\\brye\\b', 'rye'], ['dark rum|black rum|gosling|myers', 'dark-rum'], ['gold rum|amber rum', 'gold-rum'],
    ['white rum|light rum|silver rum|superior', 'white-rum'], ['\\brum\\b', 'white-rum'], ['\\bgin\\b', 'gin'], ['vodka', 'vodka'],
  ];
  function guessKey(name) {
    const n = ` ${(name || '').toLowerCase()} `;
    for (const [pat, key] of GUESS) if (new RegExp(pat.startsWith('\\b') ? pat : `\\b(?:${pat})`).test(n)) return key;
    return '';
  }

  function editBottle(b, prefill) {
    const isNew = !b;
    const d = b || Object.assign({ id: uid(), name: '', key: '', level: 'full', barcode: '', size: '', brand: '' }, prefill || {});
    if (isNew && !d.key) d.key = guessKey(d.name);
    openSheet(`
      <h2>${isNew ? 'Add a bottle' : 'Edit bottle'}</h2>
      ${d.barcode ? `<p class="hint">Barcode ${esc(d.barcode)}</p>` : ''}
      <label class="field">Name<input id="bName" value="${esc(d.name)}" placeholder="e.g. Tanqueray London Dry Gin" autocomplete="off"></label>
      <label class="field">What is it? (recipes use this)<select id="bKey">${typeOptions(d.key)}</select></label>
      <label class="field">Size (optional)<input id="bSize" value="${esc(d.size)}" placeholder="750ml"></label>
      <div class="btn-row"><button class="btn primary" id="bSave">${isNew ? 'Add to My Bar' : 'Save'}</button>
      ${isNew ? '' : '<button class="btn danger" id="bDel">Remove</button>'}</div>`);
    const body = $('#sheetBody');
    const nameIn = $('#bName', body), keyIn = $('#bKey', body);
    nameIn.addEventListener('input', () => { if (isNew && !keyIn.dataset.touched) keyIn.value = guessKey(nameIn.value); });
    keyIn.addEventListener('change', () => { keyIn.dataset.touched = '1'; });
    if (isNew && !d.name) setTimeout(() => nameIn.focus(), 250);
    $('#bSave', body).onclick = () => {
      d.name = nameIn.value.trim(); d.key = keyIn.value || null; d.size = $('#bSize', body).value.trim();
      if (!d.name) { toast('Give it a name'); return; }
      if (isNew) { d.added = new Date().toISOString().slice(0, 10); state.bottles.push(d); }
      if (d.barcode) state.learned[d.barcode] = { name: d.name, key: d.key, size: d.size };
      save(); closeSheet(); render(); toast(isNew ? `${d.name} added` : 'Saved');
    };
    const del = $('#bDel', body);
    if (del) del.onclick = () => { if (confirm(`Remove ${d.name} from your bar?`)) { state.bottles = state.bottles.filter((x) => x.id !== d.id); save(); closeSheet(); render(); } };
  }

  // ── Scanning ─────────────────────────────────────────────────────────
  // Only accept a code when its check digit is valid. A wrong check digit was the
  // usual cause of the old app "finding" the wrong product.
  function validCode(code) {
    if (!/^\d+$/.test(code)) return /^[A-Z0-9]{8,14}$/i.test(code); // Amazon-style codes (e.g. X002U45087)
    if (![8, 12, 13, 14].includes(code.length)) return false;
    const digits = code.split('').map(Number);
    const check = digits.pop();
    let sum = 0;
    digits.reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
    return (10 - (sum % 10)) % 10 === check;
  }
  function codeVariants(code) {
    const v = new Set([code]);
    if (code.length === 12) v.add('0' + code);
    if (code.length === 13 && code[0] === '0') v.add(code.slice(1));
    return [...v];
  }

  let stream = null, scanTimer = null;
  function stopCamera() {
    clearInterval(scanTimer); scanTimer = null;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }

  let scanMode = 'bar';
  function openScanner(mode) {
    scanMode = mode === 'wine' ? 'wine' : 'bar';
    openSheet(`
      <h2>${scanMode === 'wine' ? 'Scan a wine' : 'Scan a bottle'}</h2>
      <label class="field">Barcode scanner or type the number<input id="codeIn" inputmode="numeric" autocomplete="off" placeholder="Scan now, or type digits and press Enter"></label>
      <div class="btn-row"><button class="btn primary" id="camBtn">Use phone camera</button><button class="btn" id="nameBtn">No barcode? Add by name</button></div>
      <div id="camArea"></div>
      <p class="hint" id="scanMsg"></p>`, stopCamera);
    const body = $('#sheetBody');
    const codeIn = $('#codeIn', body);
    setTimeout(() => codeIn.focus(), 250);
    codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleCode(codeIn.value.trim()); } });
    $('#camBtn', body).onclick = startCamera;
    $('#nameBtn', body).onclick = () => { stopCamera(); (scanMode === 'wine' ? editWine : editBottle)(null); };
  }

  async function startCamera() {
    const area = $('#camArea'), msg = $('#scanMsg');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = 'This browser cannot open the camera. Type the number instead.'; return; }
    area.innerHTML = '<div class="scanbox"><video playsinline muted></video><div class="aim"></div></div>';
    const video = $('video', area);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } });
    } catch (e) { msg.textContent = 'Camera permission was not given. Type the number instead.'; area.innerHTML = ''; return; }
    video.srcObject = stream; await video.play();
    msg.textContent = 'Hold the barcode inside the gold box.';

    let detect;
    if ('BarcodeDetector' in window) {
      const det = new window.BarcodeDetector({ formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128'] });
      detect = async () => { const r = await det.detect(video); return r[0] && r[0].rawValue; };
    } else {
      // iPhone Safari has no built-in detector, so load ZXing on demand
      try {
        await loadScript('https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js');
        const hints = new Map([[window.ZXing.DecodeHintType.TRY_HARDER, true]]);
        const reader = new window.ZXing.BrowserMultiFormatReader(hints);
        const canvas = document.createElement('canvas');
        detect = async () => {
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          canvas.getContext('2d').drawImage(video, 0, 0);
          try { return reader.decodeFromCanvas(canvas).getText(); } catch (e) { return null; }
        };
      } catch (e) { msg.textContent = 'Could not load the scanner. Type the number instead.'; return; }
    }
    // Require the same valid code twice in a row before accepting it
    let last = null, busy = false;
    scanTimer = setInterval(async () => {
      if (busy || !stream) return; busy = true;
      try {
        const code = await detect();
        if (code && validCode(code)) {
          if (code === last) { stopCamera(); area.innerHTML = ''; handleCode(code); }
          last = code;
        }
      } catch (e) { /* keep trying */ }
      busy = false;
    }, 250);
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  async function handleCode(raw) {
    const code = (raw || '').replace(/\s/g, '');
    const msg = $('#scanMsg');
    if (!code) return;
    if (!validCode(code)) { if (msg) msg.textContent = `“${code}” did not read cleanly. Scan it again.`; const ci = $('#codeIn'); if (ci) { ci.value = ''; ci.focus(); } return; }
    if (scanMode === 'wine') {
      const w = state.wines.find((x) => codeVariants(code).includes(x.barcode));
      if (w) { if (confirm(`${w.name} is already listed. Add one more bottle?`)) { w.wish = false; w.count = (w.count || 0) + 1; save(); closeSheet(); render(); toast(`${w.count} bottles of ${w.name}`); } return; }
    }
    const existing = scanMode === 'bar' && state.bottles.find((b) => codeVariants(code).includes(b.barcode));
    if (existing) {
      if (confirm(`${existing.name} is already in your bar. Add another bottle?`)) {
        state.bottles.push(Object.assign({}, existing, { id: uid(), level: 'full', added: new Date().toISOString().slice(0, 10) }));
        save(); closeSheet(); render(); toast('Added another bottle');
      }
      return;
    }
    for (const c of codeVariants(code)) {
      const hit = state.learned[c] || KNOWN_BARCODES[c];
      if (hit) {
        if (scanMode === 'wine') editWine(null, { barcode: code, name: hit.name, type: hit.type || '' });
        else editBottle(null, { barcode: code, name: hit.name, key: hit.key || '', size: hit.size || '' });
        return;
      }
    }
    if (msg) msg.textContent = 'Looking it up…';
    const found = await lookupOnline(code);
    if (scanMode === 'wine') editWine(null, { barcode: code, name: (found && found.name) || '' });
    else editBottle(null, Object.assign({ barcode: code }, found || {}));
    if (!found) toast('Not found online. Type the name once and it will be remembered.');
  }

  async function lookupOnline(code) {
    const tries = [
      async () => {
        const r = await fetchTimeout(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,quantity`);
        const j = await r.json();
        if (j.status === 1 && j.product && j.product.product_name) return { name: [j.product.brands, j.product.product_name].filter(Boolean).join(' ').trim(), size: j.product.quantity || '' };
      },
      async () => {
        const r = await fetchTimeout(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
        const j = await r.json();
        if (j.items && j.items[0] && j.items[0].title) return { name: j.items[0].title, size: j.items[0].size || '' };
      },
    ];
    for (const t of tries) { try { const x = await t(); if (x) return x; } catch (e) { /* next source */ } }
    return null;
  }
  function fetchTimeout(url, ms = 6000) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    return fetch(url, { signal: ctl.signal }).finally(() => clearTimeout(t));
  }

  // ── Menu tab ─────────────────────────────────────────────────────────
  function guestLine(r) {
    if (state.menu.notes[r.id]) return state.menu.notes[r.id];
    const parts = r.ingredients.filter((i) => !i.optional && i.keys.length && !PANTRY.has(i.keys[0]))
      .map((i) => i.name.replace(/\b(fresh|london dry|green)\b/gi, '').replace(/\s+/g, ' ').trim())
      .map((n) => (/^(Campari|Chambord|Cointreau|Lillet|Galliano|Angostura|DOM|Kahl)/.test(n) ? n : n.toLowerCase()));
    const uniq = [...new Set(parts)];
    const list = uniq.length > 1 ? uniq.slice(0, -1).join(', ') + ' and ' + uniq[uniq.length - 1] : (uniq[0] || '');
    const flute = /flute|wine/i.test(r.glass || '');
    const how = { shake: 'shaken', stir: 'stirred', build: flute ? '' : 'built over ice', muddle: 'muddled' }[(r.method || '').toLowerCase().split(/\s/)[0]] || '';
    const s = list ? list.charAt(0).toUpperCase() + list.slice(1) : r.name;
    return how ? `${s}, ${how}.` : `${s}.`;
  }
  function menuRecipes() { return state.menu.ids.map(recipeById).filter(Boolean); }

  function renderMenu(v) {
    const items = menuRecipes();
    const have = stockedKeys();
    v.innerHTML = `
      <h2>Tonight’s menu</h2>
      <ol class="steps-list">
        <li>Tap <b>Choose drinks</b> and tick the ones you’ll offer.</li>
        <li>Edit what guests read under each drink, if you like.</li>
        <li>Tap <b>Guest link &amp; QR</b> so guests can open it on their phones, or <b>Print menu</b>.</li>
        <li>When a guest picks, tap that drink below to see your recipe.</li>
      </ol>
      <label class="field">Menu title<input id="mTitle" value="${esc(state.menu.title)}"></label>
      <button class="btn block" id="pick">Choose drinks (${items.length})</button>
      ${items.length ? `<div>${items.map((r) => {
        const c = check(r, have);
        return `<div class="menu-item"><button class="card" data-recipe="${esc(r.id)}"><div class="title">${esc(r.name)}</div>${c.ok ? '' : `<div class="miss">Need: ${esc(c.missing.map((m) => m.keys.length ? label(m.keys[0]) : m.name).join(', '))}</div>`}</button>
          <label class="field">What guests read<textarea data-note="${esc(r.id)}">${esc(guestLine(r))}</textarea></label></div>`;
      }).join('')}</div>
      <div class="btn-row"><button class="btn primary" id="shareMenu">Guest link &amp; QR</button><button class="btn" id="printMenu">Print menu</button></div>
      ${items.some((r) => photoURL[r.id]) ? `<label class="check"><input type="checkbox" id="printPhotos" ${state.menu.printPhotos ? 'checked' : ''}><span class="grow">Show drink photos on the printed menu</span></label>` : ''}
      <button class="btn small danger" id="clearMenu">Clear menu</button>` : '<div class="empty">No drinks on the menu yet.</div>'}`;
    $('#mTitle', v).addEventListener('change', (e) => { state.menu.title = e.target.value.trim() || 'Artemis Lounge'; save(); });
    $('#pick', v).onclick = pickDrinks;
    v.querySelectorAll('[data-recipe]').forEach((b) => b.addEventListener('click', () => openRecipe(b.dataset.recipe)));
    v.querySelectorAll('[data-note]').forEach((t) => t.addEventListener('change', () => { state.menu.notes[t.dataset.note] = t.value.trim(); save(); }));
    if (items.length) {
      $('#shareMenu', v).onclick = shareMenu;
      $('#printMenu', v).onclick = printMenu;
      const pp = $('#printPhotos', v); if (pp) pp.onchange = () => { state.menu.printPhotos = pp.checked; save(); };
      $('#clearMenu', v).onclick = () => { if (confirm('Clear the menu?')) { state.menu.ids = []; save(); render(); } };
    }
  }

  function pickDrinks() {
    const have = stockedKeys();
    const rows = allRecipes().map((r) => ({ r, c: check(r, have) })).sort((a, b) => (b.c.ok - a.c.ok) || a.r.name.localeCompare(b.r.name));
    openSheet(`<h2>Choose drinks</h2><p class="hint">Drinks you can make now are listed first.</p>
      ${rows.map(({ r, c }) => `<label class="check"><input type="checkbox" value="${esc(r.id)}" ${state.menu.ids.includes(r.id) ? 'checked' : ''}><span class="grow">${esc(r.name)}${c.ok ? '' : ' <span class="pill">missing items</span>'}</span></label>`).join('')}
      <div class="btn-row"><button class="btn primary" id="done">Done</button></div>`);
    $('#done').onclick = () => {
      state.menu.ids = [...document.querySelectorAll('#sheetBody input[type=checkbox]:checked')].map((i) => i.value);
      save(); closeSheet(); render();
    };
  }

  // The guest menu travels inside the link itself, so guests need no account.
  async function menuLink() {
    const data = { t: state.menu.title, d: menuRecipes().map((r) => (r.zeroProof ? [r.name, guestLine(r), 1] : [r.name, guestLine(r)])) };
    const json = JSON.stringify(data);
    let bytes = new TextEncoder().encode(json), prefix = 'j';
    if ('CompressionStream' in window) {
      try {
        const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        bytes = new Uint8Array(await new Response(cs).arrayBuffer()); prefix = 'z';
      } catch (e) { bytes = new TextEncoder().encode(json); prefix = 'j'; }
    }
    let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
    const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return new URL('menu.html#' + prefix + b64, location.href).href;
  }

  async function makeQR(el, text, size) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js');
    el.innerHTML = '';
    new window.QRCode(el, { text, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.L });
  }

  async function shareMenu() {
    const url = await menuLink();
    openSheet(`<h2>Guest menu</h2><p class="hint">Guests scan this with their phone camera. No app or account needed.</p>
      <div style="text-align:center"><div class="qr" id="qrBox"></div></div>
      <div class="btn-row"><button class="btn primary" id="sendLink">Send link</button><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Preview</a></div>`);
    try { await makeQR($('#qrBox'), url, 240); } catch (e) { $('#qrBox').textContent = 'QR code needs an internet connection.'; }
    $('#sendLink').onclick = () => shareText(state.menu.title, `${state.menu.title}: tonight’s cocktail menu\n${url}`);
  }

  async function printMenu() {
    const url = await menuLink();
    const area = $('#printArea');
    area.innerHTML = `<div class="pmenu"><h1>${esc(state.menu.title)}</h1><div class="orn">✦ ✦ ✦</div>
      ${menuRecipes().map((r) => `<div class="drink">${state.menu.printPhotos && photoURL[r.id] ? `<img class="pphoto" src="${photoURL[r.id]}" alt="">` : ''}<b>${esc(r.name)}${r.zeroProof ? ' <i>zero proof</i>' : ''}</b><span>${esc(guestLine(r))}</span></div>`).join('')}
      <div class="foot">Scan to see this menu on your phone<div id="pqr" style="display:inline-block"></div></div></div>`;
    try { await makeQR($('#pqr'), url, 110); } catch (e) { /* print without QR */ }
    await Promise.all([...area.querySelectorAll('img.pphoto')].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
    setTimeout(() => window.print(), 300);
  }

  // ── Shop tab ─────────────────────────────────────────────────────────
  function addShop(name, key) {
    if (state.shop.some((s) => !s.done && s.name.toLowerCase() === name.toLowerCase())) return;
    state.shop.push({ id: uid(), name, key: key || null, done: false });
  }
  function renderShop(v) {
    const have = stockedKeys();
    const low = state.bottles.filter((b) => b.level === 'low' || b.level === 'out');
    // Which single missing ingredient unlocks the most drinks?
    const unlock = {};
    allRecipes().forEach((r) => {
      const c = check(r, have);
      if (c.missing.length === 1 && c.missing[0].keys.length) { const k = c.missing[0].keys[0]; (unlock[k] = unlock[k] || []).push(r.name); }
    });
    const ideas = Object.entries(unlock).sort((a, b) => b[1].length - a[1].length).slice(0, 10);
    v.innerHTML = `
      <h2>Shopping list</h2>
      <p class="intro">Bottles you marked Low or Out, your own items, and the purchases that would unlock the most drinks.</p>
      <h3>Running low <span class="count">${low.length}</span></h3>
      ${low.length ? low.map((b) => `<div class="check"><span class="grow">${esc(b.name)} <span class="pill">${b.level === 'out' ? 'out' : 'low'}</span></span><button class="btn small" data-restock="${esc(b.id)}">Bought it</button></div>`).join('') : '<p class="hint">Nothing marked Low or Out.</p>'}
      <h3>My list</h3>
      <div class="row"><input class="search grow" id="shopIn" placeholder="Add an item"><button class="btn" id="shopAdd">Add</button></div>
      ${state.shop.map((s) => `<label class="check ${s.done ? 'done' : ''}"><input type="checkbox" data-shop="${esc(s.id)}" ${s.done ? 'checked' : ''}><span class="grow">${esc(s.name)}</span></label>`).join('')}
      ${state.shop.some((s) => s.done) ? '<button class="btn small" id="clearDone">Clear checked items</button>' : ''}
      ${ideas.length ? `<h3>Buy one, unlock more</h3>${ideas.map(([k, names]) => `<div class="check"><span class="grow"><b>${esc(label(k))}</b><br><span class="hint">${esc(names.join(', '))}</span></span><button class="btn small" data-idea="${k}">+ List</button></div>`).join('')}` : ''}
      <div class="btn-row"><button class="btn" id="shareList">Share list</button></div>`;
    v.querySelectorAll('[data-restock]').forEach((b) => b.addEventListener('click', () => { state.bottles.find((x) => x.id === b.dataset.restock).level = 'full'; save(); render(); toast('Marked Full'); }));
    const add = () => { const i = $('#shopIn', v); if (i.value.trim()) { addShop(i.value.trim(), guessKey(i.value) || null); save(); render(); } };
    $('#shopAdd', v).onclick = add;
    $('#shopIn', v).addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    v.querySelectorAll('[data-shop]').forEach((c) => c.addEventListener('change', () => {
      const s = state.shop.find((x) => x.id === c.dataset.shop); s.done = c.checked; save();
      if (s.done && s.key && !state.bottles.some((b) => b.key === s.key && b.level !== 'out') && confirm(`Add ${s.name} to My Bar?`)) {
        state.bottles.push({ id: uid(), name: s.name, key: s.key, level: 'full', barcode: '', size: '', added: new Date().toISOString().slice(0, 10) }); save();
      }
      render();
    }));
    const cd = $('#clearDone', v); if (cd) cd.onclick = () => { state.shop = state.shop.filter((s) => !s.done); save(); render(); };
    v.querySelectorAll('[data-idea]').forEach((b) => b.addEventListener('click', () => { addShop(label(b.dataset.idea), b.dataset.idea); save(); render(); toast('Added'); }));
    $('#shareList', v).onclick = () => {
      const lines = low.map((b) => '• ' + b.name).concat(state.shop.filter((s) => !s.done).map((s) => '• ' + s.name));
      shareText('Shopping list', lines.length ? 'Bar shopping list\n' + lines.join('\n') : 'Nothing on the list.');
    };
  }

  // ── More tab ─────────────────────────────────────────────────────────
  function renderMore(v) {
    v.innerHTML = `
      <h2>More</h2>
      <button class="btn block" id="guideBtn">How to use Artemis Lounge</button>
      <label class="field">Name of your bar<input id="barIn" value="${esc(state.barName)}"></label>
      <h3>Recipes</h3>
      <button class="btn block" id="newRecipe">Add your own recipe</button>
      <h3>Backup</h3>
      <p class="hint">Your bar is saved on this device. Save a backup file now and then, and use it to move to a new phone. The backup includes your drink photos.</p>
      <div class="btn-row"><button class="btn" id="backup">Save backup file</button><button class="btn" id="restore">Restore from file</button></div>
      <input type="file" id="restoreFile" accept="application/json,.json" hidden>
      <h3>Install on your phone</h3>
      <p class="hint">iPhone: tap Share, then “Add to Home Screen”. Android: tap the menu, then “Install app” or “Add to Home screen”.</p>
      <h3>Start over</h3>
      <button class="btn small danger" id="reset">Erase everything on this phone</button>
      <p class="hint" style="margin-top:28px">Artemis Lounge is free to use. Each person’s bar stays on their own phone and is never uploaded.</p>`;
    $('#barIn', v).addEventListener('change', (e) => { state.barName = e.target.value.trim() || 'Artemis Lounge'; save(); render(); });
    $('#newRecipe', v).onclick = editRecipe;
    $('#guideBtn', v).onclick = openGuide;
    $('#backup', v).onclick = backup;
    $('#restore', v).onclick = () => $('#restoreFile', v).click();
    $('#restoreFile', v).addEventListener('change', (e) => restore(e.target.files[0]));
    $('#reset', v).onclick = () => { if (confirm('Erase your bar, menu and list on this phone? Save a backup first if unsure.')) { state = blank(); save(); render(); } };
  }

  async function backup() {
    const data = Object.assign({ app: 'artemis-lounge', version: 1, exported: new Date().toISOString() }, state);
    try { const ph = await photosForBackup(); if (Object.keys(ph).length) data.photos = ph; } catch (e) { /* back up without photos */ }
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Artemis-Lounge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function restore(file) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const d = JSON.parse(fr.result);
        if (d.app !== 'artemis-lounge' || !Array.isArray(d.bottles)) throw new Error('not a backup');
        if (!confirm(`Replace what's on this phone with ${d.bottles.length} bottles from the file?`)) return;
        const photos = d.photos;
        state = Object.assign(blank(), d); delete state.app; delete state.version; delete state.exported; delete state.photos;
        state.menu = Object.assign(blank().menu, state.menu || {});
        save(); await restorePhotos(photos); render(); toast('Restored');
      } catch (e) { toast('That file is not an Artemis Lounge backup'); }
    };
    fr.readAsText(file);
  }

  function editRecipe() {
    openSheet(`<h2>Add a recipe</h2>
      <label class="field">Name<input id="rName"></label>
      <label class="field">Main spirit<input id="rBase" placeholder="Gin"></label>
      <label class="field">Ingredients, one per line with the amount first<textarea id="rIngs" placeholder="2 oz Gin&#10;¾ oz Lime Juice&#10;¾ oz Simple Syrup"></textarea></label>
      <label class="field">Glass<input id="rGlass" placeholder="Coupe"></label>
      <label class="field">Method<select id="rMethod"><option>Shake</option><option>Stir</option><option>Build</option><option>Muddle</option></select></label>
      <label class="field">Garnish<input id="rGarnish"></label>
      <label class="field">How to make it<textarea id="rSteps"></textarea></label>
      <div class="btn-row"><button class="btn primary" id="rSave">Save recipe</button></div>`);
    $('#rSave').onclick = () => {
      const g = (id) => $('#' + id).value.trim();
      if (!g('rName')) { toast('Give it a name'); return; }
      const ingredients = g('rIngs').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const m = l.match(/^((?:[\d.\/½¼¾⅓⅔]+\s*)+(?:oz|ml|cl|dashes|dash|barspoon|tsp|tbsp|cups?)?|top|dash|splash)\s+(.*)$/i);
        const amt = m ? m[1] : '', name = m ? m[2] : l, key = guessKey(name);
        return { amt, name, keys: key ? [key] : [], optional: /optional/i.test(l) };
      });
      state.custom.push({ id: 'my-' + uid(), custom: true, name: g('rName'), base: g('rBase'), category: '', glass: g('rGlass'), method: g('rMethod'), garnish: g('rGarnish'), difficulty: '', steps: g('rSteps'), source: '', ingredients });
      save(); closeSheet(); render(); toast('Recipe saved');
    };
  }

  // ── How-to guide ─────────────────────────────────────────────────────
  const GUIDE = [
    ['🍾', 'Stock your bar', 'Go to <b>My Bar</b> and tap <b>Scan a bottle</b>. Scan with your Bluetooth scanner or the phone camera, or type the barcode number. No barcode? Tap <b>Add by name</b>. Then choose what the bottle is, for example Gin or Coffee Liqueur. That choice is how recipes know you have it.'],
    ['🎚️', 'Keep levels current', 'Every bottle has four buttons: <b>Full</b>, <b>Half</b>, <b>Low</b> and <b>Out</b>. Tap <b>Low</b> when a bottle runs down and it goes on your Shop list. Tap <b>Out</b> when it’s empty and recipes stop counting it.'],
    ['🍸', 'Find a drink', 'The <b>Make</b> tab lists what you can mix right now. Below that, <b>One bottle away</b> shows what a single purchase would unlock. Tap any drink for the full recipe. While you mix, tap <b>Larger text</b> or <b>Keep screen on</b>. Mocktails are under <b>Zero Proof</b>.'],
    ['⭐', 'Make it yours', 'In any recipe, tap the <b>star</b> to save it to <b>★ Favorites</b> on the Make tab. Write notes, like who loved it, and search them later. Tap <b>Add photo</b> to snap a picture of your drink. Hosting a crowd? Pick <b>2, 4, 6, 8 or 12</b> above the ingredients and every amount scales for a batch.'],
    ['🍷', 'Wine', 'In <b>My Bar</b>, tap <b>Wine</b> to see your wine rack. Scan or add bottles, use + and − as you buy and open them, and rate them with stars. Keep a <b>Wines to try</b> list, and open the <b>pairing guide</b> when you plan a meal.'],
    ['📜', 'Host guests', 'Open a drink and tap <b>Add to tonight’s menu</b>, or use <b>Choose drinks</b> on the <b>Menu</b> tab. You can edit the short line guests read. Tap <b>Guest link &amp; QR</b> and guests scan the code with their phone camera, with no app or account. Or tap <b>Print menu</b>. When a guest picks a drink, tap that drink on your Menu tab to see how to make it.'],
    ['🛒', 'Shop', 'The <b>Shop</b> tab lists Low and Out bottles, plus the bottles that would unlock the most new drinks. Tap <b>Bought it</b> after you restock. You can also add your own items and share the list.'],
    ['💾', 'Keep it safe', 'Your bar is saved only in this browser on this device. Now and then, go to <b>More</b> and tap <b>Save backup file</b>. To get one-tap access, add this page to your Home Screen. On iPhone, tap Share, then <b>Add to Home Screen</b>.'],
  ];
  function openGuide() {
    openSheet(`<h2>How Artemis Lounge works</h2>
      ${GUIDE.map(([icon, title, text], i) => `<div class="guide-step"><div class="guide-icon" aria-hidden="true">${icon}</div><div><div class="guide-title">${i + 1}. ${title}</div><p>${text}</p></div></div>`).join('')}
      <div class="btn-row"><button class="btn primary" id="guideDone">${state.bottles.length ? 'Got it' : 'Start with My Bar'}</button></div>`);
    $('#guideDone').onclick = () => { closeSheet(); if (!state.bottles.length) go('bar'); };
    if (!state.seenGuide) { state.seenGuide = true; save(); }
  }

  // ── Sheet ────────────────────────────────────────────────────────────
  let onSheetClose = null;
  function openSheet(html, onClose) {
    if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
    $('#sheetBody').innerHTML = html;
    $('#sheet').hidden = false;
    $('.sheet-panel').scrollTop = 0;
    onSheetClose = onClose || null;
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    document.body.style.overflow = '';
    if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
  }
  document.querySelectorAll('#sheet [data-close]').forEach((el) => el.addEventListener('click', closeSheet));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
  window.addEventListener('afterprint', () => { $('#printArea').innerHTML = ''; });

  // A "#load=..." link carries a whole bar (made from a backup), so a person can
  // move their bar to a phone by tapping one link instead of transferring a file.
  async function loadFromLink() {
    const m = location.hash.match(/^#load=([jz])(.+)$/);
    if (!m) return;
    history.replaceState(null, '', location.pathname);
    try {
      const b64 = m[2].replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
      let bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      if (m[1] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      const d = JSON.parse(new TextDecoder().decode(bytes));
      if (!Array.isArray(d.bottles)) throw new Error('no bottles');
      const msg = state.bottles.length
        ? `Load ${d.bottles.length} bottles? This replaces the ${state.bottles.length} already on this phone.`
        : `Load ${d.bottles.length} bottles into your bar?`;
      if (!confirm(msg)) return;
      state = Object.assign(blank(), d);
      state.menu = Object.assign(blank().menu, d.menu || {});
      save(); render(); toast(`Loaded ${d.bottles.length} bottles`);
    } catch (e) { toast('That load link is incomplete'); }
  }

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    // When a newer version takes over, reload once so the update shows right away
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !window.__reloaded) { window.__reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
  }
  $('#helpBtn').addEventListener('click', openGuide);
  render();
  loadPhotos().then(() => { if (Object.keys(photoURL).length) render(); });
  loadFromLink();
  if (!state.seenGuide && !/^#load=/.test(location.hash)) setTimeout(openGuide, 400);
})();
