/* ============================================================
   PRASHANT'S SMART STUDY PLANNER — APP.JS
   ============================================================ */

// ── Theme Switching ───────────────────────────────────────────
const THEMES = ['dark','green','pink','ocean'];

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('studyTheme', theme);
  document.querySelectorAll('.theme-btn[data-theme]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  const themeParticles = {
    dark:  '139,92,246',
    green: '16,185,129',
    pink:  '255,105,180',
    ocean: '0,200,255'
  };
  window.__particleColor = themeParticles[theme] || '139,92,246';
  showToast(`${theme.charAt(0).toUpperCase()+theme.slice(1)} Mode activated!`, {dark:'🌙',green:'🌿',pink:'🌸',ocean:'🌊'}[theme]);
}

// Wire up desktop theme buttons
document.querySelectorAll('#themeSwitcher .theme-btn').forEach(btn => {
  btn.addEventListener('click', () => setTheme(btn.dataset.theme));
});

// ── Mobile Menu ───────────────────────────────────────────────
function toggleMobileMenu() {
  const drawer = document.getElementById('mobileDrawer');
  const hamburger = document.getElementById('hamburger');
  drawer.classList.toggle('open');
  hamburger.classList.toggle('open');
}

// ── State ────────────────────────────────────────────────────
let plans = JSON.parse(localStorage.getItem('studyPlans')) || [];
let pomodoroSessions = parseInt(localStorage.getItem('pomodoroSessions') || '0');
let streak = parseInt(localStorage.getItem('studyStreak') || '0');
let lastStudyDate = localStorage.getItem('lastStudyDate') || '';

// ── Timer State ──────────────────────────────────────────────
let timerInterval = null;
let timerSeconds = 25 * 60;
let timerTotal = 25 * 60;
let timerRunning = false;

// Full circumference for radius=85: 2π×85 ≈ 534
const RING_CIRCUMFERENCE = 2 * Math.PI * 85;

// ── Utility ──────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2,'0')} ${ampm}`;
}

function savePlans() {
  localStorage.setItem('studyPlans', JSON.stringify(plans));
}

// ── Toast ────────────────────────────────────────────────────
function showToast(msg, emoji = '✅') {
  const toast = document.getElementById('toast');
  toast.textContent = emoji + '  ' + msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Date Badge ───────────────────────────────────────────────
function updateDateBadge() {
  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  document.getElementById('dateBadge').textContent = now.toLocaleDateString('en-IN', options);
  document.getElementById('footerDate').textContent = now.toLocaleDateString('en-IN', options);
}

// ── Streak Logic ─────────────────────────────────────────────
function updateStreak() {
  const today = new Date().toISOString().split('T')[0];
  if (lastStudyDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (lastStudyDate === yesterday) {
      streak++;
    } else if (lastStudyDate !== today) {
      streak = 1;
    }
    lastStudyDate = today;
    localStorage.setItem('studyStreak', streak);
    localStorage.setItem('lastStudyDate', today);
  }
  document.getElementById('streakCount').textContent = streak;
}

// ── Stats ────────────────────────────────────────────────────
function updateStats() {
  const total = plans.length;
  const done = plans.filter(p => p.completed).length;
  const pending = total - done;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  animateNumber('totalTasks', total);
  animateNumber('doneTasks', done);
  animateNumber('pendingTasks', pending);
  document.getElementById('progressPercent').textContent = pct + '%';
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('miniProgressFill').style.width = pct + '%';
  document.getElementById('progressLabel').textContent = `${done} / ${total} completed`;
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;
  const step = target > current ? 1 : -1;
  let val = current;
  const interval = setInterval(() => {
    val += step;
    el.textContent = val;
    if (val === target) clearInterval(interval);
  }, 30);
}

// ── Render Plans ─────────────────────────────────────────────
function renderPlans(filterValue = 'all', searchTerm = '') {
  const container = document.getElementById('plansContainer');
  const emptyState = document.getElementById('emptyState');

  let filtered = [...plans];

  // Search
  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase();
    filtered = filtered.filter(p =>
      p.subject.toLowerCase().includes(q) ||
      (p.notes && p.notes.toLowerCase().includes(q))
    );
  }

  // Filter
  if (filterValue === 'completed') filtered = filtered.filter(p => p.completed);
  else if (filterValue === 'pending') filtered = filtered.filter(p => !p.completed);
  else if (['high','medium','low'].includes(filterValue)) filtered = filtered.filter(p => p.priority === filterValue);

  // Sort: pending first, then by date
  filtered.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.date) - new Date(b.date);
  });

  // Clear
  const old = container.querySelectorAll('.plan-item');
  old.forEach(el => el.remove());

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    filtered.forEach((plan, i) => {
      const el = createPlanElement(plan, i);
      container.appendChild(el);
    });
  }

  updateStats();
  renderWeeklyChart();
}

