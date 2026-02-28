// ===== BROADCAST CHANNEL =====
const channel = new BroadcastChannel('datapardy');
let currentScene = null;

function broadcast(scene) {
  currentScene = scene;
  channel.postMessage({ type: 'scene', scene });
}

channel.onmessage = (e) => {
  if (e.data.type === 'sync_request' && currentScene) {
    broadcast(currentScene);
  }
};

// ===== STATE =====
let gameData = null;
let wagers = [];

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  const raw = localStorage.getItem('datapardy_game');
  if (!raw) {
    alert('No game data found.');
    location.href = 'index.html';
    return;
  }
  try {
    gameData = JSON.parse(raw);
  } catch {
    alert('Game data is corrupted.');
    location.href = 'index.html';
    return;
  }

  wagers = gameData.players.map(() => 0);

  const fj = gameData.finalJeopardy;
  const catName = fj.category || 'Final Jeopardy';

  document.getElementById('finalCategoryDisplay').textContent = catName;
  document.getElementById('finalCategoryDisplay2').textContent = catName;
  document.getElementById('finalCategoryDisplay3').textContent = catName;

  renderWagerGrid();

  // Show category on audience screen immediately
  broadcast({ view: 'final_wager', category: catName, game: gameData });
});

// ===== STAGE 1: WAGERS =====
function renderWagerGrid() {
  const grid = document.getElementById('wagerGrid');
  grid.innerHTML = '';

  gameData.players.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'wager-card';
    card.innerHTML = `
      <div class="player-name">${escHtml(p.name)}</div>
      <div class="current-score">Current score: ${formatScore(p.score)}</div>
      <label style="font-size:0.75rem;color:var(--tan);text-transform:uppercase;letter-spacing:0.5px">Wager</label>
      <input type="number" id="wager-${i}" min="0" placeholder="$0"
        oninput="wagers[${i}] = parseInt(this.value) || 0">
    `;
    grid.appendChild(card);
  });
}

function goToQuestion() {
  gameData.players.forEach((p, i) => {
    const input = document.getElementById(`wager-${i}`);
    wagers[i] = parseInt(input ? input.value : 0) || 0;
  });

  const fj = gameData.finalJeopardy;

  document.getElementById('finalQuestionDisplay').textContent = fj.question || '(no question)';
  document.getElementById('finalQuestionDisplay2').textContent = fj.question || '(no question)';
  document.getElementById('finalAnswerDisplay').textContent = fj.answer || '(no answer)';

  const img1 = document.getElementById('finalImageDisplay');
  const img2 = document.getElementById('finalImageDisplay2');
  if (fj.image) {
    img1.src = fj.image;
    img1.classList.remove('hidden');
    img2.src = fj.image;
    img2.classList.remove('hidden');
  } else {
    img1.classList.add('hidden');
    img2.classList.add('hidden');
  }

  showStage('stage-question');
  broadcast({
    view: 'final_question',
    category: fj.category || 'Final Jeopardy',
    question: fj.question || '',
    image: fj.image || null,
    game: gameData
  });
}

// ===== STAGE 2: ANSWER =====
function goToAnswer() {
  renderFinalScoreRows();
  showStage('stage-answer');

  const fj = gameData.finalJeopardy;
  broadcast({
    view: 'final_answer',
    category: fj.category || 'Final Jeopardy',
    question: fj.question || '',
    answer: fj.answer || '',
    image: fj.image || null,
    players: gameData.players.map((p, i) => ({ name: p.name, score: p.score, wager: wagers[i] || 0 })),
    game: gameData
  });
}

function renderFinalScoreRows() {
  const container = document.getElementById('finalScoreRows');
  container.innerHTML = '';

  gameData.players.forEach((p, i) => {
    const wager = wagers[i] || 0;
    const row = document.createElement('div');
    row.className = 'final-score-row';
    row.innerHTML = `
      <div class="player-name-final">${escHtml(p.name)}</div>
      <div style="font-size:0.78rem;color:var(--tan);margin-right:8px">
        Wager: $${wager.toLocaleString()}
      </div>
      <div class="score-display ${p.score < 0 ? 'negative' : ''}" id="final-score-${i}">
        ${formatScore(p.score)}
      </div>
      <div class="final-adjust-btns">
        <button class="btn btn-success btn-sm" onclick="adjustFinalScore(${i}, ${wager})">
          +$${wager.toLocaleString()}
        </button>
        <button class="btn btn-danger btn-sm" onclick="adjustFinalScore(${i}, -${wager})">
          -$${wager.toLocaleString()}
        </button>
      </div>
    `;
    container.appendChild(row);
  });
}

function adjustFinalScore(playerIndex, delta) {
  gameData.players[playerIndex].score += delta;
  saveState();

  const el = document.getElementById(`final-score-${playerIndex}`);
  if (el) {
    el.textContent = formatScore(gameData.players[playerIndex].score);
    el.className = `score-display ${gameData.players[playerIndex].score < 0 ? 'negative' : ''}`;
  }

  // Re-broadcast final_answer with updated scores
  const fj = gameData.finalJeopardy;
  broadcast({
    view: 'final_answer',
    category: fj.category || 'Final Jeopardy',
    question: fj.question || '',
    answer: fj.answer || '',
    image: fj.image || null,
    players: gameData.players.map((p, i) => ({ name: p.name, score: p.score, wager: wagers[i] || 0 })),
    game: gameData
  });
}

// ===== PLAY AGAIN =====
function resetGame() {
  if (!confirm('Reset all scores and answered tiles? Category/question data will be kept.')) return;
  gameData.players.forEach(p => { p.score = 0; });
  gameData.categories.forEach(cat => {
    cat.questions.forEach(q => { q.answered = false; });
  });
  saveState();
  location.href = 'game.html';
}

// ===== STAGE HELPER =====
function showStage(id) {
  document.querySelectorAll('.final-stage').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ===== PERSIST =====
function saveState() {
  localStorage.setItem('datapardy_game', JSON.stringify(gameData));
}

// ===== UTILITY =====
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
