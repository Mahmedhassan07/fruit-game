// ── Canvas Setup ──────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// ── Fruit Data ────────────────────────────────────────────────
const FRUITS = [
  { emoji: '🍎', color: '#e63946', points: 1 },
  { emoji: '🍊', color: '#f4a261', points: 1 },
  { emoji: '🍋', color: '#f9c74f', points: 2 },
  { emoji: '🍇', color: '#9b5de5', points: 3 },
  { emoji: '🍓', color: '#e63946', points: 2 },
  { emoji: '🍑', color: '#ffb347', points: 2 },
  { emoji: '🥝', color: '#90be6d', points: 3 },
  { emoji: '🍍', color: '#f9c74f', points: 4 },
  { emoji: '🍒', color: '#c1121f', points: 2 },
  { emoji: '🫐', color: '#577590', points: 3 },
];

// ── Game State ────────────────────────────────────────────────
let fruits = [];
let particles = [];
let floatingTexts = [];
let score = 0;
let timeLeft = 20;
let gameRunning = false;
let spawnInterval, gameTimer;
let comboCount = 0;
let comboTimer = null;
const comboTimeout = 1500;
let highScore = parseInt(localStorage.getItem('fruitHS') || '0');
let lastFrameTime = 0;
let difficulty = 1;

// ── UI Helpers ────────────────────────────────────────────────
function updateUI() {
  document.getElementById('score-val').textContent = score;
  document.getElementById('timer-val').textContent = timeLeft;
  document.getElementById('best-val').textContent = highScore;
  const timerBox = document.getElementById('timer-box');
  timerBox.classList.toggle('danger', timeLeft <= 10);
}

function showCombo() {
  const cd = document.getElementById('combo-display');
  const ct = document.getElementById('combo-text');
  if (comboCount >= 2) {
    cd.classList.remove('hidden');
    ct.textContent = 'x' + comboCount;
    ct.style.color =
      comboCount >= 5 ? '#f94144' :
      comboCount >= 3 ? '#f9c74f' :
      '#90e0ef';
  } else {
    cd.classList.add('hidden');
  }
}

// ── Fruit Class ───────────────────────────────────────────────
class Fruit {
  constructor() {
    const f = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    this.emoji      = f.emoji;
    this.color      = f.color;
    this.basePoints = f.points;
    this.r          = 34 + Math.random() * 18;
    this.x          = this.r + Math.random() * (canvas.width - this.r * 2);
    this.y          = -this.r - 20;
    this.speed      = 1.5 + Math.random() * 2 + difficulty * 0.3;
    this.wobble     = (Math.random() - 0.5) * 0.8;
    this.rotation   = 0;
    this.rotSpeed   = (Math.random() - 0.5) * 0.05;
    this.alive      = true;
    this.sliced     = false;
    this.sliceAnim  = 0;
    this.opacity    = 1;
    this.scale      = 1;
    this.bouncePhase = Math.random() * Math.PI * 2;
  }

  update(dt) {
    if (!this.sliced) {
      this.y          += this.speed;
      this.x          += this.wobble;
      this.rotation   += this.rotSpeed;
      this.bouncePhase += 0.04;
      if (this.y > canvas.height + this.r + 20) this.alive = false;
    } else {
      this.sliceAnim += dt * 0.003;
      this.scale   = 1 + this.sliceAnim * 0.3;
      this.opacity = Math.max(0, 1 - this.sliceAnim * 1.5);
      if (this.opacity <= 0) this.alive = false;
    }
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scale, this.scale);

    // Glow
    ctx.shadowColor = this.color;
    ctx.shadowBlur  = this.sliced ? 30 : 12;

    // Circle background
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    // Emoji
    ctx.shadowBlur      = 0;
    ctx.font            = `${this.r * 1.3}px serif`;
    ctx.textAlign       = 'center';
    ctx.textBaseline    = 'middle';
    ctx.fillText(this.emoji, 0, 2);

    // Slice lines (shown after cut)
    if (this.sliced) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 3;
      ctx.globalAlpha = this.opacity * 0.9;

      ctx.beginPath();
      ctx.moveTo(-this.r * 0.9, -this.r * 0.3);
      ctx.lineTo( this.r * 0.9,  this.r * 0.3);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-this.r * 0.5, -this.r * 0.8);
      ctx.lineTo( this.r * 0.5,  this.r * 0.8);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Check if a point (px, py) is inside this fruit's circle
  contains(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return Math.sqrt(dx * dx + dy * dy) <= this.r;
  }
}

// ── Particle Class ────────────────────────────────────────────
class Particle {
  constructor(x, y, color) {
    this.x     = x;
    this.y     = y;
    this.color = color;
    this.vx    = (Math.random() - 0.5) * 8;
    this.vy    = (Math.random() - 0.8) * 8;
    this.life  = 1;
    this.decay = 0.02 + Math.random() * 0.03;
    this.r     = 3 + Math.random() * 5;
  }

  update() {
    this.x    += this.vx;
    this.y    += this.vy;
    this.vy   += 0.25;          // gravity
    this.life -= this.decay;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * this.life, 0, Math.PI * 2);
    ctx.fillStyle   = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur  = 8;
    ctx.fill();
    ctx.restore();
  }
}

