const LEVELS = {
  seion: { label: "レベル1 清音", file: "seion.csv" },
  dakuon_handakuon: { label: "レベル2 濁音・半濁音", file: "dakuon_handakuon.csv" },
  youon: { label: "レベル3 拗音", file: "youon.csv" }
};

const QUESTIONS_PER_LEVEL = 20;
const TIME_LIMIT_SECONDS = 5;

const levelScreen = document.getElementById("levelScreen");
const quizScreen = document.getElementById("quizScreen");
const backButton = document.getElementById("backButton");
const loadMessage = document.getElementById("loadMessage");
const levelLabel = document.getElementById("levelLabel");
const questionCount = document.getElementById("questionCount");
const timerDisplay = document.getElementById("timerDisplay");
const scoreDisplay = document.getElementById("scoreDisplay");
const instruction = document.getElementById("instruction");
const kanaCard = document.getElementById("kanaCard");
const optionsBox = document.getElementById("options");
const feedback = document.getElementById("feedback");
const explanation = document.getElementById("explanation");
const nextButton = document.getElementById("nextButton");
const retryButton = document.getElementById("retryButton");

let currentLevelKey = "";
let questions = [];
let questionNumber = 0;
let currentQuestion = null;
let phase = "shiin";
let answered = false;
let levelFinished = false;
let score = 0;
let startTime = 0;
let questionStartTime = 0;
let questionTimer = null;
let transitionTimer = null;

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else {
      if (c === '"' && field === "") quoted = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c !== "\r") field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim().replace(/^\uFEFF/, ""));
  return rows.filter(r => r.some(v => String(v || "").trim() !== ""))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = String(r[i] ?? "").trim(); });
      return obj;
    }).filter(o => o.kana && o.boin !== undefined);
}

async function loadQuestions(levelKey) {
  const response = await fetch(LEVELS[levelKey].file, { cache: "no-store" });
  if (!response.ok) throw new Error(`${LEVELS[levelKey].file} を読み込めませんでした。`);
  const data = parseCSV(await response.text());
  if (!data.length) throw new Error("CSVに問題データがありません。");
  return data;
}

function shuffle(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makeOptions(correct, values) {
  const unique = [...new Set(values.map(v => String(v || "").trim()).filter(Boolean))];
  return shuffle([correct, ...shuffle(unique.filter(v => v !== correct)).slice(0, 2)]);
}

function stopQuestionTimer() {
  if (questionTimer !== null) window.clearInterval(questionTimer);
  questionTimer = null;
}

function clearTransitionTimer() {
  if (transitionTimer !== null) window.clearTimeout(transitionTimer);
  transitionTimer = null;
}

function updateScore() {
  scoreDisplay.textContent = String(score);
}

function startLevel(levelKey, data) {
  clearTransitionTimer();
  stopQuestionTimer();
  currentLevelKey = levelKey;
  questions = shuffle(data).slice(0, QUESTIONS_PER_LEVEL);
  questionNumber = 0;
  score = 0;
  startTime = Date.now();
  levelLabel.textContent = LEVELS[levelKey].label;
  levelScreen.classList.add("hidden");
  quizScreen.classList.remove("hidden");
  backButton.classList.remove("hidden");
  nextButton.textContent = "次の問題へ →";
  updateScore();
  showQuestion();
}

function showQuestion() {
  clearTransitionTimer();
  stopQuestionTimer();
  levelFinished = false;
  if (questionNumber >= questions.length) { finishLevel(); return; }

  currentQuestion = questions[questionNumber];
  phase = currentQuestion.shiin ? "shiin" : "boin";
  answered = false;
  kanaCard.textContent = currentQuestion.kana;
  questionCount.textContent = `${questionNumber + 1} / ${questions.length} 問`;
  feedback.textContent = "";
  feedback.className = "feedback";
  explanation.textContent = "";
  nextButton.classList.add("hidden");
  retryButton.classList.add("hidden");
  timerDisplay.classList.remove("timer-expired");
  renderPhase();
  startQuestionTimer();
}

function startQuestionTimer() {
  questionStartTime = Date.now();
  updateQuestionTimer();
  questionTimer = window.setInterval(updateQuestionTimer, 100);
}

function updateQuestionTimer() {
  if (answered || levelFinished) return;
  const elapsed = (Date.now() - questionStartTime) / 1000;
  const remaining = Math.max(0, TIME_LIMIT_SECONDS - elapsed);
  timerDisplay.textContent = `のこり ${remaining.toFixed(1)} 秒`;
  if (remaining <= 0) timeExpired();
}

function renderPhase() {
  const isShiin = phase === "shiin";
  instruction.textContent = isShiin ? "この文字の子音はどれかな？" : "この文字の母音はどれかな？";
  const correct = isShiin ? currentQuestion.shiin : currentQuestion.boin;
  const choices = makeOptions(correct, questions.map(q => isShiin ? q.shiin : q.boin));
  optionsBox.replaceChildren();
  choices.forEach(choice => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    button.textContent = choice; // CSVにある小文字をそのまま表示
    button.addEventListener("click", () => chooseAnswer(choice, button));
    optionsBox.appendChild(button);
  });
}

