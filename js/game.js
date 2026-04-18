// ===== BROADCAST CHANNEL =====
const channel = new BroadcastChannel('datapardy');
let currentScene = null;

function broadcast(scene) {
  currentScene = scene;
  channel.postMessage({ type: 'scene', scene });
}

// Respond to sync requests from audience window
channel.onmessage = (e) => {
  if (e.data.type === 'sync_request') {
    if (currentScene) broadcast(currentScene);
    else if (gameData) broadcast({ view: 'board', game: gameData, page: currentPage });
  }
};

// ===== STATE =====
let gameData = null;
let currentQuestion = null; // { ci, qi, q }
let currentDDWager = 0;
let currentDDPlayerIndex = -1;
let anyContestantScoredPositive = false; // tracks host scoring for current question
const CATS_PER_PAGE = 5;
let currentPage = 0;

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

  // Inject host player if host scoring is enabled and not already present
  if (gameData.hostScoring && !gameData.players.some(p => p.isHost)) {
    gameData.players.unshift({ name: 'Host', score: 0, isHost: true });
    saveState();
  }

  document.getElementById('gameTitle').textContent = gameData.title || 'DataPardy';
  renderBoard();
  renderScores();
  broadcast({ view: 'board', game: gameData, page: currentPage });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal(false);
});

// ===== BOARD =====
function getTotalPages() {
  return Math.max(1, Math.ceil(gameData.categories.length / CATS_PER_PAGE));
}

function getPageCategories() {
  const start = currentPage * CATS_PER_PAGE;
  return gameData.categories.slice(start, start + CATS_PER_PAGE);
}

function renderBoard() {
  const board = document.getElementById('board');
  const allCats = gameData.categories;
  const totalPages = getTotalPages();

  // Clamp page
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  if (currentPage < 0) currentPage = 0;

  const start = currentPage * CATS_PER_PAGE;
  const pageCats = getPageCategories();

  board.style.gridTemplateColumns = `repeat(${pageCats.length}, 1fr)`;
  board.innerHTML = '';

  // Row 0: category headers
  pageCats.forEach(cat => {
    const cell = document.createElement('div');
    cell.className = 'board-cell category-header-cell';
    cell.textContent = cat.name || '—';
    board.appendChild(cell);
  });

  // Question rows
  const maxQ = Math.max(...pageCats.map(c => c.questions.length));
  for (let qi = 0; qi < maxQ; qi++) {
    pageCats.forEach((cat, localCi) => {
      const ci = start + localCi; // real index into gameData.categories
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
      } else if (q.inProgress) {
        cell.classList.add('in-progress');
        cell.innerHTML = `<span>$${q.points}</span><span class="in-progress-icon">↩</span>`;
        cell.onclick = () => openQuestion(ci, qi);
      } else {
        cell.textContent = '$' + q.points;
        cell.onclick = () => openQuestion(ci, qi);
      }
      board.appendChild(cell);
    });
  }

  renderPageNav();
}

function renderPageNav() {
  const totalPages = getTotalPages();
  const nav = document.getElementById('boardPageNav');
  if (!nav) return;

  if (totalPages <= 1) {
    nav.classList.add('hidden');
    return;
  }

  nav.classList.remove('hidden');
  document.getElementById('pagePrev').disabled = currentPage === 0;
  document.getElementById('pageNext').disabled = currentPage >= totalPages - 1;
  document.getElementById('pageIndicator').textContent = `${currentPage + 1} / ${totalPages}`;
}

function prevPage() {
  if (currentPage > 0) {
    currentPage--;
    renderBoard();
    broadcast({ view: 'board', game: gameData, page: currentPage });
  }
}

function nextPage() {
  if (currentPage < getTotalPages() - 1) {
    currentPage++;
    renderBoard();
    broadcast({ view: 'board', game: gameData, page: currentPage });
  }
}

// ===== SCORES =====
function renderScores() {
  const container = document.getElementById('scoreCards');
  container.innerHTML = '';
  gameData.players.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'player-score-card' + (p.isHost ? ' host-card' : '');
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
  // Track whether any contestant (non-host) scored positive this question
  if (!gameData.players[playerIndex].isHost && delta > 0) {
    anyContestantScoredPositive = true;
  }
  gameData.players[playerIndex].score += delta;
  saveState();
  updateScoreDisplay(playerIndex);
  renderModalScoreButtons();
  // Re-broadcast current scene with updated game state so audience scores update
  if (currentScene) {
    broadcast({ ...currentScene, game: gameData });
  }
}

// ===== HOST AUTO-SCORING =====
function applyHostScore() {
  const hostIndex = gameData.players.findIndex(p => p.isHost);
  if (hostIndex === -1 || !currentQuestion) return;

  const pointValue = currentDDWager > 0 ? currentDDWager : currentQuestion.q.points;
  const delta = anyContestantScoredPositive ? -pointValue : pointValue;
  gameData.players[hostIndex].score += delta;
  updateScoreDisplay(hostIndex);
}

