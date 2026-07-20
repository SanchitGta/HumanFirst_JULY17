(function () {
  'use strict';

  const STATES = Object.freeze({
    HOME: 'HOME',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER'
  });

  const SWIPE_THRESHOLD = 30;   // px — minimum horizontal swipe distance
  const PLAYER_SPEED    = 5;    // css-px per frame at 60fps
  const DT_CAP          = 50;   // ms — spiral-of-death guard for tab-blur spikes
  const LS_KEY          = 'neonDash_highScore';

  const BASE_CRYSTAL_SCORE  = 10;     // score per crystal at combo x1
  const COMBO_CAP           = 10;     // maximum multiplier ceiling
  const COMBO_DECAY_MS      = 3000;   // ms idle before combo resets to x1
  const BASE_OBSTACLE_SPEED = 3;      // px/frame at 60fps, difficulty level 0
  const MAX_OBSTACLE_SPEED  = 10;     // px/frame at 60fps, difficulty level 1
  const BASE_SPAWN_INTERVAL = 1500;   // ms between obstacle spawns at difficulty level 0
  const MIN_SPAWN_INTERVAL  = 700;    // ms between obstacle spawns at difficulty level 1
  const DIFFICULTY_RAMP_MS  = 60000;  // ms to ramp from difficulty 0 → 1
  const CRYSTAL_INTERVAL    = 2000;   // ms between crystal spawns (fixed, not difficulty-scaled)
  const SHIELD_INTERVAL     = 15000;  // ms between shield spawn attempts
  const OBSTACLE_MIN_W      = 40;     // px — narrowest obstacle
  const OBSTACLE_MAX_W      = 90;     // px — widest obstacle
  const OBSTACLE_H          = 24;     // px — fixed obstacle height
  const CRYSTAL_SIZE        = 16;     // px — crystal square side
  const SHIELD_SIZE         = 20;     // px — shield pickup square side
  const HITBOX_SHRINK       = 4;      // px — inset per side on player collision box for fairness

  // These hex values must stay in sync with the :root custom properties of the
  // same name in index.html (canvas draws can't read CSS variables).
  const COLOR_PLAYER    = '#00f6ff';
  const COLOR_OBSTACLE  = '#ff2954';
  const COLOR_CRYSTAL   = '#39ff88';
  const COLOR_SHIELD    = '#ffd23f';
  const GLOW_BLUR       = 14;     // px — shadowBlur radius for entity glow

  const PARTICLE_MAX_COUNT     = 80;   // hard cap on live particles
  const PARTICLE_LIFE_MS       = 500;  // ms — crystal/shield burst particle lifetime
  const PARTICLE_DEATH_LIFE_MS = 700;  // ms — game-over burst particle lifetime
  const PARTICLE_SPEED_MIN     = 0.5;  // px/frame at 60fps
  const PARTICLE_SPEED_MAX     = 2.5;  // px/frame at 60fps
  const PARTICLE_SIZE          = 3;    // px — particle square side

  const AUDIO_MASTER_GAIN      = 0.35; // overall output ceiling feeding the compressor

  const AMBIENT_GAIN_TARGET    = 0.05; // pad envelope target gain
  const AMBIENT_FADE_IN_MS     = 1500; // ms — pad fade-in duration
  const AMBIENT_FADE_OUT_MS    = 400;  // ms — pad fade-out duration
  const AMBIENT_ROOT_HZ        = 110;  // A2
  const AMBIENT_FIFTH_HZ       = 165;  // E3
  const AMBIENT_DETUNE_CENTS   = 4;    // detune spread between root/fifth oscillators
  const AMBIENT_FILTER_HZ      = 800;  // lowpass cutoff center
  const AMBIENT_LFO_HZ         = 0.07; // slow filter-cutoff LFO rate
  const AMBIENT_LFO_DEPTH_HZ   = 300;  // LFO modulation depth on filter cutoff

  const CLICK_FREQ_HZ          = 660;  // button click tone
  const CLICK_DURATION_MS      = 60;
  const CLICK_GAIN             = 0.18;

  const CHIME_NOTE1_HZ         = 880;    // A5
  const CHIME_NOTE2_HZ         = 1318.5; // E6
  const CHIME_NOTE_MS          = 90;
  const CHIME_GAIN             = 0.22;

  const COLLISION_SWEEP_START_HZ = 220;
  const COLLISION_SWEEP_END_HZ   = 70;
  const COLLISION_DURATION_MS    = 180;
  const COLLISION_GAIN           = 0.28;

  const NOISE_BUFFER_SEC       = 0.2;  // length of the one reusable noise buffer

  let canvas, ctx;
  let currentState  = null;
  let rafId         = null;
  let lastTimestamp = 0;
  let canvasWidth   = 0;
  let canvasHeight  = 0;
  let player        = { x: 0, y: 0, width: 40, height: 40 };
  let score         = 0;
  let highScore     = 0;
  let obstacles     = [];   // falling obstacles currently on canvas
  let crystals      = [];   // falling energy crystals currently on canvas
  let shields       = [];   // shield pickups currently falling on canvas (not yet collected)
  let hasShield     = false; // true when the player is holding a collected shield
  let combo         = 1;    // current combo multiplier; shown as "x1", "x2", …
  let comboDecay    = 0;    // ms since last crystal collection; resets combo after COMBO_DECAY_MS
  let survivalTime  = 0;    // ms elapsed in the current run; drives difficulty
  let spawnTimer    = 0;    // ms since last obstacle was spawned
  let crystalTimer  = 0;    // ms since last crystal was spawned
  let shieldTimer   = 0;    // ms since last shield pickup was spawned
  let input         = { left: false, right: false };
  let touch         = { startX: 0, startY: 0, swipeLeft: false, swipeRight: false };
  let particles     = [];   // active visual burst particles: {x, y, vx, vy, life, maxLife, color}

  let audioCtx         = null;
  let audioUnavailable = false; // memoizes a failed feature-detection
  let masterGain        = null;
  let noiseBuffer       = null; // reusable noise buffer for playCollision()
  let ambientNodes      = null; // non-null while the ambient pad is playing

  // ─── Persistence ────────────────────────────────────────────────────────────

  function loadHighScore() {
    try {
      highScore = parseInt(localStorage.getItem(LS_KEY), 10) || 0;
    } catch (_) {
      highScore = 0;
    }
  }

  function persistHighScore() {
    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem(LS_KEY, highScore); } catch (_) {}
    }
  }

  // ─── Canvas ─────────────────────────────────────────────────────────────────

  function resizeCanvas() {
    const dpr  = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.round(rect.width  * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvasWidth   = rect.width;
    canvasHeight  = rect.height;
    // setTransform instead of scale() avoids accumulation across repeated resizes
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (currentState === STATES.PLAYING) {
      player.x = Math.max(player.width / 2, Math.min(canvasWidth - player.width / 2, player.x));
    }
  }

  // ─── Screen visibility ──────────────────────────────────────────────────────

  function showScreen(state) {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.remove('screen--visible');
    });
    var idMap = {
      HOME:      'screen-home',
      PLAYING:   'screen-hud',
      PAUSED:    'screen-pause',
      GAME_OVER: 'screen-gameover'
    };
    var id = idMap[state];
    if (id) document.getElementById(id).classList.add('screen--visible');
  }

  // ─── State machine ──────────────────────────────────────────────────────────

  function transitionTo(nextState) {
    if (currentState === nextState) return;

    // Exit PLAYING: always stop the loop
    if (currentState === STATES.PLAYING) {
      stopLoop();
      stopAmbientMusic();
      if (nextState === STATES.GAME_OVER) {
        persistHighScore();
        document.getElementById('go-score').textContent  = 'Score: ' + score;
        document.getElementById('go-best').textContent   = 'Best: '  + highScore;
        document.getElementById('home-highscore').textContent = 'Best: ' + highScore;
      }
    }

    currentState = nextState;

    if (nextState === STATES.PLAYING) {
      startLoop();
      startAmbientMusic();
    } else {
      render(); // one static frame for HOME / PAUSED / GAME_OVER
    }

    showScreen(nextState);
  }

  // ─── Game loop ───────────────────────────────────────────────────────────────

  function startLoop() {
    if (rafId !== null) return; // guard against double-start
    lastTimestamp = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function tick(timestamp) {
    rafId = requestAnimationFrame(tick); // re-schedule first so stopLoop can cancel
    var dt = Math.min(timestamp - lastTimestamp, DT_CAP);
    lastTimestamp = timestamp;
    update(dt);
    render();
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  function update(dt) {
    if (currentState !== STATES.PLAYING) return;

    var dx = PLAYER_SPEED * (dt / 16.67);
    if (input.left)  player.x -= dx;
    if (input.right) player.x += dx;
    player.x = Math.max(player.width / 2, Math.min(canvasWidth - player.width / 2, player.x));

    // One-shot touch swipe: consumed after the frame that reads it
    if (touch.swipeLeft)  { input.left  = false; touch.swipeLeft  = false; }
    if (touch.swipeRight) { input.right = false; touch.swipeRight = false; }

    // ── survival time and difficulty ────────────────────────────────────────
    survivalTime += dt;

    var diff = Math.min(survivalTime / DIFFICULTY_RAMP_MS, 1);
    var currentObstacleSpeed = BASE_OBSTACLE_SPEED + (MAX_OBSTACLE_SPEED - BASE_OBSTACLE_SPEED) * diff;
    var currentSpawnInterval = BASE_SPAWN_INTERVAL - (BASE_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL) * diff;

    // ── combo decay ──────────────────────────────────────────────────────────
    if (combo > 1) {
      comboDecay += dt;
      if (comboDecay >= COMBO_DECAY_MS) {
        combo = 1; comboDecay = 0;
        updateHudCombo();
      }
    }

    // ── spawn timers ─────────────────────────────────────────────────────────
    spawnTimer += dt;
    if (spawnTimer >= currentSpawnInterval) {
      spawnTimer -= currentSpawnInterval;
      spawnObstacle(currentObstacleSpeed);
    }
    crystalTimer += dt;
    if (crystalTimer >= CRYSTAL_INTERVAL) {
      crystalTimer -= CRYSTAL_INTERVAL;
      spawnCrystal(currentObstacleSpeed * 0.7);
    }
    shieldTimer += dt;
    if (shieldTimer >= SHIELD_INTERVAL && !hasShield) {
      shieldTimer -= SHIELD_INTERVAL;
      spawnShield(currentObstacleSpeed * 0.5);
    }

    // ── move and cull obstacles ──────────────────────────────────────────────
    var i;
    for (i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].y += obstacles[i].speed * (dt / 16.67);
    }
    obstacles = obstacles.filter(function (o) { return o.y < canvasHeight + o.h; });

    // ── move crystals and shields ────────────────────────────────────────────
    for (i = crystals.length - 1; i >= 0; i--) {
      crystals[i].y += crystals[i].speed * (dt / 16.67);
    }
    for (i = shields.length - 1; i >= 0; i--) {
      shields[i].y += shields[i].speed * (dt / 16.67);
    }

    updateParticles(dt);

    // ── player bounds, computed once for all collision passes ───────────────
    var pb = {
      x: player.x - player.width  / 2 + HITBOX_SHRINK,
      y: player.y - player.height / 2 + HITBOX_SHRINK,
      w: player.width  - HITBOX_SHRINK * 2,
      h: player.height - HITBOX_SHRINK * 2
    };

    // ── obstacle collision ────────────────────────────────────────────────────
    var hitObstacle = false;
    for (i = 0; i < obstacles.length && !hitObstacle; i++) {
      if (overlaps(pb, obstacles[i])) {
        if (hasShield) {
          hasShield = false;
          document.getElementById('hud-shield').hidden = true;
          combo = 1; comboDecay = 0;
          updateHudCombo();
          spawnParticles(obstacles[i].x + obstacles[i].w / 2, obstacles[i].y + obstacles[i].h / 2,
            COLOR_SHIELD, 14, PARTICLE_LIFE_MS);
          playCollision();
          obstacles.splice(i, 1); // consume the obstacle that hit the shield
        } else {
          hitObstacle = true;
        }
      }
    }
    if (hitObstacle) {
      combo = 1; comboDecay = 0;
      spawnParticles(player.x, player.y, COLOR_OBSTACLE, 24, PARTICLE_DEATH_LIFE_MS);
      playCollision();
      transitionTo(STATES.GAME_OVER);
      return;
    }

    // ── crystal collection and miss detection ─────────────────────────────────
    crystals = crystals.filter(function (c) {
      if (overlaps(pb, c)) {
        combo = Math.min(combo + 1, COMBO_CAP);
        comboDecay = 0;
        score += BASE_CRYSTAL_SCORE * combo;
        updateHudScore();
        updateHudCombo();
        spawnParticles(c.x + c.w / 2, c.y + c.h / 2, COLOR_CRYSTAL, 8, PARTICLE_LIFE_MS);
        playChime();
        return false; // collected — remove from array
      }
      if (c.y > player.y + player.height / 2) {
        if (combo > 1) { combo = 1; comboDecay = 0; updateHudCombo(); }
        return false; // missed — remove from array
      }
      return true; // still falling, keep
    });

    // ── shield collection and cull ────────────────────────────────────────────
    shields = shields.filter(function (s) {
      if (overlaps(pb, s)) {
        hasShield = true;
        document.getElementById('hud-shield').hidden = false;
        spawnParticles(s.x + s.w / 2, s.y + s.h / 2, COLOR_SHIELD, 10, PARTICLE_LIFE_MS);
        return false;
      }
      if (s.y > canvasHeight + s.h) return false; // offscreen, cull
      return true;
    });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  function drawPlayer() {
    ctx.save();
    ctx.shadowColor = COLOR_PLAYER; ctx.shadowBlur = GLOW_BLUR;
    var grad = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, player.width / 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, COLOR_PLAYER);
    grad.addColorStop(1, 'rgba(0,246,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.width / 2, 0, Math.PI * 2);
    ctx.fill();
    if (hasShield) {
      ctx.shadowColor = COLOR_SHIELD; ctx.shadowBlur = GLOW_BLUR;
      ctx.strokeStyle = COLOR_SHIELD; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.width / 2 + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawObstacles() {
    ctx.save();
    ctx.shadowColor = COLOR_OBSTACLE; ctx.shadowBlur = GLOW_BLUR; ctx.fillStyle = COLOR_OBSTACLE;
    for (var i = 0; i < obstacles.length; i++) {
      ctx.fillRect(obstacles[i].x, obstacles[i].y, obstacles[i].w, obstacles[i].h);
    }
    ctx.restore();
  }

  function drawCrystals() {
    ctx.save();
    ctx.shadowColor = COLOR_CRYSTAL; ctx.shadowBlur = GLOW_BLUR; ctx.fillStyle = COLOR_CRYSTAL;
    for (var j = 0; j < crystals.length; j++) {
      var c  = crystals[j];
      var cx = c.x + c.w / 2;
      var cy = c.y + c.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); // 45°-rotated square = diamond
      ctx.restore();
    }
    ctx.restore();
  }

  function drawShields() {
    ctx.save();
    ctx.shadowColor = COLOR_SHIELD; ctx.shadowBlur = GLOW_BLUR;
    ctx.strokeStyle = COLOR_SHIELD; ctx.lineWidth = 2;
    for (var k = 0; k < shields.length; k++) {
      var s  = shields[k];
      var cx = s.x + s.w / 2;
      var cy = s.y + s.h / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, s.w / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles() {
    // no shadowBlur here — kept cheap, particle count can be high
    for (var i = 0; i < particles.length; i++) {
      var p     = particles[i];
      var alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = withAlpha(p.color, alpha);
      ctx.fillRect(p.x - PARTICLE_SIZE / 2, p.y - PARTICLE_SIZE / 2, PARTICLE_SIZE, PARTICLE_SIZE);
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    // no opaque fill — CSS-animated background on #game-container::before shows through

    if (currentState === STATES.PLAYING || currentState === STATES.PAUSED) {
      drawPlayer();
    }

    drawObstacles();
    drawCrystals();
    drawShields();
    drawParticles();

    ctx.shadowBlur = 0; // defensive reset so no state leaks past this frame
  }

  // ─── Reset ──────────────────────────────────────────────────────────────────

  function resetGame() {
    score      = 0;
    player.x   = canvasWidth  / 2;
    player.y   = canvasHeight * 0.75;
    obstacles  = [];
    crystals   = [];
    input.left = false;
    input.right = false;
    document.getElementById('hud-score').textContent = '0';
    document.getElementById('hud-combo').textContent = 'x1';
    document.getElementById('hud-shield').hidden     = true;
    shields      = [];
    hasShield    = false;
    combo        = 1;
    comboDecay   = 0;
    survivalTime = 0;
    spawnTimer   = 0;
    crystalTimer = 0;
    shieldTimer  = 0;
    particles    = [];
    transitionTo(STATES.PLAYING);
  }

  // ─── Spawning ────────────────────────────────────────────────────────────────

  function spawnObstacle(speed) {
    var w = OBSTACLE_MIN_W + Math.random() * (OBSTACLE_MAX_W - OBSTACLE_MIN_W);
    w = Math.min(w, canvasWidth - 2);
    var x = Math.max(0, Math.random() * (canvasWidth - w));
    obstacles.push({ x: x, y: -OBSTACLE_H, w: w, h: OBSTACLE_H, speed: speed });
  }

  function spawnCrystal(speed) {
    var x = Math.max(0, Math.random() * (canvasWidth - CRYSTAL_SIZE));
    crystals.push({ x: x, y: -CRYSTAL_SIZE, w: CRYSTAL_SIZE, h: CRYSTAL_SIZE, speed: speed });
  }

  function spawnShield(speed) {
    var x = Math.max(0, Math.random() * (canvasWidth - SHIELD_SIZE));
    shields.push({ x: x, y: -SHIELD_SIZE, w: SHIELD_SIZE, h: SHIELD_SIZE, speed: speed });
  }

  // ─── Particles ───────────────────────────────────────────────────────────────

  function spawnParticles(x, y, color, count, lifeMs) {
    for (var i = 0; i < count; i++) {
      if (particles.length >= PARTICLE_MAX_COUNT) particles.shift(); // drop oldest first
      var angle = Math.random() * Math.PI * 2;
      var speed = PARTICLE_SPEED_MIN + Math.random() * (PARTICLE_SPEED_MAX - PARTICLE_SPEED_MIN);
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: lifeMs, maxLife: lifeMs, color: color
      });
    }
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * (dt / 16.67);
      p.y += p.vy * (dt / 16.67);
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ─── Collision ───────────────────────────────────────────────────────────────

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function withAlpha(hexColor, alpha) {
    var r = parseInt(hexColor.slice(1, 3), 16);
    var g = parseInt(hexColor.slice(3, 5), 16);
    var b = parseInt(hexColor.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // ─── Audio ──────────────────────────────────────────────────────────────────
  // All sound is synthesized at runtime via the Web Audio API — no audio files,
  // no CDN, no network calls, per the offline/self-contained constraint. Context
  // creation is gesture-gated (see ensureAudioContext) to satisfy Safari/iOS
  // autoplay policy, and is a safe no-op in environments without AudioContext.

  function createNoiseBuffer(ctx, seconds) {
    var buffer = ctx.createBuffer(1, Math.max(1, Math.round(ctx.sampleRate * seconds)), ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function ensureAudioContext() {
    if (audioUnavailable) return null;

    if (!audioCtx) {
      var AudioCtxCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxCtor) {
        audioUnavailable = true;
        return null;
      }
      audioCtx = new AudioCtxCtor();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = AUDIO_MASTER_GAIN;
      var compressor = audioCtx.createDynamicsCompressor();
      masterGain.connect(compressor);
      compressor.connect(audioCtx.destination);
      noiseBuffer = createNoiseBuffer(audioCtx, NOISE_BUFFER_SEC);
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }

    return audioCtx;
  }

  function playClick() {
    var ctx = ensureAudioContext();
    if (!ctx) return;

    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = CLICK_FREQ_HZ;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(CLICK_GAIN, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + CLICK_DURATION_MS / 1000);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + CLICK_DURATION_MS / 1000);
  }

  function playChimeNote(ctx, freq, startTime, durationMs) {
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(CHIME_GAIN, startTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationMs / 1000);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + durationMs / 1000 + 0.02);
  }

  function playChime() {
    var ctx = ensureAudioContext();
    if (!ctx) return;

    var t0 = ctx.currentTime;
    playChimeNote(ctx, CHIME_NOTE1_HZ, t0, CHIME_NOTE_MS);
    playChimeNote(ctx, CHIME_NOTE2_HZ, t0 + (CHIME_NOTE_MS / 1000) * 0.6, CHIME_NOTE_MS);
  }

  function playCollision() {
    var ctx = ensureAudioContext();
    if (!ctx) return;

    var t0  = ctx.currentTime;
    var dur = COLLISION_DURATION_MS / 1000;

    // Pitch-sweep layer
    var sweepOsc = ctx.createOscillator();
    sweepOsc.type = 'sawtooth';
    sweepOsc.frequency.setValueAtTime(COLLISION_SWEEP_START_HZ, t0);
    sweepOsc.frequency.exponentialRampToValueAtTime(COLLISION_SWEEP_END_HZ, t0 + dur);
    var sweepGain = ctx.createGain();
    sweepGain.gain.setValueAtTime(COLLISION_GAIN, t0);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    sweepOsc.connect(sweepGain);
    sweepGain.connect(masterGain);
    sweepOsc.start(t0);
    sweepOsc.stop(t0 + dur + 0.02);

    // Filtered noise impact layer
    var noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    var bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 220;
    bandpass.Q.value = 0.8;
    var noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(COLLISION_GAIN * 0.8, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.6);
    noiseSrc.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseSrc.start(t0);
    noiseSrc.stop(t0 + dur);
  }

  function startAmbientMusic() {
    var ctx = ensureAudioContext();
    if (!ctx || ambientNodes) return; // unavailable, or already playing (idempotent)

    var t0 = ctx.currentTime;

    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = AMBIENT_FILTER_HZ;
    filter.Q.value = 0.7;

    var lfo = ctx.createOscillator();
    lfo.frequency.value = AMBIENT_LFO_HZ;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = AMBIENT_LFO_DEPTH_HZ;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(t0);

    var ambientGain = ctx.createGain();
    ambientGain.gain.setValueAtTime(0, t0);
    ambientGain.gain.linearRampToValueAtTime(AMBIENT_GAIN_TARGET, t0 + AMBIENT_FADE_IN_MS / 1000);

    var oscRoot = ctx.createOscillator();
    oscRoot.type = 'triangle';
    oscRoot.frequency.value = AMBIENT_ROOT_HZ;
    oscRoot.detune.value = -AMBIENT_DETUNE_CENTS;

    var oscFifth = ctx.createOscillator();
    oscFifth.type = 'triangle';
    oscFifth.frequency.value = AMBIENT_FIFTH_HZ;
    oscFifth.detune.value = AMBIENT_DETUNE_CENTS;

    oscRoot.connect(filter);
    oscFifth.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(masterGain);

    oscRoot.start(t0);
    oscFifth.start(t0);

    ambientNodes = { oscRoot: oscRoot, oscFifth: oscFifth, lfo: lfo, ambientGain: ambientGain };
  }

  function stopAmbientMusic() {
    if (!ambientNodes || !audioCtx) return;

    var t0      = audioCtx.currentTime;
    var fadeSec = AMBIENT_FADE_OUT_MS / 1000;
    var gainParam = ambientNodes.ambientGain.gain;

    gainParam.cancelScheduledValues(t0);
    gainParam.setValueAtTime(gainParam.value, t0);
    gainParam.linearRampToValueAtTime(0.0001, t0 + fadeSec);

    ambientNodes.oscRoot.stop(t0 + fadeSec + 0.05);
    ambientNodes.oscFifth.stop(t0 + fadeSec + 0.05);
    ambientNodes.lfo.stop(t0 + fadeSec + 0.05);

    ambientNodes = null;
  }

  // ─── HUD ─────────────────────────────────────────────────────────────────────

  function updateHudScore() {
    document.getElementById('hud-score').textContent = score;
  }

  function updateHudCombo() {
    document.getElementById('hud-combo').textContent = 'x' + combo;
  }

  // ─── Input: keyboard ────────────────────────────────────────────────────────

  function onKeyDown(e) {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        input.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        input.right = true;
        break;
      case 'Escape':
        if (currentState === STATES.PLAYING) transitionTo(STATES.PAUSED);
        else if (currentState === STATES.PAUSED) transitionTo(STATES.PLAYING);
        break;
    }
    // Prevent arrow keys and space from scrolling the page
    if (e.code === 'ArrowLeft'  || e.code === 'ArrowRight' ||
        e.code === 'ArrowUp'    || e.code === 'ArrowDown'  ||
        e.code === 'Space') {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        input.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        input.right = false;
        break;
    }
  }

  // ─── Input: touch ────────────────────────────────────────────────────────────

  function onTouchStart(e) {
    touch.startX = e.touches[0].clientX;
    touch.startY = e.touches[0].clientY;
    e.preventDefault();
  }

  function onTouchEnd(e) {
    var dx = e.changedTouches[0].clientX - touch.startX;
    var dy = e.changedTouches[0].clientY - touch.startY;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        input.left       = true;
        touch.swipeLeft  = true;
      } else {
        input.right      = true;
        touch.swipeRight = true;
      }
    }
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  function init() {
    canvas = document.getElementById('gameCanvas');
    ctx    = canvas.getContext('2d');

    loadHighScore();
    resizeCanvas();

    // Keep canvas logical size in sync with layout changes
    var ro = new ResizeObserver(function () {
      resizeCanvas();
      if (currentState !== STATES.PLAYING) render();
    });
    ro.observe(document.getElementById('game-container'));

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });

    // Button wiring
    document.getElementById('btn-play').addEventListener('click', function () {
      playClick();
      resetGame();
    });
    document.getElementById('btn-pause').addEventListener('click', function () {
      playClick();
      transitionTo(STATES.PAUSED);
    });
    document.getElementById('btn-resume').addEventListener('click', function () {
      playClick();
      transitionTo(STATES.PLAYING);
    });
    document.getElementById('btn-pause-home').addEventListener('click', function () {
      playClick();
      transitionTo(STATES.HOME);
    });
    document.getElementById('btn-restart').addEventListener('click', function () {
      playClick();
      resetGame();
    });
    document.getElementById('btn-go-home').addEventListener('click', function () {
      playClick();
      transitionTo(STATES.HOME);
    });

    document.getElementById('home-highscore').textContent = 'Best: ' + highScore;
    transitionTo(STATES.HOME);
  }

  document.addEventListener('DOMContentLoaded', init);

  // DevTools inspection surface only — not consumed by any module
  window.NeonDash = {
    getState: function () { return currentState; },
    getScore: function () { return score; }
  };

  // Unit-test hook only — separate from window.NeonDash so that export stays
  // exactly as story #260 contracted it. Exposes the pieces #261 added so
  // collision/scoring/combo logic can be driven and inspected without a DOM.
  window.__neonDashTestHooks = {
    overlaps: overlaps,
    resetGame: resetGame,
    tick: function (dt) { update(dt); render(); },
    getPlayer: function () { return player; },
    getCombo: function () { return combo; },
    getHasShield: function () { return hasShield; },
    getSurvivalTime: function () { return survivalTime; },
    getObstacles: function () { return obstacles; },
    getCrystals: function () { return crystals; },
    getShields: function () { return shields; },
    getParticles: function () { return particles; }
  };

})();
