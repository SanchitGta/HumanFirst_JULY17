// Game constants
const MOVES = ['ROCK', 'PAPER', 'SCISSORS'];
const EMOJIS = { ROCK: '✊', PAPER: '✋', SCISSORS: '✌️' };
const NAMES = { ROCK: 'Rock', PAPER: 'Paper', SCISSORS: 'Scissors' };
const BEATS = { ROCK: 'SCISSORS', PAPER: 'ROCK', SCISSORS: 'PAPER' };

const THINKING_DELAY_MS = 900;
const REVEAL_HOLD_MS = 2000;

const STORAGE_KEY = 'rps_v1';

let state = {
  rounds: [],
  score: { playerWins: 0, computerWins: 0, draws: 0 },
  roundNum: 1,
  playing: false,
};

let storageAvailable = false;

// Storage: persistence to localStorage
const Storage = {
  isAvailable() {
    try {
      const probeKey = '__rps_probe__';
      localStorage.setItem(probeKey, '1');
      localStorage.removeItem(probeKey);
      return true;
    } catch (e) {
      return false;
    }
  },

  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rounds: state.rounds, score: state.score }));
    } catch (e) {}
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  },
};

// Score: win/loss/draw counters
const Score = {
  getScore() {
    return state.score;
  },

  recordWin() {
    state.score.playerWins++;
    return state.score;
  },

  recordLoss() {
    state.score.computerWins++;
    return state.score;
  },

  recordDraw() {
    state.score.draws++;
    return state.score;
  },

  resetScore() {
    state.score = { playerWins: 0, computerWins: 0, draws: 0 };
    return state.score;
  },
};

// Round: computer move + outcome rules
const Round = {
  getComputerMove() {
    return MOVES[Math.floor(Math.random() * 3)];
  },

  determineOutcome(playerMove, computerMove) {
    if (playerMove === computerMove) return 'DRAW';
    return BEATS[playerMove] === computerMove ? 'WIN' : 'LOSE';
  },

  play(playerMove) {
    const computerMove = this.getComputerMove();
    const outcome = this.determineOutcome(playerMove, computerMove);
    const round = {
      id: state.roundNum,
      playerMove,
      computerMove,
      outcome,
      playedAt: new Date().toISOString(),
    };
    state.rounds.unshift(round);
    state.roundNum++;
    return round;
  },
};

// Game/UI wiring
function setButtonsDisabled(disabled) {
  document.querySelectorAll('.choice-btn').forEach((btn) => {
    btn.classList.toggle('disabled', disabled);
    btn.disabled = disabled;
  });
}

function resetRoundDisplay() {
  const playerIcon = document.getElementById('player-icon');
  const cpuIcon = document.getElementById('cpu-icon');
  const resultBanner = document.getElementById('result-banner');
  playerIcon.textContent = '?';
  playerIcon.className = 'choice-icon player-icon empty';
  cpuIcon.textContent = '?';
  cpuIcon.className = 'choice-icon cpu-icon empty';
  resultBanner.className = 'result-banner';
}

function renderScoreboard() {
  document.querySelector('#score-player .score-value').textContent = state.score.playerWins;
  document.querySelector('#score-ties .score-value').textContent = state.score.draws;
  document.querySelector('#score-cpu .score-value').textContent = state.score.computerWins;
}

function pulseScoreboard() {
  const cards = [
    document.querySelector('#score-player .score-value'),
    document.querySelector('#score-cpu .score-value'),
  ];
  cards.forEach((el) => el.classList.add('pulse'));
  setTimeout(() => {
    cards.forEach((el) => el.classList.remove('pulse'));
  }, 600);
}

function renderHistoryItem(round) {
  const list = document.getElementById('history-list');
  const empty = list.querySelector('.history-empty');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = 'history-item';
  item.innerHTML = `
    <span class="history-round">#${round.id}</span>
    <div class="history-moves">
      <span title="${NAMES[round.playerMove]}">${EMOJIS[round.playerMove]}</span>
      <span class="history-vs">vs</span>
      <span title="${NAMES[round.computerMove]}">${EMOJIS[round.computerMove]}</span>
    </div>
    <div class="history-outcome">
      <span class="outcome-badge ${round.outcome.toLowerCase()}">${round.outcome}</span>
    </div>
  `;
  list.insertBefore(item, list.firstChild);
}

function renderHistoryItemDirect(round, list) {
  const item = document.createElement('div');
  item.className = 'history-item';
  item.style.animation = 'none';
  item.innerHTML = `
    <span class="history-round">#${round.id}</span>
    <div class="history-moves">
      <span title="${NAMES[round.playerMove]}">${EMOJIS[round.playerMove]}</span>
      <span class="history-vs">vs</span>
      <span title="${NAMES[round.computerMove]}">${EMOJIS[round.computerMove]}</span>
    </div>
    <div class="history-outcome">
      <span class="outcome-badge ${round.outcome.toLowerCase()}">${round.outcome}</span>
    </div>
  `;
  list.appendChild(item);
}

