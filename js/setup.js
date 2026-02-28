// ===== STATE =====
const DEFAULT_POINT_VALUES = [200, 400, 600, 800, 1000];
const MAX_CATEGORIES = 6;
const MAX_PLAYERS = 6;
const MAX_QUESTIONS = 5;

// In-memory game state
let gameData = {
  title: '',
  players: [],
  categories: [],
  finalJeopardy: { category: '', question: '', answer: '', image: null }
};

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const saved = localStorage.getItem('datapardy_game');

  if (params.get('loaded') === '1' && saved) {
    try {
      gameData = JSON.parse(saved);
    } catch { gameData = emptyGame(); }
  } else if (saved && !params.get('fresh')) {
    // Optionally pre-fill from existing save
    try {
      gameData = JSON.parse(saved);
    } catch { gameData = emptyGame(); }
  } else {
    gameData = emptyGame();
  }

  renderAll();
});

function emptyGame() {
  return {
    title: '',
    hostScoring: false,
    rules: '',
    players: [],
    categories: [],
    finalJeopardy: { category: '', question: '', answer: '', image: null }
  };
}

// ===== RENDER ALL =====
function renderAll() {
  document.getElementById('gameTitle').value = gameData.title || '';
  document.getElementById('hostScoring').checked = !!gameData.hostScoring;
  document.getElementById('gameRules').value = gameData.rules || '';
  renderPlayers();
  renderCategories();
  renderFinalJeopardy();
}

// ===== PLAYERS =====
function renderPlayers() {
  const list = document.getElementById('playerList');
  list.innerHTML = '';
  gameData.players.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'player-entry';
    div.innerHTML = `
      <input type="text" value="${escHtml(p.name)}" placeholder="Player ${i + 1}"
        maxlength="30" onchange="updatePlayerName(${i}, this.value)">
      <button class="player-remove" onclick="removePlayer(${i})" title="Remove">✕</button>
    `;
    list.appendChild(div);
  });
  document.getElementById('addPlayerBtn').style.display =
    gameData.players.length >= MAX_PLAYERS ? 'none' : '';
}

function addPlayer() {
  if (gameData.players.length >= MAX_PLAYERS) return;
  gameData.players.push({ name: `Player ${gameData.players.length + 1}`, score: 0 });
  renderPlayers();
}

function removePlayer(i) {
  gameData.players.splice(i, 1);
  renderPlayers();
}

function updatePlayerName(i, val) {
  gameData.players[i].name = val.trim() || `Player ${i + 1}`;
}

// ===== CATEGORIES =====
function renderCategories() {
  const list = document.getElementById('categoryList');
  list.innerHTML = '';
  gameData.categories.forEach((cat, ci) => renderCategory(list, cat, ci));
  document.getElementById('addCategoryBtn').style.display =
    gameData.categories.length >= MAX_CATEGORIES ? 'none' : '';
}

function renderCategory(container, cat, ci) {
  const block = document.createElement('div');
  block.className = 'category-block';
  block.id = `cat-${ci}`;

  // Header
  const header = document.createElement('div');
  header.className = 'category-header';
  header.innerHTML = `
    <input type="text" value="${escHtml(cat.name)}" placeholder="Category Name"
      maxlength="60" onchange="updateCategoryName(${ci}, this.value)">
    <button class="btn btn-danger btn-sm" onclick="removeCategory(${ci})">Remove</button>
  `;
  block.appendChild(header);

  // Questions
  const qContainer = document.createElement('div');
  qContainer.id = `cat-${ci}-questions`;
  cat.questions.forEach((q, qi) => {
    qContainer.appendChild(renderQuestionRow(q, ci, qi));
  });
  block.appendChild(qContainer);

  if (cat.questions.length < MAX_QUESTIONS) {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-secondary btn-sm mt-8';
    addBtn.textContent = '+ Add Question';
    addBtn.onclick = () => addQuestion(ci);
    block.appendChild(addBtn);
  }

  container.appendChild(block);
}