function createPlanElement(plan, index) {
  const div = document.createElement('div');
  div.className = `plan-item ${plan.completed ? 'completed' : ''}`;
  div.dataset.priority = plan.priority;
  div.dataset.id = plan.id;
  div.style.animationDelay = `${index * 0.05}s`;

  const priorityLabels = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };

  div.innerHTML = `
    <div class="plan-check ${plan.completed ? 'checked' : ''}" onclick="togglePlan('${plan.id}')">
      ${plan.completed ? '✓' : ''}
    </div>
    <div class="plan-info">
      <div class="plan-subject">${escapeHtml(plan.subject)}</div>
      <div class="plan-meta">
        ${plan.date ? `<span class="meta-tag">📅 ${formatDate(plan.date)}</span>` : ''}
        ${plan.time ? `<span class="meta-tag">🕐 ${formatTime(plan.time)}</span>` : ''}
        ${plan.duration ? `<span class="meta-tag">⏱ ${plan.duration} min</span>` : ''}
        <span class="priority-tag ${plan.priority}">${priorityLabels[plan.priority]}</span>
      </div>
      ${plan.notes ? `<div class="plan-notes-text">📝 ${escapeHtml(plan.notes)}</div>` : ''}
    </div>
    <div class="plan-actions">
      <button class="action-btn" onclick="deletePlan('${plan.id}')" title="Delete">🗑</button>
    </div>
  `;

  return div;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ── Toggle Completion ────────────────────────────────────────
function togglePlan(id) {
  const plan = plans.find(p => p.id === id);
  if (!plan) return;
  plan.completed = !plan.completed;
  savePlans();

  if (plan.completed) {
    updateStreak();
    triggerConfetti();
    showToast('Great job! Plan completed! 🎉', '🎉');
  }

  applyCurrentFilter();
}

// ── Delete Plan ──────────────────────────────────────────────
function deletePlan(id) {
  plans = plans.filter(p => p.id !== id);
  savePlans();
  applyCurrentFilter();
  showToast('Plan removed', '🗑️');
}

// ── Clear Completed ──────────────────────────────────────────
function clearCompleted() {
  const completedCount = plans.filter(p => p.completed).length;
  if (completedCount === 0) {
    showToast('No completed plans to clear', 'ℹ️');
    return;
  }
  plans = plans.filter(p => !p.completed);
  savePlans();
  applyCurrentFilter();
  showToast(`Cleared ${completedCount} completed plan(s)`, '🧹');
}

// ── Form Submit ───────────────────────────────────────────────
document.getElementById('planForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const subject = document.getElementById('subjectInput').value.trim();
  if (!subject) return;

  const plan = {
    id: generateId(),
    subject,
    date: document.getElementById('dateInput').value,
    time: document.getElementById('timeInput').value,
    duration: document.getElementById('durationInput').value,
    priority: document.getElementById('prioritySelect').value,
    notes: document.getElementById('notesInput').value.trim(),
    completed: false,
    createdAt: new Date().toISOString()
  };

  plans.unshift(plan);
  savePlans();

  // Reset form
  this.reset();
  document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];

  applyCurrentFilter();
  showToast('Study plan added! 🚀', '📚');

  // Ripple effect on button
  const btn = document.getElementById('addPlanBtn');
  createRipple(btn);
});

