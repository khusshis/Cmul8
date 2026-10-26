import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePaid } from "@/lib/billing/server";
import { rateLimit } from "@/lib/supabase/rateLimit";
import { audit } from "@/lib/audit";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => NextResponse.json({ error: "Project not found" }, { status: 404 });
// Link lifetimes the owner can pick; null = never expires. Expiry is enforced in the database (security.sql §2).
const EXPIRY_DAYS = [1, 7, 30];
type LinkRow = { share_token: string; link_access: string; link_role: string; expires_at: string | null };
const LINK_COLS = "share_token, link_access, link_role, expires_at";

async function getRole(supabase: Supabase, id: string) {
  const { data } = await supabase.rpc("project_role", { pid: id });
  return (data as "owner" | "editor" | "viewer" | null) ?? null;
}

async function activeLink(supabase: Supabase, id: string) {
  const { data } = await supabase
    .from("project_shares")
    .select(LINK_COLS)
    .eq("project_id", id)
    .is("revoked_at", null)
    .maybeSingle();
  return data as LinkRow | null;
}

function linkJson(row: LinkRow | null) {
  return row ? { url: `/share/${row.share_token}`, access: row.link_access, role: row.link_role, expiresAt: row.expires_at } : null;
}

// Role, people with access, and (owner only) the share link. The owner's link is created
// lazily as "Restricted", like Google Drive: the URL exists but only invited people get in.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await rateLimit(`share:${user.id}`, 60, 60);
  if (limited) return limited;

  const role = await getRole(supabase, id);
  if (!role) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: people } = await supabase.rpc("project_collaborators", { pid: id });

  let link = null;
  if (role === "owner") {
    let row = await activeLink(supabase, id);
    if (!row) {
      const { data } = await supabase
        .from("project_shares")
        .insert({ project_id: id, created_by: user.id, link_access: "restricted", link_role: "viewer" })
        .select(LINK_COLS)
        .single();
      row = data as LinkRow | null;
    }
    link = linkJson(row);
  }

  return NextResponse.json({ role, people: people || [], link });
}

// Owner changes "General access": { access: 'restricted'|'anyone', role: 'viewer'|'editor',
// expiresInDays?: 1|7|30|null }. Omitting expiresInDays keeps the current expiry.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await rateLimit(`share:${user.id}`, 60, 60);
  if (limited) return limited;
  if ((await getRole(supabase, id)) !== "owner") return NextResponse.json({ error: "Only the owner can change sharing" }, { status: 403 });

  const body = (await req.json().catch(() => null)) ?? {};
  const access = body.access;
  const linkRole = body.role;
  if (!["restricted", "anyone"].includes(access) || !["viewer", "editor"].includes(linkRole)) {
    return NextResponse.json({ error: "Invalid access settings" }, { status: 400 });
  }
  const expiry = body.expiresInDays;
  if (expiry !== undefined && expiry !== null && !EXPIRY_DAYS.includes(expiry)) {
    return NextResponse.json({ error: "Invalid link expiry" }, { status: 400 });
  }
  // Turning the link off stays allowed, so a downgraded owner can still lock things down.
  if (access === "anyone") {
    const locked = await requirePaid(supabase, "Link sharing");
    if (locked) return locked;
  }

  const { data: row, error } = await supabase
    .from("project_shares")
    .update({
      link_access: access,
      link_role: linkRole,
      ...(expiry === undefined ? {} : { expires_at: expiry === null ? null : new Date(Date.now() + expiry * 86_400_000).toISOString() }),
    })
    .eq("project_id", id)
    .is("revoked_at", null)
    .select(LINK_COLS)
    .single();
  if (error || !row) return NextResponse.json({ error: "Failed to update link" }, { status: 500 });

  // People who got in through the link follow the link's settings.
  const members = supabase.from("project_members");
  const { error: memberError } = access === "restricted"
    ? await members.delete().eq("project_id", id).eq("source", "link")
    : await members.update({ role: linkRole }).eq("project_id", id).eq("source", "link");
  if (memberError) return NextResponse.json({ error: "Failed to update link members" }, { status: 500 });
  await audit(user.id, "share.update", { projectId: id, access, role: linkRole, expiresAt: (row as LinkRow).expires_at });

  return NextResponse.json({ link: linkJson(row as LinkRow) });
}

// Owner resets the link: old URL stops working and everyone who joined through it loses access.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await rateLimit(`share:${user.id}`, 60, 60);
  if (limited) return limited;
  if ((await getRole(supabase, id)) !== "owner") return NextResponse.json({ error: "Only the owner can reset the link" }, { status: 403 });

  const { error } = await supabase
    .from("project_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("project_id", id)
    .is("revoked_at", null);
  if (error) return NextResponse.json({ error: "Failed to revoke" }, { status: 500 });
  await supabase.from("project_members").delete().eq("project_id", id).eq("source", "link");
  await audit(user.id, "share.reset", { projectId: id });

  return NextResponse.json({ ok: true });
}
