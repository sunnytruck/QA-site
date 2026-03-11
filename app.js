(function () {
  const LS_KEYS = {
    candidate: "qa_candidate_info",
    responses: "qa_responses",
    result: "qa_last_result",
    questions: "qa_questions"
  };

  function loadQuestions() {
    const saved = localStorage.getItem(LS_KEYS.questions);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.questions)) return parsed;
      } catch (e) {
        console.warn("localStorage問題データの読み込みに失敗", e);
      }
    }
    if (window.DEFAULT_QUESTIONS && Array.isArray(window.DEFAULT_QUESTIONS.questions)) {
      return window.DEFAULT_QUESTIONS;
    }
    return { questions: [] };
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg || "";
  }

  function formatDateTime(date = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function setupStartPage() {
    const form = document.getElementById("startForm");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const department = document.getElementById("department").value.trim();
      const employeeId = document.getElementById("employeeId").value.trim();
      const name = document.getElementById("name").value.trim();

      let ok = true;
      setError("departmentError", "");
      setError("employeeIdError", "");
      setError("nameError", "");

      if (!department) {
        setError("departmentError", "所属部署を入力してください。");
        ok = false;
      }
      if (!employeeId) {
        setError("employeeIdError", "社員番号を入力してください。");
        ok = false;
      }
      if (!name) {
        setError("nameError", "名前を入力してください。");
        ok = false;
      }
      if (!ok) return;

      localStorage.setItem(LS_KEYS.candidate, JSON.stringify({ department, employeeId, name }));
      localStorage.removeItem(LS_KEYS.responses);
      localStorage.removeItem(LS_KEYS.result);
      window.location.href = "exam.html";
    });
  }

  function setupExamPage() {
    const form = document.getElementById("examForm");
    if (!form) return;

    const candidateRaw = localStorage.getItem(LS_KEYS.candidate);
    if (!candidateRaw) {
      alert("受験者情報がありません。最初の画面から開始してください。");
      window.location.href = "index.html";
      return;
    }

    const candidate = JSON.parse(candidateRaw);
    document.getElementById("candidateInfo").textContent = `所属部署: ${candidate.department} / 社員番号: ${candidate.employeeId} / 名前: ${candidate.name}`;

    const data = loadQuestions();
    const questions = data.questions || [];
    const container = document.getElementById("questionsContainer");
    document.getElementById("questionCount").textContent = `全 ${questions.length} 問`;

    if (!questions.length) {
      container.innerHTML = "<p class='error'>問題データがありません。作成者画面から問題を作成してください。</p>";
      return;
    }

    container.innerHTML = questions.map((q, idx) => {
      const optionsHtml = q.options.map((opt, i) => {
        const optionId = `q_${idx}_${i}`;
        return `
          <label class="option-label" for="${optionId}">
            <input type="radio" id="${optionId}" name="question_${idx}" value="${i}">
            ${esc(opt)}
          </label>
        `;
      }).join("");

      return `
        <fieldset class="question-item">
          <legend>${idx + 1}. [${esc(q.id)}] ${esc(q.title)}</legend>
          <p>${esc(q.text)}</p>
          ${optionsHtml}
        </fieldset>
      `;
    }).join("");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      setError("submitError", "");

      const responses = [];
      let allAnswered = true;
      questions.forEach((q, idx) => {
        const selected = form.querySelector(`input[name="question_${idx}"]:checked`);
        if (!selected) allAnswered = false;

        responses.push({
          questionId: q.id,
          selectedIndex: selected ? Number(selected.value) : null
        });
      });

      if (!allAnswered) {
        setError("submitError", "すべての問題に回答してください。");
        return;
      }

      const answeredAt = formatDateTime();
      let correctCount = 0;

      const details = questions.map((q, idx) => {
        const selectedIndex = responses[idx].selectedIndex;
        const isCorrect = selectedIndex === q.correctIndex;
        if (isCorrect) correctCount += 1;

        return {
          questionId: q.id,
          title: q.title,
          text: q.text,
          selectedAnswer: q.options[selectedIndex],
          correctAnswer: q.options[q.correctIndex],
          isCorrect,
          explanation: q.explanation || "",
          answeredAt
        };
      });

      const result = {
        candidate,
        totalCount: questions.length,
        correctCount,
        scoreRate: questions.length ? Math.round((correctCount / questions.length) * 1000) / 10 : 0,
        answeredAt,
        details
      };

      localStorage.setItem(LS_KEYS.responses, JSON.stringify(responses));
      localStorage.setItem(LS_KEYS.result, JSON.stringify(result));
      window.location.href = "result.html";
    });
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function buildCsv(result) {
    const header = [
      "所属部署", "社員番号", "名前", "問題ID", "問題タイトル", "問題文", "選択した回答", "正解", "正誤", "回答日時", "総問題数", "正答数", "正答率(%)"
    ];

    const rows = result.details.map((d) => [
      result.candidate.department,
      result.candidate.employeeId,
      result.candidate.name,
      d.questionId,
      d.title,
      d.text,
      d.selectedAnswer,
      d.correctAnswer,
      d.isCorrect ? "正解" : "不正解",
      d.answeredAt,
      result.totalCount,
      result.correctCount,
      result.scoreRate
    ]);

    return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  }

  function downloadCsv(filename, content) {
    const bom = "\uFEFF";
    const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function setupResultPage() {
    const table = document.getElementById("resultTable");
    if (!table) return;

    const raw = localStorage.getItem(LS_KEYS.result);
    if (!raw) {
      alert("結果データがありません。最初から回答してください。");
      window.location.href = "index.html";
      return;
    }

    const result = JSON.parse(raw);
    const meta = document.getElementById("candidateMeta");
    meta.innerHTML = `
      <dt>所属部署</dt><dd>${esc(result.candidate.department)}</dd>
      <dt>社員番号</dt><dd>${esc(result.candidate.employeeId)}</dd>
      <dt>名前</dt><dd>${esc(result.candidate.name)}</dd>
      <dt>回答日時</dt><dd>${esc(result.answeredAt)}</dd>
    `;

    document.getElementById("scoreSummary").textContent = `総問題数: ${result.totalCount} / 正答数: ${result.correctCount} / 正答率: ${result.scoreRate}%`;

    const tbody = table.querySelector("tbody");
    tbody.innerHTML = result.details.map((d) => `
      <tr>
        <td>${esc(d.questionId)}</td>
        <td>${esc(d.title)}</td>
        <td>${esc(d.selectedAnswer)}</td>
        <td>${esc(d.correctAnswer)}</td>
        <td class="${d.isCorrect ? "correct" : "incorrect"}">${d.isCorrect ? "正解" : "不正解"}</td>
      </tr>
    `).join("");

    document.getElementById("downloadCsvBtn").addEventListener("click", () => {
      const csv = buildCsv(result);
      const filename = `exam_result_${result.candidate.employeeId}_${result.answeredAt.replace(/[: ]/g, "-")}.csv`;
      downloadCsv(filename, csv);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupStartPage();
    setupExamPage();
    setupResultPage();
  });
})();