function renderQuestionRow(q, ci, qi) {
  const row = document.createElement('div');
  row.className = 'question-row';
  row.id = `q-${ci}-${qi}`;

  const imgSrc = q.image ? q.image : '';
  const hasImg = !!q.image;

  row.innerHTML = `
    <div class="question-row-header">
      <span class="points-badge">$${q.points}</span>
      <div class="form-group" style="max-width:110px;min-width:80px">
        <label>Points</label>
        <input type="number" value="${q.points}" min="50" max="99999" step="50"
          onchange="updateQuestion(${ci},${qi},'points',+this.value)">
      </div>
      <label class="dd-label">
        <input type="checkbox" ${q.isDailyDouble ? 'checked' : ''}
          onchange="updateQuestion(${ci},${qi},'isDailyDouble',this.checked)">
        Daily Double
      </label>
      <button class="btn btn-danger btn-sm" onclick="removeQuestion(${ci},${qi})" style="margin-left:auto">Remove</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Question</label>
        <textarea placeholder="Enter the question clue..." rows="2"
          onchange="updateQuestion(${ci},${qi},'question',this.value)">${escHtml(q.question)}</textarea>
      </div>
      <div class="form-group">
        <label>Answer</label>
        <textarea placeholder="Enter the answer..." rows="2"
          onchange="updateQuestion(${ci},${qi},'answer',this.value)">${escHtml(q.answer)}</textarea>
      </div>
    </div>
    <div class="form-row" style="align-items:center">
      <div class="form-group" style="max-width:240px">
        <label>Image (optional)</label>
        <input type="file" accept="image/*" style="color:var(--tan)"
          onchange="handleQuestionImage(event,${ci},${qi})">
      </div>
      <img id="qimg-${ci}-${qi}" class="image-preview ${hasImg ? '' : 'hidden'}"
        src="${escHtml(imgSrc)}" alt="preview">
      <button class="image-clear ${hasImg ? '' : 'hidden'}" id="qclear-${ci}-${qi}"
        onclick="clearQuestionImage(${ci},${qi})">✕ Remove</button>
    </div>
  `;

  // Sync points badge live
  const pointsInput = row.querySelector('input[type="number"]');
  const badge = row.querySelector('.points-badge');
  pointsInput.addEventListener('input', () => {
    badge.textContent = '$' + (pointsInput.value || 0);
  });

  return row;
}

function addCategory() {
  if (gameData.categories.length >= MAX_CATEGORIES) return;
  gameData.categories.push({
    name: '',
    questions: [newQuestion(0)]
  });
  renderCategories();
}

function removeCategory(ci) {
  gameData.categories.splice(ci, 1);
  renderCategories();
}

function updateCategoryName(ci, val) {
  gameData.categories[ci].name = val;
}

function addQuestion(ci) {
  const cat = gameData.categories[ci];
  if (cat.questions.length >= MAX_QUESTIONS) return;
  const nextPoints = DEFAULT_POINT_VALUES[cat.questions.length] || (cat.questions.length + 1) * 200;
  cat.questions.push(newQuestion(nextPoints));
  renderCategories();
}

function removeQuestion(ci, qi) {
  gameData.categories[ci].questions.splice(qi, 1);
  renderCategories();
}

function newQuestion(points) {
  return { question: '', answer: '', points: points || 200, image: null, isDailyDouble: false, answered: false, inProgress: false };
}

function updateQuestion(ci, qi, field, value) {
  gameData.categories[ci].questions[qi][field] = value;
  // Re-render the points badge if points changed
  if (field === 'points') {
    const badge = document.querySelector(`#q-${ci}-${qi} .points-badge`);
    if (badge) badge.textContent = '$' + value;
  }
}

function handleQuestionImage(event, ci, qi) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    gameData.categories[ci].questions[qi].image = e.target.result;
    const img = document.getElementById(`qimg-${ci}-${qi}`);
    const clr = document.getElementById(`qclear-${ci}-${qi}`);
    img.src = e.target.result;
    img.classList.remove('hidden');
    clr.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearQuestionImage(ci, qi) {
  gameData.categories[ci].questions[qi].image = null;
  const img = document.getElementById(`qimg-${ci}-${qi}`);
  const clr = document.getElementById(`qclear-${ci}-${qi}`);
  img.src = '';
  img.classList.add('hidden');
  clr.classList.add('hidden');
}

