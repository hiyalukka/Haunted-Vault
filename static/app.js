const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const shade = t => d3.interpolateRgb("#f29a1f", "#d9b878")(t);
const GHOST = "M-1 .9V-.2C-1 -1.2 1 -1.2 1 -.2V.9L.66 .6 .33 .9 0 .6 -.33 .9 -.66 .6Z";
const DAY = 86400;

const LANES = [
  { key: "recent", hint: "Touched in the last 3 days.", empty: "Nothing new. Add one small thing." },
  { key: "old", hint: "Untouched for 3 to 13 days. Going cold.", empty: "Nothing is going cold." },
  { key: "abandoned", hint: "Untouched for 14+ days. These are ghosts now.", empty: "No ghosts here. Keep it that way." },
];
let TASKS = [], lane = 0, DATA, typer, CUR = null;

const api = async (url, method = "GET", body) => {
  if (window.DEMO) return window.DEMO(url, method, body);   // <- add this line
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(r.status);
  return r.json();
};

/* papel picado */
(function () {
  const b = $("#banner"), cols = ["#d6336c", "#f29a1f", "#efe4cf", "#2a9d8f"], n = Math.ceil(innerWidth / 46);
  b.setAttribute("viewBox", `0 0 ${n * 46} 56`); b.setAttribute("preserveAspectRatio", "xMinYMin slice");
  let h = `<path d="M0 5H${n * 46}" stroke="#f3ead755" stroke-width="1.5"/>`;
  for (let i = 0; i < n; i++)
    h += `<g transform="translate(${i * 46 + 3} 5)"><g class="flag" style="animation-delay:-${(i * .37 % 3).toFixed(2)}s">
      <path fill="${cols[i % 4]}" fill-rule="evenodd" opacity=".9" d="M0 0H40V42L30 33 20 42 10 33 0 42Z M20 9l6 6-6 6-6-6Z M7 8l3 3-3 3-3-3Z M33 8l3 3-3 3-3-3Z"/></g></g>`;
  b.innerHTML = h;
})();

/* marigold petals */
(function () {
  const c = $("#petals");
  if (reduced) return c.remove();
  const x = c.getContext("2d"); let w, h;
  const rs = () => { w = c.width = innerWidth; h = c.height = innerHeight; }; rs(); addEventListener("resize", rs);
  const P = Array.from({ length: 22 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 3 + Math.random() * 3.5, s: .3 + Math.random() * .6,
    a: Math.random() * 6, v: .01 + Math.random() * .025, c: Math.random() < .7 ? "#f29a1f" : "#d9480f" }));
  (function f() {
    x.clearRect(0, 0, w, h);
    for (const p of P) {
      p.y += p.s; p.a += p.v; p.x += Math.sin(p.a) * .6;
      if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
      x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.globalAlpha = .42;
      x.beginPath(); x.ellipse(0, 0, p.r * 1.6, p.r, 0, 0, 6.3); x.fill(); x.restore();
    }
    requestAnimationFrame(f);
  })();
})();

/* ---------- graph ---------- */
api("/api/graph").then(d => { DATA = d; stats(d); neglected(d); meter(d); draw(d); });

function meter(d) {
  const g = d.nodes.filter(n => n.haunted).length, t = d.nodes.reduce((s, n) => s + n.todos.length, 0);
  $("#meter").innerHTML = [[g, "ghosts"], [d.nodes.length - g, "still alive"], [t, "unfinished todos"]]
    .map(([v, l]) => `<div><strong>${v}</strong><span>${l}</span></div>`).join("");
}

function stats(d) {
  const n = d.nodes.length;
  $("#stats").textContent = n ? `${n} notes, ${d.nodes.filter(x => x.haunted).length} haunted, oldest ${Math.max(...d.nodes.map(x => x.days))} days` : "No notes found. Check VAULT_PATH.";
}

