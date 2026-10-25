const LEVELS = {
  seion: { label: "レベル1 清音", file: "seion.csv" },
  dakuon_handakuon: { label: "レベル2 濁音・半濁音", file: "dakuon_handakuon.csv" },
  youon: { label: "レベル3 拗音", file: "youon.csv" }
};

const levelScreen = document.getElementById("levelScreen");
const quizScreen = document.getElementById("quizScreen");
const backButton = document.getElementById("backButton");
const loadMessage = document.getElementById("loadMessage");
const levelLabel = document.getElementById("levelLabel");
const questionCount = document.getElementById("questionCount");
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
let wrongChoice = null;
let answered = false;
let levelFinished = false;

function parseCSV(text) {
  // CSVの引用符にも対応する簡易パーサー
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
      else if (c === "\n") {
        row.push(field); rows.push(row);
        row = []; field = "";
      } else if (c !== "\r") field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim().replace(/^\uFEFF/, ""));
  return rows
    .filter(r => r.some(v => String(v || "").trim() !== ""))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = String(r[i] ?? "").trim(); });
      return obj;
    })
    .filter(o => o.kana && o.boin !== undefined);
}

async function loadQuestions(levelKey) {
  const response = await fetch(LEVELS[levelKey].file, { cache: "no-store" });
  if (!response.ok) throw new Error(`${LEVELS[levelKey].file} を読み込めませんでした。`);
  const text = await response.text();
  const data = parseCSV(text);
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
  const distractors = shuffle(unique.filter(v => v !== correct)).slice(0, 2);
  const choices = shuffle([correct, ...distractors]);
  // 通常は3択。CSV内の候補が少ない場合は不足を表示する。
  return choices;
}

function startLevel(levelKey, data) {
  currentLevelKey = levelKey;
  questions = shuffle(data);
  questionNumber = 0;
  levelLabel.textContent = LEVELS[levelKey].label;
  levelScreen.classList.add("hidden");
  quizScreen.classList.remove("hidden");
  backButton.classList.remove("hidden");
  showQuestion();
}

function showQuestion() {
  levelFinished = false;
  if (questionNumber >= questions.length) {
    finishLevel();
    return;
  }
  currentQuestion = questions[questionNumber];
  phase = currentQuestion.shiin ? "shiin" : "boin";
  wrongChoice = null;
  answered = false;
  kanaCard.textContent = currentQuestion.kana;
  questionCount.textContent = `${questionNumber + 1} / ${questions.length}`;
  feedback.textContent = "";
  feedback.className = "feedback";
  explanation.textContent = "";
  nextButton.classList.add("hidden");
  retryButton.classList.add("hidden");
  renderPhase();
}

function renderPhase() {
  const isShiin = phase === "shiin";
  instruction.textContent = isShiin
    ? "この文字の子音はどれかな？"
    : "この文字の母音はどれかな？";
  const correct = isShiin ? currentQuestion.shiin : currentQuestion.boin;
  const allValues = questions.map(q => isShiin ? q.shiin : q.boin);
  const choices = makeOptions(correct, allValues);
  optionsBox.replaceChildren();
  choices.forEach(choice => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    button.textContent = choice.toUpperCase();
    button.addEventListener("click", () => chooseAnswer(choice, button));
    optionsBox.appendChild(button);
  });
}

function chooseAnswer(choice, button) {
  if (answered) return;
  const correct = phase === "shiin" ? currentQuestion.shiin : currentQuestion.boin;
  if (choice === correct) {
    answered = true;
    button.classList.add("correct");
    [...optionsBox.children].forEach(b => b.disabled = true);
    feedback.textContent = "正解！";
    feedback.className = "feedback good";
    if (phase === "shiin" && currentQuestion.boin) {
      // 子音が正解したら母音の問題へ
      phase = "boin";
      window.setTimeout(() => {
        feedback.textContent = "";
        feedback.className = "feedback";
        renderPhase();
        answered = false;
      }, 650);
    } else {
      // 「ん」のように母音がない文字は、子音の正解で1問完了
      explanation.textContent = currentQuestion.boin
        ? `${currentQuestion.kana} のローマ字は ${currentQuestion.shiin}${currentQuestion.boin}`
        : `${currentQuestion.kana} のローマ字は ${currentQuestion.shiin}`;
      nextButton.classList.remove("hidden");
    }
  } else {
    button.classList.add("wrong");
    feedback.textContent = "不正解。もう一度えらんでね。";
    feedback.className = "feedback bad";
    // 間違えた選択肢だけ一時的に無効にし、再挑戦できるようにする
    button.disabled = true;
  }
}

function finishLevel() {
  instruction.textContent = "ぜんぶの問題にチャレンジしたよ！";
  kanaCard.textContent = "🎉";
  optionsBox.replaceChildren();
  feedback.textContent = "よくがんばりました！";
  feedback.className = "feedback good";
  explanation.textContent = "もう一度練習するか、別のレベルを選ぼう。";
  levelFinished = true;
  nextButton.textContent = "もう一度チャレンジ";
  nextButton.classList.remove("hidden");
  retryButton.classList.add("hidden");
}

function nextQuestion() {
  if (levelFinished) {
    questions = shuffle(questions);
    questionNumber = 0;
    nextButton.textContent = "次の問題へ →";
    showQuestion();
    return;
  }
  questionNumber++;
  nextButton.textContent = "次の問題へ →";
  showQuestion();
}
nextButton.addEventListener("click", nextQuestion);

backButton.addEventListener("click", () => {
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
