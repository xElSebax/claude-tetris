'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';
const RECORDS_KEY = 'tetris-records';
const START_LEVEL_KEY = 'tetris-start-level';
const MAX_SCORES = 5;
const MAX_START_LEVEL = 20;
const INPUT_BLOCK_MS = 150;
const THEME_COLORS = {
  dark: { grid: '#22222e' },
  light: { grid: '#d0d0dc' },
};

const SKIN_PALETTES = {
  retro: [
    null,
    '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784',
    '#e57373', '#90caf9', '#ffb74d', '#b0bec5',
  ],
  neon: [
    null,
    '#00f5ff', '#ffe600', '#e040fb', '#39ff14',
    '#ff3131', '#4d88ff', '#ff8c00', '#d0d0d0',
  ],
  pastel: [
    null,
    '#9eeaf5', '#fff0a3', '#d4b3e8', '#b8e8b8',
    '#f5b8b8', '#b8d4f5', '#ffd4a8', '#d0d8dc',
  ],
  pixel: [
    null,
    '#3dc2d0', '#e6c229', '#9b59b6', '#5cb85c',
    '#d9534f', '#5b9bd5', '#e67e22', '#95a5a6',
  ],
};

const SKIN_IDS = ['retro', 'neon', 'pastel', 'pixel'];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut (3×3 ring)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const gameoverPanel = document.getElementById('gameover-panel');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const pausePanel = document.getElementById('pause-panel');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const backFromControlsBtn = document.getElementById('back-from-controls');
const startLevelValue = document.getElementById('start-level-value');
const levelDownBtn = document.getElementById('level-down');
const levelUpBtn = document.getElementById('level-up');
const themeDarkBtn = document.getElementById('theme-dark');
const themeLightBtn = document.getElementById('theme-light');
const skinBtns = SKIN_IDS.map(id => document.getElementById(`skin-${id}`));
const sidebarRecordsEl = document.getElementById('sidebar-records');
const overlayRecordsEl = document.getElementById('overlay-records');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const overlayBestComboEl = document.getElementById('overlay-best-combo');
const overlayMaxLinesEl = document.getElementById('overlay-max-lines');
const overlaySaveEl = document.getElementById('overlay-save');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxCombo, scoreSaved, onStartScreen;
let theme = 'dark';
let skin = 'retro';
let colors = SKIN_PALETTES.retro;
let drawBlockImpl = drawBlockRetro;
let startLevel = 1;
let pauseView = 'main';
let ignoreInputUntil = 0;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function levelDropInterval(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = levelDropInterval(level);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  if (!clearLines()) combo = 0;
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function roundRect(context, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function shadeColor(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

function drawBlockRetro(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = colors[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  const h = size - 2;
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(px, py, w, h);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px, py, w, 4);
  context.restore();
}

function drawBlockNeon(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = colors[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  const h = size - 2;
  const a = alpha ?? 1;
  context.save();
  context.globalAlpha = a;
  context.shadowBlur = a < 1 ? 10 : 18;
  context.shadowColor = color;
  context.fillStyle = color;
  context.fillRect(px, py, w, h);
  context.shadowBlur = 0;
  context.fillStyle = 'rgba(255,255,255,0.25)';
  context.fillRect(px, py, w, 3);
  context.restore();
}

function drawBlockPastel(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = colors[colorIndex];
  const margin = 2;
  const px = x * size + margin;
  const py = y * size + margin;
  const w = size - margin * 2;
  const h = size - margin * 2;
  const radius = Math.max(3, w * 0.22);
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  roundRect(context, px, py, w, h, radius);
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.45)';
  context.lineWidth = 1;
  roundRect(context, px + 0.5, py + 0.5, w - 1, h - 1, Math.max(2, radius - 1));
  context.stroke();
  context.restore();
}

function drawBlockPixel(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = colors[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  const h = size - 2;
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(px, py, w, h);
  const step = Math.max(3, Math.floor(size / 5));
  context.fillStyle = shadeColor(color, -35);
  for (let ty = 0; ty < h; ty += step) {
    for (let tx = 0; tx < w; tx += step) {
      if ((Math.floor(tx / step) + Math.floor(ty / step)) % 2 === 0) {
        context.fillRect(px + tx, py + ty, 2, 2);
      }
    }
  }
  context.fillStyle = shadeColor(color, 40);
  context.fillRect(px, py, w, 2);
  context.fillRect(px, py, 2, h);
  context.fillStyle = shadeColor(color, -50);
  context.fillRect(px, py + h - 2, w, 2);
  context.fillRect(px + w - 2, py, 2, h);
  context.restore();
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  drawBlockImpl(context, x, y, colorIndex, size, alpha);
}

function clearCanvas(context, width, height) {
  if (skin === 'neon') {
    context.fillStyle = '#000000';
    context.fillRect(0, 0, width, height);
  } else {
    context.clearRect(0, 0, width, height);
  }
}

function drawGrid() {
  if (skin === 'neon') {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  } else if (skin === 'pastel') {
    ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  } else {
    ctx.strokeStyle = THEME_COLORS[theme].grid;
  }
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  clearCanvas(ctx, canvas.width, canvas.height);
  drawGrid();

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!gameOver) {
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }
}

function drawNext() {
  const NB = 30;
  clearCanvas(nextCtx, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return { scores: [], bestCombo: 0, maxLines: 0 };
    const data = JSON.parse(raw);
    return {
      scores: Array.isArray(data.scores) ? data.scores : [],
      bestCombo: data.bestCombo || 0,
      maxLines: data.maxLines || 0,
    };
  } catch {
    return { scores: [], bestCombo: 0, maxLines: 0 };
  }
}

function saveRecords(data) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(data));
}

function qualifiesForTop(value) {
  const { scores } = loadRecords();
  if (scores.length < MAX_SCORES) return true;
  return value > scores[scores.length - 1].score;
}

function getRankForScore(value) {
  const { scores } = loadRecords();
  let rank = 1;
  for (const entry of scores) {
    if (value > entry.score) return rank;
    rank++;
  }
  return scores.length < MAX_SCORES ? rank : -1;
}

function addScore(name, pts, gameLines, gameCombo) {
  const records = loadRecords();
  records.scores.push({
    name: (name || '').trim().slice(0, 12) || 'Jugador',
    score: pts,
    lines: gameLines,
    combo: gameCombo,
  });
  records.scores.sort((a, b) => b.score - a.score);
  records.scores = records.scores.slice(0, MAX_SCORES);
  records.bestCombo = Math.max(records.bestCombo, gameCombo);
  records.maxLines = Math.max(records.maxLines, gameLines);
  saveRecords(records);
  renderAllRecords();
}

function resetRecords() {
  saveRecords({ scores: [], bestCombo: 0, maxLines: 0 });
  renderAllRecords();
}

function renderRecordsList(listEl, highlightRank) {
  const { scores } = loadRecords();
  listEl.innerHTML = '';

  const items = [];
  let scoreIdx = 0;

  for (let rank = 1; rank <= MAX_SCORES; rank++) {
    if (highlightRank === rank) {
      items.push({ highlight: true, rank, pending: true });
    } else if (scoreIdx < scores.length) {
      items.push({ ...scores[scoreIdx], rank, highlight: false });
      scoreIdx++;
    }
  }

  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin records';
    listEl.appendChild(li);
    return;
  }

  for (const entry of items) {
    const li = document.createElement('li');
    if (entry.highlight) li.classList.add('highlight');
    if (entry.pending) {
      li.innerHTML = `<span class="rank">${entry.rank}</span><span class="name">Tú</span><span class="pts">★</span>`;
    } else {
      li.innerHTML = `<span class="rank">${entry.rank}</span><span class="name">${entry.name}</span><span class="pts">${entry.score.toLocaleString()}</span>`;
    }
    listEl.appendChild(li);
  }
}

