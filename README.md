# 👻 Haunted Vault

> Notes you stop touching turn into ghosts. A local AI writes their epitaphs and tells you how to bring them back.
>
> Live demo: https://hiyalukka.github.io/Haunted-Vault/

Built for the **DEV x Hacktoberfest Open-Source AI Challenge, Week 4: Ghost in the Machine**.


## What it does

Point it at a folder of Markdown notes (an Obsidian vault works). It scans them and draws a graveyard map:

- **Graveyard map**: a D3 graph of your notes and their `[[wiki links]]`. Notes untouched for 14+ days become ghosts.
- **Tombstones**: click a ghost and a local model writes an **epitaph**, a **cause of death**, and a **15-minute resurrection ritual**.
- **Haunting report**: a short, spooky-but-kind summary of your most neglected notes.
- **Tasks**: pull open `- [ ]` todos from your notes. Tasks also age from Recent to Old to Abandoned, so forgotten ones turn into ghosts too.

## Why open-source AI

- **Private by design.** Note contents go only to a model running on your own machine through [Ollama](https://ollama.com). The default model is `gemma3:1b`, an open-weight model.
- **Works offline.** No API key and no internet needed for the AI part.
- **Swappable.** Set `GHOST_MODEL` to any model Ollama can run.
- **No lock-in.** MongoDB Atlas is optional. Without it, tasks fall back to a local `tasks.json`. Atlas never stores note text, only note names and ages.

## Stack

Flask · Ollama (`gemma3:1b`) · MongoDB Atlas (optional) · D3.js · vanilla JS/CSS

## Run it

```bash
git clone https://github.com/YOUR_USERNAME/haunted-vault.git
cd haunted-vault
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

ollama pull gemma3:1b
ollama serve                    # skip if Ollama is already running

python make_demo.py             # creates a demo vault with old and new notes
python app.py
```

Open <http://localhost:5000>.

## Configuration

Copy `.env.example` to `.env`:

| Variable | Purpose | Default |
|---|---|---|
| `VAULT_PATH` | Folder of `.md` notes to scan | `./demo_vault` |
| `GHOST_MODEL` | Ollama model name | `gemma3:1b` |
| `MONGODB_URI` | Atlas connection string (optional) | empty, uses `tasks.json` |

## How it works

1. `scanner.py` walks the vault, reads each note's modified time, extracts `[[links]]` and `- [ ]` todos, and marks a note as haunted after 14 days.
2. `ghost.py` prompts the local model for the epitaph, cause and ritual, and parses the reply.
3. `app.py` serves the API. Generated epitaphs are cached in Atlas per note and per week, so each ghost is only asked about once a week.
4. `static/` holds the frontend: D3 force graph, task lanes and tombstone panel.

## Project structure

```
app.py          Flask API + storage (Atlas or JSON fallback)
scanner.py      Vault scanner
ghost.py        Ollama prompts
make_demo.py    Demo vault generator
static/         index.html, app.js, style.css
```

## License

MIT