function createRipple(btn) {
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = '60px';
  ripple.style.left = '50%';
  ripple.style.top = '50%';
  ripple.style.marginLeft = '-30px';
  ripple.style.marginTop = '-30px';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 700);
}

// ── Search & Filter ───────────────────────────────────────────
function applyCurrentFilter() {
  const filter = document.getElementById('filterSelect').value;
  const search = document.getElementById('searchInput').value;
  renderPlans(filter, search);
}

document.getElementById('searchInput').addEventListener('input', applyCurrentFilter);
document.getElementById('filterSelect').addEventListener('change', applyCurrentFilter);

// ── Pomodoro Timer ────────────────────────────────────────────
function setTimerMode(minutes, label) {
  if (timerRunning) { clearInterval(timerInterval); timerRunning = false; }
  timerSeconds = minutes * 60;
  timerTotal = minutes * 60;
  updateTimerDisplay();
  updateTimerRing(0);
  document.getElementById('startTimerBtn').textContent = '▶ Start';
  document.getElementById('timerModeLabel').textContent = label;

  // Active button
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  if (minutes === 25) document.getElementById('pomodoroBtn').classList.add('active');
  else if (minutes === 5) document.getElementById('shortBreakBtn').classList.add('active');
  else if (minutes === 15) document.getElementById('longBreakBtn').classList.add('active');
}

function toggleTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('startTimerBtn').textContent = '▶ Resume';
  } else {
    timerRunning = true;
    document.getElementById('startTimerBtn').textContent = '⏸ Pause';
    timerInterval = setInterval(() => {
      timerSeconds--;
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerRunning = false;
        timerSeconds = 0;
        document.getElementById('startTimerBtn').textContent = '▶ Start';
        // Completed!
        pomodoroSessions++;
        localStorage.setItem('pomodoroSessions', pomodoroSessions);
        document.getElementById('pomodoroCount').textContent = pomodoroSessions;
        showToast('Focus session complete! Take a break 🌟', '🍅');
        triggerConfetti();
        playBeep();
        updateTimerRing(1);
      } else {
        updateTimerDisplay();
        const elapsed = timerTotal - timerSeconds;
        updateTimerRing(elapsed / timerTotal);
      }
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = timerTotal;
  updateTimerDisplay();
  updateTimerRing(0);
  document.getElementById('startTimerBtn').textContent = '▶ Start';
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  document.getElementById('timerDisplay').textContent = `${m}:${s}`;
}

function updateTimerRing(progress) {
  const offset = RING_CIRCUMFERENCE * (1 - progress);
  document.getElementById('timerRingProgress').style.strokeDasharray = RING_CIRCUMFERENCE;
  document.getElementById('timerRingProgress').style.strokeDashoffset = offset;
}

// Inject SVG gradient for timer ring
function injectTimerGradient() {
  const svg = document.querySelector('.timer-ring');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="50%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  `;
  svg.prepend(defs);
  // Set stroke to url
  document.getElementById('timerRingProgress').setAttribute('stroke', 'url(#timerGradient)');
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 1.5);
  } catch(e) {}
}

// ── Weekly Chart ──────────────────────────────────────────────
function renderWeeklyChart() {
  const container = document.getElementById('weeklyChart');
  container.innerHTML = '';

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today = new Date();
  const todayIdx = today.getDay();

  // Get the past 7 days
  const weekDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    weekDays.push(d);
  }

  // Count plans per day
  const maxCount = Math.max(1, ...weekDays.map(d => {
    const ds = d.toISOString().split('T')[0];
    return plans.filter(p => p.date === ds).length;
  }));

  weekDays.forEach((d) => {
    const ds = d.toISOString().split('T')[0];
    const count = plans.filter(p => p.date === ds).length;
    const doneCount = plans.filter(p => p.date === ds && p.completed).length;
    const isToday = ds === today.toISOString().split('T')[0];
    const heightPct = Math.max(6, (count / maxCount) * 80);

    const wrap = document.createElement('div');
    wrap.className = 'week-bar-wrap';
    wrap.innerHTML = `
      <div class="week-count">${count > 0 ? count : ''}</div>
      <div class="week-bar ${count > 0 ? 'has-data' : ''} ${isToday ? 'today-bar' : ''}" style="height:${heightPct}px" title="${d.toLocaleDateString('en-IN', {day:'numeric',month:'short'})}: ${count} plan(s), ${doneCount} done"></div>
      <div class="week-label ${isToday ? 'today-label' : ''}">${days[d.getDay()]}</div>
    `;
    container.appendChild(wrap);
  });
}

