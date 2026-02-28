// ===== STATE =====
let gameData = null;
let currentQuestion = null; // { ci, qi, q }
let currentDDWager = 0;
let currentDDPlayerIndex = -1;

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  const raw = localStorage.getItem('datapardy_game');
  if (!raw) {
    alert('No game data found. Please set up a game first.');
    location.href = 'setup.html';
    return;
  }
  try {
    gameData = JSON.parse(raw);
  } catch {
    alert('Game data is corrupted. Please set up again.');
    location.href = 'setup.html';
    return;
  }

  document.getElementById('gameTitle').textContent = gameData.title || 'DataPardy';
  renderBoard();
  renderScores();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal(false);
});

// ===== BOARD =====
function renderBoard() {
  const board = document.getElementById('board');
  const cats = gameData.categories;
  const numCols = cats.length;
  const numRows = Math.max(...cats.map(c => c.questions.length)) + 1; // +1 for header

  board.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;

  board.innerHTML = '';

  // Row 0: category headers
  cats.forEach(cat => {
    const cell = document.createElement('div');
    cell.className = 'board-cell category-header-cell';
    cell.textContent = cat.name || '—';
    board.appendChild(cell);
  });

  // Rows 1..n: questions
  const maxQ = Math.max(...cats.map(c => c.questions.length));
  for (let qi = 0; qi < maxQ; qi++) {
    cats.forEach((cat, ci) => {
      const cell = document.createElement('div');
      cell.className = 'board-cell value-cell';
      const q = cat.questions[qi];
      if (!q) {
        cell.classList.add('answered');
        board.appendChild(cell);
        return;
      }
      if (q.answered) {
        cell.classList.add('answered');
      } else {
        cell.textContent = '$' + q.points;
        cell.onclick = () => openQuestion(ci, qi);
      }
      board.appendChild(cell);
    });
  }
}

// ===== SCORES =====
function renderScores() {
  const container = document.getElementById('scoreCards');
  container.innerHTML = '';
  gameData.players.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'player-score-card';
    card.id = `score-card-${i}`;
    card.innerHTML = `
      <div class="player-score-name">${escHtml(p.name)}</div>
      <div class="player-score-value ${p.score < 0 ? 'negative' : ''}" id="score-value-${i}">
        ${formatScore(p.score)}
      </div>
    `;
    container.appendChild(card);
  });
}

function updateScoreDisplay(playerIndex) {
  const p = gameData.players[playerIndex];
  const el = document.getElementById(`score-value-${playerIndex}`);
  if (el) {
    el.textContent = formatScore(p.score);
    el.className = `player-score-value ${p.score < 0 ? 'negative' : ''}`;
  }
}

function formatScore(n) {
  if (n < 0) return '-$' + Math.abs(n).toLocaleString();
  return '$' + n.toLocaleString();
}

function adjustScore(playerIndex, delta) {
  gameData.players[playerIndex].score += delta;
  saveState();
  updateScoreDisplay(playerIndex);
  // Also refresh score buttons in modal if open
  renderModalScoreButtons();
}

// ===== MODAL =====
function openQuestion(ci, qi) {
  const cat = gameData.categories[ci];
  const q = cat.questions[qi];
  if (q.answered) return;

  currentQuestion = { ci, qi, q };
  currentDDWager = 0;
  currentDDPlayerIndex = -1;

  document.getElementById('modalCategory').textContent = cat.name || '';
  document.getElementById('modalPoints').textContent = '$' + q.points;
  document.getElementById('modalAnswer').classList.remove('visible');
  document.getElementById('modalAnswerText').textContent = q.answer || '';
  document.getElementById('revealAnswerBtn').classList.remove('hidden');

  if (q.isDailyDouble) {
    showDDSection();
  } else {
    showQuestionSection(q);
  }

  document.getElementById('modalOverlay').classList.remove('hidden');
  document.getElementById('modal').scrollTop = 0;
}

