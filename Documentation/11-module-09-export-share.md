# Module 09: Export & Share

## Purpose
Provides functionality to export simulation data (as JSON or CSV) and to generate a read-only, shareable public link of a project.

## Files Owned
| File | Role |
|---|---|
| `src/app/api/projects/[id]/export/route.ts` | API route that handles generating JSON/CSV exports. |
| `src/app/api/projects/[id]/share/route.ts` | API route that handles creating and revoking public share links. |
| `src/components/workspace/ShareExportModal.tsx` | The UI modal offering export downloads and a copyable share link. |
| `src/app/share/[token]/page.tsx` | The public read-only viewer page. |
| `src/components/workspace/ShareViewer.tsx` | The client component rendering the read-only graph for the share page. |

## Algorithm / Logic
- **Exporting JSON:** Fetches the `graph_json` column from the project and sends it as `application/json`.
- **Exporting CSV:** Fetches the most recent entry from the `simulation_runs` table for the project, unwraps the nested JSON structure, and returns it as `text/csv`.
- **Sharing:** Uses a secure 32-byte hex token stored in the `shared_links` table mapping to the project ID. The public viewer fetches the project data using a custom Postgres RPC `get_shared_project(token)`.

## Gaps Flagged & Addressed
- **Gap 8:** No Export & Share functionality existed in the original codebase. This was fully implemented in Phase 3.

## Connections
- **Module 2 (Project Management):** Share and Export are scoped to a specific project.
- **Module 3 (Visual Graph Editor):** `ShareViewer.tsx` reuses `NodeCanvas.tsx` in a `readOnly` mode.

## DB Tables & RLS
- **`shared_links` table:** Holds tokens and `project_id`. RLS allows the project owner to insert/delete tokens, but prevents reading except via the security definer function.
- **RPC `get_shared_project`:** A Postgres function that bypasses normal RLS strictly for fetching the graph given a valid token.