// ── Confetti ──────────────────────────────────────────────────
function triggerConfetti() {
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#8b5cf6','#3b82f6','#06b6d4','#ec4899','#10b981','#f59e0b','#fff'];
  const particles = [];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -10,
      r: Math.random() * 8 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 4 + 2,
      alpha: 1,
      rot: Math.random() * 360,
      rotVel: (Math.random() - 0.5) * 10,
      shape: Math.random() > 0.5 ? 'circle' : 'rect'
    });
  }

  let frame;
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let alive = false;
    particles.forEach(p => {
      if (p.alpha <= 0) return;
      alive = true;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0,0,p.r,0,Math.PI*2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.r, -p.r/2, p.r*2, p.r);
      }
      ctx.restore();

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.rot += p.rotVel;
      p.alpha -= 0.012;
    });

    if (alive) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  frame = requestAnimationFrame(draw);
  setTimeout(() => { cancelAnimationFrame(frame); ctx.clearRect(0,0,canvas.width,canvas.height); }, 4000);
}

// ── Particle Background ───────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let W = canvas.width = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  const colors = [
    'rgba(139,92,246,', // purple
    'rgba(59,130,246,', // blue
    'rgba(6,182,212,',  // cyan
    'rgba(236,72,153,', // pink
    'rgba(16,185,129,', // green
  ];

  const particles = [];
  let mouse = { x: -9999, y: -9999 };

  document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

  for (let i = 0; i < 80; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.15,
      baseAlpha: 0,
      color,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.02
    });
    particles[i].baseAlpha = particles[i].alpha;
  }

  window.addEventListener('resize', () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });

  function drawParticles() {
    ctx.clearRect(0,0,W,H);

    particles.forEach(p => {
      // Mouse repel
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 120) {
        const force = (120 - dist) / 120;
        p.x += dx / dist * force * 2.5;
        p.y += dy / dist * force * 2.5;
      }

      // Pulsing alpha
      p.pulse += p.pulseSpeed;
      const alphaFactor = 0.7 + 0.3 * Math.sin(p.pulse);

      // Draw glow
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      gradient.addColorStop(0, p.color + (p.baseAlpha * alphaFactor) + ')');
      gradient.addColorStop(1, p.color + '0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw core dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + (p.baseAlpha * alphaFactor * 1.5) + ')';
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    });

    // Draw connecting lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i+1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < 130) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          const opacity = 0.12 * (1 - dist/130);
          ctx.strokeStyle = `rgba(139,92,246,${opacity})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(drawParticles);
  }
  drawParticles();
}

// ── Floating Geometric Shapes ────────────────────────────────
function spawnFloatingShapes() {
  const container = document.getElementById('floatingShapes');
  const shapeTypes = ['▲','◆','●','■','✦','✧','◉','⬡'];
  const colors = [
    '#8b5cf6','#3b82f6','#06b6d4','#ec4899','#10b981','#f59e0b'
  ];

  function spawnShape() {
    const el = document.createElement('div');
    el.className = 'fshape';
    el.textContent = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
    const size = 12 + Math.random() * 28;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const duration = 12 + Math.random() * 20;
    const delay = Math.random() * 5;
    el.style.cssText = `
      left: ${left}%;
      bottom: -60px;
      font-size: ${size}px;
      color: ${color};
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
      text-shadow: 0 0 ${size}px ${color}66;
      filter: blur(${Math.random() > 0.7 ? 1 : 0}px);
    `;
    container.appendChild(el);
    // Remove after animation
    setTimeout(() => el.remove(), (duration + delay + 2) * 1000);
  }

  // Spawn initial set
  for (let i = 0; i < 12; i++) setTimeout(spawnShape, i * 600);
  // Keep spawning
  setInterval(spawnShape, 2000);
}

// ── Shooting Stars ─────────────────────────────────────────────
function spawnShootingStars() {
  const container = document.getElementById('shootingStars');

  function createStar() {
    const el = document.createElement('div');
    el.className = 'star';
    const W = window.innerWidth;
    const H = window.innerHeight;
    const startX = Math.random() * W * 0.8;
    const startY = Math.random() * H * 0.5;
    const angle = 20 + Math.random() * 40; // degrees downward
    const length = 200 + Math.random() * 300;
    const rad = (angle * Math.PI) / 180;
    const tx = Math.cos(rad) * length;
    const ty = Math.sin(rad) * length;
    const duration = 0.8 + Math.random() * 1.2;
    const width = 80 + Math.random() * 150;
    const colors = [
      'linear-gradient(90deg, transparent, rgba(139,92,246,0.9), #fff)',
      'linear-gradient(90deg, transparent, rgba(59,130,246,0.9), #fff)',
      'linear-gradient(90deg, transparent, rgba(6,182,212,0.9), #fff)',
      'linear-gradient(90deg, transparent, rgba(236,72,153,0.9), #fff)',
    ];
    el.style.cssText = `
      left: ${startX}px;
      top: ${startY}px;
      width: ${width}px;
      transform: rotate(${angle}deg);
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      --tx: ${tx}px;
      --ty: ${ty}px;
      animation-duration: ${duration}s;
      box-shadow: 0 0 6px rgba(255,255,255,0.4);
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), duration * 1000 + 200);
  }

  // Spawn stars at random intervals
  function scheduleStar() {
    createStar();
    setTimeout(scheduleStar, 1200 + Math.random() * 3000);
  }
  setTimeout(scheduleStar, 500);
  setTimeout(scheduleStar, 2000);
  setTimeout(scheduleStar, 4000);
}

