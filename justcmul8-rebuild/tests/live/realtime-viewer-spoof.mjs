// Live check against the real Supabase project (needs .env.local + .env.test.local):
// a VIEWER must not be able to broadcast graph edits that editors will apply.
// Run: node tests/live/realtime-viewer-spoof.mjs   -> exits 1 if the viewer's op is delivered.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const read = (f) => Object.fromEntries(fs.readFileSync(f, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_0-9]+=/.test(l))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const env = { ...read(".env.local"), ...read(".env.test.local") };
const opts = { auth: { persistSession: false } };
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, opts);

async function login(email, password) {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await c.realtime.setAuth(data.session.access_token);
  return { c, user: data.user };
}
const join = (c, topic) => new Promise((resolve) => {
  const ch = c.channel(topic, { config: { private: true } });
  ch.subscribe((status, err) => { if (status !== "CLOSED") resolve({ ch, status, err: err?.message }); });
});

const A = await login(env.E2E_EMAIL, env.E2E_PASSWORD);
const B = await login(env.E2E_EMAIL_2, env.E2E_PASSWORD_2);
const { data: proj, error: pe } = await admin.from("projects")
  .insert({ user_id: A.user.id, name: `e2e-rt-${Date.now()}`, sim_type: "human_queue", graph_json: { nodes: [], edges: [] } })
  .select("id").single();
if (pe) throw pe;
let failed = false;
try {
  await admin.from("project_members").insert({ project_id: proj.id, email: env.E2E_EMAIL_2.toLowerCase(), role: "viewer", source: "invite", invited_by: A.user.id });
  const topic = `project:${proj.id}`;
  const a = await join(A.c, topic);
  const got = [];
  a.ch.on("broadcast", { event: "graph-op" }, ({ payload }) => got.push(payload));
  const b = await join(B.c, topic);
  console.log("owner join:", a.status, "| viewer join:", b.status, b.err ?? "");
  const sent = await b.ch.send({ type: "broadcast", event: "graph-op",
    payload: { kind: "snapshot", changes: [{ nodes: [{ id: "evil" }], edges: [] }], fromUserId: A.user.id, fromClientId: "spoof" } });
  await new Promise((r) => setTimeout(r, 3000));
  console.log("viewer send result:", sent, "| owner received:", got.length);
  failed = got.length > 0;

  // Sanity: the owner can still broadcast graph ops to the viewer.
  const seen = [];
  b.ch.on("broadcast", { event: "graph-op" }, ({ payload }) => seen.push(payload));
  await a.ch.send({ type: "broadcast", event: "graph-op", payload: { kind: "nodes", changes: [], fromUserId: A.user.id, fromClientId: "owner" } });
  await new Promise((r) => setTimeout(r, 3000));
  console.log("owner -> viewer delivered:", seen.length > 0);
  if (!seen.length) failed = true;

  // Viewers keep presence: they can still send cursors on the presence channel.
  const pTopic = `project-presence:${proj.id}`;
  const ap = await join(A.c, pTopic);
  const cursors = [];
  ap.ch.on("broadcast", { event: "graph-op" }, ({ payload }) => cursors.push(payload));
  const bp = await join(B.c, pTopic);
  await bp.ch.send({ type: "broadcast", event: "graph-op", payload: { kind: "cursor", changes: [{ x: 1, y: 2 }], fromUserId: B.user.id, fromClientId: "viewer" } });
  await new Promise((r) => setTimeout(r, 3000));
  console.log("viewer cursor on presence channel delivered:", cursors.length > 0);
  if (!cursors.length) failed = true;
} finally {
  await admin.from("projects").delete().eq("id", proj.id);
  await A.c.removeAllChannels(); await B.c.removeAllChannels();
}
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
