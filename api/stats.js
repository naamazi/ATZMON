// Stats for the editors' page. Needs ?key= matching STATS_KEY (or the default below).
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

const KEY = process.env.STATS_KEY || "atzmon-stats-7q4k";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.query.key !== KEY) return res.status(200).json({ error: "key" });
  if (!ready()) return res.status(200).json({ error: "storage" });
  try {
    const issues = ((await redis(["SMEMBERS", "mz:issues"])) || []).sort();
    const days = ((await redis(["SMEMBERS", "mz:days"])) || []).sort().slice(-60);
    const per = await pipeline(issues.flatMap((n) => [["GET", "mz:v:" + n], ["PFCOUNT", "mz:u:" + n], ["GET", "mz:t:" + n], ["HGETALL", "mz:o:" + n], ["HGETALL", "mz:react:" + n]]));
    const dd = await pipeline(days.flatMap((d) => [["GET", "mz:vd:" + d], ["PFCOUNT", "mz:ud:" + d], ["GET", "mz:td:" + d]]));
    const total = await redis(["PFCOUNT", "mz:uall"]);
    const pairs = (a) => { const o = {}; for (let i = 0; i < (a || []).length; i += 2) o[a[i]] = +a[i + 1]; return o; };
    res.status(200).json({
      totalReaders: total || 0,
      issues: issues.map((n, i) => ({ issue: n, views: +per[i * 5] || 0, readers: +per[i * 5 + 1] || 0, seconds: +per[i * 5 + 2] || 0, opens: pairs(per[i * 5 + 3]), reactions: pairs(per[i * 5 + 4]) })),
      days: days.map((d, i) => ({ day: d, views: +dd[i * 3] || 0, readers: +dd[i * 3 + 1] || 0, seconds: +dd[i * 3 + 2] || 0 })),
    });
  } catch (e) { res.status(200).json({ error: String(e.message || e) }); }
}