// ── Keyboard Shortcuts ─────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Ctrl+Enter to add plan
  if (e.ctrlKey && e.key === 'Enter') {
    document.getElementById('planForm').dispatchEvent(new Event('submit'));
  }
  // Space to toggle timer (when not in an input)
  if (e.code === 'Space' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
    e.preventDefault();
    toggleTimer();
  }
});

// ── Cursor Sparkle Trail ──────────────────────────────────────
function initCursorSparkle() {
  let lastSparkle = 0;
  document.addEventListener('mousemove', e => {
    const now = Date.now();
    if (now - lastSparkle < 60) return; // throttle
    lastSparkle = now;
    const spark = document.createElement('div');
    spark.className = 'cursor-spark';
    spark.style.cssText = `left:${e.clientX - 4}px;top:${e.clientY - 4}px;`;
    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 700);
  });
}

// ── Card Mouse Glow ───────────────────────────────────────────
function initCardMouseGlow() {
  document.addEventListener('mousemove', e => {
    document.querySelectorAll('.card').forEach(card => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top)  / rect.height) * 100;
      card.style.setProperty('--mx', x + '%');
      card.style.setProperty('--my', y + '%');
    });
  });
}

// ── Init ─────────────────────────────────────────────────────
function init() {
  // Restore theme
  const savedTheme = localStorage.getItem('studyTheme') || 'dark';
  setTheme(savedTheme);

  updateDateBadge();
  updateStreak();

  // Set default date to today
  document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];

  // Init timer ring
  injectTimerGradient();
  updateTimerDisplay();
  updateTimerRing(0);

  // Restore pomodoro count
  document.getElementById('pomodoroCount').textContent = pomodoroSessions;

  // Render plans
  renderPlans();

  // Init particles
  initParticles();

  // Spawn floating shapes
  spawnFloatingShapes();

  // Spawn shooting stars
  spawnShootingStars();

  // Cursor sparkle
  initCursorSparkle();

  // Card glow
  initCardMouseGlow();

  // Daily quote
  initQuotes();

  // Mini widget (clock + stats)
  initMiniWidget();

  // Subject progress
  renderSubjects();

  // Sticky notes
  renderStickyNotes();

  // Animate stats on load
  setTimeout(updateStats, 300);
}

