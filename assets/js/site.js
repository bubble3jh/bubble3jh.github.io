(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── theme toggle ── */
  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  /* ── research themes: centroids of Fig. 1 in a 100 x 64 field ── */
  var FIELD_H = 70;
  var THEMES = {
    'robustness': { label: 'Robustness', x: 37, y: 29, lx: 37, ly: 8 },
    'llm-vlm':    { label: 'LLM / VLM',  x: 80, y: 25, lx: 80, ly: 8 },
    'generative': { label: 'Generative', x: 19, y: 49, lx: 19, ly: 62.5 },
    'causality':  { label: 'Causality',  x: 66, y: 47, lx: 66, ly: 62.5 }
  };
  var SPREAD = 4.3;      /* spacing of the spiral that seeds each cluster */
  var MIN_GAP = 5.6;     /* closest two points may sit, in field units */
  var GOLDEN = 2.399963;
  var SVGNS = 'http://www.w3.org/2000/svg';

  var items = Array.prototype.slice.call(document.querySelectorAll('.item[data-themes]'));
  var map = document.getElementById('map');
  var field = document.getElementById('map-field');
  var dotsLayer = document.getElementById('map-dots');
  var readout = document.getElementById('map-readout');
  var clearBtn = document.getElementById('lens-clear');
  var dots = [];
  var themeButtons = {};
  var lens = null;

  function themesOf(el) {
    return (el.getAttribute('data-themes') || '').split(/\s+/).filter(function (t) { return THEMES[t]; });
  }

  /* section counts */
  var totals = {};
  items.forEach(function (it) {
    var k = it.getAttribute('data-kind');
    totals[k] = (totals[k] || 0) + 1;
  });
  function renderCounts() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-count]'), function (el) {
      var kind = el.getAttribute('data-count');
      var total = totals[kind] || 0;
      if (!lens) { el.textContent = total; return; }
      var shown = items.filter(function (it) {
        return it.getAttribute('data-kind') === kind && themesOf(it).indexOf(lens) !== -1;
      }).length;
      el.textContent = shown + ' of ' + total;
    });
  }

  /* ── build Fig. 1 from the items on the page ── */
  if (map && field && dotsLayer && items.length) {
    var groups = {};
    items.forEach(function (it) {
      var key = themesOf(it).join('+');
      if (!key) return;
      (groups[key] = groups[key] || []).push(it);
    });

    /* seed each group on a spiral around the mean of its themes */
    var pts = [];
    Object.keys(groups).forEach(function (key, g) {
      var keys = key.split('+');
      var cx = 0, cy = 0;
      keys.forEach(function (k) { cx += THEMES[k].x; cy += THEMES[k].y; });
      cx /= keys.length; cy /= keys.length;
      groups[key].forEach(function (it, k) {
        var r = SPREAD * Math.sqrt(k + 0.35);
        var a = k * GOLDEN + g * 1.7;
        pts.push({ item: it, themes: keys, ax: cx, ay: cy, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      });
    });
    /* push apart any two points that sit too close, keeping each near its anchor */
    for (var step = 0; step < 80; step++) {
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
        p.x = Math.min(Math.max(p.x, 6), 94); p.y = Math.min(Math.max(p.y, 16.5), 55.5);
      });
    }

    /* density rings behind each theme; the radius grows with the number of items */
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 ' + FIELD_H);
    svg.setAttribute('class', 'map__rings');
    svg.setAttribute('aria-hidden', 'true');
    Object.keys(THEMES).forEach(function (key) {
      var n = items.filter(function (it) { return themesOf(it).indexOf(key) !== -1; }).length;
      var base = 5 + 1.9 * Math.sqrt(n);
      [1, 1.62, 2.3].forEach(function (m, ring) {
        var c = document.createElementNS(SVGNS, 'circle');
        c.setAttribute('cx', THEMES[key].x); c.setAttribute('cy', THEMES[key].y);
        c.setAttribute('r', (base * m).toFixed(2));
        c.setAttribute('class', 'ring ring--' + ring);
        c.setAttribute('data-theme-key', key);
        svg.appendChild(c);
      });
    });
    field.insertBefore(svg, dotsLayer);

    pts.forEach(function (p, index) {
      var dot = document.createElement('span');
      dot.className = 'dot' + (p.themes.length > 1 ? ' dot--two' : '');
      dot.setAttribute('data-kind', p.item.getAttribute('data-kind'));
      dot.style.setProperty('--x', p.x.toFixed(2) + '%');
      dot.style.setProperty('--y', (p.y / FIELD_H * 100).toFixed(2) + '%');
      dot.style.setProperty('--c', 'var(--' + p.themes[0] + ')');
      if (p.themes[1]) dot.style.setProperty('--c2', 'var(--' + p.themes[1] + ')');
      dot.style.setProperty('--i', index);
      dotsLayer.appendChild(dot);
      var title = p.item.querySelector('.item__title');
      dots.push({ el: dot, item: p.item, themes: p.themes, x: p.x, y: p.y,
        title: title ? title.textContent.trim() : '', short: p.item.getAttribute('data-short') || '' });
    });

    /* theme buttons, set beside their cluster, with counts */
    Object.keys(THEMES).forEach(function (key) {
      var n = items.filter(function (it) { return themesOf(it).indexOf(key) !== -1; }).length;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'map__theme';
      b.setAttribute('data-theme-key', key);
      b.style.left = THEMES[key].lx + '%';
      b.style.top = (THEMES[key].ly / FIELD_H * 100) + '%';
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = THEMES[key].label + ' <span>' + n + '</span>';
      b.addEventListener('click', function () { setLens(lens === key ? null : key); });
      field.appendChild(b);
      themeButtons[key] = b;
    });

    /* dots: tooltip, link to the item, jump on click */
    dots.forEach(function (d) {
      d.el.addEventListener('mouseenter', function () { showTip(d); d.item.classList.add('is-linked'); });
      d.el.addEventListener('mouseleave', function () { hideTip(); d.item.classList.remove('is-linked'); });
      d.el.addEventListener('click', function () {
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
    Array.prototype.forEach.call(document.querySelectorAll('.item.is-linked'), function (n) { n.classList.remove('is-linked'); });
    el.classList.add('is-linked');
    flashTimer = setTimeout(function () { el.classList.remove('is-linked'); }, 1600);
  }

  /* ── theme lens: bring one theme forward, dim the rest ── */
  function setLens(key) {
    lens = key && THEMES[key] ? key : null;
    if (lens) {
      root.setAttribute('data-lens', lens);
      root.style.setProperty('--lens', 'var(--' + lens + ')');
    } else {
      root.removeAttribute('data-lens');
      root.style.removeProperty('--lens');
    }
    items.forEach(function (it) {
      it.classList.toggle('is-dim', !!lens && themesOf(it).indexOf(lens) === -1);
    });
    dots.forEach(function (d) {
      d.el.classList.toggle('is-dim', !!lens && d.themes.indexOf(lens) === -1);
    });
    Object.keys(themeButtons).forEach(function (k) {
      themeButtons[k].setAttribute('aria-pressed', String(k === lens));
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tag[data-theme]'), function (t) {
      t.setAttribute('aria-pressed', String(t.getAttribute('data-theme') === lens));
    });
    if (clearBtn) clearBtn.hidden = !lens;
    renderCounts();
  }

  Array.prototype.forEach.call(document.querySelectorAll('.tag[data-theme]'), function (t) {
    t.setAttribute('aria-pressed', 'false');
    t.addEventListener('click', function () {
      var key = t.getAttribute('data-theme');
      setLens(lens === key ? null : key);
    });
  });
  if (clearBtn) clearBtn.addEventListener('click', function () { setLens(null); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && lens) setLens(null); });

  renderCounts();
  try {
    var q = new URLSearchParams(location.search).get('lens');
    if (q && THEMES[q]) setLens(q);
  } catch (e) {}

  /* smooth scrolling only after the first paint, so a link to #section opens in place */
  window.addEventListener('load', function () { setTimeout(function () { root.classList.add('is-ready'); }, 300); });

  /* ── current section in the side links ── */
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  if (links.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var visible = {};
    var io = new IntersectionObserver(function (entries) {
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
    Object.keys(byId).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) io.observe(sec);
    });
  }
})();
