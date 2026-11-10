(() => {
  "use strict";

  const STORAGE_KEY = "study_redacoes_v1";
  const $ = (id) => document.getElementById(id);
  const form = $("form-redacao");
  const titleInput = $("titulo");
  const themeInput = $("tema");
  const textInput = $("texto-redacao");
  const list = $("lista-redacoes");
  const searchInput = $("pesquisar-redacao");
  const themeFilter = $("filtro-tema");
  const sortSelect = $("ordenacao");
  let essays = loadEssays();
  let toastTimer;

  function loadEssays() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Não foi possível ler o arquivo do STUDY:", error);
      return [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(essays));
      return true;
    } catch (error) {
      console.error(error);
      notify("Não foi possível salvar. Confira o espaço do navegador.");
      return false;
    }
  }

  function notify(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function wordCount(text) {
    const clean = text.trim();
    return clean ? clean.split(/\s+/).length : 0;
  }

  function updateCounters() {
    $("total-redacoes").textContent = essays.length;
    $("total-temas").textContent = new Set(essays.map(e => e.tema.trim().toLocaleLowerCase("pt-BR"))).size;
    $("total-palavras").textContent = essays.reduce((sum, e) => sum + wordCount(e.texto), 0).toLocaleString("pt-BR");
    const days = new Set(essays.map(e => e.createdAt ? new Date(e.createdAt).toDateString() : e.data)).size;
    $("dias-estudo").textContent = days;
    const counts = {};
    essays.forEach(e => { counts[e.tema] = (counts[e.tema] || 0) + 1; });
    const topics = Object.entries(counts).sort((a,b) => b[1]-a[1]);
    $("temas-progresso").innerHTML = topics.length
      ? topics.map(([name, count]) => `<span>${escapeHTML(name)} · ${count}</span>`).join("")
      : '<p class="muted">Seus temas aparecerão aqui.</p>';
  }

  function updateSelects() {
    const current = themeFilter.value;
    const themes = [...new Set(essays.map(e => e.tema))].sort((a,b) => a.localeCompare(b, "pt-BR"));
    themeFilter.innerHTML = '<option value="">Todos os temas</option>' + themes.map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join("");
    if (themes.includes(current)) themeFilter.value = current;

    const correctionSelect = $("redacao-correcao");
    const selected = correctionSelect.value;
    correctionSelect.innerHTML = '<option value="">Selecione uma redação...</option>' +
      essays.map(e => `<option value="${escapeHTML(e.id)}">${escapeHTML(e.titulo)}</option>`).join("");
    if (essays.some(e => e.id === selected)) correctionSelect.value = selected;
  }

  function renderEssays() {
    const query = searchInput.value.trim().toLocaleLowerCase("pt-BR");
    const selectedTheme = themeFilter.value;
    let filtered = essays.filter(e =>
      (e.titulo.toLocaleLowerCase("pt-BR").includes(query) || e.tema.toLocaleLowerCase("pt-BR").includes(query) || e.texto.toLocaleLowerCase("pt-BR").includes(query)) &&
      (!selectedTheme || e.tema === selectedTheme)
    );
    if (sortSelect.value === "antigas") filtered.sort((a,b) => new Date(a.createdAt || 0)-new Date(b.createdAt || 0));
    else if (sortSelect.value === "az") filtered.sort((a,b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
    else filtered.sort((a,b) => new Date(b.createdAt || 0)-new Date(a.createdAt || 0));

    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state"><span>♡</span><h3>${essays.length ? "Nada encontrado por aqui" : "Seu arquivo começa aqui"}</h3><p>${essays.length ? "Tente mudar a pesquisa ou o filtro." : "Quando salvar sua primeira redação, ela vai aparecer neste espaço."}</p>${essays.length ? "" : '<a href="#nova-redacao">Escrever agora →</a>'}</div>`;
    } else {
      list.innerHTML = filtered.map(e => `
        <article class="essay-card">
          <h3>${escapeHTML(e.titulo)}</h3>
          <div class="essay-meta"><span class="topic-chip">${escapeHTML(e.tema)}</span><span>${escapeHTML(e.data || "Sem data")}</span><span>${wordCount(e.texto)} palavras</span></div>
          <p class="essay-preview">${escapeHTML(e.texto)}</p>
          <div class="essay-actions">
            <button class="small-button" type="button" data-action="view" data-id="${escapeHTML(e.id)}">Ler</button>
            <button class="small-button" type="button" data-action="edit" data-id="${escapeHTML(e.id)}">Editar</button>
            <button class="small-button delete" type="button" data-action="delete" data-id="${escapeHTML(e.id)}">Excluir</button>
          </div>
        </article>`).join("");
    }
    updateCounters();
    updateSelects();
  }

  function resetForm() {
    form.reset();
    $("essay-id").value = "";
    $("form-heading").textContent = "Nova redação";
    $("botao-salvar").textContent = "Salvar redação ♡";
    $("cancelar-edicao").hidden = true;
    updateWritingCount();
  }

  function updateWritingCount() {
    $("word-count").textContent = `${wordCount(textInput.value)} palavras`;
    $("char-count").textContent = `${textInput.value.length} caracteres`;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const theme = themeInput.value.trim();
    const text = textInput.value.trim();
    if (!title || !theme || !text) {
      notify("Preencha o título, o tema e sua redação. ♡");
      return;
    }

    const id = $("essay-id").value;
    if (id) {
      const index = essays.findIndex(e => e.id === id);
      if (index !== -1) essays[index] = { ...essays[index], titulo: title, tema: theme, texto: text, updatedAt: new Date().toISOString() };
    } else {
      essays.push({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), titulo: title, tema: theme, texto: text, data: new Date().toLocaleDateString("pt-BR"), createdAt: new Date().toISOString() });
    }
    if (persist()) {
      resetForm();
      renderEssays();
      notify(id ? "Redação atualizada! ♡" : "Redação salva com sucesso! ♡");
      $("minhas-redacoes").scrollIntoView({ behavior: "smooth" });
    }
  });

  $("cancelar-edicao").addEventListener("click", resetForm);
  [titleInput, themeInput, textInput].forEach(el => el.addEventListener("input", updateWritingCount));
  searchInput.addEventListener("input", renderEssays);
  themeFilter.addEventListener("change", renderEssays);
  sortSelect.addEventListener("change", renderEssays);

  list.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const essay = essays.find(e => e.id === button.dataset.id);
    if (!essay) return;
    if (button.dataset.action === "edit") {
      $("essay-id").value = essay.id;
      titleInput.value = essay.titulo;
      themeInput.value = essay.tema;
      textInput.value = essay.texto;
      $("form-heading").textContent = "Editar redação";
      $("botao-salvar").textContent = "Atualizar redação ♡";
      $("cancelar-edicao").hidden = false;
      updateWritingCount();
      $("nova-redacao").scrollIntoView({ behavior: "smooth" });
      titleInput.focus({ preventScroll: true });
    } else if (button.dataset.action === "delete") {
      if (!confirm(`Excluir “${essay.titulo}”? Essa ação não pode ser desfeita.`)) return;
      essays = essays.filter(e => e.id !== essay.id);
      if ($("essay-id").value === essay.id) resetForm();
      persist(); renderEssays(); notify("Redação excluída.");
    } else if (button.dataset.action === "view") {
      const w = window.open("", "_blank");
      if (!w) { notify("Permita abrir a nova aba para ler a redação."); return; }
      w.document.write(`<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>${escapeHTML(essay.titulo)}</title><style>body{max-width:760px;margin:60px auto;padding:0 24px;font:17px/1.9 Georgia,serif;color:#594650}h1{font-weight:normal}small{color:#b87994}article{white-space:pre-wrap}</style></head><body><small>STUDY ♡ · ${escapeHTML(essay.tema)} · ${escapeHTML(essay.data)}</small><h1>${escapeHTML(essay.titulo)}</h1><article>${escapeHTML(essay.texto)}</article></body></html>`);
      w.document.close();
    }
  });

  $("analisar-redacao").addEventListener("click", () => {
    const essay = essays.find(e => e.id === $("redacao-correcao").value);
    const result = $("resultado-correcao");
    if (!essay) { result.innerHTML = "<p>Escolha uma redação antes de analisar. ♡</p>"; return; }
    const words = wordCount(essay.texto);
    const paragraphs = essay.texto.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const connectors = ["além disso", "portanto", "entretanto", "contudo", "desse modo", "assim", "porém", "logo", "em primeiro lugar", "consequentemente"];
    const found = connectors.filter(c => essay.texto.toLocaleLowerCase("pt-BR").includes(c));
    const tips = [];
    if (words < 150) tips.push("Seu texto está curtinho. Se for uma redação dissertativo-argumentativa, desenvolva melhor os argumentos e a conclusão.");
    else if (words > 900) tips.push("Seu texto está bem extenso. Confira se todas as ideias contribuem para defender sua tese.");
    else tips.push("A extensão está em uma faixa intermediária; confira a quantidade exigida pela proposta.");
    if (paragraphs.length < 4) tips.push("Considere organizar o texto em introdução, dois parágrafos de desenvolvimento e conclusão, se esse for o formato solicitado.");
    else tips.push(`Foram identificados ${paragraphs.length} blocos de texto separados por linha em branco. Revise se cada parágrafo tem uma função clara.`);
    if (found.length) tips.push(`Conectivos encontrados: ${found.join(", ")}. Veja se estão ligando ideias de forma lógica.`);
    else tips.push("Tente variar conectivos para deixar a progressão das ideias mais clara (por exemplo: entretanto, além disso, portanto).");
    const hasConclusion = /portanto|conclui-se|diante disso|assim,|desse modo/i.test(essay.texto);
    tips.push(hasConclusion ? "Há expressões que podem indicar uma conclusão; confira se ela retoma a tese e fecha o raciocínio." : "Confira se a conclusão retoma a tese e apresenta um fechamento adequado.");
    result.innerHTML = `<h4>Análise orientativa ♡</h4><p><strong>${words} palavras</strong> · ${paragraphs.length} parágrafos separados por linha em branco</p><ul>${tips.map(t => `<li>${escapeHTML(t)}</li>`).join("")}</ul><p><em>Importante:</em> esta é uma análise automática simples, feita no próprio navegador. Não atribui nota ENEM nem substitui uma correção humana ou uma IA especializada.</p>`;
  });

  $("exportar-dados").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(essays, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "study-backup-redacoes.json"; a.click();
    URL.revokeObjectURL(url); notify("Backup preparado! Guarde o arquivo em um lugar seguro.");
  });

  $("importar-dados").addEventListener("change", async (event) => {
    const file = event.target.files[0]; if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!Array.isArray(imported) || imported.some(e => !e.titulo || !e.tema || !e.texto)) throw new Error("Formato inválido");
      if (!confirm(`Importar ${imported.length} redação(ões)? Elas serão adicionadas às atuais.`)) return;
      const ids = new Set(essays.map(e => e.id));
      imported.forEach(e => { if (!ids.has(e.id)) essays.push({ ...e, id: e.id || String(Date.now() + Math.random()) }); });
      persist(); renderEssays(); notify("Backup importado com sucesso! ♡");
    } catch (error) { notify("Não foi possível importar. Confira se é um backup do STUDY."); }
    event.target.value = "";
  });


  // Tema claro/escuro: a preferência fica guardada neste navegador.
  const themeButton = $("theme-toggle");
  const themeIcon = $("theme-icon");
  const themeLabel = $("theme-label");

  function applyTheme(theme) {
    const dark = theme === "dark";
    document.body.classList.toggle("dark-mode", dark);
    themeIcon.textContent = dark ? "☀" : "☾";
    themeLabel.textContent = dark ? "Modo claro" : "Modo escuro";
    themeButton.setAttribute("aria-label", dark ? "Ativar modo claro" : "Ativar modo escuro");
    themeButton.setAttribute("aria-pressed", String(dark));
  }

  let savedTheme = "light";
  try { savedTheme = localStorage.getItem("study_theme") || "light"; } catch (error) {}
  applyTheme(savedTheme);

  themeButton.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
    applyTheme(nextTheme);
    try { localStorage.setItem("study_theme", nextTheme); } catch (error) {}
  });

  $("today-date").textContent = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  $("menu-toggle").addEventListener("click", () => $("sidebar").classList.toggle("open"));
  document.querySelectorAll(".nav-link, .brand").forEach(link => link.addEventListener("click", () => $("sidebar").classList.remove("open")));
  const sections = [...document.querySelectorAll(".section-anchor")];
  const navLinks = [...document.querySelectorAll(".nav-link")];
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) navLinks.forEach(link => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
    }), { rootMargin: "-20% 0px -65% 0px" });
    sections.forEach(section => observer.observe(section));
  }

  renderEssays();
  updateWritingCount();
  console.log("STUDY carregado com sucesso ♡");
})();
