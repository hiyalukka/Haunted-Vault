import os, time
from pathlib import Path

notes = {
 "RAG project": (70, "Idea: build a RAG bot for adsc.py.\n- [ ] pick vector DB\n- [ ] chunking test\nSee [[LangChain notes]]"),
 "LangChain notes": (55, "Basics of chains and agents. [[RAG project]]"),
 "GSoC 2027 plan": (5, "Org research.\n- [ ] shortlist 3 orgs\n[[Open source log]]"),
 "Open source log": (2, "Merged first PR. [[GSoC 2027 plan]]"),
 "DSA revision": (30, "Trees and graphs.\n- [ ] redo BFS problems"),
 "Substack ideas": (21, "- [ ] draft post on build in public"),
 "Kathak routine": (1, "Practice schedule."),
 "Java exam prep": (45, "- [ ] deadlock programs\n[[DSA revision]]"),
}
root = Path("demo_vault")
root.mkdir(exist_ok=True)
for name, (days, body) in notes.items():
    p = root / f"{name}.md"
    p.write_text(body, encoding="utf-8")
    t = time.time() - days * 86400
    os.utime(p, (t, t))
print("demo_vault created")