// ===== BROADCAST CHANNEL =====
const channel = new BroadcastChannel('datapardy');

channel.onmessage = (e) => {
  if (e.data.type === 'scene') {
    applyScene(e.data.scene);
  }
};

// On load, ask host for current state
window.addEventListener('DOMContentLoaded', () => {
  channel.postMessage({ type: 'sync_request' });
});

// ===== SCENE ROUTING =====
function applyScene(scene) {
  if (!scene) return;

  // Hide all scenes
  document.querySelectorAll('.audience-scene').forEach(el => el.classList.remove('active'));

  switch (scene.view) {
    case 'board':
      renderBoard(scene.game);
      show('scene-board');
      break;

    case 'daily_double':
      document.getElementById('ddMeta').textContent =
        (scene.category || '') + (scene.points ? '  •  $' + scene.points : '');
      show('scene-daily-double');
      break;

    case 'question':
      renderQuestion(scene);
      if (scene.game) renderScoreStrip('audienceScoreStripQ', scene.game.players);
      show('scene-question');
      break;

    case 'answer':
      renderAnswer(scene);
      if (scene.game) renderScoreStrip('audienceScoreStripA', scene.game.players);
      show('scene-answer');
      break;

    case 'final_wager':
      document.getElementById('fjWagerCategory').textContent = scene.category || 'Final Jeopardy';
      show('scene-final-wager');
      break;

    case 'final_question':
      document.getElementById('fjQCategory').textContent = scene.category || '';
      document.getElementById('fjQText').textContent = scene.question || '';
      setImage('fjQImage', scene.image);
      show('scene-final-question');
      break;

    case 'final_answer':
      document.getElementById('fjACategory').textContent = scene.category || '';
      document.getElementById('fjAText').textContent = scene.question || '';
      document.getElementById('fjAAnswer').textContent = scene.answer || '';
      setImage('fjAImage', scene.image);
      renderFinalScores(scene.players || []);
      show('scene-final-answer');
      break;

    default:
      show('scene-waiting');
  }
}

// ===== BOARD RENDER =====
function renderBoard(gameData) {
  if (!gameData) return;
  const board = document.getElementById('audienceBoard');
  const cats = gameData.categories;
  if (!cats || !cats.length) return;

  board.style.gridTemplateColumns = `repeat(${cats.length}, 1fr)`;
  board.innerHTML = '';

  // Category header row
  cats.forEach(cat => {
    const cell = document.createElement('div');
    cell.className = 'board-cell category-header-cell';
    cell.textContent = cat.name || '—';
    board.appendChild(cell);
  });

  // Question rows
  const maxQ = Math.max(...cats.map(c => c.questions.length));
  for (let qi = 0; qi < maxQ; qi++) {
    cats.forEach((cat) => {
      const cell = document.createElement('div');
      cell.className = 'board-cell value-cell';
      const q = cat.questions[qi];
      if (!q || q.answered) {
        cell.classList.add('answered');
      } else {
        cell.textContent = '$' + q.points;
      }
      board.appendChild(cell);
    });
  }

  renderScoreStrip('audienceScoreStrip', gameData.players);
}

// ===== QUESTION / ANSWER RENDER =====
function renderQuestion(scene) {
  const meta = scene.isDailyDouble
    ? `DAILY DOUBLE  •  ${scene.category}  •  Wager: $${(scene.wager || 0).toLocaleString()}`
    : `${scene.category}  •  $${scene.points}`;
  document.getElementById('qMeta').textContent = meta;
  document.getElementById('qText').textContent = scene.question || '';
  setImage('qImage', scene.image);
}

function renderAnswer(scene) {
  const meta = scene.isDailyDouble
    ? `DAILY DOUBLE  •  ${scene.category}  •  Wager: $${(scene.wager || 0).toLocaleString()}`
    : `${scene.category}  •  $${scene.points}`;
  document.getElementById('aMeta').textContent = meta;
  document.getElementById('aText').textContent = scene.question || '';
  document.getElementById('aAnswer').textContent = scene.answer || '';
  setImage('aImage', scene.image);
}

// ===== SCORE STRIPS =====
function renderScoreStrip(containerId, players) {
  const strip = document.getElementById(containerId);
  if (!strip || !players) return;
  strip.innerHTML = '';
  players.forEach(p => {
    const item = document.createElement('div');
    item.className = 'audience-score-item';
    const score = p.score || 0;
    item.innerHTML = `
      <div class="audience-score-name">${escHtml(p.name)}</div>
      <div class="audience-score-val ${score < 0 ? 'negative' : ''}">${formatScore(score)}</div>
    `;
    strip.appendChild(item);
  });
}

function renderFinalScores(players) {
  const container = document.getElementById('fjScores');
  if (!container) return;
  container.innerHTML = '';
  players.forEach(p => {
    const score = p.score || 0;
    const card = document.createElement('div');
    card.className = 'audience-final-score-card';
    card.innerHTML = `
      <div class="player-name">${escHtml(p.name)}</div>
      <div class="player-score ${score < 0 ? 'negative' : ''}">${formatScore(score)}</div>
    `;
    container.appendChild(card);
  });
}

// ===== HELPERS =====
function show(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function setImage(id, src) {
  const el = document.getElementById(id);
  if (!el) return;
  if (src) {
    el.src = src;
    el.classList.remove('hidden');
  } else {
    el.src = '';
    el.classList.add('hidden');
  }
}

function formatScore(n) {
  if (n < 0) return '-$' + Math.abs(n).toLocaleString();
  return '$' + n.toLocaleString();
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
