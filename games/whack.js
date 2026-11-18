/* 敲奶龙：奶龙从洞里冒头就敲，冒出凑企鹅的头千万别敲 */
(function () {
  'use strict';

  const MG = window.MiniGames;
  const ROUND_SECONDS = 24;

  MG.register({
    id: 'whack',
    title: '敲奶龙',
    desc: '奶龙冒头就敲，冒出凑企鹅的头敢敲就扣命。24 秒。',
    art: 'assets/characters/yellow-front.png',
    hint: '点击 / 触摸洞口；敲空会断连击，敲错会掉命；空格暂停',
    mount: function (root, host) {
      const wrap = document.createElement('div');
      wrap.className = 'whack-wrap';
      root.appendChild(wrap);

      const hud = document.createElement('div');
      hud.className = 'whack-hud';
      wrap.appendChild(hud);

      const board = document.createElement('div');
      board.className = 'whack-board';
      wrap.appendChild(board);

      const ov = host.ov;
      const BEAN = MG.BEAN;
      const PENGUIN = MG.PENGUIN;
      let fx = host.effects();
      let maxLives = 3;

      const holes = [];
      let score = 0;
      let combo = 0;
      let lives = 3;
      let timeLeft = ROUND_SECONDS;
      let spawnAcc = 0;
      let spawnEvery = 0.62;
      let over = false;
      let paused = false;
      let shieldLeft = 0;
      let raf = 0;
      let last = 0;

      for (let i = 0; i < 9; i++) {
        const el = document.createElement('div');
        el.className = 'hole';
        const img = document.createElement('img');
        img.alt = '';
        el.appendChild(img);
        board.appendChild(el);
        const hole = { el: el, img: img, up: false, kind: '', hideAt: 0 };
        el.addEventListener('pointerdown', function (event) {
          event.preventDefault();
          hit(hole);
        });
        holes.push(hole);
      }

      function multiplier() {
        return 1 + Math.min(2, Math.floor(combo / 4));
      }

      function hide(hole) {
        hole.up = false;
        hole.kind = '';
        hole.el.classList.remove('is-up');
      }

      function show(hole, kind) {
        hole.up = true;
        hole.kind = kind;
        hole.img.src = kind === 'bean' ? BEAN.src : PENGUIN.src;
        hole.el.classList.add('is-up');
        hole.hideAt = performance.now() + 560 + Math.random() * 320;
      }

      function trySpawn() {
        const free = holes.filter(function (h) { return !h.up; });
        if (!free.length) return;
        const hole = free[Math.floor(Math.random() * free.length)];
        const penguinChance = 0.22 + Math.min(0.12, (ROUND_SECONDS - timeLeft) * 0.005);
        show(hole, Math.random() < penguinChance ? 'penguin' : 'bean');
      }

      function shakeBoard() {
        board.classList.remove('shake');
        void board.offsetWidth;
        board.classList.add('shake');
      }

      function hit(hole) {
        if (over || paused) return;

        if (!hole.up) {
          combo = 0;
          host.sound('click');
          return;
        }

        const kind = hole.kind;
        hide(hole);
        hole.el.classList.remove('is-hit');
        void hole.el.offsetWidth;
        hole.el.classList.add('is-hit');

        if (kind === 'bean') {
          combo += 1;
          score += Math.max(1, Math.round(10 * multiplier() * fx.scoreMul));
          host.setScore(score);
          host.sound('eat');
        } else {
          combo = 0;
          host.sound('hit');
          shakeBoard();
          if (shieldLeft > 0) {
            shieldLeft -= 1;
          } else {
            lives -= 1;
            if (lives <= 0) endGame('你敲了凑企鹅');
          }
        }
      }

      function endGame(reason) {
        if (over) return;
        over = true;
        host.finish(score, {
          title: reason || '时间到',
          desc: '这一局最高连击 x' + multiplier() + '。'
        });
      }

      function reset() {
        fx = host.effects();
        maxLives = 3 + fx.extraLives;
        score = 0;
        combo = 0;
        lives = maxLives;
        timeLeft = ROUND_SECONDS;
        spawnAcc = 0;
        spawnEvery = 0.62;
        over = false;
        paused = false;
        shieldLeft = fx.shields;
        holes.forEach(hide);
        host.setScore(0);
        ov.hide();
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      }

      function frame(now) {
        const dt = Math.min(0.06, (now - last) / 1000);
        last = now;

        if (!paused && !over) {
          timeLeft -= dt;
          if (timeLeft <= 0) {
            timeLeft = 0;
            endGame('时间到');
          }

          spawnAcc += dt;
          if (spawnAcc >= spawnEvery) {
            spawnAcc = 0;
            trySpawn();
            if (timeLeft < 18 && Math.random() < 0.45) trySpawn();
            spawnEvery = Math.max(0.30, 0.62 - (ROUND_SECONDS - timeLeft) * 0.014);
          }

          holes.forEach(function (hole) {
            if (hole.up && now > hole.hideAt) hide(hole);
          });
        }

        hud.textContent = '⏱ ' + Math.ceil(timeLeft) + 's   ♥ ' + lives + '   x' + multiplier() + ' 连击';
        raf = requestAnimationFrame(frame);
      }

      function togglePause(force) {
        if (over) return;
        const next = typeof force === 'boolean' ? force : !paused;
        if (next === paused) return;
        paused = next;
        if (paused) {
          ov.show({
            title: '已暂停',
            desc: '洞里的奶龙也停了。',
            actions: [{ label: '继续', onClick: function () { togglePause(); } }]
          });
        } else {
          ov.hide();
          last = performance.now();
        }
      }

      function onKeyDown(event) {
        if (event.key === ' ' || event.key === 'p' || event.key === 'P') {
          event.preventDefault();
          togglePause();
        }
      }

      document.addEventListener('keydown', onKeyDown);
      reset();

      return {
        restart: reset,
        togglePause: togglePause,
        destroy: function () {
          cancelAnimationFrame(raf);
          document.removeEventListener('keydown', onKeyDown);
        }
      };
    }
  });
})();