// ── Study Clock Mini Widget ───────────────────────────────────────
const STUDY_TIPS = [
  '💡 Take a 5-min break every 25 min.',
  '💧 Stay hydrated while studying!',
  '📵 Put your phone on Do Not Disturb.',
  '✍️ Write notes by hand to retain better.',
  '🌙 Avoid studying past midnight.',
  '🎯 Break big topics into small chunks.',
  '🎵 Try lo-fi music for focus.',
  '🧘 Stretch between study sessions.',
  '👍 Review your notes within 24 hours.',
  '🔍 Teach what you learn to remember it.',
];
let tipIdx = Math.floor(Math.random() * STUDY_TIPS.length);

function initMiniWidget() {
  const clockEl = document.getElementById('miniClock');
  const tipEl   = document.getElementById('miniTip');
  if (!clockEl) return;
  function tickClock() {
    const now = new Date();
    const h = now.getHours().toString().padStart(2,'0');
    const m = now.getMinutes().toString().padStart(2,'0');
    const s = now.getSeconds().toString().padStart(2,'0');
    clockEl.textContent = `${h}:${m}:${s}`;
  }
  tickClock();
  setInterval(tickClock, 1000);
  if (tipEl) {
    tipEl.textContent = STUDY_TIPS[tipIdx];
    setInterval(() => {
      tipIdx = (tipIdx + 1) % STUDY_TIPS.length;
      tipEl.style.animation = 'none';
      requestAnimationFrame(() => { tipEl.style.animation = ''; tipEl.textContent = STUDY_TIPS[tipIdx]; });
    }, 8000);
  }
  updateMiniStats();
  setInterval(updateMiniStats, 5000);
}

function updateMiniStats() {
  const today = new Date().toISOString().split('T')[0];
  const todayPlans = plans.filter(p => p.date === today);
  const todayDone  = todayPlans.filter(p => p.completed);
  const el1 = document.getElementById('mwToday');
  const el2 = document.getElementById('mwDone');
  const el3 = document.getElementById('mwPomo');
  if (el1) el1.textContent = todayPlans.length;
  if (el2) el2.textContent = todayDone.length;
  if (el3) el3.textContent = pomodoroSessions;
}

