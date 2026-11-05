// src/apps/messages/secretCode/gravityPit.js
//
// 暗号墙的"坑"：把 gravityPhysics 的刚体世界接到真实的 DOM 方块上。
// React 只负责外面的壳（工具栏、解码窗、弹层），方块本身由这里直接创建和移动
// （每帧改 transform，不走 React 渲染），所以容器元素里不要放 React 子节点。
//
// 方块的行为：
//   - 大小 = 用过的次数（<5 次小方块，5-8 次宽卡，满 9 次大方块 + 镭射）
//   - 方块从容器顶端一块一块掉下来，互相碰撞、堆叠；落地并且进入视野才开始破译
//   - 点一下：方块跳一下 + onOpen(id)；鼠标直接拖，手机上横向滑动或按住 0.17 秒再拖，
//     纵向滑动仍然是滚动页面；拖动有橡皮筋上限，松手后方块会被甩出去再落回堆里
//   - sync() 只增减有差异的方块，留下的不动，缺口由重力自动补上
//   - 全部静止后循环自动停掉，不空耗电；系统开了"减少动态效果"时不播放掉落，直接摆好
import { createWorld } from './gravityPhysics';
import { cipherHTML, escapeHtml, prefersReducedMotion, scramble } from './secretCodeScramble';

export const HOLO_USES = 9;
const TETHER = 110;
const SPAWN_GAP_MS = 110;

// ---------------------------------------------------------------------------
// 方块的 HTML
// ---------------------------------------------------------------------------

const sizeOf = (used) => (used >= HOLO_USES ? 'big' : used >= 5 ? 'wide' : 'one');

const codeLength = (code) => Array.from(String(code)).length;

// 暗号字符越多，字号缩得越小，免得溢出方块
const fontScale = (code, size) => {
  const n = codeLength(code);
  if (n <= 2) return 1;
  if (size === 'one') return n === 3 ? 0.72 : 0.56;
  return n === 3 ? 0.85 : 0.7;
};

// 字符串 id 没法直接取模，用字符码求个稳定的小数字，决定哪些方块贴胶带
const tapeSeed = (id) => {
  let sum = 0;
  const text = String(id);
  for (let i = 0; i < text.length; i += 1) sum += text.charCodeAt(i);
  return sum % 3;
};

const highlight = (text, query) => {
  const html = escapeHtml(text);
  if (!query) return html;
  const q = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(q, 'gi'), (m) => `<mark>${m}</mark>`);
};

export const materialHTML = (look, inner, holo) =>
  `<span class="sw-mat sw-m-${look.mat}${holo ? ' is-holo' : ''}" style="--fc:${look.color};--fi:${look.ink}">` +
  `<span class="sw-mat__face">${inner}</span></span>`;

const tileHTML = (entry, ctx) => {
  const used = entry.useCount || 0;
  const size = sizeOf(used);
  const holo = used >= HOLO_USES;
  const open = ctx.cracked.has(entry.id);
  const shown = (text) => (open ? highlight(text, ctx.query) : cipherHTML(text));

  const inner =
    (size === 'big' ? '<span class="sw-tile__badge">HOLO</span>' : '') +
    '<span class="sw-tile__lock" aria-hidden="true">ENC</span>' +
    `<b class="sw-tile__code" data-k="code" style="--k:${fontScale(entry.code, size)}">${shown(entry.code)}</b>` +
    (size !== 'one' ? `<span class="sw-tile__m" data-k="m">${shown(entry.meaning)}</span>` : '') +
    `<span class="sw-tile__meta">${used} 次</span>`;

  const tape =
    tapeSeed(entry.id) === 0 && size !== 'big' ? '<span class="sw-tile__tape" aria-hidden="true"></span>' : '';

  return (
    `<button class="sw-tile sw-t-${size}${open ? ' is-open' : ''}" data-act="open" data-crack data-id="${escapeHtml(entry.id)}" type="button" ` +
    `aria-label="${escapeHtml(ctx.folderName)}：${escapeHtml(entry.code)}，${escapeHtml(entry.meaning)}">` +
    materialHTML(ctx.look, inner, holo) +
    tape +
    '</button>'
  );
};

const addTileHTML = () =>
  '<button class="sw-tile sw-t-add" data-act="new" type="button">' +
  '<span class="sw-mat"><span class="sw-mat__face">' +
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
  '<span>新暗号</span></span></span></button>';

const buildElement = (html) => {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  return holder.firstElementChild;
};

