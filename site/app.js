/* Repository-derived search. Real links and server-rendered records work without JS. */
const $ = (s) => document.querySelector(s);
const node = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const PAGE_SIZE = 12;
const state = {
  q: "",
  category: "",
  outcome: "",
  mechanism: "",
  sort: "title",
  page: 1,
};
const cache = new Map();
let manifest,
  request = 0,
  matches = [];
const urlFor = (i) =>
  `/ideas/${encodeURIComponent(i.category)}/${encodeURIComponent(i.id)}/`;
function readState() {
  const p = new URLSearchParams(location.search);
  for (const key of ["q", "category", "outcome", "mechanism"])
    state[key] = p.get(key) || "";
  state.sort = ["title", "lessons", "score"].includes(p.get("sort"))
    ? p.get("sort")
    : "title";
  const page = Number(p.get("page"));
  state.page = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
}
function writeState() {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state))
    if (v && !(k === "page" && v === 1) && !(k === "sort" && v === "title"))
      p.set(k, String(v));
  history.replaceState(
    null,
    "",
    `${location.pathname}${p.size ? "?" + p : ""}${location.hash}`,
  );
}
async function json(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error("Catalog request failed");
  return r.json();
}
async function getPage(p) {
  if (!cache.has(p.path))
    cache.set(
      p.path,
      json("/" + p.path).catch((e) => {
        cache.delete(p.path);
        throw e;
      }),
    );
  return cache.get(p.path);
}
function controls(syncInput = true) {
  if (syncInput) $("#q").value = state.q;
  $("#mechanism").value = state.mechanism;
  $("#sort").value = state.sort;
  document
    .querySelectorAll("[data-category]")
    .forEach((a) =>
      a.setAttribute(
        "aria-current",
        String(a.dataset.category === state.category),
      ),
    );
  document
    .querySelectorAll("[data-outcome]")
    .forEach((a) =>
      a.setAttribute(
        "aria-current",
        String(a.dataset.outcome === state.outcome),
      ),
    );
  $("#clear").hidden = !["q", "category", "outcome", "mechanism"].some(
    (k) => state[k],
  );
  $("#applied").replaceChildren();
  for (const k of ["q", "category", "outcome", "mechanism"])
    if (state[k]) {
      const text =
        k === "category"
          ? manifest?.categories[state[k]] || state[k]
          : state[k].replaceAll("-", " ");
      const b = node("button", "", `${text} ×`);
      b.setAttribute("aria-label", `Remove ${k} filter: ${text}`);
      b.onclick = () => change(k, "");
      $("#applied").append(b);
    }
}
function change(k, v) {
  state[k] = v;
  state.page = 1;
  writeState();
  controls();
  render();
}
function row(i, n) {
  const li = node("li", "experiment");
  li.append(node("span", "experiment-number", String(n + 1).padStart(2, "0")));
  const content = node("div");
  const meta = node("div", "record-meta");
  meta.append(
    node("span", "status " + i.outcome, i.outcome),
    node("span", "", manifest.categories[i.category] || i.category),
    node("span", "", i.confidence + " confidence"),
  );
  const h = node("h3");
  const a = node("a", "", i.title);
  a.href = urlFor(i);
  h.append(a);
  const tags = node("div", "record-tags");
  tags.append(
    node("span", "", i.lessons.length + " lessons"),
    node("span", "", i.effort + " of work"),
  );
  content.append(meta, h, node("p", "", i.verdict), tags);
  const arrow = node("span", "record-arrow", "↗");
  arrow.setAttribute("aria-hidden", "true");
  li.append(content, arrow);
  return li;
}
async function render() {
  const id = ++request;
  $("#results").setAttribute("aria-busy", "true");
  $("#load-error").hidden = true;
  $("#surprise").disabled = true;
  try {
    manifest ||= await json("/explore.json");
    if (id !== request) return;
    controls(false);
    const filtered = Boolean(
      state.q ||
      state.category ||
      state.outcome ||
      state.mechanism ||
      state.sort !== "title",
    );
    const needed = filtered
      ? manifest.pages
      : manifest.pages.slice(0, Math.ceil((state.page * PAGE_SIZE) / 100));
    const records = [];
    let next = 0,
      done = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, needed.length) }, async () => {
        while (next < needed.length) {
          const p = needed[next++];
          const rows = await getPage(p);
          records.push(...rows);
          done++;
          if (id === request && needed.length > 1)
            $("#result-count").textContent =
              `Reading catalog ${done} / ${needed.length}…`;
        }
      }),
    );
    if (id !== request) return;
    const terms = state.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    matches = records.filter(
      (i) =>
        (!state.category || i.category === state.category) &&
        (!state.outcome || i.outcome === state.outcome) &&
        (!state.mechanism || i.tags.includes(state.mechanism)) &&
        terms.every((t) =>
          [
            i.title,
            i.verdict,
            ...i.tags,
            ...i.lessons,
            ...(i.aliases || []),
            ...(i.projects || []),
          ]
            .join(" ")
            .toLowerCase()
            .includes(t),
        ),
    );
    matches.sort((a, b) =>
      state.sort === "lessons"
        ? b.lessons.length - a.lessons.length || a.title.localeCompare(b.title)
        : state.sort === "score"
          ? b.score - a.score || a.title.localeCompare(b.title)
          : a.title.localeCompare(b.title),
    );
    const total = filtered ? matches.length : manifest.count;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    writeState();
    const start = (state.page - 1) * PAGE_SIZE;
    const rows = matches.slice(start, start + PAGE_SIZE);
    $("#results").replaceChildren(...rows.map((i, n) => row(i, start + n)));
    if (!total) {
      const empty = node("li", "empty-results");
      empty.append(
        node(
          "h3",
          "",
          manifest.count
            ? "No matching experiments."
            : "The archive is waiting for its first experiment.",
        ),
        node(
          "p",
          "",
          manifest.count
            ? "Try fewer words or clear a filter. An unrecorded idea is an opportunity to contribute."
            : "Contribute an experiment to start the collection.",
        ),
      );
      $("#results").append(empty);
    }
    $("#result-count").textContent = total
      ? `${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total} experiments`
      : "0 experiments";
    const prev = node("button", "", "← Previous");
    prev.disabled = state.page === 1;
    prev.onclick = () => go(state.page - 1);
    const nextButton = node("button", "", "Next →");
    nextButton.disabled = state.page === pages;
    nextButton.onclick = () => go(state.page + 1);
    $("#pagination").replaceChildren(
      prev,
      node("span", "", `Page ${state.page} of ${pages}`),
      nextButton,
    );
    $("#surprise").hidden = false;
    $("#surprise").disabled = !total;
  } catch {
    if (id !== request) return;
    manifest = null;
    cache.clear();
    $("#load-error").hidden = false;
    $("#load-error").replaceChildren(
      node(
        "p",
        "",
        "Search could not load the catalog. The recorded experiments below are still readable.",
      ),
    );
    const a = node("a", "", "Browse the complete archive");
    a.href = "/browse/";
    const retry = node("button", "text-button", "Retry search");
    retry.onclick = () => render();
    $("#load-error").append(a, document.createTextNode(" · "), retry);
    $("#result-count").textContent =
      "Search unavailable · showing the last loaded records";
  } finally {
    if (id === request) $("#results").removeAttribute("aria-busy");
  }
}
function go(page) {
  state.page = page;
  writeState();
  render().then(() => {
    $("#catalog-title").tabIndex = -1;
    $("#catalog-title").focus({ preventScroll: true });
    $("#catalog").scrollIntoView();
  });
}
readState();
controls();
$("#search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  change("q", $("#q").value.trim());
});
let debounce;
$("#q").addEventListener("input", () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => change("q", $("#q").value.trim()), 180);
});
document.querySelectorAll("[data-category]").forEach((a) =>
  a.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    change("category", a.dataset.category);
  }),
);
document.querySelectorAll("[data-outcome]").forEach((a) =>
  a.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    change("outcome", a.dataset.outcome);
  }),
);
$("#mechanism").onchange = (e) => change("mechanism", e.target.value);
$("#sort").onchange = (e) => change("sort", e.target.value);
$("#clear").onclick = () => {
  Object.assign(state, {
    q: "",
    category: "",
    outcome: "",
    mechanism: "",
    page: 1,
  });
  writeState();
  controls();
  render();
};
$("#surprise").onclick = async () => {
  try {
    if (!manifest) return;
    $("#surprise").disabled = true;
    let candidates = matches;
    if (!state.q && !state.category && !state.outcome && !state.mechanism) {
      const index = Math.floor(Math.random() * manifest.count);
      const p = manifest.pages[Math.floor(index / 100)];
      candidates = [(await getPage(p))[index % 100]];
    }
    if (candidates.length)
      location.assign(
        urlFor(candidates[Math.floor(Math.random() * candidates.length)]),
      );
  } catch {
    $("#load-error").hidden = false;
    $("#load-error").textContent =
      "Could not open an experiment. Try again or browse the archive.";
  } finally {
    $("#surprise").disabled = false;
  }
};
addEventListener("popstate", () => {
  readState();
  controls();
  render();
});
render();

