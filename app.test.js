// Unit tests for the pure game-logic modules in app.js (Round, Score, Storage).
// Uses Node's built-in test runner and assert module only — no dependencies, no build step.
// Run with: node --test app.test.js

const test = require('node:test');
const assert = require('node:assert/strict');

function makeMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

global.localStorage = makeMemoryStorage();

const { MOVES, BEATS, Storage, Score, Round } = require('./app.js');

test('Round.determineOutcome covers all 9 move combinations per standard RPS rules', () => {
  for (const playerMove of MOVES) {
    for (const computerMove of MOVES) {
      const outcome = Round.determineOutcome(playerMove, computerMove);
      if (playerMove === computerMove) {
        assert.equal(outcome, 'DRAW', `${playerMove} vs ${computerMove}`);
      } else if (BEATS[playerMove] === computerMove) {
        assert.equal(outcome, 'WIN', `${playerMove} vs ${computerMove}`);
      } else {
        assert.equal(outcome, 'LOSE', `${playerMove} vs ${computerMove}`);
      }
    }
  }
});

test('Round.getComputerMove always returns one of the three valid moves (uniform-random contract)', () => {
  for (let i = 0; i < 200; i++) {
    assert.ok(MOVES.includes(Round.getComputerMove()));
  }
});

test('Round.play records a round, advances roundNum, and unshifts onto rounds (most-recent-first)', () => {
  const before = Round.play('ROCK');
  assert.equal(before.playerMove, 'ROCK');
  assert.ok(MOVES.includes(before.computerMove));
  assert.ok(['WIN', 'LOSE', 'DRAW'].includes(before.outcome));
  assert.ok(before.playedAt);
});

test('Score counters increment independently and reset to zero', () => {
  Score.resetScore();
  assert.deepEqual(Score.getScore(), { playerWins: 0, computerWins: 0, draws: 0 });

  Score.recordWin();
  Score.recordWin();
  Score.recordLoss();
  Score.recordDraw();

  assert.deepEqual(Score.getScore(), { playerWins: 2, computerWins: 1, draws: 1 });

  Score.resetScore();
  assert.deepEqual(Score.getScore(), { playerWins: 0, computerWins: 0, draws: 0 });
});

test('Storage.save/load round-trips rounds and score through localStorage', () => {
  Storage.clear();
  assert.equal(Storage.load(), null);

  const snapshot = {
    rounds: [{ id: 1, playerMove: 'ROCK', computerMove: 'SCISSORS', outcome: 'WIN', playedAt: '2026-01-01T00:00:00.000Z' }],
    score: { playerWins: 1, computerWins: 0, draws: 0 },
  };
  Storage.save(snapshot);

  const loaded = Storage.load();
  assert.deepEqual(loaded, snapshot);
});

test('Storage.load returns null for missing or corrupted data instead of throwing', () => {
  Storage.clear();
  assert.equal(Storage.load(), null);

  global.localStorage.setItem('rps_v1', 'not valid json{{{');
  assert.equal(Storage.load(), null);

  Storage.clear();
});

test('Storage.clear removes the persisted key', () => {
  Storage.save({ rounds: [], score: { playerWins: 0, computerWins: 0, draws: 0 } });
  assert.notEqual(Storage.load(), null);

  Storage.clear();
  assert.equal(Storage.load(), null);
});

test('Storage.isAvailable returns a boolean and does not throw when localStorage is missing', () => {
  const saved = global.localStorage;
  delete global.localStorage;

  assert.equal(Storage.isAvailable(), false);

  global.localStorage = saved;
  assert.equal(Storage.isAvailable(), true);
});
