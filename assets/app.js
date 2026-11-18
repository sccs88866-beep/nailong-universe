/* 奶龙宇宙 · 外壳：存档、奶龙币、强化卡、商店、路由、音效、覆盖层 */
(function () {
  'use strict';

  const MiniGames = (window.MiniGames = window.MiniGames || {});
  MiniGames.list = [];
  MiniGames.register = function (def) { MiniGames.list.push(def); };

  /* ================= 存档 ================= */
  const SAVE_KEY = 'beanverse.save.v1';
  const SOUND_KEY = 'beanverse.sound.v1';

  const Save = {
    data: { coins: 0, bests: {}, owned: [], title: '', buffs: {}, storySeen: false },
    load() {
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (err) { raw = null; }
      if (raw && typeof raw === 'object') {
        this.data.coins = Number(raw.coins) || 0;
        this.data.bests = raw.bests && typeof raw.bests === 'object' ? raw.bests : {};
        this.data.owned = Array.isArray(raw.owned) ? raw.owned : [];
        this.data.title = typeof raw.title === 'string' ? raw.title : '';
        this.data.buffs = raw.buffs && typeof raw.buffs === 'object' ? raw.buffs : {};
        this.data.storySeen = Boolean(raw.storySeen);
      }
      return this.data;
    },
    flush() {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (err) { /* ignore */ }
    },
    addCoins(n) {
      this.data.coins = Math.max(0, this.data.coins + n);
      this.flush();
      paintCoins();
    },
    spend(n) {
      if (this.data.coins < n) return false;
      this.data.coins -= n;
      this.flush();
      paintCoins();
      return true;
    },
    owns(id) { return this.data.owned.indexOf(id) !== -1; },
    claim(item) {
      if (this.owns(item.id)) return;
      this.data.owned.push(item.id);
      if (item.kind === 'title') this.data.title = item.title;
      this.flush();
    },
    equip(item) {
      if (item.kind !== 'title' || !this.owns(item.id)) return;
      this.data.title = item.title;
      this.flush();
    },
    title() { return this.data.title || '无名奶龙'; },
    best(id) { return Number(this.data.bests[id]) || 0; },
    setBest(id, score) {
      if (score > this.best(id)) {
        this.data.bests[id] = score;
        this.flush();
        return true;
      }
      return false;
    },
    buffCount(id) { return Number(this.data.buffs[id]) || 0; },
    addBuff(id) {
      this.data.buffs[id] = this.buffCount(id) + 1;
      this.flush();
    }
  };

  Save.load();
  MiniGames.save = Save;
  MiniGames.title = function () { return Save.title(); };

  /* ================= 强化卡 ================= */
  const CARDS = [
    { id: 'magnet', icon: '🧲', name: '奶龙磁铁', desc: '接住判定 +15%（可叠加）' },
    { id: 'luck', icon: '🍀', name: '幸运豆', desc: '所有得分 +10%' },
    { id: 'heart', icon: '❤️', name: '多一条命', desc: '每个游戏开局 +1 条命' },
    { id: 'slow', icon: '🐢', name: '稳如老狗', desc: '开局速度 -8%' },
    { id: 'shield', icon: '🛡️', name: '起手护盾', desc: '每局自带一次护盾' }
  ];

  MiniGames.CARDS = CARDS;
  MiniGames.cardById = function (id) {
    return CARDS.filter(function (c) { return c.id === id; })[0] || null;
  };

  /* 商店道具 + 强化卡合并后的实际效果 */
  MiniGames.effects = function () {
    const shopMagnet = Save.owns('up-magnet') ? 0.3 : 0;
    return {
      reach: 1 + shopMagnet + 0.15 * Save.buffCount('magnet'),
      scoreMul: 1 + 0.1 * Save.buffCount('luck'),
      extraLives: Save.buffCount('heart'),
      speedMul: Math.pow(0.92, Save.buffCount('slow')),
      shields: (Save.owns('up-shield') ? 1 : 0) + Save.buffCount('shield')
    };
  };

  /* ================= 商店 ================= */
  const SHOP = [
    {
      id: 'title-bean', kind: 'title', title: '一颗普通奶龙', price: 80,
      name: '称号 · 一颗普通奶龙', desc: '低调，但至少比「无名奶龙」强一点。'
    },
    {
      id: 'title-fan', kind: 'title', title: '凑企鹅头号粉丝', price: 200,
      name: '称号 · 凑企鹅头号粉丝', desc: '你到现在都不知道她叫什么。'
    },
    {
      id: 'title-abstract', kind: 'title', title: '抽象艺术家', price: 400,
      name: '称号 · 抽象艺术家', desc: '玩得越烂，越有艺术感。'
    },
    {
      id: 'up-magnet', kind: 'upgrade', price: 250,
      name: '道具 · 吸铁石', desc: '「接住奶龙」里判定范围 +30%，手抖也能接住。'
    },
    {
      id: 'up-shield', kind: 'upgrade', price: 320,
      name: '道具 · 备用护盾', desc: '每个游戏里，每局第一次失误不扣命。'
    }
  ];

  MiniGames.SHOP = SHOP;

  /* ================= 音效 ================= */
  const Sound = (function () {
    let ctx = null;
    let enabled = true;
    try { enabled = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (err) { /* ignore */ }

    const presets = {
      eat:   { from: 620, to: 940, dur: 0.08, type: 'triangle', gain: 0.05 },
      hit:   { from: 240, to: 150, dur: 0.09, type: 'square',   gain: 0.045 },
      coin:  { from: 880, to: 1320, dur: 0.09, type: 'sine',    gain: 0.04 },
      jump:  { from: 340, to: 620, dur: 0.10, type: 'triangle', gain: 0.04 },
      over:  { from: 300, to: 90, dur: 0.45, type: 'sawtooth', gain: 0.05 },
      win:   { from: 520, to: 1040, dur: 0.30, type: 'sine',    gain: 0.06 },
      click: { from: 380, to: 380, dur: 0.04, type: 'sine',     gain: 0.03 }
    };

    function context() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    return {
      play(name) {
        if (!enabled) return;
        const preset = presets[name];
        const audio = context();
        if (!preset || !audio) return;
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        const now = audio.currentTime;
        osc.type = preset.type;
        osc.frequency.setValueAtTime(preset.from, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, preset.to), now + preset.dur);
        gain.gain.setValueAtTime(preset.gain, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.dur);
        osc.connect(gain).connect(audio.destination);
        osc.start(now);
        osc.stop(now + preset.dur + 0.02);
      },
      get enabled() { return enabled; },
      toggle() {
        enabled = !enabled;
        try { localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off'); } catch (err) { /* ignore */ }
        return enabled;
      }
    };
  })();

  MiniGames.sound = Sound;

  /* ================= 素材 ================= */
  const images = {};

  MiniGames.img = function (src) {
    if (!images[src]) {
      const img = new Image();
      img.src = src;
      images[src] = img;
    }
    return images[src];
  };

  MiniGames.BEAN = MiniGames.img('assets/characters/yellow-front.png');
  MiniGames.BEAN_SIDE = MiniGames.img('assets/characters/yellow-side.png');
  MiniGames.PENGUIN = MiniGames.img('assets/characters/penguin-head.png');

  MiniGames.drawSprite = function (ctx, img, cx, cy, height, flip) {
    if (!img || !img.complete || !img.naturalWidth) return 0;
    const width = (img.naturalWidth / img.naturalHeight) * height;
    ctx.save();
    ctx.translate(cx, cy);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
    ctx.restore();
    return width;
  };

  MiniGames.pointerPos = function (canvas, event, logicalWidth, logicalHeight) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * logicalWidth,
      y: ((event.clientY - rect.top) / rect.height) * logicalHeight
    };
  };

  MiniGames.roundRect = function (ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  /* ================= 覆盖层 ================= */
  MiniGames.overlay = function (root) {
    const node = document.createElement('div');
    node.className = 'overlay';
    node.innerHTML =
      '<div class="overlay-card">' +
      '<h2 class="ov-title"></h2>' +
      '<p class="ov-desc"></p>' +
      '<p class="ov-coins" hidden><span>本局获得 </span><b class="ov-coin-value">0</b><span> 奶龙币</span></p>' +
      '<div class="ov-actions"></div>' +
      '</div>';
    root.appendChild(node);

    const titleEl = node.querySelector('.ov-title');
    const descEl = node.querySelector('.ov-desc');
    const coinsEl = node.querySelector('.ov-coins');
    const coinValueEl = node.querySelector('.ov-coin-value');
    const actionsEl = node.querySelector('.ov-actions');

    function button(spec, primary) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'btn' + (primary ? ' primary' : '');
      el.textContent = spec.label;
      el.addEventListener('click', function () {
        Sound.play('click');
        if (spec.onClick) spec.onClick();
      });
      return el;
    }

    return {
      show(opts) {
        titleEl.textContent = opts.title || '';
        descEl.textContent = opts.desc || '';
        descEl.hidden = !opts.desc;
        if (opts.coins) {
          coinValueEl.textContent = opts.coins;
          coinsEl.hidden = false;
        } else {
          coinsEl.hidden = true;
        }
        actionsEl.innerHTML = '';
        (opts.actions || []).forEach(function (spec, index) {
          actionsEl.appendChild(button(spec, index === 0));
        });
        node.classList.add('is-open');
      },
      hide() { node.classList.remove('is-open'); }
    };
  };

  /* ================= 弹窗：序章 / 强化卡 ================= */
  const storyModal = document.getElementById('story-modal');
  const cardModal = document.getElementById('card-modal');
  const cardPicks = document.getElementById('card-picks');

  function openStory() {
    storyModal.hidden = false;
  }

  function closeStory() {
    storyModal.hidden = true;
    Save.data.storySeen = true;
    Save.flush();
  }

  /* 随机抽 3 张（可重复已拥有的，便于叠层） */
  function drawCards(count) {
    const pool = CARDS.slice();
    const picked = [];
    while (picked.length < count && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return picked;
  }

  MiniGames.pickCard = function (done) {
    const picks = drawCards(3);
    cardPicks.innerHTML = '';
    picks.forEach(function (card) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pick-card';
      btn.innerHTML =
        '<span class="pick-icon">' + card.icon + '</span>' +
        '<span class="pick-name">' + card.name + '</span>' +
        '<span class="pick-desc">' + card.desc + '</span>' +
        '<span class="pick-owned">已拥有 x' + Save.buffCount(card.id) + '</span>';
      btn.addEventListener('click', function () {
        Save.addBuff(card.id);
        Sound.play('win');
        cardModal.hidden = true;
        renderBuffs();
        if (done) done(card);
      });
      cardPicks.appendChild(btn);
    });
    cardModal.hidden = false;
  };

  /* ================= 页面外壳 ================= */
  const homeEl = document.getElementById('home');
  const coinCountEl = document.getElementById('coin-count');
  const buffListEl = document.getElementById('buff-list');
  let current = null;
  let currentGameId = '';

  function paintCoins() {
    coinCountEl.textContent = Save.data.coins;
  }

  function renderBuffs() {
    if (!buffListEl) return;
    const owned = CARDS.filter(function (c) { return Save.buffCount(c.id) > 0; });
    if (!owned.length) {
      buffListEl.innerHTML = '<span class="buff-empty">还没有强化卡，打完一局就能抽一张</span>';
      return;
    }
    buffListEl.innerHTML = owned.map(function (c) {
      const n = Save.buffCount(c.id);
      return '<span class="buff-chip" title="' + c.desc + '">' +
        '<span class="buff-icon">' + c.icon + '</span>' + c.name +
        (n > 1 ? ' <b>x' + n + '</b>' : '') +
        '</span>';
    }).join('');
  }

  function renderHome() {
    const grid = document.getElementById('game-grid');
    grid.innerHTML = '';
    MiniGames.list.forEach(function (game, index) {
      const card = document.createElement('a');
      card.className = 'level';
      card.href = '#/' + game.id;
      card.innerHTML =
        '<span class="level-no">第 ' + (index + 1) + ' 关</span>' +
        '<span class="level-art"><img src="' + game.art + '" alt=""></span>' +
        '<span class="level-main">' +
        '<span class="level-title">' + game.title + '</span>' +
        '<span class="level-desc">' + game.desc + '</span>' +
        '</span>' +
        '<span class="level-side">' +
        '<span class="level-best">最佳 <b>' + Save.best(game.id) + '</b></span>' +
        '<span class="level-go">开始 →</span>' +
        '</span>';
      grid.appendChild(card);
    });
    renderBuffs();
  }

  function clearDynamic() {
    Array.prototype.forEach.call(document.querySelectorAll('#app .view.dynamic'), function (node) {
      if (node.__destroy) {
        try { node.__destroy(); } catch (err) { /* ignore */ }
      }
      node.remove();
    });
    current = null;
    currentGameId = '';
    homeEl.hidden = false;
  }

  function coinsFor(score) {
    return Math.max(1, Math.round(score / 8));
  }

  /* ---------- 游戏页 ---------- */
  function openGame(id) {
    const def = MiniGames.list.filter(function (g) { return g.id === id; })[0];
    if (!def) { location.hash = '#/'; return; }
    if (current && currentGameId === id) return;
    clearDynamic();

    const view = document.createElement('section');
    view.className = 'view game dynamic';
    view.innerHTML =
      '<div class="game-bar">' +
      '<a class="btn small" href="#/">← 选关</a>' +
      '<h2>' + def.title + '</h2>' +
      '<div class="stats">' +
      '<div class="stat"><b data-role="score">0</b><i>得分</i></div>' +
      '<div class="stat"><b data-role="best">' + Save.best(id) + '</b><i>最佳</i></div>' +
      '</div>' +
      '<button class="btn small" type="button" data-role="pause">暂停</button>' +
      '<button class="btn small" type="button" data-role="restart">重开</button>' +
      '</div>' +
      '<div class="stage" data-role="stage"></div>' +
      '<p class="hint">' + (def.hint || '') + '</p>';

    homeEl.hidden = true;
    document.getElementById('app').appendChild(view);

    const stage = view.querySelector('[data-role="stage"]');
    const scoreEl = view.querySelector('[data-role="score"]');
    const bestEl = view.querySelector('[data-role="best"]');
    const ov = MiniGames.overlay(stage);

    let instance = null;

    const host = {
      ov: ov,
      setScore(value) { scoreEl.textContent = value; },
      effects() { return MiniGames.effects(); },
      sound(fx) { Sound.play(fx); },
      finish(score, opts) {
        opts = opts || {};
        const coins = coinsFor(score);
        Save.addCoins(coins);
        const isBest = Save.setBest(id, score);
        bestEl.textContent = Save.best(id);
        Sound.play(opts.win ? 'win' : 'over');

        const showResult = function () {
          ov.show({
            title: opts.title || '这一局结束了',
            desc: (opts.desc ? opts.desc + '\n' : '') + '得分 ' + score + (isBest ? ' · 新纪录！' : ''),
            coins: coins,
            actions: [
              { label: '再来一局', onClick: function () { instance.restart(); } },
              { label: '回选关', onClick: function () { location.hash = '#/'; } }
            ]
          });
        };

        // 先抽卡，再显示结算
        ov.hide();
        MiniGames.pickCard(function () {
          showResult();
        });
      }
    };

    instance = def.mount(stage, host);
    current = instance;
    currentGameId = id;
    view.__destroy = function () { instance.destroy(); };

    view.querySelector('[data-role="restart"]').addEventListener('click', function () {
      Sound.play('click');
      instance.restart();
    });

    view.querySelector('[data-role="pause"]').addEventListener('click', function () {
      Sound.play('click');
      instance.togglePause();
    });

    document.title = def.title + ' · 奶龙宇宙';
  }

  /* ---------- 商店页 ---------- */
  function openShop() {
    clearDynamic();
    homeEl.hidden = true;

    const view = document.createElement('section');
    view.className = 'view dynamic';
    view.innerHTML =
      '<div class="game-bar">' +
      '<a class="btn small" href="#/">← 选关</a>' +
      '<h2>奶龙币商店</h2>' +
      '<div class="stats"><div class="stat"><b data-role="shop-coins">' + Save.data.coins + '</b><i>奶龙币</i></div></div>' +
      '</div>' +
      '<p class="hint" style="text-align:left;margin:0 0 16px">称号买下就自动佩戴，可以随时点回来换；道具是永久的，和强化卡叠加。</p>' +
      '<div class="shop-grid" data-role="shop-grid"></div>';

    document.getElementById('app').appendChild(view);
    const grid = view.querySelector('[data-role="shop-grid"]');
    const coinsEl = view.querySelector('[data-role="shop-coins"]');

    function render() {
      coinsEl.textContent = Save.data.coins;
      grid.innerHTML = '';
      SHOP.forEach(function (item) {
        const owned = Save.owns(item.id);
        const equipped = item.kind === 'title' && Save.data.title === item.title;
        const node = document.createElement('div');
        node.className = 'shop-item' + (owned ? ' is-owned' : '');
        node.innerHTML =
          '<span class="badge">' + (item.kind === 'title' ? '称号' : '道具') + '</span>' +
          '<h3>' + item.name + '</h3>' +
          '<p>' + item.desc + '</p>' +
          '<div class="price"><i class="coin-dot" aria-hidden="true"></i>' + item.price + '</div>';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn' + (owned ? '' : ' primary');
        if (!owned) {
          btn.textContent = '购买';
          btn.disabled = Save.data.coins < item.price;
          btn.addEventListener('click', function () {
            if (!Save.spend(item.price)) return;
            Save.claim(item);
            Sound.play('coin');
            render();
          });
        } else if (item.kind === 'title' && !equipped) {
          btn.textContent = '佩戴';
          btn.addEventListener('click', function () {
            Save.equip(item);
            Sound.play('click');
            render();
          });
        } else {
          btn.textContent = equipped ? '使用中' : '已拥有';
          btn.disabled = true;
        }
        node.appendChild(btn);
        grid.appendChild(node);
      });
    }

    render();
    document.title = '商店 · 奶龙宇宙';
  }

  /* ---------- 路由 ---------- */
  function route() {
    const raw = location.hash.replace(/^#\/?/, '');
    const id = raw.split('?')[0];

    if (id === 'shop') {
      openShop();
      return;
    }
    if (id && MiniGames.list.some(function (g) { return g.id === id; })) {
      openGame(id);
      return;
    }
    clearDynamic();
    document.title = '奶龙宇宙 · 三个不太正经的小游戏';
    renderHome();
  }

  /* ---------- 音效开关 / 后台暂停 ---------- */
  const soundBtn = document.getElementById('sound-toggle');

  function paintSound() {
    soundBtn.textContent = Sound.enabled ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-pressed', String(Sound.enabled));
  }

  soundBtn.addEventListener('click', function () {
    Sound.toggle();
    paintSound();
    Sound.play('click');
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && current) {
      try { current.togglePause(true); } catch (err) { /* ignore */ }
    }
  });

  /* ---------- 序章 ---------- */
  document.getElementById('story-skip').addEventListener('click', function () {
    Sound.play('click');
    closeStory();
  });
  document.getElementById('story-start').addEventListener('click', function () {
    Sound.play('click');
    closeStory();
    location.hash = '#/catch';
  });

  /* ---------- 启动 ---------- */
  function boot() {
    paintCoins();
    paintSound();
    renderHome();
    window.addEventListener('hashchange', route);
    route();
    if (!Save.data.storySeen && !location.hash) openStory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
