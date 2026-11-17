(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = null;
  try { params = new URLSearchParams(location.search); } catch (e) {}

  function all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function param(key) { return params ? params.get(key) : null; }

  /* ── theme toggle ── */
  var themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  /* ── research themes, as regions of a 100 x 70 field ──
     Robustness and LLM / VLM are the two main themes. Causality lies inside Robustness and
     LLM / VLM lies inside Generative, so a theme also covers the themes drawn inside it. */
  var FIELD_H = 70;
  var THEMES = {
    'generative': { label: 'Generative', x: 70, y: 41, r: 31,   lx: 80, ly: 62.5, covers: ['llm-vlm'] },
    'robustness': { label: 'Robustness', x: 24, y: 39, r: 44,   lx: 30, ly: 8,    covers: ['causality'], main: true },
    'causality':  { label: 'Causality',  x: 20, y: 47, r: 11.5, lx: 20, ly: 62.5 },
    'llm-vlm':    { label: 'LLM / VLM',  x: 67, y: 33, r: 20,   lx: 67, ly: 22.5, main: true }
  };
  var LABEL_ORDER = ['robustness', 'llm-vlm', 'causality', 'generative'];
  /* where the items of each combination of themes gather */
  var ANCHORS = {
    'robustness': [26, 26],
    'causality': [20, 47],
    'llm-vlm': [76, 38],
    'generative': [85, 51],
    'robustness+llm-vlm': [57.5, 38],
    'robustness+generative': [49, 52]
  };
  var SPREAD = 4.3;      /* spacing of the spiral that seeds each group */
  var MIN_GAP = 5.6;     /* closest two points may sit, in field units */
  var PAD = 2.6;         /* clearance between a point and the edge of a region */
  var GOLDEN = 2.399963;
  var SVGNS = 'http://www.w3.org/2000/svg';

  var items = all('.item[data-themes]');
  var pubRoot = document.getElementById('pub-groups');
  var pubs = all('#pub-groups .pub');          /* in page order, newest first */
  var past = all('.item[data-past]');
  var map = document.getElementById('map');
  var field = document.getElementById('map-field');
  var dotsLayer = document.getElementById('map-dots');
  var readout = document.getElementById('map-readout');
  var clearBtn = document.getElementById('lens-clear');
  var firstBtn = document.getElementById('first-only');
  var dots = [];
  var themeButtons = {};
  var state = { lens: null, view: 'year', firstOnly: false };

  function themesOf(el) {
    return (el.getAttribute('data-themes') || '').split(/\s+/).filter(function (t) { return THEMES[t]; });
  }
  /* true when one of the themes is the given theme or lies inside it */
  function within(themes, key) {
    var cover = [key].concat(THEMES[key].covers || []);
    return themes.some(function (t) { return cover.indexOf(t) !== -1; });
  }
  function inLens(el) { return !state.lens || within(themesOf(el), state.lens); }

  /* ── build the map from the items on the page ── */
  var zones = {};
  if (map && field && dotsLayer && items.length) {
    var clusters = {};
    items.forEach(function (it) {
      var key = themesOf(it).join('+');
      if (!key) return;
      (clusters[key] = clusters[key] || []).push(it);
    });

    /* seed each group on a spiral around its anchor */
    var pts = [];
    Object.keys(clusters).forEach(function (key, g) {
      var keys = key.split('+');
      var anchor = ANCHORS[key];
      if (!anchor) {
        anchor = [0, 0];
        keys.forEach(function (k) { anchor[0] += THEMES[k].x / keys.length; anchor[1] += THEMES[k].y / keys.length; });
      }
      var inside = {};
      Object.keys(THEMES).forEach(function (k) { inside[k] = within(keys, k); });
      clusters[key].forEach(function (it, k) {
        var r = SPREAD * Math.sqrt(k + 0.35);
        var a = k * GOLDEN + g * 1.7;
        pts.push({ item: it, themes: keys, inside: inside, ax: anchor[0], ay: anchor[1],
          x: anchor[0] + r * Math.cos(a), y: anchor[1] + r * Math.sin(a) });
      });
    });
    /* how many items each region holds, and the room its label takes (half width, in field units) */
    var counts = {}, labelHalf = {};
    Object.keys(THEMES).forEach(function (k) {
      counts[k] = items.filter(function (it) { return within(themesOf(it), k); }).length;
      labelHalf[k] = (THEMES[k].label.length + String(counts[k]).length + 1) + 5.5;
    });
    /* push apart any two points that sit too close, keep each near its anchor, inside the regions
       of its themes and outside the others, and clear of the labels */
    for (var step = 0; step < 160; step++) {
      for (var i = 0; i < pts.length; i++) {
        for (var j = i + 1; j < pts.length; j++) {
          var dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
          var dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          if (dist < MIN_GAP) {
            var push = (MIN_GAP - dist) / 2;
            pts[i].x -= dx / dist * push; pts[i].y -= dy / dist * push;
            pts[j].x += dx / dist * push; pts[j].y += dy / dist * push;
          }
        }
      }
      pts.forEach(function (p) {
        p.x += (p.ax - p.x) * 0.03; p.y += (p.ay - p.y) * 0.03;
        Object.keys(THEMES).forEach(function (k) {
          var z = THEMES[k];
          var zx = p.x - z.x, zy = p.y - z.y;
          var d = Math.sqrt(zx * zx + zy * zy) || 0.01;
          var limit = p.inside[k] ? z.r - PAD : z.r + PAD;
          if (p.inside[k] ? d > limit : d < limit) { p.x = z.x + zx / d * limit; p.y = z.y + zy / d * limit; }
        });
        Object.keys(THEMES).forEach(function (k) {
          var z = THEMES[k];
          if (Math.abs(p.x - z.lx) < labelHalf[k] + 1.5 && Math.abs(p.y - z.ly) < 5.2) {
            p.y = z.ly + (z.ly < FIELD_H / 2 ? 5.2 : -5.2);   /* toward the middle of the field */
          }
        });
        p.x = Math.min(Math.max(p.x, 5), 95); p.y = Math.min(Math.max(p.y, 5), FIELD_H - 5);
      });
    }

    /* the regions: a soft fill that fades toward the edge, and a hairline around it */
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 ' + FIELD_H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'map__zones');
    svg.setAttribute('aria-hidden', 'true');
    var defs = document.createElementNS(SVGNS, 'defs');
    svg.appendChild(defs);
    Object.keys(THEMES).forEach(function (key) {
      var z = THEMES[key];
      var grad = document.createElementNS(SVGNS, 'radialGradient');
      grad.setAttribute('id', 'zone-' + key);
      grad.setAttribute('data-theme-key', key);
      grad.setAttribute('class', 'zgrad' + (z.main ? ' zgrad--main' : ''));
      [0, 1].forEach(function (n) {
        var stop = document.createElementNS(SVGNS, 'stop');
        stop.setAttribute('offset', n);
        stop.setAttribute('class', 'zstop zstop--' + n);
        grad.appendChild(stop);
      });
      defs.appendChild(grad);
      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', z.x); c.setAttribute('cy', z.y); c.setAttribute('r', z.r);
      c.setAttribute('fill', 'url(#zone-' + key + ')');
      c.setAttribute('class', 'zone' + (z.main ? ' zone--main' : ''));
      c.setAttribute('data-theme-key', key);
      svg.appendChild(c);
      zones[key] = c;
    });
    field.insertBefore(svg, dotsLayer);

    pts.forEach(function (p, index) {
      var dot = document.createElement('span');
      dot.className = 'dot' + (p.themes.length > 1 ? ' dot--two' : '');
      dot.setAttribute('data-kind', p.item.getAttribute('data-kind'));
      dot.setAttribute('data-for', p.item.id);
      dot.style.setProperty('--x', p.x.toFixed(2) + '%');
      dot.style.setProperty('--y', (p.y / FIELD_H * 100).toFixed(2) + '%');
      dot.style.setProperty('--c', 'var(--' + p.themes[0] + ')');
      if (p.themes[1]) dot.style.setProperty('--c2', 'var(--' + p.themes[1] + ')');
      dot.style.setProperty('--i', index);
      dotsLayer.appendChild(dot);
      var title = p.item.querySelector('.item__title');
      dots.push({ el: dot, item: p.item, themes: p.themes,
        title: title ? title.textContent.trim() : '', short: p.item.getAttribute('data-short') || '' });
    });

    /* theme buttons beside their region, the two main themes first; each counts what its region holds */
    LABEL_ORDER.forEach(function (key) {
      var n = counts[key];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'map__theme' + (THEMES[key].main ? ' map__theme--main' : '');
      b.setAttribute('data-theme-key', key);
      b.style.left = THEMES[key].lx + '%';
      b.style.top = (THEMES[key].ly / FIELD_H * 100) + '%';
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = THEMES[key].label + ' <span>' + n + '</span>';
      b.addEventListener('click', function () { setLens(state.lens === key ? null : key); });
      field.appendChild(b);
      themeButtons[key] = b;
    });

    /* dots: read out the item, link to it, jump on click */
    dots.forEach(function (d) {
      d.el.addEventListener('mouseenter', function () { showTip(d); d.item.classList.add('is-linked'); });
      d.el.addEventListener('mouseleave', function () { hideTip(); d.item.classList.remove('is-linked'); });
      d.el.addEventListener('click', function () {
        if (d.item.hidden) setFirstOnly(false);
        d.item.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        if (history.replaceState) history.replaceState(null, '', '#' + d.item.id);
        flash(d.item);
      });
      d.item.addEventListener('mouseenter', function () { d.el.classList.add('is-linked'); });
      d.item.addEventListener('mouseleave', function () { d.el.classList.remove('is-linked'); });
      d.item.addEventListener('focusin', function () { d.el.classList.add('is-linked'); });
      d.item.addEventListener('focusout', function () { d.el.classList.remove('is-linked'); });
    });

    /* one orchestrated moment: the points start collapsed and spread to their themes */
    map.hidden = false;
    if (!reduceMotion) {
      map.classList.add('is-collapsed');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { map.classList.remove('is-collapsed'); });
      });
    }
  }

  /* ── "Robust to": play the four kinds of shift once, in order, then rest on an overview of all four ── */
  var shiftBox = document.getElementById('shifts');
  if (shiftBox) {
    var shiftPanes = all('.shift', shiftBox), shiftTabs = all('.shifts__tab', shiftBox);
    var overview = shiftBox.querySelector('.shifts__all');
    var CYCLE = 3500, shiftAt = 0, shiftTimer = null, shiftHold = false, autoplay = true;
    var restart = function (el) { el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on'); };
    var showShift = function (i) {          /* i = -1 shows the overview */
      shiftAt = i;
      shiftPanes.forEach(function (p, k) { if (k === i) restart(p); else p.classList.remove('is-on'); });
      if (overview) { if (i < 0) restart(overview); else overview.classList.remove('is-on'); }
      shiftTabs.forEach(function (tb, k) {
        tb.setAttribute('aria-selected', String(k === i));
        if (k === i) restart(tb); else tb.classList.remove('is-on');
      });
      shiftBox.classList.toggle('is-overview', i < 0);
    };
    var schedule = function () {
      clearTimeout(shiftTimer);
      shiftBox.classList.remove('is-auto');
      if (shiftHold || shiftAt < 0 || reduceMotion) return;
      if (autoplay) shiftBox.classList.add('is-auto');
      shiftTimer = setTimeout(function () {
        if (autoplay && shiftAt < shiftPanes.length - 1) showShift(shiftAt + 1);
        else { autoplay = false; showShift(-1); }
        schedule();
      }, CYCLE + (autoplay ? 0 : 1000));
    };
    var pick = function (k) { autoplay = false; showShift(k); schedule(); };
    shiftTabs.forEach(function (tb, k) { tb.addEventListener('click', function () { pick(k); }); });
    all('.ov-tile', shiftBox).forEach(function (b) { b.addEventListener('click', function () { pick(+b.getAttribute('data-show')); }); });
    shiftBox.addEventListener('mouseenter', function () { shiftHold = true; schedule(); });
    shiftBox.addEventListener('mouseleave', function () { shiftHold = false; schedule(); });
    var q = parseInt(param('shift'), 10);
    if (!isNaN(q)) { autoplay = false; showShift(q); }            /* ?shift=k holds one scene (for previews) */
    else if (reduceMotion) { autoplay = false; showShift(-1); }
    else { showShift(0); schedule(); }
  }

  /* the caption doubles as a readout for the point under the cursor */
  function showTip(d) {
    if (!readout || !map) return;
    readout.innerHTML = '';
    var b = document.createElement('b');
    b.textContent = d.short;
    readout.appendChild(b);
    readout.appendChild(document.createTextNode(d.title));
    map.classList.add('is-reading');
  }
  function hideTip() { if (map) map.classList.remove('is-reading'); }

  var flashTimer;
  function flash(el) {
    clearTimeout(flashTimer);
    all('.item.is-linked').forEach(function (n) { n.classList.remove('is-linked'); });
    el.classList.add('is-linked');
    flashTimer = setTimeout(function () { el.classList.remove('is-linked'); }, 1600);
  }

  /* ── what is shown: the theme lens dims, the first-author filter hides ── */
  function applyFilters() {
    pubs.forEach(function (p) { p.hidden = state.firstOnly && !p.hasAttribute('data-first'); });
    if (pubRoot) {
      all('.pubgroup', pubRoot).forEach(function (g) {
        var shown = all('.pub', g).filter(function (p) { return !p.hidden; }).length;
        g.hidden = !shown;
        var n = g.querySelector('.pubgroup__n');
        if (n) n.textContent = shown + (shown === 1 ? ' paper' : ' papers');
      });
    }
    items.forEach(function (it) { it.classList.toggle('is-dim', !inLens(it)); });
    dots.forEach(function (d) { d.el.classList.toggle('is-dim', !inLens(d.item) || d.item.hidden); });
    all('[data-count]').forEach(function (el) {
      var set = el.getAttribute('data-count') === 'past' ? past : pubs;
      var shown = set.filter(function (it) { return !it.hidden && inLens(it); }).length;
      el.textContent = shown === set.length ? String(set.length) : shown + ' of ' + set.length;
    });
  }

  function setLens(key) {
    state.lens = key && THEMES[key] ? key : null;
    if (state.lens) {
      root.setAttribute('data-lens', state.lens);
      root.style.setProperty('--lens', 'var(--' + state.lens + ')');
    } else {
      root.removeAttribute('data-lens');
      root.style.removeProperty('--lens');
    }
    Object.keys(themeButtons).forEach(function (k) {
      var on = !!state.lens && within([k], state.lens);
      themeButtons[k].setAttribute('aria-pressed', String(k === state.lens));
      themeButtons[k].classList.toggle('is-on', on);
      if (zones[k]) zones[k].classList.toggle('is-on', on);
    });
    all('.tag[data-theme]').forEach(function (t) {
      t.setAttribute('aria-pressed', String(t.getAttribute('data-theme') === state.lens));
    });
    if (clearBtn) clearBtn.hidden = !state.lens;
    applyFilters();
  }

  function setFirstOnly(on) {
    state.firstOnly = !!on;
    if (firstBtn) firstBtn.setAttribute('aria-pressed', String(state.firstOnly));
    applyFilters();
  }

  /* ── publications: the same entries, arranged by year or by type ── */
  var TYPES = [
    { key: 'preprint', label: 'Preprint' },
    { key: 'journal', label: 'Journal' },
    { key: 'conference', label: 'Conference' }
  ];
  function rankOf(el) { return parseFloat(el.getAttribute('data-rank')) || 0; }

  function renderPubs() {
    if (!pubRoot || !pubs.length) return;
    var groups = [], index = {};
    function group(key, label) {
      if (!index[key]) { index[key] = { key: key, label: label, list: [] }; groups.push(index[key]); }
      return index[key];
    }
    if (state.view === 'type') {
      TYPES.forEach(function (t) { group(t.key, t.label); });
      pubs.forEach(function (p) {
        var t = p.getAttribute('data-type');
        group(t, t.charAt(0).toUpperCase() + t.slice(1)).list.push(p);
      });
      groups.forEach(function (g) { g.list.sort(function (a, b) { return rankOf(a) - rankOf(b); }); });
    } else {
      pubs.forEach(function (p) { var y = p.getAttribute('data-year'); group(y, y).list.push(p); });
    }
    var frag = document.createDocumentFragment();
    groups.forEach(function (g) {
      if (!g.list.length) return;
      var wrap = document.createElement('div');
      wrap.className = 'pubgroup';
      wrap.id = 'pubgroup-' + g.key.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      var h = document.createElement('h3');
      h.className = 'pubgroup__label' + (/^\d+$/.test(g.label) ? '' : ' pubgroup__label--text');
      h.appendChild(document.createTextNode(g.label + ' '));
      var n = document.createElement('span');
      n.className = 'pubgroup__n';
      h.appendChild(n);
      var ul = document.createElement('ul');
      ul.className = 'items';
      g.list.forEach(function (p) { ul.appendChild(p); });
      wrap.appendChild(h);
      wrap.appendChild(ul);
      frag.appendChild(wrap);
    });
    while (pubRoot.firstChild) pubRoot.removeChild(pubRoot.firstChild);
    pubRoot.appendChild(frag);
    pubRoot.setAttribute('data-view', state.view);
    applyFilters();
  }

  var swapTimer;
  function setView(view, instant) {
    view = view === 'type' ? 'type' : 'year';
    all('.seg [data-view]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === view));
    });
    if (view === state.view) return;
    state.view = view;
    clearTimeout(swapTimer);
    if (instant || reduceMotion || !pubRoot) { if (pubRoot) pubRoot.classList.remove('is-switching'); renderPubs(); return; }
    pubRoot.classList.add('is-switching');
    swapTimer = setTimeout(function () { renderPubs(); pubRoot.classList.remove('is-switching'); }, 160);
  }

  all('.seg [data-view]').forEach(function (b) {
    b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
  });
  if (firstBtn) firstBtn.addEventListener('click', function () { setFirstOnly(!state.firstOnly); });

  all('.tag[data-theme]').forEach(function (t) {
    t.setAttribute('aria-pressed', 'false');
    t.addEventListener('click', function () {
      var key = t.getAttribute('data-theme');
      setLens(state.lens === key ? null : key);
    });
  });
  if (clearBtn) clearBtn.addEventListener('click', function () { setLens(null); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.lens) setLens(null); });

  /* ── the numbers at the top are counted from the publication list ── */
  function countType(type) {
    return pubs.filter(function (p) { return p.getAttribute('data-type') === type; }).length;
  }
  /* whole years since a start month (YYYY-MM), so the number stays current */
  all('[data-since]').forEach(function (el) {
    var p = el.getAttribute('data-since').split('-'), now = new Date();
    var months = (now.getFullYear() - +p[0]) * 12 + (now.getMonth() + 1 - +p[1]);
    if (months > 0) el.textContent = String(Math.floor(months / 12));
  });
  var statEls = all('[data-stat]');
  if (pubs.length) {
    var totals = {
      papers: pubs.length,
      first: pubs.filter(function (p) { return p.hasAttribute('data-first'); }).length,
      journal: countType('journal'),
      conference: countType('conference')
    };
    statEls.forEach(function (el) {
      var v = totals[el.getAttribute('data-stat')];
      if (typeof v === 'number') el.textContent = String(v);
    });
    var inReview = countType('preprint');
    var sub = document.querySelector('[data-stat-sub="papers"]');
    if (sub) sub.textContent = (pubs.length - inReview) + ' published' + (inReview ? ', ' + inReview + ' under review' : '');
  }
  /* count up once: at load for the numbers already on screen, on arrival for the rest.
     A number is only set to zero at the moment its count starts, so none can be left at zero. */
  function countUp(el) {
    var to = parseInt(el.textContent, 10);
    if (!to || el.hasAttribute('data-counted')) return;
    el.setAttribute('data-counted', '');
    el.textContent = '0';
    var duration = 700 + to * 30;
    var start = null;
    var settled = false;
    function tick(now) {
      if (settled) return;
      if (start === null) start = now;
      var k = Math.min((now - start) / duration, 1);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(tick); else settled = true;
    }
    setTimeout(function () { requestAnimationFrame(tick); }, 180);
    setTimeout(function () { if (!settled) { settled = true; el.textContent = String(to); } }, 3000);
  }
  if (!reduceMotion && statEls.length && window.requestAnimationFrame) {
    var viewportH = window.innerHeight || root.clientHeight;
    var offscreen = [];
    statEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < viewportH) countUp(el); else offscreen.push(el);
    });
    if (offscreen.length && 'IntersectionObserver' in window) {
      var statIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          statIO.unobserve(en.target);
          countUp(en.target);
        });
      }, { rootMargin: '0px 0px 15% 0px' });
      offscreen.forEach(function (el) { statIO.observe(el); });
    }
  }

  /* a number leads to the list it counts */
  all('[data-go]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var go = a.getAttribute('data-go');
      var section = document.getElementById('publications');
      if (!section || !pubRoot) return;
      e.preventDefault();
      var byType = go === 'journal' || go === 'conference';
      if (byType) setView('type', true);
      else if (go === 'papers') setView('year', true);
      setFirstOnly(go === 'first');
      var dest = (byType && document.getElementById('pubgroup-' + go)) || section;
      dest.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (history.replaceState) history.replaceState(null, '', '#publications');
    });
  });

  /* ── copy the email address ── */
  all('[data-copy]').forEach(function (btn) {
    var label = btn.getAttribute('aria-label');
    var status = document.getElementById('copy-status');
    var timer;
    function done() {
      btn.classList.add('is-done');
      btn.setAttribute('aria-label', 'Copied');
      if (status) status.textContent = 'Email address copied';
      clearTimeout(timer);
      timer = setTimeout(function () {
        btn.classList.remove('is-done');
        btn.setAttribute('aria-label', label);
        if (status) status.textContent = '';
      }, 1600);
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = btn.getAttribute('data-copy');
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var copied = false;
      try { copied = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      btn.focus();
      if (copied) { done(); return; }
      /* last resort: select the address so it can be copied by hand */
      var link = btn.parentNode && btn.parentNode.querySelector('a');
      if (link && window.getSelection && document.createRange) {
        var range = document.createRange();
        range.selectNodeContents(link);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    btn.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(btn.getAttribute('data-copy')).then(done, fallback);
      } else {
        fallback();
      }
    });
  });

  /* ── first render, then any state asked for in the address ── */
  renderPubs();
  applyFilters();
  if (param('view') === 'type') setView('type', true);
  if (param('first') === '1') setFirstOnly(true);
  if (THEMES[param('lens')]) setLens(param('lens'));

  /* smooth scrolling only after the first paint, so a link to #section opens in place */
  window.addEventListener('load', function () { setTimeout(function () { root.classList.add('is-ready'); }, 300); });

  /* ── current section in the side links ── */
  var links = all('.toc a');
  if (links.length && 'IntersectionObserver' in window) {
    var visible = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      var current = null;
      links.forEach(function (a) {
        var id = a.getAttribute('href').slice(1);
        if (!current && visible[id]) current = id;
      });
      links.forEach(function (a) {
        if (a.getAttribute('href').slice(1) === current) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }, { rootMargin: '-20% 0px -60% 0px' });
    links.forEach(function (a) {
      var sec = document.getElementById(a.getAttribute('href').slice(1));
      if (sec) spy.observe(sec);
    });
  }
})();
