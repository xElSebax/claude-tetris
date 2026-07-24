'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const MAX_START_LEVEL = 15;

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
const pauseOverlay = document.getElementById('pause-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlayStats = document.getElementById('overlay-stats');
const overlayQualify = document.getElementById('overlay-qualify');
const nameForm = document.getElementById('name-form');
const playerNameInput = document.getElementById('player-name');
const saveRecordBtn = document.getElementById('save-record-btn');
const sidebarRecords = document.getElementById('sidebar-records');
const overlayRecords = document.getElementById('overlay-records');
const playBtn = document.getElementById('play-btn');
const restartBtn = document.getElementById('restart-btn');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const toggleControlsBtn = document.getElementById('toggle-controls-btn');
const pauseControls = document.getElementById('pause-controls');
const levelDownBtn = document.getElementById('level-down');
const levelUpBtn = document.getElementById('level-up');
const startLevelDisplay = document.getElementById('start-level-display');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const sidebarResetRecordsBtn = document.getElementById('sidebar-reset-records');
const themeDarkBtn = document.getElementById('theme-dark');
const themeLightBtn = document.getElementById('theme-light');
const skinBtns = document.querySelectorAll('.skin-btn');

const THEME_KEY = 'tetris-theme';
const START_LEVEL_KEY = 'tetris-start-level';
const RECORDS_KEY = 'tetris-records';
const SKIN_KEY = 'tetris-skin';
const MAX_RECORDS = 5;
const SKIN_IDS = ['retro', 'neon', 'pastel', 'pixel'];

const THEME_COLORS = {
  dark: { panel: '#1a1a25', grid: '#22222e' },
  light: { panel: '#ffffff', grid: '#d0d0dc' },
};

const SKIN_PALETTES = {
  retro: [
    null,
    '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784',
    '#e57373', '#90caf9', '#ffb74d', '#b0bec5',
  ],
  neon: [
    null,
    '#00fff5', '#ffff00', '#ff00ff', '#00ff66',
    '#ff3366', '#3399ff', '#ff9900', '#cccccc',
  ],
  pastel: [
    null,
    '#a8e6cf', '#ffd3b6', '#d4a5d9', '#b5ead7',
    '#ffb3ba', '#c7ceea', '#ffdfba', '#dfe6e9',
  ],
  pixel: [
    null,
    '#5cdbd3', '#ffe066', '#b37feb', '#95de64',
    '#ff7875', '#69c0ff', '#ffc069', '#bfbfbf',
  ],
};

const SKINS = {
  retro: {
    canvasBg: t => THEME_COLORS[t].panel,
    grid: t => THEME_COLORS[t].grid,
    draw: drawBlockRetro,
  },
  neon: {
    canvasBg: () => '#000000',
    grid: () => '#141420',
    draw: drawBlockNeon,
  },
  pastel: {
    canvasBg: () => '#faf8ff',
    grid: () => '#e8e0f0',
    draw: drawBlockPastel,
  },
  pixel: {
    canvasBg: t => (t === 'dark' ? '#1a1a2e' : '#e8e8f0'),
    grid: t => (t === 'dark' ? '#2a2a40' : '#c8c8d8'),
    draw: drawBlockPixel,
  },
};

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme = 'dark';
let skin = 'retro';
let startLevel = 1;
let pauseControlsVisible = false;
let currentCombo, maxCombo;
let records = [];
let highlightRecordIndex = -1;
let pendingRecordSave = false;
let recordSaved = false;
let awaitingStart = true;

function dropIntervalForLevel(lv) {
  return Math.max(100, 1000 - (lv - 1) * 90);
}

function levelFromLines() {
  return startLevel + Math.floor(lines / 10);
}

function skinColors() {
  return SKIN_PALETTES[skin];
}

function blockRect(x, y, size) {
  const pad = 1;
  return {
    px: x * size + pad,
    py: y * size + pad,
    w: size - pad * 2,
    h: size - pad * 2,
  };
}

function drawBlockRetro(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = skinColors()[colorIndex];
  const { px, py, w, h } = blockRect(x, y, size);
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(px, py, w, h);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px, py, w, 4);
  context.globalAlpha = 1;
}

function drawBlockNeon(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = skinColors()[colorIndex];
  const { px, py, w, h } = blockRect(x, y, size);
  const a = alpha ?? 1;
  context.save();
  context.globalAlpha = a;
  context.shadowBlur = a < 1 ? 10 : 18;
  context.shadowColor = color;
  context.fillStyle = color;
  context.fillRect(px, py, w, h);
  context.restore();
}

function drawBlockPastel(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = skinColors()[colorIndex];
  const { px, py, w, h } = blockRect(x, y, size);
  const radius = Math.min(6, size * 0.22);
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(px, py, w, h, radius);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.35)';
  context.beginPath();
  context.roundRect(px + 2, py + 2, w - 4, Math.min(5, h * 0.25), radius * 0.5);
  context.fill();
  context.globalAlpha = 1;
}

