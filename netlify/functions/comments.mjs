// Public comments per issue for מידעצמון. Stored in Netlify Blobs.
import { getStore } from "@netlify/blobs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const clean = (s, max) => String(s || "").replace(/[\u0000-\u0008\u000B-\u001F]/g, "").trim().slice(0, max);

export default async (req) => {
  const url = new URL(req.url);
  const store = getStore("comments");
  let body = {};
  if (req.method !== "GET") { try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); } }
  const issue = clean(url.searchParams.get("issue") || body.issue, 8);
  if (!/^\d{3,5}$/.test(issue)) return json({ error: "bad issue" }, 400);
  const key = "issue-" + issue;
  const list = (await store.get(key, { type: "json" })) || [];
  const isOwner = (c) => c && (c.token === body.token || (process.env.ADMIN_KEY && body.token === process.env.ADMIN_KEY));

  if (req.method === "GET") {
    return json(list.map(({ token, ...c }) => c));
  }
  if (req.method === "POST") {
    const name = clean(body.name, 40), text = clean(body.text, 600);
    if (!name || !text) return json({ error: "missing" }, 400);
    if (list.length >= 500) return json({ error: "full" }, 429);
    const c = { id: crypto.randomUUID(), token: crypto.randomUUID(), name, text, ts: Date.now() };
    list.push(c);
    await store.setJSON(key, list);
    return json(c, 201);
  }
  const i = list.findIndex((c) => c.id === body.id);
  if (i < 0) return json({ error: "not found" }, 404);
  if (!isOwner(list[i])) return json({ error: "forbidden" }, 403);
  if (req.method === "PUT") {
    const text = clean(body.text, 600);
    if (!text) return json({ error: "missing" }, 400);
    list[i].text = text; list[i].edited = Date.now();
  } else if (req.method === "DELETE") {
    list.splice(i, 1);
  } else {
    return json({ error: "method" }, 405);
  }
  await store.setJSON(key, list);
  return json({ ok: true });
};
