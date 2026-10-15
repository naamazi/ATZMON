export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, storageKeys: Object.keys(process.env).filter(k => /KV|REDIS|UPSTASH/.test(k)) });
}
