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

    case 'rules': {
      document.getElementById('rulesGameTitle').textContent = scene.title || 'DataPardy';
      const body = document.getElementById('rulesBody');
      const lines = (scene.rules || 'No rules specified.')
        .split('\n')
        .filter(l => l.trim());
      body.innerHTML = lines.map(l => `<p>${escHtml(l)}</p>`).join('');
      show('scene-rules');
      break;
    }

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
      } else if (q.inProgress) {
        cell.classList.add('in-progress');
        cell.innerHTML = `<span>$${q.points}</span><span class="in-progress-icon">↩</span>`;
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
  if (!players || !players.length) return;

  // Sort by score descending
  const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  // Podium: visual order is 2nd, 1st, 3rd (1st in center)
  const podiumDiv = document.createElement('div');
  podiumDiv.className = 'audience-podium';

  const podiumOrder = top3.length === 1
    ? [{ p: top3[0], rank: 1 }]
    : top3.length === 2
      ? [{ p: top3[1], rank: 2 }, { p: top3[0], rank: 1 }]
      : [{ p: top3[1], rank: 2 }, { p: top3[0], rank: 1 }, { p: top3[2], rank: 3 }];

  podiumOrder.forEach(({ p, rank }) => {
    const score = p.score || 0;
    const place = document.createElement('div');
    place.className = `audience-podium-place place-${rank}`;
    place.innerHTML = `
      <div class="audience-podium-name">${escHtml(p.name)}</div>
      <div class="audience-podium-score ${score < 0 ? 'negative' : ''}">${formatScore(score)}</div>
      <div class="audience-podium-stand"><span class="audience-podium-rank">#${rank}</span></div>
    `;
    podiumDiv.appendChild(place);
  });

  container.appendChild(podiumDiv);

  // Remaining players as an ordered list
  if (rest.length > 0) {
    const listDiv = document.createElement('div');
    listDiv.className = 'audience-podium-rest';
    rest.forEach((p, idx) => {
      const rank = idx + 4;
      const score = p.score || 0;
      const item = document.createElement('div');
      item.className = 'audience-podium-rest-item';
      item.innerHTML = `
        <span class="audience-podium-rest-rank">${rank}</span>
        <span class="audience-podium-rest-name">${escHtml(p.name)}</span>
        <span class="audience-podium-rest-score ${score < 0 ? 'negative' : ''}">${formatScore(score)}</span>
      `;
      listDiv.appendChild(item);
    });
    container.appendChild(listDiv);
  }
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