function drawBlockPixel(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = skinColors()[colorIndex];
  const { px, py, w, h } = blockRect(x, y, size);
  const a = alpha ?? 1;
  context.globalAlpha = a;
  context.fillStyle = color;
  context.fillRect(px, py, w, h);
  if (a >= 0.5) {
    const cell = Math.max(2, Math.floor(size / 6));
    context.fillStyle = 'rgba(0,0,0,0.18)';
    for (let dy = 0; dy < h; dy += cell) {
      for (let dx = 0; dx < w; dx += cell) {
        if (((dx / cell) + (dy / cell)) % 2 === 0) {
          context.fillRect(px + dx, py + dy, cell, cell);
        }
      }
    }
    context.fillStyle = 'rgba(255,255,255,0.25)';
    for (let dy = cell; dy < h; dy += cell * 2) {
      for (let dx = cell; dx < w; dx += cell * 2) {
        context.fillRect(px + dx, py + dy, 1, 1);
      }
    }
  }
  context.globalAlpha = 1;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  SKINS[skin].draw(context, x, y, colorIndex, size, alpha);
}

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
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = levelFromLines();
    dropInterval = dropIntervalForLevel(level);
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
  const cleared = clearLines();
  if (cleared > 0) {
    currentCombo++;
    if (currentCombo > maxCombo) maxCombo = currentCombo;
  } else {
    currentCombo = 0;
  }
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

function updateStartLevelDisplay() {
  startLevelDisplay.textContent = startLevel;
}

function setStartLevel(value) {
  startLevel = Math.max(1, Math.min(MAX_START_LEVEL, value));
  localStorage.setItem(START_LEVEL_KEY, String(startLevel));
  updateStartLevelDisplay();
}

function fillCanvasBackground(context, width, height) {
  context.fillStyle = SKINS[skin].canvasBg(theme);
  context.fillRect(0, 0, width, height);
}

function drawGrid() {
  ctx.strokeStyle = SKINS[skin].grid(theme);
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
  fillCanvasBackground(ctx, canvas.width, canvas.height);
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
  fillCanvasBackground(nextCtx, nextCanvas.width, nextCanvas.height);
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
    const parsed = raw ? JSON.parse(raw) : [];
    records = Array.isArray(parsed)
      ? parsed.sort((a, b) => b.score - a.score).slice(0, MAX_RECORDS)
      : [];
  } catch {
    records = [];
  }
}

function saveRecords() {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function qualifiesForRecords(points) {
  if (records.length < MAX_RECORDS) return true;
  const lowest = records[records.length - 1]?.score ?? 0;
  return points > lowest;
}

function formatRecordDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short' });
}

