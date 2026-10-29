/* Static demo mode: used on github.io or with ?demo. Replaces the Flask API. */
if (/github\.io$/.test(location.hostname) || /[?&]demo/.test(location.search)) {
  const N = [["RAG project", 70, "Idea: build a RAG bot for adsc.py.", ["pick vector DB", "chunking test"], ["LangChain notes"]],
    ["LangChain notes", 55, "Basics of chains and agents.", [], ["RAG project"]],
    ["GSoC 2027 plan", 5, "Org research.", ["shortlist 3 orgs"], ["Open source log"]],
    ["Open source log", 2, "Merged first PR.", [], ["GSoC 2027 plan"]],
    ["DSA revision", 30, "Trees and graphs.", ["redo BFS problems"], []],
    ["Substack ideas", 21, "Post ideas.", ["draft post on build in public"], []],
    ["Kathak routine", 1, "Practice schedule.", [], []],
    ["Java exam prep", 45, "Deadlock programs.", ["deadlock programs"], ["DSA revision"]]];
  const nodes = N.map(([id, days, ex, todos, links]) => ({ id, path: id + ".md", days, words: 12 + days, todos, links, excerpt: ex,
    ghost: Math.min(1, +(days / 60).toFixed(2)), haunted: days >= 14 }));
  const ids = new Set(nodes.map(n => n.id));
  const edges = nodes.flatMap(n => n.links.filter(l => ids.has(l)).map(l => ({ source: n.id, target: l })));
  const E = {
    "RAG project": ["Here lies the RAG project, buried under an unchosen vector database.", "It asked a hard question on day one and never got an answer.", "Compare two vector DBs for 15 minutes and pick one."],
    "LangChain notes": ["Here lies LangChain notes, chained to nothing.", "The basics were learned, then the project that needed them stalled.", "Write a 3-line chain example from memory."],
    "DSA revision": ["Here lies DSA revision, lost somewhere between BFS and DFS.", "Graphs got scary and other deadlines got louder.", "Redo one BFS problem and write down the queue steps."],
    "Substack ideas": ["Here lies a post that was never published.", "The idea was good, but a blank page felt bigger than it was.", "Write only the headline and three bullet points."],
    "Java exam prep": ["Here lies Java exam prep, deadlocked with itself.", "Two threads waited on each other and so did the student.", "Trace one deadlock program and name the locks."]
  };
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const now = () => Date.now() / 1000;
  const save = t => localStorage.setItem("hv_tasks", JSON.stringify(t));
  const seed = () => [{ id: "demo1", text: "Try clicking a ghost", source: null, created: now(), touched: now(), done: false }];
  window.DEMO = async (url, method, body) => {
    await new Promise(r => setTimeout(r, 500));
    let T = get("hv_tasks", null) || seed();
    if (url === "/api/graph") return { nodes, edges };
    if (url === "/api/haunt") { const e = E[body.id] || ["Here lies " + body.id + ", quietly forgotten.", "Life got busy.", "Open it and write one line."]; return { epitaph: e[0], cause: e[1], resurrect: e[2] }; }
    if (url === "/api/report") return { text: "Five notes haunt this vault, and they are mostly small ideas that lost a fight with a busy week. The RAG project has been silent the longest, and its two todos are still waiting patiently. One kind step today would wake any of them." };
    if (url === "/api/tasks/import") {
      let added = 0;
      nodes.forEach(n => n.todos.forEach(t => { if (!T.some(x => x.text === t && x.source === n.id)) { const c = now() - n.days * 86400; T.push({ id: Math.random().toString(36).slice(2, 12), text: t, source: n.id, created: c, touched: c, done: false }); added++; } }));
      save(T); return { added };
    }
    if (url === "/api/tasks" && method === "POST") { const t = { id: Math.random().toString(36).slice(2, 12), text: body.text, source: body.source || null, created: now(), touched: now(), done: false }; T.push(t); save(T); return t; }
    if (url === "/api/tasks") return T;
    const id = url.split("/").pop();
    if (method === "DELETE") T = T.filter(t => t.id !== id);
    else T = T.map(t => t.id !== id ? t : body.action === "touch" ? { ...t, touched: now() } : { ...t, done: body.action === "done" });
    save(T); return { ok: true };
  };
}