// Public comments per issue for מידעצמון (Vercel function). Stored in Redis (Upstash, added from Vercel Storage).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error("redis " + r.status);
  return (await r.json()).result;
}
const clean = (s, max) => String(s || "").replace(/[\u0000-\u0008\u000B-\u001F]/g, "").trim().slice(0, max);
const uid = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) return res.status(500).json({ error: "storage not connected" });
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const issue = clean(req.query.issue || body.issue, 8);
  if (!/^\d{3,5}$/.test(issue)) return res.status(400).json({ error: "bad issue" });
  const key = "mz:comments:" + issue;
  const raw = await redis(["GET", key]);
  const list = raw ? JSON.parse(raw) : [];
  const save = () => redis(["SET", key, JSON.stringify(list)]);
  const isOwner = (c) => c && (c.token === body.token || (process.env.ADMIN_KEY && body.token === process.env.ADMIN_KEY));

  if (req.method === "GET") return res.status(200).json(list.map(({ token, ...c }) => c));
  if (req.method === "POST") {
    const name = clean(body.name, 40), text = clean(body.text, 600);
    if (!name || !text) return res.status(400).json({ error: "missing" });
    if (list.length >= 500) return res.status(429).json({ error: "full" });
    const c = { id: uid(), token: uid(), name, text, ts: Date.now() };
    list.push(c); await save();
    return res.status(201).json(c);
  }
  const i = list.findIndex((c) => c.id === body.id);
  if (i < 0) return res.status(404).json({ error: "not found" });
  if (!isOwner(list[i])) return res.status(403).json({ error: "forbidden" });
  if (req.method === "PUT") {
    const text = clean(body.text, 600);
    if (!text) return res.status(400).json({ error: "missing" });
    list[i].text = text; list[i].edited = Date.now();
  } else if (req.method === "DELETE") {
    list.splice(i, 1);
  } else return res.status(405).json({ error: "method" });
  await save();
  return res.status(200).json({ ok: true });
}