async function initFeatured() {
  try {
    const data = await json("/featured.json");
    let slides = data.library,
      mode = "Library score picks",
      index = 0;
    if (Date.now() <= Date.parse(data.valid_until) && data.community.length) {
      slides = data.community;
      mode = "Community picks";
    }
    if (!slides.length) return;
    const show = () => {
      if (
        mode === "Community picks" &&
        Date.now() > Date.parse(data.valid_until)
      ) {
        slides = data.library;
        mode = "Library score picks";
        index = 0;
      }
      if (!slides.length) return;
      const i = slides[index];
      $("#feature-mode").textContent = mode;
      const a = $("#featured-link");
      a.textContent = i.title + " ↗";
      a.href = urlFor(i);
      $("#feature-score").textContent =
        mode === "Community picks"
          ? `${i.count} reviewed votes · Tallied ${data.as_of.slice(0, 10)}`
          : `${i.score} calculated points · Community votes are separate.`;
      $("#feature-position").textContent = `${index + 1} / ${slides.length}`;
      $(".feature-controls").hidden = slides.length < 2;
    };
    $("#feature-prev").onclick = () => {
      index = (index + slides.length - 1) % slides.length;
      show();
    };
    $("#feature-next").onclick = () => {
      index = (index + 1) % slides.length;
      show();
    };
    $(".feature-controls").hidden = slides.length < 2;
    show();
    setInterval(() => {
      if (
        mode === "Community picks" &&
        Date.now() > Date.parse(data.valid_until)
      )
        show();
    }, 60000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) show();
    });
  } catch {
    /* The generated first pick remains a normal, readable link. */
  }
}
initFeatured();
