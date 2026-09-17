import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = req.nextUrl.searchParams.get("format") || "json";

  const { data: project, error } = await supabase
    .from("projects")
    .select("name, sim_type, graph_json")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (format === "json") {
    const body = JSON.stringify({ name: project.name, sim_type: project.sim_type, graph_json: project.graph_json }, null, 2);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${project.name.replace(/[^a-z0-9]+/gi, "_")}.json"`,
      },
    });
  }

  // format === "csv" — pull the most recent run's node stats
  const { data: run } = await supabase
    .from("simulation_runs")
    .select("result_json")
    .eq("project_id", id)
    .eq("user_id", user.id)
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run?.result_json) {
    return NextResponse.json({ error: "No simulation results yet for this project — run a simulation first." }, { status: 404 });
  }

  const stats = run.result_json.nodeStats as Record<string, any>;
  const rows = [["Block", "Type", "In", "Out", "Utilization %", "Avg Wait (s)"]];
  for (const s of Object.values(stats)) {
    rows.push([
      s.label,
      s.nodeType,
      String(s.entitiesIn ?? ""),
      String(s.entitiesOut ?? ""),
      s.utilization != null ? String(Math.round(s.utilization * 100)) : "",
      s.avgWaitTime != null ? s.avgWaitTime.toFixed(1) : "",
    ]);
  }
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${project.name.replace(/[^a-z0-9]+/gi, "_")}_results.csv"`,
    },
  });
}
