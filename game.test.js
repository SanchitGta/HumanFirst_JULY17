'use strict';

// Unit tests for the gameplay logic added in story #261 (obstacle/crystal/shield
// collision, scoring, combo, and difficulty state) added to game.js.
//
// game.js runs as a plain IIFE against browser globals (document, window,
// localStorage, requestAnimationFrame, ResizeObserver). There is no bundler or
// test framework in this repo, so this harness loads the real source into a
// vm context with minimal DOM/browser stubs and drives it through
// `window.__neonDashTestHooks` (a test-only surface added alongside, but
// separate from, the story #260 `window.NeonDash` debug shim so that
// contracted export is left byte-for-byte unchanged).
//
// Run with: node --test game.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;

function makeElement(overrides) {
  const listeners = {};
  return Object.assign(
    {
      textContent: '',
      hidden: false,
      classList: { add() {}, remove() {} },
      addEventListener(type, fn) {
        (listeners[type] = listeners[type] || []).push(fn);
      },
      getBoundingClientRect() {
        return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
      },
      _listeners: listeners
    },
    overrides
  );
}

function makeCanvas() {
  const ctx = {
    fillStyle: null,
    fillRect() {},
    clearRect() {},
    setTransform() {},
    save() {},
    restore() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    translate() {},
    rotate() {},
    createRadialGradient() {
      return { addColorStop() {} };
    }
  };
  return makeElement({
    width: 0,
    height: 0,
    getContext() {
      return ctx;
    }
  });
}

// Loads a fresh copy of game.js into its own vm context so each test starts
// from a clean module state, and fires DOMContentLoaded to run init().
function loadGame() {
  const elements = {};
  [
    'gameCanvas', 'game-container', 'hud-score', 'hud-combo', 'hud-shield',
    'go-score', 'go-best', 'home-highscore',
    'btn-play', 'btn-pause', 'btn-resume', 'btn-pause-home', 'btn-restart', 'btn-go-home',
    'screen-home', 'screen-hud', 'screen-pause', 'screen-gameover'
  ].forEach((id) => {
    elements[id] = id === 'gameCanvas' ? makeCanvas() : makeElement();
  });

  const documentListeners = {};
  const documentStub = {
    addEventListener(type, fn) {
      (documentListeners[type] = documentListeners[type] || []).push(fn);
    },
    getElementById(id) {
      if (!elements[id]) throw new Error('Unknown element id requested: ' + id);
      return elements[id];
    },
    querySelectorAll() {
      return [
        elements['screen-home'],
        elements['screen-hud'],
        elements['screen-pause'],
        elements['screen-gameover']
      ];
    }
  };

  const localStorageStore = {};
  const localStorageStub = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(localStorageStore, key)
        ? localStorageStore[key]
        : null;
    },
    setItem(key, value) {
      localStorageStore[key] = String(value);
    }
  };

  const sandbox = {
    document: documentStub,
    localStorage: localStorageStub,
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
    addEventListener() {},
    removeEventListener() {},
    performance: { now: () => 0 },
    ResizeObserver: class {
      observe() {}
    },
    console
  };
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: 'game.js' });

  // Run story #260's init(), registered on DOMContentLoaded.
  (documentListeners.DOMContentLoaded || []).forEach((fn) => fn());

  return { sandbox, elements, localStorageStore };
}

// Player AABB after HITBOX_SHRINK=4 inset, for a freshly reset game
// (player.x = canvasWidth/2 = 200, player.y = canvasHeight*0.75 = 450,
// width/height = 40): x in [184, 216], y in [434, 466].
function overlappingRect(w, h) {
  return { x: 190, y: 440, w, h };
}

test('overlaps() detects AABB intersection and respects exclusive edges', () => {
  const { sandbox } = loadGame();
  const overlaps = sandbox.__neonDashTestHooks.overlaps;

  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 }), false);
  // Touching edges (a's right edge == b's left edge) do not count as overlapping.
  assert.equal(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), false);
});

