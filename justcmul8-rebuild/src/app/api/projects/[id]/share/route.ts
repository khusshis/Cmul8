import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function getRole(supabase: Supabase, id: string) {
  const { data } = await supabase.rpc("project_role", { pid: id });
  return (data as "owner" | "editor" | "viewer" | null) ?? null;
}

async function activeLink(supabase: Supabase, id: string) {
  const { data } = await supabase
    .from("project_shares")
    .select("share_token, link_access, link_role")
    .eq("project_id", id)
    .is("revoked_at", null)
    .maybeSingle();
  return data;
}

function linkJson(row: { share_token: string; link_access: string; link_role: string } | null) {
  return row ? { url: `/share/${row.share_token}`, access: row.link_access, role: row.link_role } : null;
}

// Role, people with access, and (owner only) the share link. The owner's link is created
// lazily as "Restricted", like Google Drive: the URL exists but only invited people get in.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        .select("share_token, link_access, link_role")
        .single();
      row = data;
    }
    link = linkJson(row);
  }

  return NextResponse.json({ role, people: people || [], link });
}

// Owner changes "General access": { access: 'restricted'|'anyone', role: 'viewer'|'editor' }.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((await getRole(supabase, id)) !== "owner") return NextResponse.json({ error: "Only the owner can change sharing" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const access = body.access;
  const linkRole = body.role;
  if (!["restricted", "anyone"].includes(access) || !["viewer", "editor"].includes(linkRole)) {
    return NextResponse.json({ error: "Invalid access settings" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("project_shares")
    .update({ link_access: access, link_role: linkRole })
    .eq("project_id", id)
    .is("revoked_at", null)
    .select("share_token, link_access, link_role")
    .single();
  if (error || !row) return NextResponse.json({ error: "Failed to update link" }, { status: 500 });

  // People who got in through the link follow the link's settings.
  const members = supabase.from("project_members");
  const { error: memberError } = access === "restricted"
    ? await members.delete().eq("project_id", id).eq("source", "link")
    : await members.update({ role: linkRole }).eq("project_id", id).eq("source", "link");
  if (memberError) return NextResponse.json({ error: "Failed to update link members" }, { status: 500 });

  return NextResponse.json({ link: linkJson(row) });
}

// Owner resets the link: old URL stops working and everyone who joined through it loses access.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((await getRole(supabase, id)) !== "owner") return NextResponse.json({ error: "Only the owner can reset the link" }, { status: 403 });

  const { error } = await supabase
    .from("project_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("project_id", id)
    .is("revoked_at", null);
  if (error) return NextResponse.json({ error: "Failed to revoke" }, { status: 500 });
  await supabase.from("project_members").delete().eq("project_id", id).eq("source", "link");

  return NextResponse.json({ ok: true });
}
