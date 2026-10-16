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
  const blank = () => ({ barName: 'Artemis Lounge', bottles: [], learned: {}, custom: [], menu: { title: 'Artemis Lounge', ids: [], notes: {} }, shop: [], bigText: false });
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

  function allRecipes() { return BUILTIN.concat(state.custom); }
  function recipeById(id) { return allRecipes().find((r) => r.id === id); }

  // ── Availability ─────────────────────────────────────────────────────
  // A bottle counts unless it is marked Out. Low still pours.
  function stockedKeys() {
    const s = new Set(PANTRY);
    state.bottles.forEach((b) => { if (b.key && b.level !== 'out') s.add(b.key); });
    return s;
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
    const bases = ['All', ...new Set(allRecipes().map(baseOf))];
    const q = ui.q.trim().toLowerCase();
    const rows = allRecipes()
      .filter((r) => ui.base === 'All' || baseOf(r) === ui.base)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.ingredients.some((i) => i.name.toLowerCase().includes(q)))
      .map((r) => ({ r, c: check(r, have) }));
    const ready = rows.filter((x) => x.c.ok);
    const close = rows.filter((x) => !x.c.ok && x.c.missing.length === 1 && x.c.missing[0].keys.length);
    const rest = rows.filter((x) => !x.c.ok && !close.includes(x));

    v.innerHTML = `
      <input class="search" id="q" type="search" placeholder="Search drinks or ingredients" value="${esc(ui.q)}" autocomplete="off">
      <div class="chips">${bases.map((b) => `<button class="chip ${b === ui.base ? 'on' : ''}" data-base="${esc(b)}">${esc(b)}</button>`).join('')}</div>
      ${state.bottles.length ? '' : `<p class="hint">Add your bottles under <b>My Bar</b> and this page shows what you can make tonight.</p>`}
      <h3>Ready to make <span class="count">${ready.length}</span></h3>
      <div class="list">${ready.map(card).join('') || '<div class="empty">Nothing yet. Add bottles in My Bar.</div>'}</div>
      ${close.length ? `<h3>One bottle away <span class="count">${close.length}</span></h3><div class="list">${close.map(card).join('')}</div>` : ''}
      ${rest.length ? `<h3>Everything else <span class="count">${rest.length}</span></h3><div class="list">${rest.map(card).join('')}</div>` : ''}`;

    const qi = $('#q', v);
    qi.addEventListener('input', () => { ui.q = qi.value; const pos = qi.selectionStart; renderMake(v); const n = $('#q', v); n.focus(); n.setSelectionRange(pos, pos); });
    v.querySelectorAll('[data-base]').forEach((b) => b.addEventListener('click', () => { ui.base = b.dataset.base; renderMake(v); }));
    v.querySelectorAll('[data-recipe]').forEach((b) => b.addEventListener('click', () => openRecipe(b.dataset.recipe)));
  }
  function card({ r, c }) {
    const facts = [r.base, r.glass].filter(Boolean).join(' · ');
    let extra = '';
    if (!c.ok) extra = `<div class="miss">Need: ${esc(c.missing.map((m) => m.keys.length ? label(m.keys[0]) : m.name).join(', '))}</div>`;
    else if (c.swaps.length) extra = `<div class="swap">Using ${esc(c.swaps.map((s) => `${s.use} for ${s.need}`).join(', '))}</div>`;
    return `<button class="card" data-recipe="${esc(r.id)}"><div class="title">${esc(r.name)}${r.custom ? '<span class="pill">yours</span>' : ''}</div><div class="sub">${esc(facts)}</div>${extra}</button>`;
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
    const ingHtml = r.ingredients.map((i) => {
      const ok = !i.keys.length || i.keys.some((k) => have.has(k));
      const swap = !ok && c.swaps.find((s) => i.keys.some((k) => label(k) === s.need));
      const cls = i.optional || ok ? 'ok' : swap ? 'ok' : 'no';
      return `<li class="${cls}"><span class="amt">${esc(i.amt)}</span><span>${esc(i.name)}${i.optional ? ' <span class="pill">optional</span>' : ''}${swap ? `<span class="sub-note">Use ${esc(swap.use)}</span>` : ''}</span></li>`;
    }).join('');
    const used = state.bottles.filter((b) => b.key && r.ingredients.some((i) => i.keys.includes(b.key)) && b.level !== 'out');

    openSheet(`
      <article class="recipe">
        <h2>${esc(r.name)}</h2>
        <div class="facts">${esc([r.category, r.glass, r.method, r.difficulty].filter(Boolean).join(' · '))}</div>
        <h3>Ingredients</h3>
        <ul class="ings">${ingHtml || '<li>No ingredients entered.</li>'}</ul>
        ${r.garnish ? `<h3>Garnish</h3><p class="steps">${esc(r.garnish)}</p>` : ''}
        ${r.steps ? `<h3>How to make it</h3><p class="steps">${esc(r.steps)}</p>` : ''}
        ${r.source ? `<p class="hint">Recipe from ${esc(r.source)}</p>` : ''}
        <div class="btn-row">
          <button class="btn ${onMenu ? '' : 'primary'}" id="menuToggle">${onMenu ? 'Remove from menu' : 'Add to tonight’s menu'}</button>
          <button class="btn" id="share">Share recipe</button>
        </div>
        <div class="btn-row">
          <button class="btn small" id="bigText">${state.bigText ? 'Normal text' : 'Larger text'}</button>
          ${'wakeLock' in navigator ? `<button class="btn small" id="awake">${wakeLock ? 'Let screen sleep' : 'Keep screen on'}</button>` : ''}
          ${c.missing.some((m) => m.keys.length) ? `<button class="btn small" id="addMissing">Add missing to Shop</button>` : ''}
          ${r.custom ? `<button class="btn small danger" id="delRecipe">Delete recipe</button>` : ''}
        </div>
        ${used.length ? `<h3>Bottles used. Running low?</h3>${used.map(bottleRow).join('')}` : ''}
      </article>`);

    const body = $('#sheetBody');
    $('#menuToggle', body).onclick = () => {
      const ids = state.menu.ids;
      if (ids.includes(r.id)) ids.splice(ids.indexOf(r.id), 1); else ids.push(r.id);
      save(); toast(ids.includes(r.id) ? 'Added to menu' : 'Removed from menu'); openRecipe(id); render();
    };
    $('#share', body).onclick = () => shareText(r.name, recipeText(r));
    $('#bigText', body).onclick = () => { state.bigText = !state.bigText; save(); render(); openRecipe(id); };
    const aw = $('#awake', body);
    if (aw) aw.onclick = async () => { await keepAwake(!wakeLock); openRecipe(id); };
    const am = $('#addMissing', body);
    if (am) am.onclick = () => { c.missing.forEach((m) => m.keys.length && addShop(label(m.keys[0]), m.keys[0])); save(); toast('Added to Shop'); };
    const dr = $('#delRecipe', body);
    if (dr) dr.onclick = () => { if (confirm(`Delete ${r.name}?`)) { state.custom = state.custom.filter((x) => x.id !== r.id); state.menu.ids = state.menu.ids.filter((x) => x !== r.id); save(); closeSheet(); render(); } };
    wireBottleRows(body, () => { openRecipe(id); render(); });
  }

  function recipeText(r) {
    const lines = [r.name.toUpperCase(), [r.glass, r.method].filter(Boolean).join(' · '), ''];
    r.ingredients.forEach((i) => lines.push(`${i.amt ? i.amt + ' ' : ''}${i.name}${i.optional ? ' (optional)' : ''}`));
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

  function renderBar(v) {
    const groups = {};
    state.bottles.forEach((b) => { const g = b.key ? groupOf(b.key) : 'Other'; (groups[g] = groups[g] || []).push(b); });
    const untyped = state.bottles.filter((b) => !b.key).length;
    v.innerHTML = `
      <div class="btn-row">
        <button class="btn primary" id="scanBtn">Scan a bottle</button>
        <button class="btn" id="addBtn">Add by name</button>
      </div>
      <p class="hint">A Bluetooth barcode scanner works too. Tap “Scan a bottle” and scan into the box.</p>
      ${untyped ? `<p class="hint">${untyped} item${untyped > 1 ? 's need' : ' needs'} a type before recipes can count ${untyped > 1 ? 'them' : 'it'}. Tap Edit.</p>` : ''}
      ${state.bottles.length ? '' : `<div class="empty">Your bar is empty. Scan or add your first bottle.<br><br>Moving from another phone? Use <b>More &gt; Restore</b>.</div>`}
      ${GROUP_ORDER.filter((g) => groups[g]).map((g) => `<h3>${esc(g)} <span class="count">${groups[g].length}</span></h3><div class="list">${groups[g].sort((a, b) => a.name.localeCompare(b.name)).map(bottleRow).join('')}</div>`).join('')}`;
    $('#scanBtn', v).onclick = openScanner;
    $('#addBtn', v).onclick = () => editBottle(null);
    wireBottleRows(v);
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

  function openScanner() {
    openSheet(`
      <h2>Scan a bottle</h2>
      <label class="field">Barcode scanner or type the number<input id="codeIn" inputmode="numeric" autocomplete="off" placeholder="Scan now, or type digits and press Enter"></label>
      <div class="btn-row"><button class="btn primary" id="camBtn">Use phone camera</button><button class="btn" id="nameBtn">No barcode? Add by name</button></div>
      <div id="camArea"></div>
      <p class="hint" id="scanMsg"></p>`, stopCamera);
    const body = $('#sheetBody');
    const codeIn = $('#codeIn', body);
    setTimeout(() => codeIn.focus(), 250);
    codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleCode(codeIn.value.trim()); } });
    $('#camBtn', body).onclick = startCamera;
    $('#nameBtn', body).onclick = () => { stopCamera(); editBottle(null); };
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
    const existing = state.bottles.find((b) => codeVariants(code).includes(b.barcode));
    if (existing) {
      if (confirm(`${existing.name} is already in your bar. Add another bottle?`)) {
        state.bottles.push(Object.assign({}, existing, { id: uid(), level: 'full', added: new Date().toISOString().slice(0, 10) }));
        save(); closeSheet(); render(); toast('Added another bottle');
      }
      return;
    }
    for (const c of codeVariants(code)) {
      const hit = state.learned[c] || KNOWN_BARCODES[c];
      if (hit) { editBottle(null, { barcode: code, name: hit.name, key: hit.key || '', size: hit.size || '' }); return; }
    }
    if (msg) msg.textContent = 'Looking it up…';
    const found = await lookupOnline(code);
    editBottle(null, Object.assign({ barcode: code }, found || {}));
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
      <p class="hint">Pick drinks, then share a link or QR code guests open on their own phones, or print it. When a guest chooses, tap the drink here to see your recipe.</p>
      <label class="field">Menu title<input id="mTitle" value="${esc(state.menu.title)}"></label>
      <button class="btn block" id="pick">Choose drinks (${items.length})</button>
      ${items.length ? `<div>${items.map((r) => {
        const c = check(r, have);
        return `<div class="menu-item"><button class="card" data-recipe="${esc(r.id)}"><div class="title">${esc(r.name)}</div>${c.ok ? '' : `<div class="miss">Need: ${esc(c.missing.map((m) => m.keys.length ? label(m.keys[0]) : m.name).join(', '))}</div>`}</button>
          <label class="field">What guests read<textarea data-note="${esc(r.id)}">${esc(guestLine(r))}</textarea></label></div>`;
      }).join('')}</div>
      <div class="btn-row"><button class="btn primary" id="shareMenu">Guest link &amp; QR</button><button class="btn" id="printMenu">Print menu</button></div>
      <button class="btn small danger" id="clearMenu">Clear menu</button>` : '<div class="empty">No drinks on the menu yet.</div>'}`;
    $('#mTitle', v).addEventListener('change', (e) => { state.menu.title = e.target.value.trim() || 'Artemis Lounge'; save(); });
    $('#pick', v).onclick = pickDrinks;
    v.querySelectorAll('[data-recipe]').forEach((b) => b.addEventListener('click', () => openRecipe(b.dataset.recipe)));
    v.querySelectorAll('[data-note]').forEach((t) => t.addEventListener('change', () => { state.menu.notes[t.dataset.note] = t.value.trim(); save(); }));
    if (items.length) {
      $('#shareMenu', v).onclick = shareMenu;
      $('#printMenu', v).onclick = printMenu;
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
    const data = { t: state.menu.title, d: menuRecipes().map((r) => [r.name, guestLine(r)]) };
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
      ${menuRecipes().map((r) => `<div class="drink"><b>${esc(r.name)}</b><span>${esc(guestLine(r))}</span></div>`).join('')}
      <div class="foot">Scan to see this menu on your phone<div id="pqr" style="display:inline-block"></div></div></div>`;
    try { await makeQR($('#pqr'), url, 110); } catch (e) { /* print without QR */ }
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
      <label class="field">Name of your bar<input id="barIn" value="${esc(state.barName)}"></label>
      <h3>Recipes</h3>
      <button class="btn block" id="newRecipe">Add your own recipe</button>
      <h3>Backup</h3>
      <p class="hint">Your bar is saved on this phone only. Save a backup file now and then, and use it to move to a new phone.</p>
      <div class="btn-row"><button class="btn" id="backup">Save backup file</button><button class="btn" id="restore">Restore from file</button></div>
      <input type="file" id="restoreFile" accept="application/json,.json" hidden>
      <h3>Install on your phone</h3>
      <p class="hint">iPhone: tap Share, then “Add to Home Screen”. Android: tap the menu, then “Install app” or “Add to Home screen”.</p>
      <h3>Start over</h3>
      <button class="btn small danger" id="reset">Erase everything on this phone</button>
      <p class="hint" style="margin-top:28px">Artemis Lounge is free to use. Each person’s bar stays on their own phone and is never uploaded.</p>`;
    $('#barIn', v).addEventListener('change', (e) => { state.barName = e.target.value.trim() || 'Artemis Lounge'; save(); render(); });
    $('#newRecipe', v).onclick = editRecipe;
    $('#backup', v).onclick = backup;
    $('#restore', v).onclick = () => $('#restoreFile', v).click();
    $('#restoreFile', v).addEventListener('change', (e) => restore(e.target.files[0]));
    $('#reset', v).onclick = () => { if (confirm('Erase your bar, menu and list on this phone? Save a backup first if unsure.')) { state = blank(); save(); render(); } };
  }

  function backup() {
    const data = Object.assign({ app: 'artemis-lounge', version: 1, exported: new Date().toISOString() }, state);
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
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        if (d.app !== 'artemis-lounge' || !Array.isArray(d.bottles)) throw new Error('not a backup');
        if (!confirm(`Replace what's on this phone with ${d.bottles.length} bottles from the file?`)) return;
        state = Object.assign(blank(), d); delete state.app; delete state.version; delete state.exported;
        state.menu = Object.assign(blank().menu, state.menu || {});
        save(); render(); toast('Restored');
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

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
})();
