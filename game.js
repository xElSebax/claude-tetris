'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // Nut - metallic grey
];

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
const resetRecordsBtn = document.getElementById('reset-records-btn');
const sidebarResetRecordsBtn = document.getElementById('sidebar-reset-records');
const themeDarkBtn = document.getElementById('theme-dark');
const themeLightBtn = document.getElementById('theme-light');

const THEME_KEY = 'tetris-theme';
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const THEME_COLORS = {
  dark: { grid: '#22222e' },
  light: { grid: '#d0d0dc' },
};

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme = 'dark';
let currentCombo, maxCombo;
let records = [];
let highlightRecordIndex = -1;
let pendingRecordSave = false;
let recordSaved = false;
let awaitingStart = true;

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
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = THEME_COLORS[theme].grid;
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!gameOver) {
    // ghost
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    // current piece
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
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
  const isPause = mode === 'pause';
  const isGameOver = mode === 'gameover';

  playBtn.classList.toggle('hidden', !isStart);
  restartBtn.classList.toggle('hidden', isStart);
  overlayStats.classList.toggle('hidden', !isGameOver);
  overlayQualify.classList.toggle('hidden', !(isGameOver && pendingRecordSave && !recordSaved));
  nameForm.classList.toggle('hidden', !(isGameOver && pendingRecordSave && !recordSaved));
  overlayRecords.classList.toggle('hidden', isPause);
  resetRecordsBtn.classList.toggle('hidden', isPause);
}

function showStartScreen() {
  awaitingStart = true;
  gameOver = true;
  paused = false;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = 'Pulsa Jugar para empezar';
  highlightRecordIndex = -1;
  pendingRecordSave = false;
  recordSaved = false;
  renderRecords();
  setOverlayMode('start');
  overlay.classList.remove('hidden');
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  pendingRecordSave = qualifiesForRecords(score);
  recordSaved = false;
  highlightRecordIndex = -1;

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayStats.textContent = `Combo máx: ${maxCombo} · Líneas: ${lines}`;
  playerNameInput.value = '';

  renderRecords();
  setOverlayMode('gameover');
  overlay.classList.remove('hidden');

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
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlayStats.classList.add('hidden');
    overlayQualify.classList.add('hidden');
    nameForm.classList.add('hidden');
    setOverlayMode('pause');
    overlay.classList.remove('hidden');
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

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
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
  level = 1;
  currentCombo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  pendingRecordSave = false;
  recordSaved = false;
  highlightRecordIndex = -1;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
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

restartBtn.addEventListener('click', init);
playBtn.addEventListener('click', init);
saveRecordBtn.addEventListener('click', savePendingRecord);
resetRecordsBtn.addEventListener('click', resetRecords);
sidebarResetRecordsBtn.addEventListener('click', resetRecords);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') savePendingRecord();
});
themeDarkBtn.addEventListener('click', () => setTheme('dark'));
themeLightBtn.addEventListener('click', () => setTheme('light'));

initTheme();
loadRecords();
renderRecords();
showStartScreen();