test('collecting a crystal increases score by BASE_CRYSTAL_SCORE * combo and increments combo', () => {
  const { sandbox } = loadGame();
  const hooks = sandbox.__neonDashTestHooks;

  hooks.resetGame();
  assert.equal(sandbox.NeonDash.getScore(), 0);
  assert.equal(hooks.getCombo(), 1);

  hooks.getCrystals().push(Object.assign(overlappingRect(16, 16), { speed: 5 }));
  hooks.tick(0);

  assert.equal(hooks.getCrystals().length, 0, 'collected crystal is removed');
  assert.equal(hooks.getCombo(), 2, 'combo increments on collection');
  assert.equal(sandbox.NeonDash.getScore(), 20, '10 (base) * 2 (new combo)');
});

test('combo multiplier scales score on consecutive collections and caps at COMBO_CAP', () => {
  const { sandbox } = loadGame();
  const hooks = sandbox.__neonDashTestHooks;
  hooks.resetGame();

  // Collect 12 crystals in a row; combo should climb 2..10 and then hold at 10.
  for (let i = 0; i < 12; i++) {
    hooks.getCrystals().push(Object.assign(overlappingRect(16, 16), { speed: 5 }));
    hooks.tick(0);
  }

  assert.equal(hooks.getCombo(), 10, 'combo multiplier caps at 10');
  // 2+3+...+10 (9 terms) then two more collections at the cap (10 each).
  const expectedScore = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10].reduce(
    (sum, multiplier) => sum + 10 * multiplier,
    0
  );
  assert.equal(sandbox.NeonDash.getScore(), expectedScore);
});

test('a crystal that passes the player uncollected resets combo to 1 without changing score', () => {
  const { sandbox } = loadGame();
  const hooks = sandbox.__neonDashTestHooks;
  hooks.resetGame();

  // Build combo up to 3 first.
  for (let i = 0; i < 2; i++) {
    hooks.getCrystals().push(Object.assign(overlappingRect(16, 16), { speed: 5 }));
    hooks.tick(0);
  }
  assert.equal(hooks.getCombo(), 3);
  const scoreBeforeMiss = sandbox.NeonDash.getScore();

  // Player bottom edge is at y = 450 + 20 = 470; a crystal below that is a miss.
  hooks.getCrystals().push({ x: 190, y: 480, w: 16, h: 16, speed: 5 });
  hooks.tick(0);

  assert.equal(hooks.getCrystals().length, 0, 'missed crystal is removed');
  assert.equal(hooks.getCombo(), 1, 'miss resets combo to 1');
  assert.equal(sandbox.NeonDash.getScore(), scoreBeforeMiss, 'score unaffected by a miss');
});

test('combo decays to 1 after COMBO_DECAY_MS of idle time without a collection', () => {
  const { sandbox } = loadGame();
  const hooks = sandbox.__neonDashTestHooks;
  hooks.resetGame();

  hooks.getCrystals().push(Object.assign(overlappingRect(16, 16), { speed: 5 }));
  hooks.tick(0);
  assert.equal(hooks.getCombo(), 2, 'combo raised by the collection');

  hooks.tick(3000); // >= COMBO_DECAY_MS with no further collections

  assert.equal(hooks.getCombo(), 1, 'idle decay resets combo');
  assert.equal(sandbox.NeonDash.getState(), 'PLAYING', 'decay does not end the run');
});

test('colliding with an obstacle while unshielded ends the game and locks in the score', () => {
  const { sandbox } = loadGame();
  const hooks = sandbox.__neonDashTestHooks;
  hooks.resetGame();

  hooks.getCrystals().push(Object.assign(overlappingRect(16, 16), { speed: 5 }));
  hooks.tick(0); // score = 20, combo = 2
  const scoreAtCollision = sandbox.NeonDash.getScore();

  hooks.getObstacles().push(Object.assign(overlappingRect(30, 24), { speed: 5 }));
  hooks.tick(0);

  assert.equal(sandbox.NeonDash.getState(), 'GAME_OVER');
  assert.equal(sandbox.NeonDash.getScore(), scoreAtCollision, 'score is locked in at collision');
  assert.equal(hooks.getCombo(), 1, 'combo resets on collision');
});

