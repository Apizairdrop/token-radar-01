// Token Radar's plain dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail drawer with the model's own
// inputs and the protocol's farm plan, and the live-token set the market already prices. No network:
// every byte it shows is in data.js.
//
// The model in one place, so the page and the board agree: the page recomputes a row from the
// snapshot figures and checks the number board.json carries. The farm plan is the same derivation
// main.ts writes to board.json: category, chains, TVL and age decide the action, the capital, the
// hold and every cost and time. No name is special-cased.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var rows = DATA.rows || [];
  var live = DATA.live || [];
  var model = DATA.model || {};
  var state = { q: '', category: 'all', chain: 'all', scope: 'all', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtFull(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // The model, recomputed in the page from the same figures main.ts used.
  function impliedOf(row) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var extra = Math.max(0, Math.min((row.chains ? row.chains.length : 1) - 1, model.chain_max_extra));
    var chainMult = 1 + model.chain_weight * extra;
    var multiple = row.category_multiple !== undefined ? row.category_multiple : DATA.global_multiple;
    return Math.max(1, Math.round(row.tvl_usd * multiple * growthMult * maturity * chainMult));
  }

  // Farm plan: the same derivation main.ts writes to board.json.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('risk curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('curator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares for the whole season.';
    if (c.indexOf('dex') >= 0 || c.indexOf('liquidity manager') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + " of the yield-bearing asset through " + name + ' on ' + chain + ' and hold it.';
    if (c.indexOf('yield aggregator') >= 0) return 'Deposit $' + capital + " into " + name + "'s top vault on " + chain + ' and leave it compounding.';
    if (c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Deposit $' + capital + " into " + name + "'s main yield strategy on " + chain + ' and keep the position open.';
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0 || c.indexOf('interest rate') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + " into " + name + "'s basis vault on " + chain + ' and keep the position open.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + ', then leave it to resolve.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use it in one app on that chain.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt token.';
    if (c.indexOf('stablecoin') >= 0 || c.indexOf('dual-token') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it.';
    if (c.indexOf('farm') >= 0) return 'Deposit $' + capital + " into " + name + "'s farm on " + chain + ' and harvest the rewards weekly.';
    if (c.indexOf('btc') >= 0 || c.indexOf('anchor') >= 0) return 'Deposit $' + capital + ' of BTC-backed collateral through ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('cedefi') >= 0) return 'Deposit $' + capital + " into " + name + "'s managed strategy on " + chain + ' and keep the shares.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('dex') >= 0 || c.indexOf('liquidity manager') >= 0) return 'Make one swap or add a little liquidity each week.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow or repay a small amount each week so the position stays active.';
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0 || c.indexOf('basis') >= 0) return 'Adjust or close and reopen one small position each week.';
    if (c.indexOf('prediction') >= 0) return 'Place one small market position each week.';
    if (c.indexOf('rwa') >= 0) return 'Check the yield accrual weekly and claim or compound what is due.';
    if (c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0 || c.indexOf('aggregator') >= 0) return 'Harvest or compound the rewards once a week.';
    if (c.indexOf('chain') >= 0 || c.indexOf('bridge') >= 0) return 'Move a small amount across the bridge each week.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Check the staking rewards weekly and restake what is due.';
    return 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.';
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var steps = [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: weeklyFor(p) + ' A steady weekly rhythm counts more than one large deposit.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ];
    return steps.map(function (s) {
      var t = s.text + ' Cost: ' + s.cost + '. Time: ' + s.time + '.';
      if (t.length > 600) t = t.slice(0, 596) + '...';
      return { text: s.text, cost: s.cost, time: s.time, full: t };
    });
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.scope === 'watchlist' && !r.on_watchlist) return false;
      if (state.scope === 'early' && r.on_watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (!r.chains || r.chains.indexOf(state.chain) < 0)) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var dir = state.dir;
    var key = state.sort;
    list.sort(function (a, b) {
      var d = 0;
      if (key === 'implied') d = a.implied_value_usd - b.implied_value_usd;
      else if (key === 'tvl') d = a.tvl_usd - b.tvl_usd;
      else if (key === 'growth') d = (a.change_7d || 0) - (b.change_7d || 0);
      else if (key === 'age') d = (a.age_days || 0) - (b.age_days || 0);
      else if (key === 'rank') d = a.rank - b.rank;
      else if (key === 'name') d = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      else if (key === 'category') d = (a.category || '') < (b.category || '') ? -1 : (a.category || '') > (b.category || '') ? 1 : 0;
      if (d === 0) d = a.rank - b.rank;
      return d * dir;
    });
    return list;
  }

  function renderStats() {
    var top = rows.length ? rows[0] : null;
    var box = document.getElementById('stats');
    box.innerHTML = '';
    var items = [
      [String(DATA.board_size), 'ranked protocols'],
      [String(DATA.watchlist_size), 'on the watchlist'],
      [String(DATA.early_size), 'early finds'],
      [top ? fmtUsd(top.implied_value_usd) : 'n/a', 'top implied value']
    ];
    items.forEach(function (it) {
      box.appendChild(el('div', { class: 'stat' }, el('div', { class: 'n', text: it[0] }), el('div', { class: 'l', text: it[1] })));
    });
  }

  function renderModel() {
    var box = document.getElementById('model');
    var mults = (DATA.category_multiples || []).slice(0, 8);
    var table = el('table', {},
      el('tr', {}, el('th', { text: 'Category' }), el('th', { text: 'Market multiple' }), el('th', { text: 'Live protocols' })));
    mults.forEach(function (m) {
      table.appendChild(el('tr', {},
        el('td', { text: m.category }),
        el('td', { class: 'num', text: m.multiple.toFixed(3) + 'x' }),
        el('td', { class: 'num', text: String(m.samples) })));
    });
    box.appendChild(el('h2', { text: 'How the radar scores — model ' + DATA.model_version }));
    box.appendChild(el('p', { text: 'Implied value = TVL x category multiple x growth x maturity x chains. The category multiple is the median market-cap-to-TVL ratio of the snapshot\u2019s own live-token protocols in that category (global median ' + DATA.global_multiple.toFixed(3) + 'x where a category has too few); growth is the 7-day TVL change clamped to -50%..+100% at 0.60 weight; maturity runs 0.70 for a new protocol to 1.20 at four years; each extra chain adds 2%, at most 10%.' }));
    box.appendChild(el('p', { text: 'No protocol name is special-cased: the same arithmetic scores every row, and the page recomputes each row from the snapshot figures and checks the number the board carries.' }));
    box.appendChild(table);
  }

  function renderMeta() {
    var m = document.getElementById('meta');
    m.innerHTML = '';
    m.appendChild(el('div', {}, 'Snapshot as of ', el('b', { text: DATA.as_of })));
    m.appendChild(el('div', {}, 'Floor ', el('b', { text: fmtUsd(DATA.floor_usd) }), ' · Model ', el('b', { text: DATA.model_version })));
    document.getElementById('source').textContent = DATA.source;
  }

  function renderFilters() {
    var cats = [];
    rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
    cats.sort();
    var cs = document.getElementById('category');
    cs.innerHTML = '';
    cs.appendChild(el('option', { value: 'all', text: 'All categories' }));
    cats.forEach(function (c) { cs.appendChild(el('option', { value: c, text: c })); });
    var chains = [];
    rows.forEach(function (r) { (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); }); });
    chains.sort();
    var ch = document.getElementById('chain');
    ch.innerHTML = '';
    ch.appendChild(el('option', { value: 'all', text: 'All chains' }));
    chains.forEach(function (c) { ch.appendChild(el('option', { value: c, text: c })); });
  }

  function renderTable() {
    var list = filtered();
    var tbody = document.getElementById('rows');
    tbody.innerHTML = '';
    if (list.length === 0) {
      tbody.appendChild(el('tr', {}, el('td', { colspan: '8', class: 'empty', text: 'No protocol matches this filter.' })));
    }
    list.forEach(function (r) {
      var chg = r.change_7d;
      var cls = chg === null || chg === undefined ? 'flat' : chg > 0 ? 'up' : chg < 0 ? 'down' : 'flat';
      var tr = el('tr', { class: state.selected === r.slug ? 'sel' : '', onclick: function () { select(r.slug); } },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', {},
          el('span', { class: 'name', text: r.name }),
          el('span', { class: 'sub', text: r.slug }),
          r.on_watchlist
            ? el('span', { class: 'badge watch', text: 'WATCHLIST' })
            : el('span', { class: 'badge early', text: 'EARLY' })),
        el('td', { text: r.category || '—' }),
        el('td', { text: (r.chains || []).slice(0, 2).join(', ') + ((r.chains || []).length > 2 ? ' +' + ((r.chains || []).length - 2) : '') }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + cls, text: fmtPct(chg) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtUsd(r.implied_value_usd) }));
      tbody.appendChild(tr);
    });
    document.getElementById('count').textContent =
      list.length + ' of ' + rows.length + ' ranked protocols' +
      (state.category !== 'all' ? ' · ' + state.category : '') +
      (state.chain !== 'all' ? ' · ' + state.chain : '') +
      (state.scope !== 'all' ? ' · ' + state.scope : '');
  }

  function renderDetail() {
    var box = document.getElementById('detail');
    var r = null;
    rows.forEach(function (x) { if (x.slug === state.selected) r = x; });
    if (!r) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '';
    var recomputed = impliedOf(r);
    var steps = farmSteps(r);
    box.appendChild(el('button', { class: 'close', text: 'Close', onclick: function () { select(null); } }));
    box.appendChild(el('h2', { text: r.name }));
    box.appendChild(el('p', { class: 'cat', text: (r.category || 'Uncategorized') + ' · ' + (r.chains || []).join(', ') + (r.on_watchlist ? ' · Watchlist' : ' · Early find') }));
    var dl = el('dl', {});
    [['Rank', '#' + r.rank], ['TVL', fmtFull(r.tvl_usd)], ['7-day change', fmtPct(r.change_7d)],
     ['Age', fmtAge(r.age_days)], ['Implied value', fmtFull(r.implied_value_usd)],
     ['Page recompute', fmtFull(recomputed) + (recomputed === r.implied_value_usd ? ' ✓' : ' ≠ board')]]
      .forEach(function (kv) { dl.appendChild(el('dt', { text: kv[0] })); dl.appendChild(el('dd', { text: kv[1] })); });
    box.appendChild(dl);
    box.appendChild(el('h3', { text: 'Why this value' }));
    box.appendChild(el('div', { class: 'formula', text:
      fmtFull(r.tvl_usd) + ' TVL\n× ' + r.category_multiple.toFixed(3) + ' category multiple (' + (r.category || 'global') + ')\n× ' + r.growth_multiplier.toFixed(4) + ' growth\n× ' + r.maturity_multiplier.toFixed(4) + ' maturity\n× ' + r.chain_multiplier.toFixed(4) + ' chains\n= ' + fmtFull(r.implied_value_usd) + ' implied value' }));
    box.appendChild(el('h3', { text: 'Farm plan — 6 steps' }));
    var ol = el('ol', { class: 'steps' });
    steps.forEach(function (s) {
      ol.appendChild(el('li', {}, document.createTextNode(s.text + ' '), el('span', { class: 'cost', text: 'Cost: ' + s.cost + '. Time: ' + s.time + '.' })));
    });
    box.appendChild(ol);
  }

  function renderLive() {
    var box = document.getElementById('live');
    box.appendChild(el('h2', { text: 'Already trading — the market\u2019s own values' }));
    box.appendChild(el('p', { text: 'These protocols already have a token, so the radar shows the market\u2019s own market cap instead of a model value. They are kept apart from the ranked board, and their market-cap-to-TVL ratios are what price each category above.' }));
    var t = el('table', {},
      el('tr', {}, el('th', { text: 'Protocol' }), el('th', { text: 'Category' }), el('th', { text: 'TVL' }), el('th', { text: 'Market cap' }), el('th', { text: 'MCap / TVL' })));
    live.forEach(function (p) {
      t.appendChild(el('tr', {},
        el('td', { text: p.name }),
        el('td', { text: p.category || '—' }),
        el('td', { class: 'num', text: fmtUsd(p.tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(p.mcap_usd) }),
        el('td', { class: 'num', text: p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + 'x' : 'n/a' })));
    });
    box.appendChild(t);
  }

  function select(slug) {
    state.selected = slug;
    renderTable();
    renderDetail();
  }

  function readShot() {
    var params = new URLSearchParams(window.location.search);
    var shot = params.get('shot');
    if (!shot) return;
    if (shot === 'filtered' && params.get('category')) {
      state.category = params.get('category');
      var cs = document.getElementById('category');
      if (cs) cs.value = state.category;
    }
    if (shot === 'detail' && params.get('slug')) {
      state.selected = params.get('slug');
      setTimeout(function () {
        var d = document.getElementById('detail');
        if (d) d.scrollIntoView({ block: 'start' });
      }, 50);
    }
  }

  function bind() {
    document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; renderTable(); });
    document.getElementById('category').addEventListener('change', function (e) { state.category = e.target.value; renderTable(); });
    document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderTable(); });
    document.getElementById('scope').addEventListener('change', function (e) { state.scope = e.target.value; renderTable(); });
    document.getElementById('sort').addEventListener('change', function (e) {
      var v = e.target.value;
      state.sort = v;
      state.dir = (v === 'name' || v === 'category' || v === 'rank') ? 1 : -1;
      renderTable();
    });
    document.querySelectorAll('#table th[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-sort');
        if (state.sort === k) state.dir = -state.dir;
        else { state.sort = k; state.dir = k === 'name' || k === 'category' ? 1 : -1; }
        renderTable();
      });
    });
  }

  renderMeta();
  renderStats();
  renderModel();
  renderFilters();
  readShot();
  bind();
  renderTable();
  renderDetail();
  renderLive();
  document.getElementById('board').setAttribute('aria-busy', 'false');
  window.__shotReady = true;
})();