// ===== FINAL JEOPARDY =====
function renderFinalJeopardy() {
  const fj = gameData.finalJeopardy;
  document.getElementById('finalCategory').value = fj.category || '';
  document.getElementById('finalQuestion').value = fj.question || '';
  document.getElementById('finalAnswer').value = fj.answer || '';
  if (fj.image) {
    document.getElementById('finalImagePreview').src = fj.image;
    document.getElementById('finalImagePreview').classList.remove('hidden');
    document.getElementById('finalImageClear').classList.remove('hidden');
  }
}

function handleFinalImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    gameData.finalJeopardy.image = e.target.result;
    document.getElementById('finalImagePreview').src = e.target.result;
    document.getElementById('finalImagePreview').classList.remove('hidden');
    document.getElementById('finalImageClear').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearFinalImage() {
  gameData.finalJeopardy.image = null;
  document.getElementById('finalImagePreview').src = '';
  document.getElementById('finalImagePreview').classList.add('hidden');
  document.getElementById('finalImageClear').classList.add('hidden');
  document.getElementById('finalImage').value = '';
}

// ===== COLLECT FORM DATA =====
function collectFormData() {
  gameData.title = document.getElementById('gameTitle').value.trim() || 'Jeopardy Game';
  gameData.hostScoring = document.getElementById('hostScoring').checked;
  gameData.rules = document.getElementById('gameRules').value;

  // Collect player names from live inputs
  const playerInputs = document.querySelectorAll('.player-entry input[type="text"]');
  playerInputs.forEach((inp, i) => {
    if (gameData.players[i]) {
      gameData.players[i].name = inp.value.trim() || `Player ${i + 1}`;
    }
  });

  // Collect category names
  gameData.categories.forEach((cat, ci) => {
    const nameInput = document.querySelector(`#cat-${ci} .category-header input`);
    if (nameInput) cat.name = nameInput.value.trim() || `Category ${ci + 1}`;

    // Collect question fields
    cat.questions.forEach((q, qi) => {
      const row = document.getElementById(`q-${ci}-${qi}`);
      if (!row) return;
      const textareas = row.querySelectorAll('textarea');
      if (textareas[0]) q.question = textareas[0].value.trim();
      if (textareas[1]) q.answer = textareas[1].value.trim();
      const numInput = row.querySelector('input[type="number"]');
      if (numInput) q.points = parseInt(numInput.value) || 200;
      const ddChk = row.querySelector('input[type="checkbox"]');
      if (ddChk) q.isDailyDouble = ddChk.checked;
    });
  });

  // Final jeopardy
  gameData.finalJeopardy.category = document.getElementById('finalCategory').value.trim();
  gameData.finalJeopardy.question = document.getElementById('finalQuestion').value.trim();
  gameData.finalJeopardy.answer = document.getElementById('finalAnswer').value.trim();
}

// ===== SAVE / LOAD =====
function saveToFile() {
  collectFormData();
  const json = JSON.stringify(gameData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (gameData.title || 'jeopardy').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function loadFromFile() {
  document.getElementById('importFileInput').click();
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.categories || !Array.isArray(data.categories)) throw new Error('Invalid file');
      gameData = data;
      renderAll();
    } catch (err) {
      alert('Error loading file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ===== START GAME =====
function startGame() {
  collectFormData();

  if (gameData.players.length === 0) {
    alert('Please add at least one player.');
    return;
  }
  if (gameData.categories.length === 0) {
    alert('Please add at least one category with questions.');
    return;
  }

  // Ensure all players have score field
  gameData.players.forEach(p => { if (p.score === undefined) p.score = 0; });
  // Ensure all questions have answered field (don't overwrite existing state)
  gameData.categories.forEach(cat => {
    cat.questions.forEach(q => { if (q.answered === undefined) q.answered = false; });
  });

  localStorage.setItem('datapardy_game', JSON.stringify(gameData));
  location.href = 'game.html';
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