// ── Daily Inspiration Quotes ──────────────────────────────────────
const QUOTES = [
  { text:"The secret of getting ahead is getting started.", author:"Mark Twain", tags:["Motivation","Action"] },
  { text:"You don't have to be great to start, but you have to start to be great.", author:"Zig Ziglar", tags:["Start","Growth"] },
  { text:"Success is the sum of small efforts repeated day in and day out.", author:"Robert Collier", tags:["Consistency","Success"] },
  { text:"Study hard what interests you the most in the most undisciplined, irreverent and original manner.", author:"Richard Feynman", tags:["Study","Curiosity"] },
  { text:"Education is the most powerful weapon which you can use to change the world.", author:"Nelson Mandela", tags:["Education","Impact"] },
  { text:"Believe you can and you're halfway there.", author:"Theodore Roosevelt", tags:["Belief","Confidence"] },
  { text:"It always seems impossible until it's done.", author:"Nelson Mandela", tags:["Persistence","Goals"] },
  { text:"Don't watch the clock; do what it does. Keep going.", author:"Sam Levenson", tags:["Focus","Time"] },
  { text:"The expert in anything was once a beginner.", author:"Helen Hayes", tags:["Learning","Patience"] },
  { text:"Push yourself, because no one else is going to do it for you.", author:"Unknown", tags:["Discipline","Self"] },
  { text:"Great things never come from comfort zones.", author:"Neil Strauss", tags:["Challenge","Growth"] },
  { text:"Dream it. Wish it. Do it.", author:"Unknown", tags:["Action","Dreams"] },
  { text:"Stay focused, go after your dreams and keep moving toward your goals.", author:"LL Cool J", tags:["Focus","Goals"] },
  { text:"Success doesn't come from what you do occasionally, it comes from what you do consistently.", author:"Marie Forleo", tags:["Consistency","Success"] },
  { text:"The beautiful thing about learning is that nobody can take it away from you.", author:"B.B. King", tags:["Learning","Growth"] },
  { text:"Don't stop when you're tired. Stop when you're done.", author:"Unknown", tags:["Endurance","Focus"] },
  { text:"Wake up with determination. Go to bed with satisfaction.", author:"Unknown", tags:["Motivation","Daily"] },
  { text:"Your limitation — it's only your imagination.", author:"Unknown", tags:["Mindset","Growth"] },
  { text:"Hard work beats talent when talent doesn't work hard.", author:"Tim Notke", tags:["Hard Work","Talent"] },
  { text:"Little things make big days.", author:"Unknown", tags:["Consistency","Habits"] },
  { text:"It's going to be hard, but hard does not mean impossible.", author:"Unknown", tags:["Resilience","Courage"] },
  { text:"Don't limit your challenges. Challenge your limits.", author:"Unknown", tags:["Challenge","Mindset"] },
  { text:"All progress takes place outside the comfort zone.", author:"Michael John Bobak", tags:["Progress","Growth"] },
  { text:"Reading is to the mind what exercise is to the body.", author:"Joseph Addison", tags:["Reading","Study"] },
  { text:"Invest in your mind. It pays the best interest.", author:"Benjamin Franklin", tags:["Learning","Investment"] },
  { text:"Knowledge is power.", author:"Francis Bacon", tags:["Knowledge","Power"] },
  { text:"You are braver than you believe, stronger than you seem.", author:"A.A. Milne", tags:["Strength","Belief"] },
  { text:"Today a reader, tomorrow a leader.", author:"Margaret Fuller", tags:["Reading","Leadership"] },
  { text:"One day or day one — you decide.", author:"Unknown", tags:["Start","Decision"] },
  { text:"Work hard in silence, let your success be the noise.", author:"Frank Ocean", tags:["Focus","Work"] },
];

let currentQuoteIdx = Math.floor(Date.now() / 86400000) % QUOTES.length;

function displayQuote(q) {
  const textEl   = document.getElementById('quoteText');
  const authEl   = document.getElementById('quoteAuthor');
  const tagsEl   = document.getElementById('quoteTags');
  if (!textEl) return;
  textEl.style.animation = 'none';
  requestAnimationFrame(() => {
    textEl.style.animation = '';
    textEl.textContent = q.text;
    authEl.textContent  = '— ' + q.author;
    tagsEl.innerHTML = q.tags.map(t => `<span class="quote-tag">#${t}</span>`).join('');
  });
}

function newQuote() {
  currentQuoteIdx = (currentQuoteIdx + 1) % QUOTES.length;
  displayQuote(QUOTES[currentQuoteIdx]);
}

function initQuotes() {
  displayQuote(QUOTES[currentQuoteIdx]);
}

// ── Subject Progress Tracker ──────────────────────────────────────
let subjects = JSON.parse(localStorage.getItem('studySubjects') || '[]');

const SUBJECT_COLORS = [
  'linear-gradient(90deg,#8b5cf6,#3b82f6)',
  'linear-gradient(90deg,#ec4899,#f59e0b)',
  'linear-gradient(90deg,#06b6d4,#10b981)',
  'linear-gradient(90deg,#f97316,#eab308)',
  'linear-gradient(90deg,#6366f1,#8b5cf6)',
  'linear-gradient(90deg,#14b8a6,#06b6d4)',
];

function saveSubjects() { localStorage.setItem('studySubjects', JSON.stringify(subjects)); }

