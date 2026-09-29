import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ShareViewer from "@/components/workspace/ShareViewer";
import ShareLinkUnavailable from "@/components/workspace/ShareLinkUnavailable";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const loginUrl = `/login?redirect=${encodeURIComponent(`/share/${token}`)}`;

  // Logged in: invited people (or anyone, for "anyone with the link") go straight into the live workspace.
  if (user) {
    const { data: projectId } = await supabase.rpc("accept_share_link", { token });
    if (projectId) redirect(`/dashboard/project/${projectId}`);
  }

  const { data: status } = await supabase.rpc("get_share_status", { token });
  if (status !== "active") {
    return <ShareLinkUnavailable reason={status === "revoked" ? "revoked" : "invalid"} />;
  }
  if (user) return <ShareLinkUnavailable reason="no-access" email={user.email} />;

  // Anonymous: read-only preview for public links, otherwise sign in first.
  const { data } = await supabase.rpc("get_shared_project", { token });
  const project = Array.isArray(data) ? data[0] : data;
  if (!project) redirect(loginUrl);
  return <ShareViewer name={project.name} simType={project.sim_type} graph={project.graph_json} loginUrl={loginUrl} />;
}