function neglected(d) {
  const top = d.nodes.filter(n => n.haunted).sort((a, b) => b.days - a.days).slice(0, 5);
  $("#negList").innerHTML = top.length ? top.map((n, i) => {
    const when = new Date(Date.now() - n.days * 864e5).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `<button class="stone" data-id="${esc(n.id)}" style="--i:${i};--age:${n.ghost}">
      <span class="candle" aria-hidden="true"></span><i class="ph ph-cross" aria-hidden="true"></i>
      <strong>${esc(n.id)}</strong><em>${n.days} days</em><small>last seen ${when}</small></button>`;
  }).join("") : `<p class="empty">Every note was touched in the last two weeks.</p>`;
}
$("#negList").addEventListener("click", e => {
  const b = e.target.closest(".stone"); if (b) openTomb(DATA.nodes.find(n => n.id === b.dataset.id));
});

function draw({ nodes, edges }) {
  const svg = d3.select("#graph"), W = 900, H = 560;
    nodes.forEach(d => d.r = 20 + Math.min(18, Math.sqrt(d.words) / 2.2));
    svg.append("defs").html('<filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><radialGradient id="haloG"><stop offset="0" stop-color="#efe4cf" stop-opacity=".38"/><stop offset="1" stop-color="#efe4cf" stop-opacity="0"/></radialGradient><radialGradient id="haloF"><stop offset="0" stop-color="#f29a1f" stop-opacity=".4"/><stop offset="1" stop-color="#f29a1f" stop-opacity="0"/></radialGradient>');
  const link = svg.append("g").selectAll("line").data(edges).join("line").attr("class", "link");
  const node = svg.append("g").selectAll("g").data(nodes).join("g").attr("class", "node").attr("tabindex", 0)
    .attr("role", "button").attr("aria-label", d => `${d.id}, ${d.days} days untouched`)
    .on("click", (_, d) => openTomb(d))
    .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTomb(d); } })
    .call(d3.drag()
      .on("start", (e, d) => { if (!e.active) sim.alphaTarget(.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = d.fy = null; }));

  node.each(function (d) {
    const g = d3.select(this), r = d.r;
    g.append("circle").attr("r", r * 2.3).attr("fill", d.haunted ? "url(#haloG)" : "url(#haloF)");
    if (d.haunted) g.append("circle").attr("class", "ring").attr("r", r * 1.1);
    const body = g.append("g").attr("class", d.haunted ? "bob" : "ember").style("animation-delay", `${-Math.random() * 5}s`).attr("filter", "url(#glow)");
    const mark = body.append("g").attr("class", "mark");
    if (d.haunted) {
      body.attr("opacity", 1 - d.ghost * .2);
      mark.append("path").attr("d", GHOST).attr("transform", `scale(${r})`).attr("fill", d3.interpolateRgb("#efe4cf", "#9c8f7a")(d.ghost));
      [-1, 1].forEach(s => mark.append("circle").attr("cx", s * .38 * r).attr("cy", -.25 * r).attr("r", .16 * r).attr("fill", "#0d0907"));
      mark.append("ellipse").attr("cy", .12 * r).attr("rx", .14 * r).attr("ry", .2 * r).attr("fill", "#0d0907");
    } else {
      mark.append("circle").attr("r", r * .7).attr("fill", shade(d.ghost));
      mark.append("circle").attr("r", r * .3).attr("cy", r * .1).attr("fill", "#fff3d6");
    }
    g.append("text").attr("class", "lbl").attr("dy", -r - 10).text(d.id.length > 24 ? d.id.slice(0, 23) + "…" : d.id);
  });

  const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(edges).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(W / 2, H / 2))
    .force("collide", d3.forceCollide(d => d.r + 14))
    .on("tick", () => {
      nodes.forEach(d => { d.x = Math.max(50, Math.min(W - 50, d.x)); d.y = Math.max(60, Math.min(H - 50, d.y)); });
      link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });
}

/* ---------- typing ---------- */
function typeInto(el, text, speed = 24) {
  clearInterval(typer); el.textContent = "";
  if (reduced) return void (el.textContent = text);
  el.classList.add("typing"); let i = 0;
  typer = setInterval(() => {
    el.textContent += text[i++] ?? "";
    if (i >= text.length) { clearInterval(typer); el.classList.remove("typing"); }
  }, speed);
}

/* ---------- tombstone ---------- */
function closeTomb() { $("#tomb").classList.add("hidden"); d3.selectAll(".node").classed("sel", false); }
addEventListener("keydown", e => { if (e.key === "Escape") closeTomb(); });