function renderRecordStats() {
  const { bestCombo, maxLines } = loadRecords();
  bestComboEl.textContent = bestCombo;
  maxLinesEl.textContent = maxLines;
  overlayBestComboEl.textContent = bestCombo;
  overlayMaxLinesEl.textContent = maxLines;
}

function renderAllRecords(highlightRank) {
  renderRecordStats();
  renderRecordsList(sidebarRecordsEl, null);
  renderRecordsList(overlayRecordsEl, highlightRank ?? null);
}

function updateGlobalStats(gameLines, gameCombo) {
  const records = loadRecords();
  const bestCombo = Math.max(records.bestCombo, gameCombo);
  const maxLines = Math.max(records.maxLines, gameLines);
  if (bestCombo !== records.bestCombo || maxLines !== records.maxLines) {
    records.bestCombo = bestCombo;
    records.maxLines = maxLines;
    saveRecords(records);
  }
}

function updateStartLevelDisplay() {
  startLevelValue.textContent = startLevel;
}

function setStartLevel(lvl) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, lvl));
  localStorage.setItem(START_LEVEL_KEY, String(startLevel));
  updateStartLevelDisplay();
}

function showPauseView(view) {
  pauseView = view;
  pauseMain.classList.toggle('hidden', view !== 'main');
  pauseControls.classList.toggle('hidden', view !== 'controls');
  document.querySelector('.pause-level').classList.toggle('hidden', view !== 'main');
}

function showGameOverOverlay() {
  gameoverPanel.classList.remove('hidden');
  pausePanel.classList.add('hidden');
  overlay.classList.remove('hidden');
}

function showPauseOverlay() {
  gameoverPanel.classList.add('hidden');
  pausePanel.classList.remove('hidden');
  showPauseView('main');
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
  gameoverPanel.classList.add('hidden');
  pausePanel.classList.add('hidden');
}

function gameInputBlocked() {
  return paused || gameOver || performance.now() < ignoreInputUntil;
}