function chooseAnswer(choice, button) {
  if (answered || levelFinished) return;
  const correct = phase === "shiin" ? currentQuestion.shiin : currentQuestion.boin;
  if (choice === correct) {
    score += 1;
    updateScore();
    button.classList.add("correct");
    [...optionsBox.children].forEach(b => b.disabled = true);
    feedback.textContent = "正解！ +1点";
    feedback.className = "feedback good";

    if (phase === "shiin" && currentQuestion.boin) {
      answered = true;
      phase = "boin";
      transitionTimer = window.setTimeout(() => {
        if (levelFinished) return;
        feedback.textContent = "";
        feedback.className = "feedback";
        renderPhase();
        answered = false;
      }, 450);
    } else {
      answered = true;
      stopQuestionTimer();
      timerDisplay.textContent = "回答完了";
      explanation.textContent = currentQuestion.boin
        ? `${currentQuestion.kana} のローマ字は ${currentQuestion.shiin}${currentQuestion.boin}`
        : `${currentQuestion.kana} のローマ字は ${currentQuestion.shiin}`;
      nextButton.classList.remove("hidden");
    }
  } else {
    score -= 1;
    updateScore();
    button.classList.add("wrong");
    feedback.textContent = "不正解。-1点　もう一度！";
    feedback.className = "feedback bad";
    button.disabled = true;
    if ([...optionsBox.children].every(b => b.disabled)) {
      // 選択肢をすべて間違えた場合も、残り時間内に再表示して挑戦できるようにする
      transitionTimer = window.setTimeout(() => {
        if (answered || levelFinished) return;
        feedback.textContent = "もう一度えらんでね。";
        feedback.className = "feedback";
        renderPhase();
      }, 300);
    }
  }
}

function timeExpired() {
  if (answered || levelFinished) return;
  stopQuestionTimer();
  clearTransitionTimer();
  answered = true;
  score -= 1;
  updateScore();
  [...optionsBox.children].forEach(b => b.disabled = true);
  timerDisplay.textContent = "時間切れ！";
  timerDisplay.classList.add("timer-expired");
  feedback.textContent = "時間切れ！ -1点";
  feedback.className = "feedback bad";
  explanation.textContent = currentQuestion.boin
    ? `${currentQuestion.kana} のローマ字は ${currentQuestion.shiin}${currentQuestion.boin}`
    : `${currentQuestion.kana} のローマ字は ${currentQuestion.shiin}`;
  transitionTimer = window.setTimeout(() => {
    questionNumber++;
    showQuestion();
  }, 800);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return minutes > 0 ? `${minutes}分${String(seconds).padStart(2, "0")}秒` : `${seconds}.${tenths}秒`;
}

function finishLevel() {
  stopQuestionTimer();
  clearTransitionTimer();
  levelFinished = true;
  const elapsed = Date.now() - startTime;
  instruction.textContent = "チャレンジ終了！";
  kanaCard.textContent = "🎉";
  optionsBox.replaceChildren();
  timerDisplay.textContent = "終了";
  timerDisplay.classList.remove("timer-expired");
  feedback.textContent = "おつかれさまでした！";
  feedback.className = "feedback good";
  explanation.textContent = `スコア：${score} 点　／　タイム：${formatDuration(elapsed)}　／　${questions.length}問に挑戦`;
  nextButton.textContent = "もう一度チャレンジ";
  nextButton.classList.remove("hidden");
  retryButton.classList.add("hidden");
  questionCount.textContent = `${questions.length} / ${questions.length} 問`;
}

function nextQuestion() {
  if (levelFinished) {
    startLevel(currentLevelKey, questions.length ? questions : []);
    return;
  }
  questionNumber++;
  nextButton.textContent = "次の問題へ →";
  showQuestion();
}
nextButton.addEventListener("click", nextQuestion);

backButton.addEventListener("click", () => {
  clearTransitionTimer();
  stopQuestionTimer();
  quizScreen.classList.add("hidden");
  levelScreen.classList.remove("hidden");
  backButton.classList.add("hidden");
  loadMessage.textContent = "";
});

document.querySelectorAll("[data-level]").forEach(button => {
  button.addEventListener("click", async () => {
    const levelKey = button.dataset.level;
    loadMessage.textContent = "問題を読み込んでいます…";
    document.querySelectorAll("[data-level]").forEach(b => b.disabled = true);
    try {
      const data = await loadQuestions(levelKey);
      startLevel(levelKey, data);
      loadMessage.textContent = "";
    } catch (error) {
      loadMessage.textContent = `${error.message} CSVファイルがHTMLと同じ場所にあるか確認してください。`;
    } finally {
      document.querySelectorAll("[data-level]").forEach(b => b.disabled = false);
    }
  });
});