async function openTomb(d) {
  d3.selectAll(".node").classed("sel", n => n === d);
  CUR = null; $("#tAdd").disabled = true; $("#tAdd").textContent = "Add ritual as a task";
  $("#tName").textContent = d.id;
  $("#tMeta").textContent = `${d.days} days untouched, ${d.words} words`;
  $("#tTodos").innerHTML = d.todos.length ? d.todos.map(t => `<li>${esc(t)}</li>`).join("") : "<li>Nothing open.</li>";
  $("#tEpitaph").textContent = ""; $("#tCause").textContent = $("#tRes").textContent = "Waiting for the model...";
  $("#tomb").classList.remove("hidden");
  try {
    const r = await api("/api/haunt", "POST", { id: d.id, days: d.days, todos: d.todos, excerpt: d.excerpt });
    typeInto($("#tEpitaph"), r.epitaph);
    $("#tCause").textContent = r.cause; $("#tRes").textContent = r.resurrect;
    CUR = { note: d.id, ritual: r.resurrect }; $("#tAdd").disabled = false;
  } catch {
    $("#tEpitaph").textContent = "No answer. Is Ollama running?";
    $("#tCause").textContent = $("#tRes").textContent = "Start it with: ollama serve";
  }
}

$("#tAdd").onclick = async () => {
  if (!CUR) return;
  try {
    TASKS.push(await api("/api/tasks", "POST", { text: CUR.ritual, source: CUR.note }));
    lane = 0; renderTasks();
    $("#tAdd").disabled = true; $("#tAdd").textContent = "Added to Recent";
  } catch { $("#tAdd").textContent = "Could not save. Try again."; }
};

/* ---------- report ---------- */
$("#reportBtn").onclick = async () => {
  const top = DATA.nodes.filter(n => n.haunted).sort((a, b) => (b.days + b.todos.length * 10) - (a.days + a.todos.length * 10))
    .slice(0, 5).map(n => ({ id: n.id, days: n.days, todos: n.todos }));
  if (!top.length) return typeInto($("#rText"), "Every note was touched in the last two weeks. Nothing is haunted.");
  $("#rText").textContent = "Gathering the spirits...";
  try { typeInto($("#rText"), (await api("/api/report", "POST", top)).text, 16); }
  catch { $("#rText").textContent = "No answer. Is Ollama running?"; }
};

/* ---------- tasks ---------- */
const ageDays = t => Math.floor((Date.now() / 1000 - t.touched) / DAY);
const laneOf = t => { const d = ageDays(t); return d < 3 ? 0 : d < 14 ? 1 : 2; };

const taskRow = (t, n) => `<li class="task ${lane === 2 ? "ghosty" : ""}" data-id="${t.id}" style="--n:${Math.min(n, 8)}">
  <button class="check" data-act="done" aria-label="Mark done: ${esc(t.text)}"><i class="ph ph-check" aria-hidden="true"></i></button>
  <div class="body"><span class="txt">${esc(t.text)}</span>${t.source ? `<span class="src">from ${esc(t.source)}</span>` : ""}</div>
  <span class="age">${ageDays(t)}d</span>
  ${lane > 0 ? `<button class="icon" data-act="touch" aria-label="Revive task"><i class="ph ph-arrow-counter-clockwise" aria-hidden="true"></i></button>` : ""}
  <button class="icon" data-act="del" aria-label="Delete task"><i class="ph ph-x" aria-hidden="true"></i></button></li>`;

function renderTasks() {
  const open = TASKS.filter(t => !t.done), by = [[], [], []];
  open.forEach(t => by[laneOf(t)].push(t));
  by[0].sort((a, b) => b.touched - a.touched); by[1].sort((a, b) => a.touched - b.touched); by[2].sort((a, b) => a.touched - b.touched);
  $(".tabs").style.setProperty("--i", lane);
  $(".tasks").classList.toggle("haunted", lane === 2);
  $$(".tab").forEach((b, k) => { b.setAttribute("aria-selected", k === lane); b.querySelector("b").textContent = by[k].length; });
  $("#laneHint").textContent = LANES[lane].hint;
  $("#taskCount").textContent = `${open.length} open, ${TASKS.length - open.length} done`;
  $("#taskList").innerHTML = by[lane].length ? by[lane].map(taskRow).join("") : `<li class="empty">${LANES[lane].empty}</li>`;
}