function renderSubjects() {
  const list  = document.getElementById('subjectList');
  const empty = document.getElementById('subjectEmpty');
  if (!list) return;
  // Clear existing rows (keep empty placeholder)
  list.querySelectorAll('.subject-row').forEach(el => el.remove());
  if (subjects.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  subjects.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'subject-row';
    row.innerHTML = `
      <div class="subject-row-top">
        <span class="subject-name">${escapeHtml(s.name)}</span>
        <span class="subject-pct">${s.pct}%</span>
        <button class="subject-del" onclick="deleteSubject(${i})" title="Remove">✕</button>
      </div>
      <div class="subject-bar-track">
        <div class="subject-bar-fill" style="width:${s.pct}%;background:${SUBJECT_COLORS[i % SUBJECT_COLORS.length]};"></div>
      </div>
      <div class="subject-controls">
        <button class="subject-ctrl-btn" onclick="adjustSubject(${i},-10)">−10%</button>
        <button class="subject-ctrl-btn" onclick="adjustSubject(${i},-5)">−5%</button>
        <button class="subject-ctrl-btn" onclick="adjustSubject(${i},5)">+5%</button>
        <button class="subject-ctrl-btn" onclick="adjustSubject(${i},10)">+10%</button>
      </div>
    `;
    list.appendChild(row);
  });
}

function addSubjectPrompt() {
  const name = prompt('Enter subject name (e.g. Mathematics):');
  if (!name || !name.trim()) return;
  const pctStr = prompt(`Starting progress % for "${name.trim()}" (0–100):`, '0');
  const pct = Math.min(100, Math.max(0, parseInt(pctStr) || 0));
  subjects.push({ name: name.trim(), pct });
  saveSubjects();
  renderSubjects();
  showToast(`📚 ${name.trim()} added!`, '📈');
}

function adjustSubject(i, delta) {
  subjects[i].pct = Math.min(100, Math.max(0, subjects[i].pct + delta));
  saveSubjects();
  renderSubjects();
  if (subjects[i].pct === 100) {
    triggerConfetti();
    showToast(`🎉 ${subjects[i].name} — 100% Complete!`, '🏆');
  }
}

function deleteSubject(i) {
  subjects.splice(i, 1);
  saveSubjects();
  renderSubjects();
}

// ── Quick Sticky Notes ────────────────────────────────────────────
let stickyNotes = JSON.parse(localStorage.getItem('stickyNotes') || '[]');

const NOTE_COLORS = ['#fbbf24','#34d399','#60a5fa','#f87171','#a78bfa','#fb923c'];

function saveStickyNotes() { localStorage.setItem('stickyNotes', JSON.stringify(stickyNotes)); }

function renderStickyNotes() {
  const grid  = document.getElementById('stickyNotesGrid');
  const empty = document.getElementById('notesEmpty');
  if (!grid) return;
  grid.querySelectorAll('.sticky-note').forEach(el => el.remove());
  if (stickyNotes.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  stickyNotes.forEach((note, i) => {
    const div = document.createElement('div');
    div.className = 'sticky-note';
    div.style.setProperty('--note-color', NOTE_COLORS[note.colorIdx]);
    div.innerHTML = `
      <button class="sticky-note-del" onclick="deleteStickyNote(${i})">✕</button>
      <div class="sticky-note-text">${escapeHtml(note.text)}</div>
      <div class="sticky-note-date">${note.date}</div>
    `;
    grid.insertBefore(div, empty);
  });
}

function addNote() {
  const text = prompt('Write your quick note:');
  if (!text || !text.trim()) return;
  const colorIdx = Math.floor(Math.random() * NOTE_COLORS.length);
  const date = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  stickyNotes.unshift({ text: text.trim(), colorIdx, date });
  saveStickyNotes();
  renderStickyNotes();
  showToast('Note saved! 📌', '📝');
}

function deleteStickyNote(i) {
  stickyNotes.splice(i, 1);
  saveStickyNotes();
  renderStickyNotes();
}

document.addEventListener('DOMContentLoaded', init);

