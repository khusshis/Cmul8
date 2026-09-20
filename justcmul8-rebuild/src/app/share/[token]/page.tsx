import { createClient } from "@/lib/supabase/server";
import ShareViewer from "@/components/workspace/ShareViewer";
import ShareLinkUnavailable from "@/components/workspace/ShareLinkUnavailable";

export default async function SharePage({ params }: { params: { token: string } }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_project", { token: params.token });
  const project = Array.isArray(data) ? data[0] : data;

  if (!error && project) {
    return <ShareViewer name={project.name} simType={project.sim_type} graph={project.graph_json} />;
  }

  const { data: status } = await supabase.rpc("get_share_status", { token: params.token });
  return <ShareLinkUnavailable reason={status === "revoked" ? "revoked" : "invalid"} />;
}
