/* 奶龙快跑：侧身奶龙一路狂奔，跳过滚过来的凑企鹅的头 */
(function () {
  'use strict';

  const MG = window.MiniGames;
  const W = 800;
  const H = 420;
  const GROUND = 330;

  MG.register({
    id: 'jump',
    title: '奶龙快跑',
    desc: '奶龙自动往前跑，跳过滚过来的凑企鹅的头，顺手捡豆子。',
    art: 'assets/characters/yellow-side.png',
    hint: '空格 / ↑ / 点击跳跃；空格暂停；漏一个就结束',
    mount: function (root, host) {
      const canvas = document.createElement('canvas');
      canvas.className = 'board board-wide';
      root.appendChild(canvas);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const ov = host.ov;
      const BEAN = MG.BEAN;
      const BEAN_SIDE = MG.BEAN_SIDE;
      const PENGUIN = MG.PENGUIN;
      let fx = host.effects();

      const runner = { x: 150, y: 0, vy: 0, w: 52, h: 74, onGround: true };
      let obstacles = [];
      let pickups = [];
      let distance = 0;
      let beanCount = 0;
      let speed = 300;
      let over = false;
      let paused = false;
      let running = false;
      let shieldLeft = 0;
      let obstacleTimer = 0.9;
      let pickupTimer = 1.6;
      let bob = 0;
      let raf = 0;
      let last = 0;

      const clouds = [];
      for (let i = 0; i < 7; i++) {
        clouds.push({ x: Math.random() * W, y: 40 + Math.random() * 140, s: 0.3 + Math.random() * 0.6 });
      }

      function score() {
        return Math.round((Math.floor(distance / 10) + beanCount * 20) * fx.scoreMul);
      }

      function spawnObstacle() {
        const radius = 28 + Math.random() * 10;
        obstacles.push({ x: W + radius + 20, r: radius, angle: 0 });
      }

      function spawnPickup() {
        pickups.push({
          x: W + 40,
          y: GROUND - (70 + Math.random() * 150),
          r: 17,
          angle: Math.random() * Math.PI
        });
      }

      function reset() {
        fx = host.effects();
        obstacles = [];
        pickups = [];
        distance = 0;
        beanCount = 0;
        speed = 380 * fx.speedMul;
        over = false;
        paused = false;
        running = true;
        shieldLeft = fx.shields;
        obstacleTimer = 1.2;
        pickupTimer = 1.6;
        runner.y = 0;
        runner.vy = 0;
        runner.onGround = true;
        host.setScore(0);
        ov.hide();
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      }

      function jump() {
        if (over || paused) return;
        if (!runner.onGround) return;
        runner.vy = -740;
        runner.onGround = false;
        host.sound('jump');
      }

      function endGame() {
        if (over) return;
        over = true;
        running = false;
        host.finish(score(), {
          title: '撞到凑企鹅了',
          desc: '跑了 ' + Math.floor(distance / 10) + ' 米，捡了 ' + beanCount + ' 颗豆子。'
        });
      }

      function hitSomething() {
        if (shieldLeft > 0) {
          shieldLeft -= 1;
          host.sound('coin');
          return true;
        }
        endGame();
        return false;
      }

      function update(dt) {
        speed = Math.min(900, 380 + distance * 0.075) * fx.speedMul;
        distance += speed * dt;
        bob += dt * 10;

        runner.vy += 2280 * dt;
        runner.y += runner.vy * dt;
        if (runner.y >= 0) {
          runner.y = 0;
          runner.vy = 0;
          runner.onGround = true;
        }

        obstacleTimer -= dt;
        if (obstacleTimer <= 0) {
          spawnObstacle();
          obstacleTimer = Math.max(0.55, 0.95 - distance * 0.00005) * (0.85 + Math.random() * 0.4);
        }

        pickupTimer -= dt;
        if (pickupTimer <= 0) {
          spawnPickup();
          pickupTimer = 1.8 + Math.random() * 2.0;
        }

        clouds.forEach(function (c) {
          c.x -= speed * 0.12 * dt * c.s;
          if (c.x < -80) { c.x = W + 60; c.y = 40 + Math.random() * 140; }
        });

        const top = GROUND + runner.y - runner.h;
        const left = runner.x - runner.w / 2;
        const right = runner.x + runner.w / 2;

        obstacles.forEach(function (o) {
          o.x -= speed * dt;
          o.angle -= (speed / o.r) * dt;
          const oy = GROUND - o.r;
          const dx = Math.max(left, Math.min(o.x, right)) - o.x;
          const dy = Math.max(top, Math.min(oy, GROUND + runner.y)) - oy;
          if (dx * dx + dy * dy < o.r * o.r) {
            o.dead = true;
            hitSomething();
          }
        });

        pickups.forEach(function (p) {
          p.x -= speed * dt;
          p.angle += dt * 2;
          const cy = GROUND + runner.y - runner.h / 2;
          const dx = p.x - runner.x;
          const dy = p.y - cy;
          if (dx * dx + dy * dy < (p.r + 34) * (p.r + 34)) {
            p.dead = true;
            beanCount += 1;
            host.sound('eat');
          }
        });

        obstacles = obstacles.filter(function (o) { return !o.dead && o.x > -80; });
        pickups = pickups.filter(function (p) { return !p.dead && p.x > -60; });

        host.setScore(score());
      }

      function draw() {
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#091120');
        sky.addColorStop(0.6, '#12203a');
        sky.addColorStop(1, '#1b3050');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = 'rgba(148, 197, 255, 0.16)';
        clouds.forEach(function (c) {
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, 46 * c.s + 20, 14 * c.s + 6, 0, 0, Math.PI * 2);
          ctx.fill();
        });

        // 远处山脊
        ctx.fillStyle = 'rgba(30, 58, 95, 0.75)';
        ctx.beginPath();
        ctx.moveTo(0, GROUND);
        for (let x = 0; x <= W; x += 40) {
          const y = GROUND - 70 - Math.sin((x + distance * 0.25) * 0.006) * 34 - Math.sin((x + distance * 0.1) * 0.013) * 18;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, GROUND);
        ctx.closePath();
        ctx.fill();

        // 地面
        const g = ctx.createLinearGradient(0, GROUND, 0, H);
        g.addColorStop(0, '#0f1c30');
        g.addColorStop(1, '#080c16');
        ctx.fillStyle = g;
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.strokeStyle = 'rgba(110, 231, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, GROUND);
        ctx.lineTo(W, GROUND);
        ctx.stroke();

        // 地面速度线
        ctx.strokeStyle = 'rgba(110, 231, 255, 0.12)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 12; i++) {
          const x = (W - ((distance * 1.4 + i * 90) % (W + 120)));
          ctx.beginPath();
          ctx.moveTo(x, GROUND + 14 + (i % 3) * 12);
          ctx.lineTo(x + 42, GROUND + 14 + (i % 3) * 12);
          ctx.stroke();
        }

        // 豆子
        pickups.forEach(function (p) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.sin(p.angle) * 0.25);
          ctx.shadowColor = 'rgba(250, 204, 21, 0.55)';
          ctx.shadowBlur = 16;
          MG.drawSprite(ctx, BEAN, 0, 0, p.r * 2.6);
          ctx.restore();
        });

        // 凑企鹅的头（滚过来）
        obstacles.forEach(function (o) {
          ctx.save();
          ctx.translate(o.x, GROUND - o.r);
          ctx.rotate(o.angle);
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 18;
          MG.drawSprite(ctx, PENGUIN, 0, 0, o.r * 2.1);
          ctx.restore();
        });

        // 奶龙
        const lift = runner.onGround ? Math.abs(Math.sin(bob)) * 2 : 0;
        ctx.save();
        ctx.translate(runner.x, GROUND + runner.y - lift);
        const tilt = runner.onGround ? 0.06 : Math.max(-0.18, Math.min(0.18, runner.vy * 0.00016));
        ctx.rotate(tilt);
        ctx.shadowColor = 'rgba(250, 204, 21, 0.35)';
        ctx.shadowBlur = 22;
        MG.drawSprite(ctx, BEAN_SIDE, 0, 0, runner.h, false);
        ctx.restore();

        if (shieldLeft > 0) {
          ctx.strokeStyle = 'rgba(110, 231, 255, 0.75)';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.arc(runner.x, GROUND + runner.y - runner.h / 2, 62, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (running && !paused) update(dt);
        draw();
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
            desc: '奶龙保持着起跑的姿势等你。',
            actions: [{ label: '继续', onClick: function () { togglePause(); } }]
          });
        } else {
          ov.hide();
          last = performance.now();
        }
      }

      function onKeyDown(event) {
        if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
          event.preventDefault();
          if (event.repeat) return;
          jump();
        } else if (event.key === 'p' || event.key === 'P') {
          event.preventDefault();
          togglePause();
        }
      }

      canvas.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        jump();
      });

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