function renderHistoryCount() {
  const n = state.rounds.length;
  document.getElementById('history-count').textContent = `${n} round${n !== 1 ? 's' : ''}`;
}

function showEmptyHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = `<div class="history-empty"><div style="font-size:28px;margin-bottom:8px">🎮</div>Choose rock, paper, or scissors to start!</div>`;
}

function showToast(msg) {
  const container = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      t.classList.add('show');
    });
  });
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2000);
}

function spawnConfetti() {
  const display = document.getElementById('round-display');
  const colors = ['#1E3A2F', '#2D5442', '#7AA896', '#D5E5DE', '#16a34a', '#f59e0b'];
  for (let i = 0; i < 18; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-piece';
    c.style.cssText = `
      left:${10 + Math.random() * 80}%;
      bottom:20px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay:${Math.random() * 0.3}s;
      animation-duration:${0.6 + Math.random() * 0.5}s;
    `;
    display.appendChild(c);
    setTimeout(() => c.remove(), 1200);
  }
}

function playMove(playerMove) {
  if (state.playing) return;
  state.playing = true;
  setButtonsDisabled(true);

  const playerIcon = document.getElementById('player-icon');
  const cpuIcon = document.getElementById('cpu-icon');
  const resultBanner = document.getElementById('result-banner');

  playerIcon.textContent = EMOJIS[playerMove];
  playerIcon.classList.remove('empty');
  playerIcon.classList.add('bounce-in');

  cpuIcon.innerHTML = '<div class="thinking"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
  cpuIcon.classList.remove('empty');
  resultBanner.className = 'result-banner';

  setTimeout(() => {
    const round = Round.play(playerMove);

    cpuIcon.innerHTML = EMOJIS[round.computerMove];
    cpuIcon.classList.add('bounce-in');

    if (round.outcome === 'WIN') {
      Score.recordWin();
      resultBanner.textContent = '🎉 You win this round!';
      resultBanner.className = 'result-banner show win';
      spawnConfetti();
    } else if (round.outcome === 'LOSE') {
      Score.recordLoss();
      resultBanner.textContent = '💻 Computer wins this round';
      resultBanner.className = 'result-banner show lose';
      playerIcon.classList.add('shake');
    } else {
      Score.recordDraw();
      resultBanner.textContent = "🤝 It's a draw!";
      resultBanner.className = 'result-banner show draw';
    }

    renderScoreboard();
    pulseScoreboard();

    document.getElementById('round-counter').textContent = `Round ${state.roundNum}`;
    renderHistoryItem(round);
    renderHistoryCount();
    if (storageAvailable) Storage.save(state);

    setTimeout(() => {
      resetRoundDisplay();
      state.playing = false;
      setButtonsDisabled(false);
    }, REVEAL_HOLD_MS);
  }, THINKING_DELAY_MS);
}

function resetGame() {
  if (state.rounds.length === 0 && state.score.playerWins === 0 && state.score.computerWins === 0 && state.score.draws === 0) return;

  Score.resetScore();
  state.rounds = [];
  state.roundNum = 1;
  state.playing = false;
  if (storageAvailable) Storage.clear();

  renderScoreboard();
  document.getElementById('round-counter').textContent = 'Round 1';
  resetRoundDisplay();
  setButtonsDisabled(false);

  showEmptyHistory();
  renderHistoryCount();
  showToast('Game reset!');
}

function init() {
  storageAvailable = Storage.isAvailable();

  if (storageAvailable) {
    const saved = Storage.load();
    if (saved) {
      state.rounds = saved.rounds || [];
      state.score = saved.score || { playerWins: 0, computerWins: 0, draws: 0 };
      state.roundNum = state.rounds.length + 1;
    }
  }

  renderScoreboard();
  document.getElementById('round-counter').textContent = `Round ${state.roundNum}`;
  renderHistoryCount();

  if (state.rounds.length > 0) {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    state.rounds.slice(0, 20).forEach((r) => renderHistoryItemDirect(r, list));
  }

  document.getElementById('btn-rock').addEventListener('click', () => playMove('ROCK'));
  document.getElementById('btn-paper').addEventListener('click', () => playMove('PAPER'));
  document.getElementById('btn-scissors').addEventListener('click', () => playMove('SCISSORS'));
  document.getElementById('reset-btn').addEventListener('click', resetGame);
}

if (typeof document !== 'undefined') {
  init();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MOVES, EMOJIS, NAMES, BEATS, Storage, Score, Round };
}
