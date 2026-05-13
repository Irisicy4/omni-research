/* ───────────────────────────────────────────────────────────────
   OmniResearch — single-file SPA logic
   Tab 1: paper feed (Xiaohongshu-style waterfall)
   Tab 2: dataset registry (port of awesome-mmdataset-website)
   ─────────────────────────────────────────────────────────────── */

(() => {
  const PAPER_MANIFEST_URL = "papers/manifest.json";
  const DATASETS_SEED_URL = "data/datasets-seed.json";
  const DATASETS_STORAGE_KEY = "omniresearch.datasets.v1";

  // ───── Tab routing ─────
  const tabs = document.querySelectorAll(".tab");
  const panes = document.querySelectorAll(".tab-pane");
  function activateTab(name) {
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    panes.forEach((p) =>
      p.classList.toggle("active", p.id === `tab-${name}`)
    );
    if (location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
  }
  tabs.forEach((t) =>
    t.addEventListener("click", () => activateTab(t.dataset.tab))
  );
  const initialTab = (location.hash || "#feed").slice(1);
  activateTab(["feed", "datasets"].includes(initialTab) ? initialTab : "feed");

  // ───── Modal helpers ─────
  function openModal(id) {
    const m = document.getElementById(id);
    m.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal(m) {
    m.hidden = true;
    document.body.style.overflow = "";
  }
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target.dataset.close !== undefined) closeModal(modal);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document
        .querySelectorAll(".modal:not([hidden])")
        .forEach((m) => closeModal(m));
    }
  });

  // ─────────────────────────────────────────────────────────
  //  TAB 1 — Paper feed
  // ─────────────────────────────────────────────────────────
  const feedMasonry = document.getElementById("feed-masonry");
  const feedMeta = document.getElementById("feed-meta");
  const feedEmpty = document.getElementById("feed-empty");
  const feedChips = document.getElementById("feed-chips");

  let papers = [];
  let activeFilter = "all";

  function pseudoLikes(id) {
    // deterministic-ish "likes" count from id
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return 30 + (h % 4200);
  }

  function paperCardHTML(p) {
    const img = p.image || `https://picsum.photos/seed/${p.arxiv_id}/600/${600 + (p.arxiv_id.charCodeAt(p.arxiv_id.length - 1) % 4) * 80}`;
    const likes = pseudoLikes(p.arxiv_id);
    return `
      <article class="paper-card" data-id="${p.arxiv_id}">
        <img class="paper-card-img" loading="lazy" src="${img}" alt="" />
        <div class="paper-card-body">
          <h3 class="paper-card-headline">${escapeHTML(p.summary)}</h3>
          <p class="paper-card-subtitle">${escapeHTML(p.title)}</p>
          <div class="paper-card-foot">
            <span class="venue">${escapeHTML(p.venue || "arXiv")}</span>
            <span class="likes">♥ ${likes.toLocaleString()}</span>
          </div>
        </div>
      </article>
    `;
  }

  function renderFeed() {
    const matched =
      activeFilter === "all"
        ? papers
        : papers.filter((p) =>
            (p.tags || []).map((t) => t.toLowerCase()).includes(activeFilter)
          );

    feedMeta.textContent = `${matched.length} paper${matched.length === 1 ? "" : "s"} · updated ${new Date().toLocaleDateString()}`;

    if (matched.length === 0) {
      feedMasonry.innerHTML = "";
      feedEmpty.hidden = false;
      return;
    }
    feedEmpty.hidden = true;
    feedMasonry.innerHTML = matched.map(paperCardHTML).join("");
  }

  feedChips.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    feedChips.querySelectorAll(".chip").forEach((c) =>
      c.classList.toggle("active", c === btn)
    );
    activeFilter = btn.dataset.filter;
    renderFeed();
  });

  feedMasonry.addEventListener("click", (e) => {
    const card = e.target.closest(".paper-card");
    if (!card) return;
    showPaperDetail(card.dataset.id);
  });

  async function showPaperDetail(id) {
    const p = papers.find((x) => x.arxiv_id === id);
    if (!p) return;
    const body = document.getElementById("paper-modal-body");
    const img = p.image || `https://picsum.photos/seed/${p.arxiv_id}/1200/700`;

    body.innerHTML = `
      <img class="hero" src="${img}" alt="" />
      <div class="paper-head">
        <h2 class="headline">${escapeHTML(p.summary)}</h2>
        <p class="paper-title">${escapeHTML(p.title)}</p>
        <div class="paper-meta">
          <span class="pill">${escapeHTML(p.venue || "arXiv")}</span>
          <span class="pill sky">arXiv:${escapeHTML(p.arxiv_id)}</span>
          <span class="pill">${escapeHTML(p.date)}</span>
          ${(p.tags || []).map((t) => `<span class="pill">${escapeHTML(t)}</span>`).join("")}
        </div>
        <p style="color:var(--ink-muted);font-size:13px;margin:0 0 8px;">
          ${(p.authors || []).map(escapeHTML).join(", ")}
        </p>
      </div>
      <div class="actions-row">
        <a class="btn-secondary" target="_blank" rel="noopener"
           href="https://arxiv.org/abs/${encodeURIComponent(p.arxiv_id)}"
           style="text-decoration:none;display:inline-block;">Open on arXiv ↗</a>
      </div>
      <div class="paper-content" id="paper-content-${id}">
        <p style="color:var(--ink-muted);">Loading paper notes…</p>
      </div>
    `;
    openModal("paper-modal");

    try {
      const folder = p.date.replaceAll("-", "");
      const res = await fetch(`papers/${folder}/${p.arxiv_id}.md`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let md = await res.text();
      // strip YAML frontmatter
      md = md.replace(/^---[\s\S]*?---\s*/, "");
      const html = window.marked ? window.marked.parse(md) : escapeHTML(md);
      document.getElementById(`paper-content-${id}`).innerHTML = html;
    } catch (err) {
      document.getElementById(`paper-content-${id}`).innerHTML =
        `<p style="color:var(--danger);">Couldn't load notes (${escapeHTML(err.message)}).</p>`;
    }
  }

  async function loadPapers() {
    try {
      const res = await fetch(PAPER_MANIFEST_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      papers = (data.papers || []).sort((a, b) =>
        a.date < b.date ? 1 : a.date > b.date ? -1 : 0
      );
      renderFeed();
    } catch (err) {
      feedMasonry.innerHTML = `
        <div style="color:var(--danger);padding:20px;">
          Failed to load papers/manifest.json — ${escapeHTML(err.message)}
        </div>`;
      feedMeta.textContent = "";
    }
  }

  // ─────────────────────────────────────────────────────────
  //  TAB 2 — Dataset registry
  // ─────────────────────────────────────────────────────────
  const dsGrid = document.getElementById("ds-grid");
  const dsMeta = document.getElementById("ds-meta");
  const dsEmpty = document.getElementById("ds-empty");
  const filterType = document.getElementById("filter-type");
  const filterDomain = document.getElementById("filter-domain");
  const filterTag = document.getElementById("filter-tag");
  const filterSearch = document.getElementById("filter-search");

  let datasets = [];

  function loadLocalDatasets() {
    try {
      const raw = localStorage.getItem(DATASETS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  function saveLocalDatasets(list) {
    const userAdded = list.filter((d) => d._source === "user");
    localStorage.setItem(DATASETS_STORAGE_KEY, JSON.stringify(userAdded));
  }

  async function loadDatasets() {
    let seed = [];
    try {
      const res = await fetch(DATASETS_SEED_URL);
      if (res.ok) seed = (await res.json()).datasets || [];
      seed.forEach((d) => (d._source = "seed"));
    } catch {
      /* ok, seed missing */
    }
    const local = loadLocalDatasets();
    local.forEach((d) => (d._source = "user"));
    datasets = [...local, ...seed];
    refreshFilterOptions();
    renderDatasets();
  }

  function refreshFilterOptions() {
    const types = new Set();
    const domains = new Set();
    const tags = new Set();
    datasets.forEach((d) => {
      if (d.type) types.add(d.type);
      if (d.domain) domains.add(d.domain);
      (d.tags || []).forEach((t) => tags.add(t));
    });
    fillSelect(filterType, "All types", [...types].sort());
    fillSelect(filterDomain, "All domains", [...domains].sort());
    fillSelect(filterTag, "All tags", [...tags].sort());
  }
  function fillSelect(sel, placeholder, items) {
    const prev = sel.value;
    sel.innerHTML =
      `<option value="">${placeholder}</option>` +
      items.map((v) => `<option value="${escapeAttr(v)}">${escapeHTML(v)}</option>`).join("");
    if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
  }

  function datasetCardHTML(d, idx) {
    const tags = (d.tags || []).map((t) => `<span class="tag-pill">${escapeHTML(t)}</span>`).join("");
    const modalities = (d.modality || []).map(
      (m) => `<span class="tag-pill sky">${escapeHTML(m)}</span>`
    ).join("");
    const links = (d.dataLink || "")
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(
        (u) =>
          `<a href="${escapeAttr(u)}" target="_blank" rel="noopener">${escapeHTML(u)}</a>`
      )
      .join("<br/>");
    return `
      <div class="dataset-card">
        <div class="card-header">
          <h3 class="card-title">
            ${escapeHTML(d.task || "(unnamed)")}
            ${d.paperLink ? `<a href="${escapeAttr(d.paperLink)}" target="_blank" rel="noopener">Paper ↗</a>` : ""}
          </h3>
          <div class="card-actions">
            <button data-clone="${idx}">Clone</button>
            ${d._source === "user" ? `<button class="danger" data-delete="${idx}">Delete</button>` : ""}
          </div>
        </div>
        <div class="card-tags">
          <span class="tag-pill highlight">${escapeHTML(d.type || "—")}</span>
          ${d.domain ? `<span class="tag-pill">${escapeHTML(d.domain)}</span>` : ""}
          ${modalities}
          ${d.taskCategory ? `<span class="tag-pill">${escapeHTML(d.taskCategory)}</span>` : ""}
          ${d.dataPoints ? `<span class="tag-pill">${Number(d.dataPoints).toLocaleString()} samples</span>` : ""}
          ${d.dataSize ? `<span class="tag-pill">${escapeHTML(String(d.dataSize))} GB</span>` : ""}
          ${tags}
        </div>
        <div class="card-description">
          <p>${escapeHTML(d.description || "")}</p>
          ${d.specialty ? `<p><strong>Specialty:</strong> ${escapeHTML(d.specialty)}</p>` : ""}
        </div>
        ${
          d.dataLink || d.loadData
            ? `<div class="card-logistics">
                 ${d.dataLink ? `<div class="logistics-item"><span class="logistics-label">Data links</span>${links}</div>` : ""}
                 ${d.loadData ? `<div class="logistics-item"><span class="logistics-label">Load / logistics</span><code>${escapeHTML(d.loadData)}</code></div>` : ""}
               </div>`
            : ""
        }
      </div>
    `;
  }

  function renderDatasets() {
    const q = filterSearch.value.trim().toLowerCase();
    const fType = filterType.value;
    const fDomain = filterDomain.value;
    const fTag = filterTag.value;

    const matched = datasets.filter((d) => {
      if (fType && d.type !== fType) return false;
      if (fDomain && d.domain !== fDomain) return false;
      if (fTag && !(d.tags || []).includes(fTag)) return false;
      if (q) {
        const hay = [
          d.task, d.type, d.domain, d.description, d.specialty,
          d.taskCategory, d.dataLink, d.loadData,
          ...(d.tags || []), ...(d.modality || []),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    dsMeta.textContent =
      `${matched.length} of ${datasets.length} datasets` +
      (matched.length !== datasets.length ? " (filtered)" : "");

    if (matched.length === 0) {
      dsGrid.innerHTML = "";
      dsEmpty.hidden = false;
      return;
    }
    dsEmpty.hidden = true;
    dsGrid.innerHTML = matched.map((d, i) => datasetCardHTML(d, datasets.indexOf(d))).join("");
  }

  [filterType, filterDomain, filterTag].forEach((el) =>
    el.addEventListener("change", renderDatasets)
  );
  filterSearch.addEventListener("input", renderDatasets);

  dsGrid.addEventListener("click", (e) => {
    const del = e.target.closest("[data-delete]");
    const clone = e.target.closest("[data-clone]");
    if (del) {
      const idx = Number(del.dataset.delete);
      if (confirm(`Delete "${datasets[idx]?.task}"? This only affects your local browser.`)) {
        datasets.splice(idx, 1);
        saveLocalDatasets(datasets);
        refreshFilterOptions();
        renderDatasets();
      }
    } else if (clone) {
      const idx = Number(clone.dataset.clone);
      const src = datasets[idx];
      if (!src) return;
      const copy = JSON.parse(JSON.stringify(src));
      copy.task = (copy.task || "") + " (copy)";
      copy._source = "user";
      datasets.unshift(copy);
      saveLocalDatasets(datasets);
      refreshFilterOptions();
      renderDatasets();
    }
  });

  // Add form
  document.getElementById("btn-open-add-modal").addEventListener("click", () => {
    document.getElementById("add-dataset-form").reset();
    openModal("add-modal");
  });
  document.getElementById("add-dataset-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const modalities = [...form.querySelector("select[name='modality']").selectedOptions]
      .map((o) => o.value);
    const tags = (fd.get("tags") || "")
      .toString()
      .split(/[,\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const entry = {
      _source: "user",
      type: fd.get("type"),
      task: fd.get("task"),
      modality: modalities,
      domain: fd.get("domain"),
      dataPoints: fd.get("dataPoints") || null,
      taskCategory: fd.get("taskCategory"),
      tags,
      dataLink: fd.get("dataLink"),
      loadData: fd.get("loadData"),
      dataSize: fd.get("dataSize") || null,
      description: fd.get("description"),
      specialty: fd.get("specialty"),
      paperLink: fd.get("paperLink"),
      queryMod: fd.get("queryMod"),
      targetMod: fd.get("targetMod"),
      numQuery: fd.get("numQuery") || null,
      numCandidates: fd.get("numCandidates") || null,
      createdAt: new Date().toISOString(),
    };
    datasets.unshift(entry);
    saveLocalDatasets(datasets);
    refreshFilterOptions();
    renderDatasets();
    closeModal(document.getElementById("add-modal"));
  });

  // ───── utilities ─────
  function escapeHTML(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function escapeAttr(s) {
    return escapeHTML(s);
  }

  // ───── kick off ─────
  loadPapers();
  loadDatasets();
})();