test('a held shield absorbs exactly one obstacle collision instead of ending the game', () => {
  const { sandbox } = loadGame();
  const hooks = sandbox.__neonDashTestHooks;
  hooks.resetGame();

  hooks.getShields().push(Object.assign(overlappingRect(20, 20), { speed: 5 }));
  hooks.tick(0);
  assert.equal(hooks.getHasShield(), true, 'shield pickup equips the shield');
  assert.equal(sandbox.elements['hud-shield'].hidden, false);

  hooks.getObstacles().push(Object.assign(overlappingRect(30, 24), { speed: 5 }));
  hooks.tick(0);

  assert.equal(sandbox.NeonDash.getState(), 'PLAYING', 'first collision is absorbed, not fatal');
  assert.equal(hooks.getHasShield(), false, 'shield is consumed');
  assert.equal(sandbox.elements['hud-shield'].hidden, true);
  assert.equal(hooks.getObstacles().length, 0, 'the absorbing obstacle is removed');

  // Next collision without a shield is fatal.
  hooks.getObstacles().push(Object.assign(overlappingRect(30, 24), { speed: 5 }));
  hooks.tick(0);
  assert.equal(sandbox.NeonDash.getState(), 'GAME_OVER');
});

test('reaching game over with a new high score persists it to localStorage', () => {
  const { sandbox, localStorageStore } = loadGame();
  const hooks = sandbox.__neonDashTestHooks;
  hooks.resetGame();

  hooks.getCrystals().push(Object.assign(overlappingRect(16, 16), { speed: 5 }));
  hooks.tick(0); // score = 20

  hooks.getObstacles().push(Object.assign(overlappingRect(30, 24), { speed: 5 }));
  hooks.tick(0); // game over, unshielded

  assert.equal(sandbox.NeonDash.getState(), 'GAME_OVER');
  assert.equal(localStorageStore.neonDash_highScore, '20');
});

test('resetGame() clears combo, shield, obstacles, crystals, and shields for a fresh run', () => {
  const { sandbox } = loadGame();
  const hooks = sandbox.__neonDashTestHooks;
  hooks.resetGame();

  hooks.getCrystals().push(Object.assign(overlappingRect(16, 16), { speed: 5 }));
  hooks.tick(0);
  hooks.getShields().push(Object.assign(overlappingRect(20, 20), { speed: 5 }));
  hooks.tick(0);
  hooks.getObstacles().push({ x: 0, y: 0, w: 10, h: 10, speed: 5 });

  hooks.resetGame();

  assert.equal(hooks.getCombo(), 1);
  assert.equal(hooks.getHasShield(), false);
  assert.equal(hooks.getObstacles().length, 0);
  assert.equal(hooks.getCrystals().length, 0);
  assert.equal(hooks.getShields().length, 0);
  assert.equal(hooks.getSurvivalTime(), 0);
  assert.equal(sandbox.NeonDash.getScore(), 0);
});

test('survivalTime accumulates elapsed frame time, driving the difficulty ramp', () => {
  const { sandbox } = loadGame();
  const hooks = sandbox.__neonDashTestHooks;
  hooks.resetGame();

  hooks.tick(100);
  hooks.tick(250);

  assert.equal(hooks.getSurvivalTime(), 350);
});

test('resetGame() clears particles for a fresh run', () => {
  const { sandbox } = loadGame();
  const hooks = sandbox.__neonDashTestHooks;
  hooks.resetGame();

  hooks.getCrystals().push(Object.assign(overlappingRect(16, 16), { speed: 5 }));
  hooks.tick(0); // collection spawns particles

  assert.ok(hooks.getParticles().length > 0, 'collecting a crystal spawns particles');

  hooks.resetGame();

  assert.equal(hooks.getParticles().length, 0, 'reset clears particles');
});

test('particle count never exceeds PARTICLE_MAX_COUNT', () => {
  const { sandbox } = loadGame();
  const hooks = sandbox.__neonDashTestHooks;
  hooks.resetGame();

  // Each crystal collection spawns 8 particles; 15 collections would push well
  // past the 80-particle cap without the drop-oldest-first guard.
  for (let i = 0; i < 15; i++) {
    hooks.getCrystals().push(Object.assign(overlappingRect(16, 16), { speed: 5 }));
    hooks.tick(0);
  }

  assert.ok(hooks.getParticles().length <= 80, 'particle count stays at or below the hard cap');
});
