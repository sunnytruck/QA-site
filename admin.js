(function () {
  const ADMIN_PASSWORD = "admin123";
  const LS_KEYS = {
    auth: "qa_admin_auth",
    questions: "qa_questions"
  };

  function loadQuestionData() {
    const raw = localStorage.getItem(LS_KEYS.questions);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.questions)) return parsed;
      } catch (e) {
        console.warn("問題データ読み込み失敗", e);
      }
    }
    return window.DEFAULT_QUESTIONS || { questions: [] };
  }

  function saveQuestionData(data) {
    localStorage.setItem(LS_KEYS.questions, JSON.stringify(data));
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  let state = {
    editingId: null,
    questionData: loadQuestionData()
  };

  function setAuth(isAuthed) {
    localStorage.setItem(LS_KEYS.auth, isAuthed ? "1" : "0");
  }

  function isAuthed() {
    return localStorage.getItem(LS_KEYS.auth) === "1";
  }

  function togglePanel() {
    const login = document.getElementById("loginSection");
    const panel = document.getElementById("adminPanelSection");
    const authed = isAuthed();
    login.classList.toggle("hidden", authed);
    panel.classList.toggle("hidden", !authed);
    if (authed) {
      renderTable();
      resetForm();
    }
  }

  function refreshCorrectIndexOptions() {
    const optionInputs = Array.from(document.querySelectorAll(".option-input"));
    const select = document.getElementById("correctIndex");
    const oldValue = select.value;

    select.innerHTML = optionInputs
      .map((_, i) => `<option value="${i}">${i + 1}番</option>`)
      .join("");

    if (oldValue && Number(oldValue) < optionInputs.length) {
      select.value = oldValue;
    }
  }

  function addOptionInput(value = "") {
    const wrapper = document.getElementById("optionInputs");
    const count = wrapper.querySelectorAll(".option-input").length;
    if (count >= 6) return;

    const row = document.createElement("div");
    row.className = "form-row";
    row.innerHTML = `
      <label>選択肢 ${count + 1} <span class="required">*</span></label>
      <input type="text" class="option-input" maxlength="200" value="${esc(value)}" required>
    `;
    wrapper.appendChild(row);
    refreshCorrectIndexOptions();
  }

  function removeOptionInput() {
    const wrapper = document.getElementById("optionInputs");
    const rows = wrapper.querySelectorAll(".form-row");
    if (rows.length <= 2) return;
    rows[rows.length - 1].remove();
    refreshCorrectIndexOptions();
  }

  function renderTable() {
    const tbody = document.querySelector("#adminQuestionTable tbody");
    const questions = state.questionData.questions;
    tbody.innerHTML = questions.map((q) => `
      <tr>
        <td>${esc(q.id)}</td>
        <td>${esc(q.title)}</td>
        <td>${esc(q.text)}</td>
        <td>${q.options.length}</td>
        <td>
          <button type="button" data-edit="${esc(q.id)}">編集</button>
          <button type="button" data-delete="${esc(q.id)}" class="button-secondary">削除</button>
        </td>
      </tr>
    `).join("");
  }

  function resetForm() {
    state.editingId = null;
    document.getElementById("editorTitle").textContent = "問題作成";
    document.getElementById("questionForm").reset();
    document.getElementById("questionId").value = "";
    document.getElementById("questionFormError").textContent = "";
    document.getElementById("cancelEditBtn").classList.add("hidden");

    const wrapper = document.getElementById("optionInputs");
    wrapper.innerHTML = "";
    addOptionInput();
    addOptionInput();
    document.getElementById("correctIndex").value = "0";
  }

  function startEdit(id) {
    const q = state.questionData.questions.find((item) => item.id === id);
    if (!q) return;

    state.editingId = id;
    document.getElementById("editorTitle").textContent = `問題編集 (${id})`;
    document.getElementById("questionId").value = q.id;
    document.getElementById("questionTitle").value = q.title;
    document.getElementById("questionText").value = q.text;
    document.getElementById("explanation").value = q.explanation || "";
    document.getElementById("cancelEditBtn").classList.remove("hidden");

    const wrapper = document.getElementById("optionInputs");
    wrapper.innerHTML = "";
    q.options.forEach((opt) => addOptionInput(opt));
    document.getElementById("correctIndex").value = String(q.correctIndex);
  }

  function deleteQuestion(id) {
    if (!confirm(`問題 ${id} を削除します。よろしいですか？`)) return;
    state.questionData.questions = state.questionData.questions.filter((q) => q.id !== id);
    saveQuestionData(state.questionData);
    renderTable();
    resetForm();
  }

  function nextQuestionId() {
    const ids = state.questionData.questions
      .map((q) => q.id)
      .filter((id) => /^Q\d+$/.test(id))
      .map((id) => Number(id.slice(1)));
    const next = ids.length ? Math.max(...ids) + 1 : 1;
    return `Q${String(next).padStart(3, "0")}`;
  }

  function setupEvents() {
    document.getElementById("adminLoginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const password = document.getElementById("adminPassword").value;
      const err = document.getElementById("adminLoginError");
      err.textContent = "";

      if (password !== ADMIN_PASSWORD) {
        err.textContent = "パスワードが正しくありません。";
        return;
      }
      setAuth(true);
      togglePanel();
    });

    document.getElementById("logoutBtn").addEventListener("click", () => {
      setAuth(false);
      togglePanel();
    });

    document.getElementById("addOptionBtn").addEventListener("click", () => addOptionInput());
    document.getElementById("removeOptionBtn").addEventListener("click", () => removeOptionInput());
    document.getElementById("cancelEditBtn").addEventListener("click", () => resetForm());

    document.querySelector("#adminQuestionTable tbody").addEventListener("click", (e) => {
      const editId = e.target.getAttribute("data-edit");
      const deleteId = e.target.getAttribute("data-delete");
      if (editId) startEdit(editId);
      if (deleteId) deleteQuestion(deleteId);
    });

    document.getElementById("questionForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const err = document.getElementById("questionFormError");
      err.textContent = "";

      const title = document.getElementById("questionTitle").value.trim();
      const text = document.getElementById("questionText").value.trim();
      const options = Array.from(document.querySelectorAll(".option-input")).map((i) => i.value.trim());
      const correctIndex = Number(document.getElementById("correctIndex").value);
      const explanation = document.getElementById("explanation").value.trim();

      if (!title || !text) {
        err.textContent = "問題タイトルと問題文は必須です。";
        return;
      }
      if (options.length < 2 || options.some((o) => !o)) {
        err.textContent = "選択肢は2つ以上、すべて入力してください。";
        return;
      }
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        err.textContent = "正解の選択肢番号が不正です。";
        return;
      }

      const payload = {
        id: state.editingId || nextQuestionId(),
        title,
        text,
        options,
        correctIndex,
        explanation
      };

      if (state.editingId) {
        state.questionData.questions = state.questionData.questions.map((q) => (q.id === state.editingId ? payload : q));
      } else {
        state.questionData.questions.push(payload);
      }

      saveQuestionData(state.questionData);
      renderTable();
      resetForm();
    });

    document.getElementById("exportJsonBtn").addEventListener("click", () => {
      downloadTextFile("questions-export.json", JSON.stringify(state.questionData, null, 2));
    });

    document.getElementById("exportJsBtn").addEventListener("click", () => {
      const content = `window.DEFAULT_QUESTIONS = ${JSON.stringify(state.questionData, null, 2)};\n`;
      downloadTextFile("questions-export.js", content);
    });

    document.getElementById("importForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const text = document.getElementById("importText").value.trim();
      const err = document.getElementById("importError");
      err.textContent = "";

      if (!text) {
        err.textContent = "インポート内容を入力してください。";
        return;
      }

      try {
        let parsed;
        if (text.includes("window.DEFAULT_QUESTIONS")) {
          const match = text.match(/window\.DEFAULT_QUESTIONS\s*=\s*([\s\S]*?);?$/);
          if (!match) throw new Error("questions.js形式の解析に失敗");
          parsed = JSON.parse(match[1]);
        } else {
          parsed = JSON.parse(text);
        }

        if (!parsed || !Array.isArray(parsed.questions)) {
          throw new Error("questions配列が見つかりません");
        }

        state.questionData = parsed;
        saveQuestionData(parsed);
        renderTable();
        resetForm();
        alert("インポートが完了しました。");
      } catch (error) {
        err.textContent = `インポートに失敗しました: ${error.message}`;
      }
    });
  }

  function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupEvents();
    togglePanel();
  });
})();