function endGame() {
  gameOver = true;
  onStartScreen = false;
  scoreSaved = false;
  cancelAnimationFrame(animId);
  updateGlobalStats(lines, maxCombo);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Combo: ${maxCombo}`;

  const rank = getRankForScore(score);
  const qualifies = rank > 0;

  if (qualifies) {
    overlaySaveEl.classList.remove('hidden');
    playerNameInput.value = '';
    playerNameInput.disabled = false;
    saveScoreBtn.disabled = false;
    setTimeout(() => playerNameInput.focus(), 50);
  } else {
    overlaySaveEl.classList.add('hidden');
  }

  restartBtn.textContent = 'Reiniciar';
  renderAllRecords(qualifies ? rank : null);
  showGameOverOverlay();
}

function saveCurrentScore() {
  if (scoreSaved || !qualifiesForTop(score)) return;
  addScore(playerNameInput.value, score, lines, maxCombo);
  scoreSaved = true;
  playerNameInput.disabled = true;
  saveScoreBtn.disabled = true;
  overlaySaveEl.classList.add('hidden');
  renderAllRecords(null);
}

function showStartScreen() {
  onStartScreen = true;
  gameOver = true;
  paused = false;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = 'Destruye líneas y alcanza el top 5';
  overlaySaveEl.classList.add('hidden');
  restartBtn.textContent = 'Jugar';
  renderAllRecords(null);
  showGameOverOverlay();
}

function resumeGame() {
  if (gameOver || !paused) return;
  paused = false;
  hideOverlay();
  ignoreInputUntil = performance.now() + INPUT_BLOCK_MS;
  lastTime = performance.now();
  dropAccum = 0;
  loop(lastTime);
}

function togglePause() {
  if (gameOver) return;
  if (paused) {
    resumeGame();
  } else {
    paused = true;
    cancelAnimationFrame(animId);
    overlaySaveEl.classList.add('hidden');
    showPauseOverlay();
  }
}

function updateThemeButtons() {
  const isDark = theme === 'dark';
  themeDarkBtn.classList.toggle('active', isDark);
  themeLightBtn.classList.toggle('active', !isDark);
  themeDarkBtn.setAttribute('aria-pressed', String(isDark));
  themeLightBtn.setAttribute('aria-pressed', String(!isDark));
}

function applyTheme(nextTheme) {
  theme = nextTheme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  updateThemeButtons();
}

function setTheme(nextTheme) {
  if (nextTheme !== 'dark' && nextTheme !== 'light') return;
  applyTheme(nextTheme);
  if (board) {
    draw();
    drawNext();
  }
}

const SKIN_DRAWERS = {
  retro: drawBlockRetro,
  neon: drawBlockNeon,
  pastel: drawBlockPastel,
  pixel: drawBlockPixel,
};

function updateSkinButtons() {
  skinBtns.forEach(btn => {
    const active = btn.dataset.skin === skin;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function applySkin(nextSkin) {
  skin = nextSkin;
  colors = SKIN_PALETTES[skin];
  drawBlockImpl = SKIN_DRAWERS[skin];
  document.documentElement.setAttribute('data-skin', skin);
  localStorage.setItem(SKIN_KEY, skin);
  updateSkinButtons();
}

function setSkin(nextSkin) {
  if (!SKIN_IDS.includes(nextSkin)) return;
  applySkin(nextSkin);
  if (board) {
    draw();
    drawNext();
  }
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  applySkin(SKIN_IDS.includes(saved) ? saved : 'retro');
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

function initStartLevel() {
  const saved = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  setStartLevel(Number.isFinite(saved) ? saved : 1);
}

function loop(ts) {
  if (paused || gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = (startLevel - 1) * 10;
  level = startLevel;
  combo = 0;
  maxCombo = 0;
  scoreSaved = false;
  paused = false;
  gameOver = false;
  onStartScreen = false;
  pauseView = 'main';
  dropInterval = levelDropInterval(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlaySaveEl.classList.add('hidden');
  restartBtn.textContent = 'Reiniciar';
  hideOverlay();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!gameOver) {
      e.preventDefault();
      togglePause();
    }
    return;
  }
  if (gameInputBlocked()) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', resumeGame);
pauseRestartBtn.addEventListener('click', () => {
  ignoreInputUntil = performance.now() + INPUT_BLOCK_MS;
  init();
});
showControlsBtn.addEventListener('click', () => showPauseView('controls'));
backFromControlsBtn.addEventListener('click', () => showPauseView('main'));
levelDownBtn.addEventListener('click', () => setStartLevel(startLevel - 1));
levelUpBtn.addEventListener('click', () => setStartLevel(startLevel + 1));
themeDarkBtn.addEventListener('click', () => setTheme('dark'));
themeLightBtn.addEventListener('click', () => setTheme('light'));
skinBtns.forEach(btn => {
  btn.addEventListener('click', () => setSkin(btn.dataset.skin));
});
saveScoreBtn.addEventListener('click', saveCurrentScore);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveCurrentScore();
});
resetRecordsBtn.addEventListener('click', () => {
  if (confirm('¿Borrar todos los records?')) resetRecords();
});

initTheme();
initSkin();
initStartLevel();
renderAllRecords(null);
showStartScreen();