// ===== MODAL =====
function openQuestion(ci, qi) {
  const cat = gameData.categories[ci];
  const q = cat.questions[qi];
  if (q.answered) return;

  currentQuestion = { ci, qi, q };
  currentDDWager = 0;
  currentDDPlayerIndex = -1;
  anyContestantScoredPositive = false;

  document.getElementById('modalCategory').textContent = cat.name || '';
  document.getElementById('modalPoints').textContent = '$' + q.points;
  const answerEl = document.getElementById('modalAnswer');
  answerEl.classList.remove('visible');
  answerEl.classList.add('host-preview');
  document.getElementById('hostOnlyBadge').classList.remove('hidden');
  document.getElementById('modalAnswerText').textContent = q.answer || '';
  document.getElementById('revealAnswerBtn').classList.remove('hidden');

  if (q.isDailyDouble) {
    showDDSection(cat.name, q.points);
  } else {
    showQuestionSection(q, cat.name);
  }

  document.getElementById('modalOverlay').classList.remove('hidden');
  document.getElementById('modal').scrollTop = 0;
}

function showDDSection(categoryName, points) {
  document.getElementById('modalDDSection').classList.remove('hidden');
  document.getElementById('modalQuestionSection').classList.add('hidden');

  const sel = document.getElementById('ddPlayerSelect');
  sel.innerHTML = '';
  // Don't offer host as a DD wager player
  gameData.players.forEach((p, i) => {
    if (p.isHost) return;
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = p.name + ' (' + formatScore(p.score) + ')';
    sel.appendChild(opt);
  });
  document.getElementById('ddWagerAmount').value = '';

  broadcast({ view: 'daily_double', category: categoryName, points });
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
  showQuestionSection(currentQuestion.q, gameData.categories[currentQuestion.ci].name);
}

function showQuestionSection(q, categoryName) {
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

  const ansImgEl = document.getElementById('modalAnswerImage');
  if (q.answerImage) {
    ansImgEl.src = q.answerImage;
    ansImgEl.classList.remove('hidden');
  } else {
    ansImgEl.src = '';
    ansImgEl.classList.add('hidden');
  }

  document.getElementById('modalQuestion').textContent = q.question || '(no question text)';
  renderModalScoreButtons();

  broadcast({
    view: 'question',
    category: categoryName || '',
    points: q.points,
    question: q.question || '',
    image: q.image || null,
    answerImage: q.answerImage || null,
    isDailyDouble: q.isDailyDouble,
    wager: currentDDWager,
    game: gameData
  });
}

function renderModalScoreButtons() {
  const container = document.getElementById('scoreButtons');
  if (!container) return;
  container.innerHTML = '';

  const pts = currentQuestion ? currentQuestion.q.points : 0;
  const isDD = currentDDWager > 0;
  const wager = isDD ? currentDDWager : pts;

  gameData.players.forEach((p, i) => {
    // Skip host — they have no manual buttons
    if (p.isHost) return;
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
  const answerEl = document.getElementById('modalAnswer');
  answerEl.classList.remove('host-preview');
  answerEl.classList.add('visible');
  document.getElementById('hostOnlyBadge').classList.add('hidden');
  document.getElementById('revealAnswerBtn').classList.add('hidden');

  const q = currentQuestion.q;
  const cat = gameData.categories[currentQuestion.ci];
  broadcast({
    view: 'answer',
    category: cat.name || '',
    points: q.points,
    question: q.question || '',
    answer: q.answer || '',
    image: q.image || null,
    answerImage: q.answerImage || null,
    isDailyDouble: q.isDailyDouble,
    wager: currentDDWager,
    game: gameData
  });
}

function pauseQuestion() {
  if (!currentQuestion) return;
  const { ci, qi } = currentQuestion;
  gameData.categories[ci].questions[qi].inProgress = true;
  saveState();
  renderBoard();
  currentQuestion = null;
  currentDDWager = 0;
  currentDDPlayerIndex = -1;
  anyContestantScoredPositive = false;
  document.getElementById('modalOverlay').classList.add('hidden');
  broadcast({ view: 'board', game: gameData, page: currentPage });
}

function closeModal(markAnswered) {
  if (currentQuestion && markAnswered) {
    // Auto-score the host before marking done
    applyHostScore();
    const { ci, qi } = currentQuestion;
    gameData.categories[ci].questions[qi].inProgress = false;
    gameData.categories[ci].questions[qi].answered = true;
    saveState();
    renderBoard();
  }
  currentQuestion = null;
  currentDDWager = 0;
  currentDDPlayerIndex = -1;
  anyContestantScoredPositive = false;
  document.getElementById('modalOverlay').classList.add('hidden');
  broadcast({ view: 'board', game: gameData, page: currentPage });
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) {
    closeModal(false);
  }
}

// ===== FINAL JEOPARDY =====
function goToFinal() {
  saveState();
  location.href = 'final.html';
}

// ===== RULES =====
function showRules() {
  broadcast({ view: 'rules', rules: gameData.rules || '', title: gameData.title || 'DataPardy' });
}

// ===== AUDIENCE WINDOW =====
function openAudienceScreen() {
  window.open('audience.html', 'datapardy_audience',
    'width=1280,height=720,menubar=no,toolbar=no,location=no');
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