$$(".tab").forEach(b => b.onclick = () => { lane = +b.dataset.k; renderTasks(); });

$("#addForm").addEventListener("submit", async e => {
  e.preventDefault();
  const i = $("#newTask"), text = i.value.trim(); if (!text) return;
  try { TASKS.push(await api("/api/tasks", "POST", { text })); i.value = ""; lane = 0; renderTasks(); i.focus(); }
  catch { $("#laneHint").textContent = "Could not save the task. Is the server running?"; }
});

$("#taskList").addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const li = b.closest(".task"), id = li.dataset.id, act = b.dataset.act, t = TASKS.find(x => x.id === id);
  try {
    if (act === "del") { li.classList.add("leaving"); await wait(200); await api(`/api/tasks/${id}`, "DELETE"); TASKS = TASKS.filter(x => x.id !== id); }
    if (act === "done") { li.classList.add("done"); await wait(260); li.classList.add("leaving"); await wait(200); await api(`/api/tasks/${id}`, "PATCH", { action: "done" }); t.done = true; }
    if (act === "touch") { li.classList.add("leaving"); await wait(200); await api(`/api/tasks/${id}`, "PATCH", { action: "touch" }); t.touched = Date.now() / 1000; }
    renderTasks();
  } catch { li.classList.remove("leaving", "done"); $("#laneHint").textContent = "That did not save. Try again."; }
});

$("#importBtn").onclick = async () => {
  const s = $("#importBtn span");
  try {
    const { added } = await api("/api/tasks/import", "POST", {});
    TASKS = await api("/api/tasks"); renderTasks();
    s.textContent = added ? `Added ${added} from notes` : "Nothing new in your notes";
  } catch { s.textContent = "Import failed"; }
  setTimeout(() => s.textContent = "Pull todos from notes", 2400);
};

api("/api/tasks").then(t => { TASKS = t; renderTasks(); }).catch(() => { $("#laneHint").textContent = "Tasks could not load."; });
/* drifting ghosts + fireflies */
$(".sky").insertAdjacentHTML("beforeend",
  [0, 1, 2].map(i => `<i class="ph ph-ghost drift" style="--i:${i}"></i>`).join("") +
  Array.from({ length: 14 }, () => `<b class="fly" style="left:${Math.random() * 100}%;top:${20 + Math.random() * 70}%;--d:${6 + Math.random() * 8}s;--s:${-Math.random() * 10}s"></b>`).join(""));
/* halloween scene: dead tree, pumpkins, bats, fog */
const PK = (x, s) => `<use href="#pk" transform="translate(${x} 282) scale(${s})"/>`;
$(".sky").insertAdjacentHTML("beforeend",
  `<svg class="scene" viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice"><defs><g id="pk"><ellipse rx="34" ry="28" fill="#c2410c"/><ellipse rx="17" ry="28" fill="#e8620f"/><ellipse cx="-17" rx="14" ry="26" fill="#d9480f"/><ellipse cx="17" rx="14" ry="26" fill="#d9480f"/><path d="M-2-27q2-13 10-13" stroke="#3b4a1f" stroke-width="5" fill="none"/><path class="fc" d="M-21-7l8-11 7 11zM7-7l7-11 8 11zM-18 8l6 6 6-5 6 5 6-5 6 6-6 7h-24z"/></g></defs>
  <g stroke="#050302" stroke-width="9" fill="none" stroke-linecap="round"><path d="M110 300C118 230 100 180 124 100M120 150L64 104M124 118L176 62M114 196L58 176M64 104l-14-22M176 62l22-6M176 62l-6-26"/></g>
  ${PK(330, 1)}${PK(392, .6)}${PK(1090, 1.15)}${PK(1168, .7)}${PK(1250, .85)}</svg>
  <div class="fog"></div><div class="fog f2"></div>` +
  [0, 1, 2, 3].map(i => `<svg class="bat" viewBox="0 0 24 12" style="--t:${8 + i * 17}%;--d:${16 + i * 5}s;--s:${-i * 6}s"><path d="M12 12L9 8 6 9 4 5 0 2c4-1 8 0 10 3l2-2 2 2c4-3 8-4 12-3l-4 3-2 4-3-1z" fill="#050302"/></svg>`).join(""));