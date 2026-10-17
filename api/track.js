// Anonymous reading stats: views, unique readers, reading time, opened corners. No personal data.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ready = () => !!(URL_ && TOKEN);
async function redis(cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error("redis " + r.status);
  return (await r.json()).result;
}
async function pipeline(cmds) {
  if (!cmds.length) return [];
  const r = await fetch(URL_ + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error("redis " + r.status);
  return (await r.json()).map((x) => x.result);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST" || !ready()) return res.status(204).end();
    let b = req.body || {};
    if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
    const issue = String(b.issue || ""); if (!/^\d{3,5}$/.test(issue)) return res.status(204).end();
    const vid = String(b.vid || "").slice(0, 40).replace(/[^a-z0-9]/gi, "") || "anon";
    const day = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
    const cmds = [["SADD", "mz:issues", issue]];
    if (b.ev === "view") cmds.push(["INCR", "mz:v:" + issue], ["PFADD", "mz:u:" + issue, vid], ["INCR", "mz:vd:" + day], ["PFADD", "mz:ud:" + day, vid], ["SADD", "mz:days", day], ["PFADD", "mz:uall", vid]);
    else if (b.ev === "time") { const s = Math.max(0, Math.min(600, +b.sec || 0)); cmds.push(["INCRBY", "mz:t:" + issue, s], ["INCRBY", "mz:td:" + day, s]); }
    else if (b.ev === "open") { const it = String(b.item || "").slice(0, 40); if (it) cmds.push(["HINCRBY", "mz:o:" + issue, it, 1]); }
    await pipeline(cmds);
    return res.status(204).end();
  } catch (e) { return res.status(204).end(); }
}