// ---------------------------------------------------------------------------
// 控制器
// ---------------------------------------------------------------------------

/**
 * @param {object} options
 * @param {HTMLElement} options.container       放方块的容器（position: relative; overflow: hidden）
 * @param {() => HTMLElement|null} options.getScrollRoot  滚动容器，用来算坑的最小高度和"进入视野"
 * @param {(id: string) => void} options.onOpen  点了一个暗号方块
 * @param {() => void} options.onAdd             点了"新暗号"方块
 * @param {(count: number) => void} options.onOpenedChange  已破译的数量变化
 */
export const createGravityPit = ({ container, getScrollRoot, onOpen, onAdd, onOpenedChange }) => {
  const REDUCED = prefersReducedMotion();

  let world = null;
  let map = {}; // key -> { el, sig, body }
  let queue = [];
  let raf = 0;
  let last = 0;
  let acc = 0;
  let stillFor = 0;
  let nextSpawn = 0;
  let spawnN = 0;
  let spawnWaitedFrom = 0;
  let pending = null;
  let active = null;
  let suppressClick = false;
  let io = null;
  let ro = null;
  let wave = 0;
  let waveTimer = 0;
  let destroyed = false;

  const timers = new Set();
  const later = (fn, ms) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const cracked = new Set();
  const opened = new Set();
  let latestEntries = new Map();
  let latestQuery = '';
  let selectedId = null;

  const vibrate = (pattern) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
  };

  // ---- 破译 ----------------------------------------------------------------

  const reportOpened = () => {
    if (onOpenedChange) onOpenedChange(opened.size);
  };

  const crackEl = (el, delay) => {
    const id = el.dataset.id;
    const entry = latestEntries.get(id);
    if (!entry || cracked.has(id)) return;
    cracked.add(id);
    const codeEl = el.querySelector('[data-k="code"]');
    const meaningEl = el.querySelector('[data-k="m"]');
    const fin = () => {
      el.classList.add('is-open');
      opened.add(id);
      reportOpened();
    };
    scramble(codeEl, entry.code, {
      delay,
      dur: 520,
      html: highlight(entry.code, latestQuery),
      done: meaningEl ? null : fin,
    });
    if (meaningEl) {
      scramble(meaningEl, entry.meaning, {
        delay: delay + 160,
        html: highlight(entry.meaning, latestQuery),
        done: fin,
      });
    }
  };

  const bodyOf = (el) => {
    const rec = el && map[el.dataset.body];
    return rec && rec.body;
  };

  const onSee = (list) => {
    list.forEach((item) => {
      if (!item.isIntersecting) return;
      io.unobserve(item.target);
      item.target.dataset.seen = '1';
      const body = bodyOf(item.target);
      if (!body || !body.landed) return; // 还在半空，落地时再破译
      crackEl(item.target, wave * 90);
      wave += 1;
    });
    window.clearTimeout(waveTimer);
    waveTimer = window.setTimeout(() => {
      wave = 0;
    }, 260);
  };

  const watch = () => {
    if (io) io.disconnect();
    container.querySelectorAll('[data-crack]').forEach((el) => {
      if (cracked.has(el.dataset.id)) return;
      if (io) io.observe(el);
      else el.dataset.seen = '1';
    });
  };

  // ---- 物理循环 ------------------------------------------------------------

  const paint = (b) => {
    if (b.el) {
      b.el.style.transform = `translate(${(b.x - b.hw).toFixed(2)}px,${(b.y - b.hh).toFixed(2)}px) rotate(${b.a.toFixed(4)}rad)`;
    }
  };

  const wake = () => {
    stillFor = 0;
    if (!raf && world && !destroyed) {
      last = 0;
      acc = 0;
      raf = requestAnimationFrame(loop);
    }
  };

  const spawnClear = (x, hw) =>
    world.bodies.every((b) => b.ghost || b.y - b.hh > -6 || Math.abs(b.x - x) > b.hw + hw + 6);

  const spawn = (item) => {
    const size = world.size();
    const span = Math.max(0, size.w - item.w);
    const x = item.w / 2 + ((spawnN++ * 0.618 + 0.13) % 1) * span;
    const angle = (((spawnN * 37) % 11) - 5) * 0.045;
    const body = world.make(x, -item.h / 2 - 8, item.w / 2, item.h / 2, angle, false);
    body.vy = 120;
    body.w = (((spawnN * 53) % 7) - 3) * 0.35;
    body.vx = (((spawnN * 29) % 5) - 2) * 28;
    body.el = item.el;
    body.key = item.key;
    world.add(body);
    map[item.key].body = body;
    paint(body);
    return body;
  };

  const drainQueue = (ts) => {
    if (!queue.length || ts < nextSpawn) return;
    const item = queue[0];
    if (!spawnWaitedFrom) spawnWaitedFrom = ts;
    const size = world.size();
    const span = Math.max(0, size.w - item.w);
    const px = item.w / 2 + ((spawnN * 0.618 + 0.13) % 1) * span;
    // 出口被上一块挡着就等一下，最多等 0.8 秒
    if (!spawnClear(px, item.w / 2) && ts - spawnWaitedFrom < 800) return;
    queue.shift();
    spawnWaitedFrom = 0;
    spawn(item);
    nextSpawn = ts + SPAWN_GAP_MS;
  };

  function loop(ts) {
    raf = 0;
    if (!world || destroyed) return;
    if (!last) last = ts;
    acc += Math.min(0.034, (ts - last) / 1000);
    last = ts;
    drainQueue(ts);
    while (acc >= world.dt) {
      world.step();
      acc -= world.dt;
    }
    world.bodies.forEach(paint);
    if (world.resting() && !queue.length) stillFor += 1;
    else stillFor = 0;
    if (stillFor > 24) {
      world.bodies.forEach((b) => {
        b.vx = 0;
        b.vy = 0;
        b.w = 0;
      });
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  // 撞击时方块轻轻压扁一下
  const squash = (b, speed) => {
    if (REDUCED || !b.el || !b.el.animate) return;
    const now = performance.now();
    if (b.lastHit && now - b.lastHit < 170) return;
    b.lastHit = now;
    const mat = b.el.querySelector('.sw-mat');
    if (!mat) return;
    const k = Math.min(1, (speed - 240) / 800);
    const sx = 1 + 0.055 * k;
    const sy = 1 - 0.085 * k;
    mat.animate(
      [
        { transform: 'scale(1)' },
        { transform: `scale(${sx},${sy})`, offset: 0.3 },
        { transform: 'scale(1)' },
      ],
      { duration: 220 + 70 * k, easing: 'ease-out' }
    );
  };

  // ---- 拖动 ----------------------------------------------------------------

  const pointIn = (ev) => {
    const rect = container.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  };

  const rubber = (d) => TETHER * (1 - Math.exp(-d / TETHER));

  const beginDrag = () => {
    if (!pending || active) return;
    const body = bodyOf(pending.el);
    if (!body) {
      pending = null;
      return;
    }
    window.clearTimeout(pending.hold);
    active = { b: body, ox: pending.x, oy: pending.y, el: pending.el };
    pending = null;
    world.grab(body, active.ox, active.oy);
    active.el.classList.add('is-grab');
    vibrate(5);
    wake();
  };

  const onDown = (ev) => {
    if (ev.button > 0 || !world) return;
    const el = ev.target.closest('[data-body]');
    if (!el) return;
    const p = pointIn(ev);
    pending = { el, x: p.x, y: p.y, cx: ev.clientX, cy: ev.clientY, touch: ev.pointerType === 'touch', hold: 0 };
    if (pending.touch) pending.hold = window.setTimeout(beginDrag, 170);
  };

  const onMove = (ev) => {
    if (pending) {
      const dx = ev.clientX - pending.cx;
      const dy = ev.clientY - pending.cy;
      if (Math.hypot(dx, dy) < 5) return;
      if (!pending.touch || Math.abs(dx) > Math.abs(dy)) {
        beginDrag();
      } else {
        // 手机上纵向滑动：交还给页面滚动
        window.clearTimeout(pending.hold);
        pending = null;
        return;
      }
    }
    if (!active) return;
    const p = pointIn(ev);
    const ax = p.x - active.ox;
    const ay = p.y - active.oy;
    const len = Math.hypot(ax, ay) || 1;
    const k = rubber(len) / len;
    world.moveGrab(active.ox + ax * k, active.oy + ay * k);
    wake();
  };

  const onUp = () => {
    if (pending) {
      window.clearTimeout(pending.hold);
      pending = null;
    }
    if (!active) return;
    active.el.classList.remove('is-grab');
    world.release();
    active = null;
    suppressClick = true;
    later(() => {
      suppressClick = false;
    }, 60);
    wake();
  };

  const onCancel = () => {
    if (pending) {
      window.clearTimeout(pending.hold);
      pending = null;
    }
    if (active) {
      active.el.classList.remove('is-grab');
      world.release();
      active = null;
      wake();
    }
  };

  const onClickCapture = (ev) => {
    if (suppressClick) {
      ev.stopPropagation();
      ev.preventDefault();
      suppressClick = false;
    }
  };

  const onTouchMove = (ev) => {
    if (active) ev.preventDefault();
  };

  const onClick = (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn || !container.contains(btn)) return;
    if (btn.dataset.act === 'open') {
      if (onOpen) onOpen(btn.dataset.id);
    } else if (btn.dataset.act === 'new') {
      if (onAdd) onAdd();
    }
  };

  // ---- 搭建 ----------------------------------------------------------------

  world = createWorld({
    impact: squash,
    land: (b) => {
      if (b.el && b.el.dataset.seen) crackEl(b.el, 0);
    },
  });
  world.setBounds(container.clientWidth, Math.max(container.clientHeight, 300));

  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(onSee, { root: getScrollRoot ? getScrollRoot() : null, threshold: 0.3 });
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  container.addEventListener('pointerdown', onDown);
  container.addEventListener('click', onClickCapture, true);
  container.addEventListener('click', onClick);
  container.addEventListener('touchmove', onTouchMove, { passive: false });

  if (window.ResizeObserver) {
    ro = new ResizeObserver(() => {
      if (!world) return;
      const s = world.size();
      if (Math.abs(container.clientWidth - s.w) > 1) {
        world.setBounds(container.clientWidth, s.h);
        wake();
      }
    });
    ro.observe(container);
  }

  // 减少动态效果时：不播放下落，同步算完再一次性摆好
  const settleNow = () => {
    while (queue.length) {
      spawn(queue.shift());
      for (let i = 0; i < 90; i += 1) world.step();
    }
    for (let j = 0; j < 300; j += 1) world.step();
    world.bodies.forEach((b) => {
      b.vx = 0;
      b.vy = 0;
      b.w = 0;
      paint(b);
    });
  };

  const dropEl = (el) => {
    if (el && el.parentNode) el.remove();
  };

  /**
   * 让容器里的方块和最新数据对齐，只增减有差异的方块。
   * @param {object} data
   * @param {Array} data.entries        要显示的暗号（已按显示顺序排好）
   * @param {object} data.look          { mat, color, ink }
   * @param {string} data.folderName
   * @param {string} data.query         搜索词（用来高亮）
   * @param {string|null} data.selectedId
   * @param {boolean} data.showAdd      要不要显示"新暗号"方块
   */
  const sync = (data) => {
    if (destroyed || !world) return;
    const { entries, look, folderName, query, showAdd } = data;
    latestEntries = new Map(entries.map((e) => [e.id, e]));
    latestQuery = query || '';
    selectedId = data.selectedId || null;

    const W = container.clientWidth;
    const u = W / 4.875;
    const sizes = { one: [u, u], wide: [u * 2.2, u], big: [u * 2.05, u * 2.05] };
    const ctx = { cracked, query: latestQuery, look, folderName };

    const items = entries.map((entry) => {
      const s = sizes[sizeOf(entry.useCount || 0)];
      return {
        key: `e${entry.id}`,
        id: entry.id,
        w: s[0],
        h: s[1],
        html: tileHTML(entry, ctx),
        sig: [entry.code, entry.meaning, entry.useCount || 0, latestQuery, look.mat, look.color, folderName].join('|'),
      };
    });
    if (showAdd) items.push({ key: 'add', id: null, w: u, h: u, html: addTileHTML(), sig: 'add' });

    const want = {};
    items.forEach((it) => {
      want[it.key] = it;
    });

    // 去掉不再需要的
    Object.keys(map).forEach((key) => {
      if (want[key]) return;
      const rec = map[key];
      if (rec.body) {
        world.remove(rec.body);
        if (active && active.b === rec.body) active = null;
      }
      queue = queue.filter((q) => q.key !== key);
      dropEl(rec.el);
      delete map[key];
    });
    [...cracked].forEach((id) => {
      if (!latestEntries.has(id)) cracked.delete(id);
    });
    let removedOpened = false;
    [...opened].forEach((id) => {
      if (!latestEntries.has(id)) {
        opened.delete(id);
        removedOpened = true;
      }
    });

    // 新增和替换
    items.forEach((it) => {
      const rec = map[it.key];
      if (!rec) {
        const el = buildElement(it.html);
        el.dataset.body = it.key;
        el.style.width = `${it.w}px`;
        el.style.height = `${it.h}px`;
        container.appendChild(el);
        map[it.key] = { el, sig: it.sig, body: null };
        queue.push({ key: it.key, el, w: it.w, h: it.h });
      } else if (rec.sig !== it.sig) {
        const fresh = buildElement(it.html);
        fresh.dataset.body = it.key;
        fresh.style.width = `${it.w}px`;
        fresh.style.height = `${it.h}px`;
        if (rec.el.dataset.seen) fresh.dataset.seen = '1';
        fresh.style.transform = rec.el.style.transform;
        rec.el.replaceWith(fresh);
        rec.el = fresh;
        rec.sig = it.sig;
        if (rec.body) rec.body.el = fresh;
        queue.forEach((q) => {
          if (q.key === it.key) q.el = fresh;
        });
      }
      if (it.id) map[it.key].el.classList.toggle('is-sel', selectedId === it.id);
    });

    // 坑的高度：至少铺满可视区，方块多了再往下长
    const root = getScrollRoot ? getScrollRoot() : null;
    let minH = 300;
    if (root) {
      const top =
        container.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
      minH = root.clientHeight - top;
    }
    const area = items.reduce((sum, it) => sum + it.w * it.h, 0);
    const height = Math.max(minH, Math.ceil(area / (W * 0.74)) + 70, 300);
    const size = world.size();
    container.style.height = `${height}px`;
    if (Math.abs(height - size.h) > 0.5 || Math.abs(W - size.w) > 1) world.setBounds(W, height);

    world.bodies.forEach(paint);
    watch();
    if (removedOpened) reportOpened();
    if (REDUCED) settleNow();
    else wake();
  };

  const setSelected = (id) => {
    selectedId = id || null;
    container.querySelectorAll('[data-id]').forEach((el) => {
      el.classList.toggle('is-sel', selectedId !== null && el.dataset.id === selectedId);
    });
  };

  // 被点中的方块立刻破译（不用等进入视野）
  const crackNow = (id) => {
    const rec = map[`e${id}`];
    if (!rec || !rec.el) return;
    if (io) io.unobserve(rec.el);
    rec.el.dataset.seen = '1';
    crackEl(rec.el, 0);
  };

  const hop = (id) => {
    const rec = map[`e${id}`];
    if (!rec || !rec.body || REDUCED) return;
    rec.body.vy -= 300;
    rec.body.w += (rec.body.id % 2 ? 1 : -1) * 1.4;
    wake();
  };

  // 撕掉/搬走：方块被甩飞再淡出，上面的方块塌下来补位
  const fling = (id) => {
    const key = `e${id}`;
    const rec = map[key];
    if (!rec || !rec.body) return false;
    const body = rec.body;
    delete map[key];
    queue = queue.filter((q) => q.key !== key);
    body.ghost = true;
    body.vy = -640;
    body.vx = body.x < world.size().w / 2 ? 320 : -320;
    body.w = 7;
    body.el.classList.add('is-gone');
    if (body.el.animate) {
      body.el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], {
        duration: REDUCED ? 1 : 520,
        fill: 'forwards',
      });
    }
    wake();
    later(() => {
      if (world) world.remove(body);
      dropEl(body.el);
      if (REDUCED && world) settleNow();
      wake();
    }, REDUCED ? 1 : 520);
    return true;
  };

  const shake = () => {
    if (!world) return;
    world.bodies.forEach((b, i) => {
      b.vy -= 520 + ((i * 67) % 260);
      b.vx += (i % 2 ? 1 : -1) * (80 + ((i * 41) % 170));
      b.w += ((i % 3) - 1) * 3;
    });
    wake();
  };

  const destroy = () => {
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
    window.clearTimeout(waveTimer);
    if (pending) window.clearTimeout(pending.hold);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    container.removeEventListener('pointerdown', onDown);
    container.removeEventListener('click', onClickCapture, true);
    container.removeEventListener('click', onClick);
    container.removeEventListener('touchmove', onTouchMove);
    if (io) io.disconnect();
    if (ro) ro.disconnect();
    io = null;
    ro = null;
    world = null;
    map = {};
    queue = [];
    active = null;
    pending = null;
  };

  return { sync, setSelected, crackNow, hop, fling, shake, destroy };
};