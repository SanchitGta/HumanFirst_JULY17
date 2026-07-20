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

  let canvas, ctx;
  let currentState  = null;
  let rafId         = null;
  let lastTimestamp = 0;
  let canvasWidth   = 0;
  let canvasHeight  = 0;
  let player        = { x: 0, y: 0, width: 40, height: 40 };
  let score         = 0;
  let highScore     = 0;
  let obstacles     = [];   // stub — populated by #261
  let crystals      = [];   // stub — populated by #261
  let input         = { left: false, right: false };
  let touch         = { startX: 0, startY: 0, swipeLeft: false, swipeRight: false };

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

    // TODO #261: obstacle/crystal spawn, movement, collision detection, score increment, difficulty scaling
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  function render() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (currentState === STATES.PLAYING || currentState === STATES.PAUSED) {
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(
        player.x - player.width  / 2,
        player.y - player.height / 2,
        player.width,
        player.height
      );
    }

    // TODO #261: render obstacles, crystals, shields
    // TODO #262: replace all fillRect calls with styled/glow versions
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
    transitionTo(STATES.PLAYING);
    // TODO #261: reset difficulty, speed, spawn timers
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
      resetGame();
    });
    document.getElementById('btn-pause').addEventListener('click', function () {
      transitionTo(STATES.PAUSED);
    });
    document.getElementById('btn-resume').addEventListener('click', function () {
      transitionTo(STATES.PLAYING);
    });
    document.getElementById('btn-pause-home').addEventListener('click', function () {
      transitionTo(STATES.HOME);
    });
    document.getElementById('btn-restart').addEventListener('click', function () {
      resetGame();
    });
    document.getElementById('btn-go-home').addEventListener('click', function () {
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

})();
