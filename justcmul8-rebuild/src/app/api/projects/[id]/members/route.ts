import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";
import { requirePaid } from "@/lib/billing/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["viewer", "editor"];

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Every member mutation is owner-only; RLS enforces it too, this just gives a clean 403.
async function requireOwner(supabase: Supabase, id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: role } = await supabase.rpc("project_role", { pid: id });
  if (role !== "owner") return { error: NextResponse.json({ error: "Only the owner can manage access" }, { status: 403 }) };
  return { user };
}

async function readBody(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return {
    email: typeof body.email === "string" ? body.email.trim().toLowerCase() : "",
    role: body.role as string,
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Gmail SMTP: GMAIL_USER + a Google App Password (needs 2-Step Verification). ~500 emails/day.
const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

async function sendInviteEmail(opts: { to: string; inviter: string; projectName: string; role: string; url: string }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return { sent: false, error: "GMAIL_USER / GMAIL_APP_PASSWORD are not set" };
  }

  const project = escapeHtml(opts.projectName);
  const inviter = escapeHtml(opts.inviter);
  try {
    await mailer.sendMail({
      from: `"JustCmul8" <${process.env.GMAIL_USER}>`,
      to: opts.to,
      subject: `${opts.inviter} shared "${opts.projectName}" with you`,
      text: `${opts.inviter} gave you ${opts.role} access to "${opts.projectName}" on JustCmul8.\nOpen it: ${opts.url}\nSign in (or create an account) with ${opts.to} to get access.`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#111827">
          <h2 style="margin:0 0 12px">${inviter} invited you to a simulation</h2>
          <p style="color:#4b5563;line-height:1.5">You've been given <b>${opts.role}</b> access to <b>${project}</b> on JustCmul8.</p>
          <p style="margin:24px 0">
            <a href="${opts.url}" style="background:#5742FF;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Open simulation</a>
          </p>
          <p style="color:#9ca3af;font-size:12px">Sign in (or create an account) with ${escapeHtml(opts.to)} to get access.</p>
        </div>`,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "Email failed" };
  }
}

// Invite (or re-invite with a new role) by email.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await requireOwner(supabase, id);
  if (auth.error) return auth.error;
  const locked = await requirePaid(supabase, "Inviting collaborators");
  if (locked) return locked;

  const { email, role } = await readBody(req);
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  if (email === auth.user.email?.toLowerCase()) return NextResponse.json({ error: "You already own this project" }, { status: 400 });

  const { error } = await supabase
    .from("project_members")
    .upsert({ project_id: id, email, role, source: "invite", invited_by: auth.user.id }, { onConflict: "project_id,email" });
  if (error) return NextResponse.json({ error: "Failed to add person" }, { status: 500 });

  const { data: project } = await supabase.from("projects").select("name").eq("id", id).single();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle();
  const mail = await sendInviteEmail({
    to: email,
    inviter: profile?.display_name || auth.user.email || "Someone",
    projectName: project?.name || "a simulation",
    role,
    url: `${req.nextUrl.origin}/dashboard/project/${id}`,
  });
  if (!mail.sent) console.warn("[members] invite email not sent:", mail.error);

  return NextResponse.json({ ok: true, emailSent: mail.sent, emailError: mail.error });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await requireOwner(supabase, id);
  if (auth.error) return auth.error;

  const { email, role } = await readBody(req);
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  // A role picked by the owner is deliberate, so it no longer follows the link settings.
  const { error } = await supabase
    .from("project_members")
    .update({ role, source: "invite" })
    .eq("project_id", id)
    .eq("email", email);
  if (error) return NextResponse.json({ error: "Failed to change role" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await requireOwner(supabase, id);
  if (auth.error) return auth.error;

  const { email } = await readBody(req);
  const { error } = await supabase.from("project_members").delete().eq("project_id", id).eq("email", email);
  if (error) return NextResponse.json({ error: "Failed to remove person" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
