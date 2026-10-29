import re, time
from pathlib import Path

LINK = re.compile(r"\[\[([^\]|#]+)")
TODO = re.compile(r"^\s*[-*] \[ \] (.+)$", re.M)

def scan(vault):
    root, now, notes = Path(vault).expanduser(), time.time(), {}
    for p in root.rglob("*.md"):
        rel = p.relative_to(root)
        if any(part.startswith(".") for part in rel.parts):
            continue
        text = p.read_text(encoding="utf-8", errors="ignore")
        days = int((now - p.stat().st_mtime) / 86400)
        notes[p.stem] = {
            "id": p.stem, "path": str(rel), "days": days,
            "words": len(text.split()),
            "todos": TODO.findall(text)[:5],
            "links": sorted({l.strip() for l in LINK.findall(text)}),
            "excerpt": text[:600],
            "ghost": round(min(1, days / 60), 2),
            "haunted": days >= 14,
        }
    nodes = list(notes.values())
    edges = [{"source": n["id"], "target": l}
             for n in nodes for l in n["links"] if l in notes]
    return {"nodes": nodes, "edges": edges}