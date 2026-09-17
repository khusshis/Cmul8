import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("project_shares")
    .select("share_token")
    .eq("project_id", id)
    .is("revoked_at", null)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ url: `/share/${existing.share_token}` });
  }

  const { data: created, error: insertError } = await supabase
    .from("project_shares")
    .insert({ project_id: id, created_by: user.id })
    .select("share_token")
    .single();
  if (insertError || !created) {
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }

  return NextResponse.json({ url: `/share/${created.share_token}` });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("project_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("project_id", id)
    .eq("created_by", user.id)
    .is("revoked_at", null);
  if (error) return NextResponse.json({ error: "Failed to revoke" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("project_shares")
    .select("share_token")
    .eq("project_id", id)
    .eq("created_by", user.id)
    .is("revoked_at", null)
    .maybeSingle();

  return NextResponse.json({ url: data ? `/share/${data.share_token}` : null });
}