function buildRecordsTable(compact) {
  if (!records.length) {
    return '<p class="records-empty">Sin records aún</p>';
  }

  const headers = compact
    ? '<tr><th>#</th><th>Nombre</th><th>Pts</th><th>Cmb</th><th>Lín</th></tr>'
    : '<tr><th>#</th><th>Nombre</th><th>Puntos</th><th>Combo</th><th>Líneas</th><th>Fecha</th></tr>';

  const rows = records.map((entry, index) => {
    const highlight = index === highlightRecordIndex ? ' class="record-highlight"' : '';
    const name = escapeHtml(entry.name || 'Jugador');
    const scoreText = Number(entry.score || 0).toLocaleString();
    const comboText = entry.combo ?? 0;
    const linesText = entry.lines ?? 0;
    const dateText = formatRecordDate(entry.date);

    if (compact) {
      return `<tr${highlight}><td>${index + 1}</td><td>${name}</td><td class="col-score">${scoreText}</td><td>${comboText}</td><td>${linesText}</td></tr>`;
    }
    return `<tr${highlight}><td>${index + 1}</td><td>${name}</td><td class="col-score">${scoreText}</td><td>${comboText}</td><td>${linesText}</td><td>${dateText}</td></tr>`;
  }).join('');

  return `<table class="records-table"><thead>${headers}</thead><tbody>${rows}</tbody></table>`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderRecords() {
  sidebarRecords.innerHTML = buildRecordsTable(true);
  overlayRecords.innerHTML = buildRecordsTable(false);
}

function addRecord(name) {
  const entry = {
    name: (name || 'Jugador').trim().slice(0, 20) || 'Jugador',
    score,
    combo: maxCombo,
    lines,
    date: new Date().toISOString(),
  };

  records.push(entry);
  records.sort((a, b) => b.score - a.score);
  records = records.slice(0, MAX_RECORDS);
  highlightRecordIndex = records.findIndex(
    r => r.score === entry.score && r.date === entry.date
  );
  saveRecords();
  renderRecords();
}

function resetRecords() {
  if (!confirm('¿Borrar todos los records?')) return;
  records = [];
  highlightRecordIndex = -1;
  saveRecords();
  renderRecords();
}

function setOverlayMode(mode) {
  const isStart = mode === 'start';
  const isGameOver = mode === 'gameover';

  playBtn.classList.toggle('hidden', !isStart);
  restartBtn.classList.toggle('hidden', isStart);
  overlayStats.classList.toggle('hidden', !isGameOver);
  overlayQualify.classList.toggle('hidden', !(isGameOver && pendingRecordSave && !recordSaved));
  nameForm.classList.toggle('hidden', !(isGameOver && pendingRecordSave && !recordSaved));
}

function showStartScreen() {
  awaitingStart = true;
  gameOver = true;
  paused = false;
  cancelAnimationFrame(animId);
  pauseOverlay.classList.add('hidden');
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = 'Pulsa Jugar para empezar';
  highlightRecordIndex = -1;
  pendingRecordSave = false;
  recordSaved = false;
  renderRecords();
  setOverlayMode('start');
  gameOverOverlay.classList.remove('hidden');
}

function setPauseControlsVisible(visible) {
  pauseControlsVisible = visible;
  pauseControls.classList.toggle('hidden', !visible);
  toggleControlsBtn.textContent = visible ? 'Ocultar controles' : 'Ver controles';
}

function showPauseMenu() {
  paused = true;
  cancelAnimationFrame(animId);
  setPauseControlsVisible(false);
  updateStartLevelDisplay();
  pauseOverlay.classList.remove('hidden');
}

function hidePauseMenu() {
  paused = false;
  pauseOverlay.classList.add('hidden');
  setPauseControlsVisible(false);
}

function resumeGame() {
  if (gameOver || !paused) return;
  hidePauseMenu();
  lastTime = performance.now();
  loop(lastTime);
}

function endGame() {
  gameOver = true;
  paused = false;
  cancelAnimationFrame(animId);
  pauseOverlay.classList.add('hidden');
  pendingRecordSave = qualifiesForRecords(score);
  recordSaved = false;
  highlightRecordIndex = -1;

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayStats.textContent = `Combo máx: ${maxCombo} · Líneas: ${lines}`;
  playerNameInput.value = '';

  renderRecords();
  setOverlayMode('gameover');
  gameOverOverlay.classList.remove('hidden');

  if (pendingRecordSave) {
    playerNameInput.focus();
  }
}

function savePendingRecord() {
  if (!pendingRecordSave || recordSaved) return;
  addRecord(playerNameInput.value);
  recordSaved = true;
  pendingRecordSave = false;
  overlayQualify.classList.add('hidden');
  nameForm.classList.add('hidden');
}

function togglePause() {
  if (gameOver || awaitingStart) return;
  if (paused) {
    resumeGame();
  } else {
    showPauseMenu();
  }
}

function updateThemeButtons() {
  const isDark = theme === 'dark';
  themeDarkBtn.classList.toggle('active', isDark);
  themeLightBtn.classList.toggle('active', !isDark);
  themeDarkBtn.setAttribute('aria-pressed', String(isDark));
  themeLightBtn.setAttribute('aria-pressed', String(!isDark));
}

function updateSkinButtons() {
  skinBtns.forEach(btn => {
    const active = btn.dataset.skin === skin;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
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

function applySkin(nextSkin) {
  skin = nextSkin;
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

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  applySkin(SKIN_IDS.includes(saved) ? saved : 'retro');
}

function initStartLevel() {
  const saved = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  startLevel = Number.isFinite(saved) && saved >= 1 && saved <= MAX_START_LEVEL ? saved : 1;
  updateStartLevelDisplay();
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
  awaitingStart = false;
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  currentCombo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  pendingRecordSave = false;
  recordSaved = false;
  highlightRecordIndex = -1;
  dropInterval = dropIntervalForLevel(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  pauseOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
  setPauseControlsVisible(false);
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!gameOver && !awaitingStart) {
      e.preventDefault();
      togglePause();
    }
    return;
  }
  if (awaitingStart || paused || gameOver) return;
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

resumeBtn.addEventListener('click', resumeGame);
pauseRestartBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);
playBtn.addEventListener('click', init);
toggleControlsBtn.addEventListener('click', () => setPauseControlsVisible(!pauseControlsVisible));
levelDownBtn.addEventListener('click', () => setStartLevel(startLevel - 1));
levelUpBtn.addEventListener('click', () => setStartLevel(startLevel + 1));
saveRecordBtn.addEventListener('click', savePendingRecord);
resetRecordsBtn.addEventListener('click', resetRecords);
sidebarResetRecordsBtn.addEventListener('click', resetRecords);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') savePendingRecord();
});
themeDarkBtn.addEventListener('click', () => setTheme('dark'));
themeLightBtn.addEventListener('click', () => setTheme('light'));
skinBtns.forEach(btn => {
  btn.addEventListener('click', () => setSkin(btn.dataset.skin));
});

initTheme();
initSkin();
initStartLevel();
loadRecords();
renderRecords();
showStartScreen();