function showDDSection() {
  document.getElementById('modalDDSection').classList.remove('hidden');
  document.getElementById('modalQuestionSection').classList.add('hidden');

  // Populate player select
  const sel = document.getElementById('ddPlayerSelect');
  sel.innerHTML = '';
  gameData.players.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = p.name + ' (' + formatScore(p.score) + ')';
    sel.appendChild(opt);
  });

  // Set max wager hint
  document.getElementById('ddWagerAmount').value = '';
}

function confirmDDWager() {
  const playerIndex = parseInt(document.getElementById('ddPlayerSelect').value);
  const wager = parseInt(document.getElementById('ddWagerAmount').value);
  if (isNaN(wager) || wager < 0) {
    alert('Please enter a valid wager amount (minimum $0).');
    return;
  }
  currentDDPlayerIndex = playerIndex;
  currentDDWager = wager;
  document.getElementById('modalPoints').textContent = 'DAILY DOUBLE — Wager: $' + wager;
  showQuestionSection(currentQuestion.q);
}

function showQuestionSection(q) {
  document.getElementById('modalDDSection').classList.add('hidden');
  document.getElementById('modalQuestionSection').classList.remove('hidden');

  const imgEl = document.getElementById('modalImage');
  if (q.image) {
    imgEl.src = q.image;
    imgEl.classList.remove('hidden');
  } else {
    imgEl.src = '';
    imgEl.classList.add('hidden');
  }

  document.getElementById('modalQuestion').textContent = q.question || '(no question text)';
  renderModalScoreButtons();
}

function renderModalScoreButtons() {
  const container = document.getElementById('scoreButtons');
  if (!container) return;
  container.innerHTML = '';

  const pts = currentQuestion ? currentQuestion.q.points : 0;
  const isDD = currentDDWager > 0;
  const wager = isDD ? currentDDWager : pts;

  gameData.players.forEach((p, i) => {
    // For Daily Double, only show the wagering player
    if (isDD && i !== currentDDPlayerIndex) return;

    const group = document.createElement('div');
    group.className = 'score-btn-group';

    const nameEl = document.createElement('div');
    nameEl.className = 'score-btn-name';
    nameEl.textContent = p.name;

    const pair = document.createElement('div');
    pair.className = 'score-btn-pair';

    const plusBtn = document.createElement('button');
    plusBtn.className = 'btn btn-success btn-sm';
    plusBtn.textContent = '+$' + wager.toLocaleString();
    plusBtn.onclick = () => adjustScore(i, wager);

    const minusBtn = document.createElement('button');
    minusBtn.className = 'btn btn-danger btn-sm';
    minusBtn.textContent = '-$' + wager.toLocaleString();
    minusBtn.onclick = () => adjustScore(i, -wager);

    pair.appendChild(plusBtn);
    pair.appendChild(minusBtn);
    group.appendChild(nameEl);
    group.appendChild(pair);
    container.appendChild(group);
  });
}

function revealAnswer() {
  document.getElementById('modalAnswer').classList.add('visible');
  document.getElementById('revealAnswerBtn').classList.add('hidden');
}

function closeModal(markAnswered) {
  if (currentQuestion && markAnswered) {
    const { ci, qi } = currentQuestion;
    gameData.categories[ci].questions[qi].answered = true;
    saveState();
    renderBoard();
  }
  currentQuestion = null;
  currentDDWager = 0;
  currentDDPlayerIndex = -1;
  document.getElementById('modalOverlay').classList.add('hidden');
}

function handleOverlayClick(e) {
  // Only close if clicking the overlay itself, not the modal
  if (e.target === document.getElementById('modalOverlay')) {
    closeModal(false);
  }
}

// ===== FINAL JEOPARDY =====
function goToFinal() {
  saveState();
  location.href = 'final.html';
}

// ===== PERSIST =====
function saveState() {
  localStorage.setItem('datapardy_game', JSON.stringify(gameData));
}

// ===== UTILITY =====
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
