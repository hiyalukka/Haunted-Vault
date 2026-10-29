import os, re, ollama

MODEL = os.getenv("GHOST_MODEL", "gemma3:1b")

def _ask(prompt, temp=0.8):
    r = ollama.chat(model=MODEL, messages=[{"role": "user", "content": prompt}],
                    options={"temperature": temp})
    return r["message"]["content"].strip()

def haunt(note):
    out = _ask(f"""You are the gentle, witty ghost of an abandoned note.
Title: {note['id']}
Days untouched: {note['days']}
Open todos: {note['todos']}
Excerpt: {note['excerpt']}

Reply in EXACTLY this format, one line each:
EPITAPH: a spooky line starting with 'Here lies'
CAUSE: one sentence on why it was probably abandoned
RESURRECT: one concrete 15-minute step to revive it""")
    res = {}
    for k in ("EPITAPH", "CAUSE", "RESURRECT"):
        m = re.search(k + r":\s*(.+)", out)
        res[k.lower()] = m.group(1).strip() if m else "..."
    return res

def report(items):
    lines = "\n".join(f"- {i['id']} ({i['days']} days, {len(i['todos'])} open todos)" for i in items)
    t = _ask(f"""Write exactly 3 short sentences: a spooky but kind haunting report about these
abandoned notes, ending with one encouraging line. Start directly with the first sentence.
No intro, no quotation marks, no follow-up question.\n{lines}""")
    return t.split("---")[0].strip().strip('"\u201c\u201d')