import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ShareViewer from "@/components/workspace/ShareViewer";

export default async function SharePage({ params }: { params: { token: string } }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_project", { token: params.token });
  const project = Array.isArray(data) ? data[0] : data;
  if (error || !project) notFound();

  return <ShareViewer name={project.name} simType={project.sim_type} graph={project.graph_json} />;
}
