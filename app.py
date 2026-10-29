import json, os, time, uuid
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from pymongo import MongoClient
from scanner import scan
from ghost import haunt, report

load_dotenv()
VAULT = os.getenv("VAULT_PATH", "./demo_vault")
URI = os.getenv("MONGODB_URI")
db = MongoClient(URI, serverSelectionTimeoutMS=3000)["haunted_vault"] if URI else None

app = Flask(__name__, static_folder="static", static_url_path="")


def mongo(fn):
    """Run a Mongo action. If Atlas is missing or offline, skip it and keep going."""
    if db is None:
        return None
    try:
        return fn()
    except Exception as e:
        print("mongo skipped:", e)
        return None


if db is not None and mongo(lambda: db.command("ping")) is None:
    print("Atlas unreachable, tasks will be saved to tasks.json")
    db = None


class Store:
    """Tasks live in Atlas when connected, otherwise in tasks.json."""
    f = Path("tasks.json")

    def all(self):
        if db is not None:
            return list(db.tasks.find({}, {"_id": 0}))
        return json.loads(self.f.read_text(encoding="utf-8")) if self.f.exists() else []

    def _write(self, rows):
        self.f.write_text(json.dumps(rows), encoding="utf-8")

    def add(self, t):
        if db is not None:
            db.tasks.insert_one(dict(t))
        else:
            self._write(self.all() + [t])

    def update(self, tid, **fields):
        if db is not None:
            db.tasks.update_one({"id": tid}, {"$set": fields})
        else:
            self._write([{**r, **fields} if r["id"] == tid else r for r in self.all()])

    def remove(self, tid):
        if db is not None:
            db.tasks.delete_one({"id": tid})
        else:
            self._write([r for r in self.all() if r["id"] != tid])


store = Store()


def new_task(text, source=None, touched=None):
    t = touched or time.time()
    return {"id": uuid.uuid4().hex[:10], "text": text.strip()[:200], "source": source,
            "created": t, "touched": t, "done": False}


@app.get("/")
def index():
    return app.send_static_file("index.html")


@app.get("/api/graph")
def graph():
    data = scan(VAULT)
    nodes = data["nodes"]
    mongo(lambda: db.scans.insert_one({
        "ts": time.time(), "total": len(nodes),
        "haunted": sum(n["haunted"] for n in nodes),
        "notes": [{"id": n["id"], "days": n["days"]} for n in nodes],  # no note content
    }))
    return jsonify(data)


@app.post("/api/haunt")
def api_haunt():
    n = request.json
    key = {"note": n["id"], "bucket": n["days"] // 7}
    hit = mongo(lambda: db.epitaphs.find_one(key, {"_id": 0, "epitaph": 1, "cause": 1, "resurrect": 1}))
    if hit:
        return jsonify(hit)
    res = haunt(n)
    mongo(lambda: db.epitaphs.update_one(key, {"$set": {**res, "ts": time.time()}}, upsert=True))
    return jsonify(res)


@app.post("/api/report")
def api_report():
    return jsonify({"text": report(request.json)})


@app.get("/api/tasks")
def tasks_list():
    return jsonify(store.all())


@app.post("/api/tasks")
def tasks_add():
    text = (request.json.get("text") or "").strip()
    if not text:
        return jsonify({"error": "empty"}), 400
    t = new_task(text, request.json.get("source"))
    store.add(t)
    return jsonify(t)


@app.patch("/api/tasks/<tid>")
def tasks_update(tid):
    fields = {"touch": {"touched": time.time()}, "done": {"done": True},
              "undone": {"done": False}}.get(request.json.get("action"))
    if fields is None:
        return jsonify({"error": "bad action"}), 400
    store.update(tid, **fields)
    return jsonify({"ok": True})


@app.delete("/api/tasks/<tid>")
def tasks_delete(tid):
    store.remove(tid)
    return jsonify({"ok": True})


@app.post("/api/tasks/import")
def tasks_import():
    have = {(t["text"], t.get("source")) for t in store.all()}
    added = 0
    for note in scan(VAULT)["nodes"]:
        for todo in note["todos"]:
            if (todo.strip()[:200], note["id"]) in have:
                continue
            store.add(new_task(todo, note["id"], time.time() - note["days"] * 86400))
            added += 1
    return jsonify({"added": added})


if __name__ == "__main__":
    app.run(port=5000, debug=True)