// ── Floating Score Text Class ─────────────────────────────────
class FloatingText {
  constructor(x, y, text, color) {
    this.x     = x;
    this.y     = y;
    this.text  = text;
    this.color = color;
    this.life  = 1;
    this.vy    = -2.5;
  }

  update() {
    this.y    += this.vy;
    this.vy   *= 0.95;
    this.life -= 0.022;
  }

  draw() {
    ctx.save();
    ctx.globalAlpha  = this.life;
    ctx.font         = `bold ${22 + (1 - this.life) * 10}px 'Fredoka One', cursive`;
    ctx.textAlign    = 'center';
    ctx.fillStyle    = this.color;
    ctx.shadowColor  = this.color;
    ctx.shadowBlur   = 12;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// ── Spawning ──────────────────────────────────────────────────
function spawnFruit() {
  if (!gameRunning) return;
  // Chance to spawn 2 fruits increases with difficulty
  const count = Math.random() < 0.2 + difficulty * 0.05 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    fruits.push(new Fruit());
  }
}

// ── Slice Logic ───────────────────────────────────────────────
function sliceFruit(x, y) {
  fruits.forEach(f => {
    if (!f.sliced && f.alive && f.contains(x, y)) {
      f.sliced = true;

      // Update combo
      comboCount++;
      if (comboTimer) clearTimeout(comboTimer);
      comboTimer = setTimeout(() => {
        comboCount = 0;
        showCombo();
      }, comboTimeout);
      showCombo();

      // Calculate points with multiplier
      const multiplier =
        comboCount >= 5 ? 4 :
        comboCount >= 3 ? 2 :
        comboCount >= 2 ? 1.5 : 1;
      const pts = Math.ceil(f.basePoints * multiplier);
      score += pts;
      updateUI();

      // Spawn juice particles
      for (let i = 0; i < 14; i++) {
        particles.push(new Particle(f.x, f.y, f.color));
      }

      // Floating score label
      const label = comboCount >= 2 ? `+${pts} x${comboCount}` : `+${pts}`;
      const col   =
        comboCount >= 5 ? '#f94144' :
        comboCount >= 3 ? '#f9c74f' :
        '#fff';
      floatingTexts.push(new FloatingText(f.x, f.y - 20, label, col));
    }
  });
}

// ── Input Events ──────────────────────────────────────────────
canvas.addEventListener('click', (e) => {
  if (!gameRunning) return;
  const rect = canvas.getBoundingClientRect();
  sliceFruit(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!gameRunning) return;
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  sliceFruit(t.clientX - rect.left, t.clientY - rect.top);
}, { passive: false });

// ── Background Grid ───────────────────────────────────────────
function drawBackground() {
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth   = 1;
  const gs        = 20;

  for (let x = 0; x < canvas.width; x += gs) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gs) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

// ── Game Loop ─────────────────────────────────────────────────
function loop(ts) {
  if (!gameRunning) return;
  const dt = ts - lastFrameTime;
  lastFrameTime = ts;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  // Update
  fruits.forEach(f => f.update(dt));
  particles.forEach(p => p.update());
  floatingTexts.forEach(t => t.update());

  // Remove dead objects
  fruits       = fruits.filter(f => f.alive);
  particles    = particles.filter(p => p.life > 0);
  floatingTexts = floatingTexts.filter(t => t.life > 0);

  // Draw
  particles.forEach(p => p.draw());
  fruits.forEach(f => f.draw());
  floatingTexts.forEach(t => t.draw());

  requestAnimationFrame(loop);
}

// ── Start Game ────────────────────────────────────────────────
function startGame() {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');

  // Reset state
  fruits        = [];
  particles     = [];
  floatingTexts = [];
  score         = 0;
  timeLeft      = 20;
  comboCount    = 0;
  difficulty    = 1;

  if (comboTimer) clearTimeout(comboTimer);
  document.getElementById('combo-display').classList.add('hidden');
  updateUI();

  clearInterval(spawnInterval);
  clearInterval(gameTimer);

  gameRunning    = true;
  spawnInterval  = setInterval(spawnFruit, 900);

  gameTimer = setInterval(() => {
    timeLeft--;
    difficulty = 1 + (20 - timeLeft) / 10;   // ramp up speed over time
    updateUI();
    if (timeLeft <= 0) endGame();
  }, 1000);

  lastFrameTime = performance.now();
  requestAnimationFrame(loop);
}

// ── End Game ──────────────────────────────────────────────────
function endGame() {
  gameRunning = false;
  clearInterval(spawnInterval);
  clearInterval(gameTimer);
  if (comboTimer) clearTimeout(comboTimer);

  const isNew = score > highScore;
  if (isNew) {
    highScore = score;
    localStorage.setItem('fruitHS', highScore);
  }

  document.getElementById('final-score').textContent = score;
  document.getElementById('high-score-notice').textContent =
    isNew ? '🏆 New High Score!' : `Best: ${highScore}`;
  document.getElementById('gameover-screen').classList.remove('hidden');
  updateUI();
}

// ── Init ──────────────────────────────────────────────────────
document.getElementById('best-val').textContent = highScore;