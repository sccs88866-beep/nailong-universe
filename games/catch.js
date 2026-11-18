/* 接住奶龙：凑企鹅的头在下面接，奶龙从天而降，炸弹别接 */
(function () {
  'use strict';

  const MG = window.MiniGames;
  const W = 600;
  const H = 600;

  MG.register({
    id: 'catch',
    title: '接住奶龙',
    desc: '移动凑企鹅的头，接住掉下来的奶龙，别接炸弹。',
    art: 'assets/characters/penguin-head.png',
    hint: '鼠标 / 手指拖动，或用 ← →（A / D）移动；空格暂停',
    mount: function (root, host) {
      const canvas = document.createElement('canvas');
      canvas.className = 'board board-square';
      root.appendChild(canvas);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const ov = host.ov;
      const PENGUIN = MG.PENGUIN;
      const BEAN = MG.BEAN;
      let fx = host.effects();
      const maxLives = function () { return 2 + fx.extraLives; };

      const player = { x: W / 2, y: H - 84, r: 58, targetX: W / 2, tilt: 0 };
      const flakes = [];
      for (let i = 0; i < 42; i++) {
        flakes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: 1 + Math.random() * 2,
          v: 12 + Math.random() * 34
        });
      }

      let items = [];
      let pops = [];
      let score = 0;
      let lives = 3;
      let combo = 0;
      let elapsed = 0;
      let spawnTimer = 0;
      let running = false;
      let paused = false;
      let over = false;
      let shieldLeft = 0;
      let shake = 0;
      let raf = 0;
      let last = 0;
      const keys = { left: false, right: false };

      function spawn() {
        const isBomb = Math.random() < (elapsed > 8 ? 0.26 : 0.12);
        items.push({
          kind: isBomb ? 'bomb' : 'bean',
          x: 46 + Math.random() * (W - 92),
          y: -50,
          r: isBomb ? 26 : 33,
          spin: (Math.random() - 0.5) * 2.2,
          angle: 0,
          drift: (Math.random() - 0.5) * 60
        });
      }

      function reset() {
        fx = host.effects();
        items = [];
        pops = [];
        score = 0;
        lives = maxLives();
        combo = 0;
        elapsed = 0;
        spawnTimer = 0.4;
        over = false;
        paused = false;
        running = true;
        shake = 0;
        shieldLeft = fx.shields;
        player.x = W / 2;
        player.targetX = W / 2;
        host.setScore(0);
        ov.hide();
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      }

      function pop(x, y, text, color) {
        pops.push({ x: x, y: y, text: text, color: color, life: 0.9 });
      }

      function multiplier() {
        return 1 + Math.min(2, Math.floor(combo / 5));
      }

      function collect(item) {
        if (item.kind === 'bean') {
          combo += 1;
          const gain = Math.max(1, Math.round(10 * multiplier() * fx.scoreMul));
          score += gain;
          host.setScore(score);
          host.sound('eat');
          pop(item.x, item.y, '+' + gain, '#facc15');
        } else {
          combo = 0;
          if (shieldLeft > 0) {
            shieldLeft -= 1;
            host.sound('coin');
            pop(item.x, item.y, '护盾挡下', '#6ee7ff');
          } else {
            lives -= 1;
            shake = 1;
            host.sound('hit');
            pop(item.x, item.y, '咕——', '#f87171');
            if (lives <= 0) {
              endGame();
            }
          }
        }
      }

      function endGame() {
        running = false;
        over = true;
        host.finish(score, {
          title: '奶龙撒了一地',
          desc: '你一共接住了 ' + Math.floor(score / 10) + ' 颗（按分折算，别较真）。'
        });
      }

      function update(dt) {
        elapsed += dt;
        const speed = Math.min(700, 240 + elapsed * 22) * fx.speedMul;
        const every = Math.max(0.30, 0.85 - elapsed * 0.016);

        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawn();
          if (elapsed > 25 && Math.random() < 0.25) spawn();
          spawnTimer = every * (0.8 + Math.random() * 0.5);
        }

        let dir = 0;
        if (keys.left) dir -= 1;
        if (keys.right) dir += 1;
        if (dir !== 0) player.targetX += dir * 520 * dt;
        player.targetX = Math.max(player.r + 8, Math.min(W - player.r - 8, player.targetX));

        const prevX = player.x;
        player.x += (player.targetX - player.x) * Math.min(1, dt * 14);
        player.tilt = Math.max(-0.2, Math.min(0.2, (player.x - prevX) * 0.02));

        const pick = player.r * 0.74 * fx.reach;

        items.forEach(function (item) {
          item.y += speed * dt;
          item.x += item.drift * dt;
          item.angle += item.spin * dt;
          if (item.x < 30 || item.x > W - 30) item.drift *= -1;

          const dx = item.x - player.x;
          const dy = item.y - (player.y - 10);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < pick + item.r * fx.reach) {
            item.dead = true;
            collect(item);
          } else if (item.y > H + 70) {
            item.dead = true;
            if (item.kind === 'bean') combo = 0;
          }
        });

        items = items.filter(function (item) { return !item.dead; });

        pops.forEach(function (p) {
          p.y -= 42 * dt;
          p.life -= dt;
        });
        pops = pops.filter(function (p) { return p.life > 0; });

        flakes.forEach(function (f) {
          f.y += f.v * dt;
          if (f.y > H) { f.y = -4; f.x = Math.random() * W; }
        });

        if (shake > 0) shake = Math.max(0, shake - dt * 3);
      }

      function draw() {
        ctx.save();
        if (shake > 0) {
          ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);
        }

        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#0b1226');
        sky.addColorStop(0.55, '#0e1b33');
        sky.addColorStop(1, '#132744');
        ctx.fillStyle = sky;
        ctx.fillRect(-20, -20, W + 40, H + 40);

        ctx.fillStyle = 'rgba(226, 240, 255, 0.55)';
        flakes.forEach(function (f) {
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        });

        // 掉落物
        items.forEach(function (item) {
          if (item.kind === 'bean') {
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(item.angle * 0.35);
            MG.drawSprite(ctx, BEAN, 0, 0, item.r * 2.35);
            ctx.restore();
          } else {
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(item.angle);
            ctx.shadowColor = 'rgba(248, 113, 113, 0.8)';
            ctx.shadowBlur = 18;
            ctx.fillStyle = '#1f2937';
            ctx.beginPath();
            ctx.arc(0, 0, item.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.font = '34px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💣', 0, 2);
            ctx.restore();
          }
        });

        // 凑企鹅的头
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.tilt);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 10;
        MG.drawSprite(ctx, PENGUIN, 0, 0, player.r * 2.05);
        ctx.restore();

        if (shieldLeft > 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(110, 231, 255, 0.75)';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.arc(player.x, player.y, player.r * 1.12, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // 飘字
        pops.forEach(function (p) {
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.9));
          ctx.fillStyle = p.color;
          ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(p.text, p.x, p.y);
          ctx.globalAlpha = 1;
        });

        // HUD
        ctx.font = '24px "Segoe UI Symbol", "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < maxLives(); i++) {
          ctx.globalAlpha = i < lives ? 1 : 0.22;
          ctx.fillStyle = '#fb7185';
          ctx.fillText('♥', 20 + i * 26, 30);
        }
        ctx.globalAlpha = 1;

        if (combo >= 5) {
          ctx.textAlign = 'right';
          ctx.fillStyle = '#facc15';
          ctx.font = '700 18px "Segoe UI", system-ui, sans-serif';
          ctx.fillText('x' + multiplier() + ' 连击', W - 20, 30);
        }

        ctx.restore();
      }

      function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (running && !paused) update(dt);
        draw();
        raf = requestAnimationFrame(frame);
      }

      function togglePause(force) {
        if (!running) return;
        const next = typeof force === 'boolean' ? force : !paused;
        if (next === paused) return;
        paused = next;
        if (paused) {
          ov.show({
            title: '已暂停',
            desc: '凑企鹅的头停在了半空。',
            actions: [{ label: '继续', onClick: function () { togglePause(); } }]
          });
        } else {
          ov.hide();
          last = performance.now();
        }
      }

      /* ---- 输入 ---- */
      function onPointer(event) {
        if (!running || paused) return;
        const pos = MG.pointerPos(canvas, event, W, H);
        player.targetX = pos.x;
      }

      function onKeyDown(event) {
        const key = event.key;
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') { keys.left = true; event.preventDefault(); }
        else if (key === 'ArrowRight' || key === 'd' || key === 'D') { keys.right = true; event.preventDefault(); }
        else if (key === ' ' || key === 'p' || key === 'P') {
          event.preventDefault();
          togglePause();
        }
      }

      function onKeyUp(event) {
        const key = event.key;
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') keys.left = false;
        if (key === 'ArrowRight' || key === 'd' || key === 'D') keys.right = false;
      }

      canvas.addEventListener('pointermove', onPointer);
      canvas.addEventListener('pointerdown', onPointer);
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);

      reset();

      return {
        restart: reset,
        togglePause: togglePause,
        destroy: function () {
          cancelAnimationFrame(raf);
          document.removeEventListener('keydown', onKeyDown);
          document.removeEventListener('keyup', onKeyUp);
        }
      };
    }
  });
})();
