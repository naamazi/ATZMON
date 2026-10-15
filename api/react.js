// Emoji reactions per issue for מידעצמון. Counts kept in a Redis hash per issue.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const EMOJI = new Set(["heart", "laugh", "wow", "clap"]);

async function redis(cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error("redis " + r.status);
  return (await r.json()).result;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (!URL_ || !TOKEN) return res.status(503).json({ error: "storage not connected" });
    let body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const issue = String(req.query.issue || body.issue || "").slice(0, 8);
    if (!/^\d{3,5}$/.test(issue)) return res.status(400).json({ error: "bad issue" });
    const hkey = "mz:react:" + issue;
    if (req.method === "GET") {
      const flat = (await redis(["HGETALL", hkey])) || [];
      const out = {};
      for (let i = 0; i < flat.length; i += 2) out[flat[i]] = Math.max(0, +flat[i + 1] || 0);
      return res.status(200).json(out);
    }
    if (req.method === "POST") {
      const key = String(body.key || "");
      const [item, emo] = key.split("|");
      if (!/^[a-z0-9]{1,12}$/.test(item || "") || !EMOJI.has(emo)) return res.status(400).json({ error: "bad key" });
      const delta = body.delta === -1 ? -1 : 1;
      let v = await redis(["HINCRBY", hkey, key, delta]);
      if (v < 0) { await redis(["HSET", hkey, key, 0]); v = 0; }
      return res.status(200).json({ key, count: v });
    }
    return res.status(405).json({ error: "method" });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
