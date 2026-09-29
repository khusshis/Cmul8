from dg import *
import numpy as np


# ---------- 1. SDLC model ----------
def sdlc():
    fig, ax = canvas(9, 5.6, (0, 18), (0, 11.2))
    txt(ax, 9, 10.7, "Iterative and Incremental Development Model", 12, bold=True)
    x = 0.4
    for i, t in enumerate(["Requirement\nAnalysis", "Feasibility\nStudy", "System\nDesign"]):
        box(ax, x + i * 2.6, 8.2, 2.2, 1.5, t, 9.5, fill=GREY)
        if i < 2:
            arr(ax, (x + i * 2.6 + 2.2, 8.95), (x + (i + 1) * 2.6, 8.95))
    box(ax, 8.6, 8.2, 2.6, 1.5, "Prototype Spike\n(SimPy on Pyodide)", 9.5, fill="white", ls="--")
    arr(ax, (x + 2 * 2.6 + 2.2, 8.95), (8.6, 8.95))
    txt(ax, 9.9, 7.75, "risk retired before module design", 8, italic=True)
    box(ax, 12.2, 8.2, 2.6, 1.5, "Baseline: SRS,\nSchema, UI Design", 9.5, fill=GREY)
    arr(ax, (11.2, 8.95), (12.2, 8.95))
    ax.add_patch(Rectangle((0.4, 2.6), 14.4, 4.6, fc="none", ec="black", lw=1.4, ls="--"))
    txt(ax, 7.6, 6.85, "Incremental Build Loop  (repeated for each of the twelve modules)", 10, bold=True)
    labels = ["Module\nDesign", "Coding", "Unit\nTesting", "Integration\n& Review"]
    for i, t in enumerate(labels):
        bx = 1.0 + i * 3.4
        box(ax, bx, 3.6, 2.4, 1.7, t, 10, fill="white", rounded=True)
        if i < 3:
            arr(ax, (bx + 2.4, 4.45), (bx + 3.4, 4.45))
    line(ax, [(11.4, 3.6), (11.4, 3.0), (2.2, 3.0)], ls="--")
    arr(ax, (2.2, 3.0), (2.2, 3.6), style="->", ls="--")
    txt(ax, 6.8, 2.8, "feedback: defects and interface changes return to the next iteration", 8, italic=True)
    arr(ax, (13.5, 8.2), (13.5, 7.2))
    box(ax, 15.3, 3.6, 2.4, 1.7, "Release &\nDeployment", 10, fill=GREY)
    arr(ax, (14.8, 4.45), (15.3, 4.45))
    box(ax, 0.4, 0.6, 17.3, 1.1, "Documentation, configuration management (Git) and issue tracking run continuously through every phase", 9.5, fill=LGREY)
    save(fig, "f_sdlc")


# ---------- 2. Module map ----------
def modules():
    fig, ax = canvas(9, 6.4, (0, 18), (0, 12.8))
    txt(ax, 9, 12.3, "Functional Modules of JustCmul8", 12, bold=True)
    groups = [
        ("A.  Platform and Data Layer", ["1  Platform and\nData Layer"], 0),
        ("B.  Modelling and Execution", ["2  Visual Graph\nEditor", "3  Node Configuration\nPanel", "4  Simulation\nEngine", "5  AI Assistant", "6  AI System\nOptimiser"], 1),
        ("C.  Analysis and Reuse", ["7  KPI Dashboard\nand Results", "8  Monte Carlo and\nScenarios", "9  Digital Twin\nPlayback", "10  Template\nGallery"], 2),
        ("D.  Distribution and Collaboration", ["11  Executive Report\nand Share", "12  Real-Time\nCollaboration"], 3),
    ]
    ys = [9.6, 6.6, 3.6, 0.6]
    for (title, mods, gi), y in zip(groups, ys):
        ax.add_patch(Rectangle((0.3, y - 0.2), 17.4, 2.4, fc=LGREY if gi % 2 == 0 else "white", ec="black", lw=1.3))
        txt(ax, 0.6, y + 1.95, title, 9.5, ha="left", bold=True)
        n = len(mods)
        w = 3.1
        gap = 0.35
        total = n * w + (n - 1) * gap
        x0 = (18 - total) / 2
        for i, m in enumerate(mods):
            box(ax, x0 + i * (w + gap), y + 0.2, w, 1.35, m, 9, fill="white", rounded=True)
    for a, b in zip(ys[:-1], ys[1:]):
        arr(ax, (9, a - 0.2), (9, b + 2.2), style="->")
    save(fig, "f_modules")


# ---------- 3. Pipeline ----------
def pipeline():
    fig, ax = canvas(9.4, 4.9, (0, 19), (-0.8, 9.2))
    txt(ax, 9.5, 8.7, "Execution Pipeline: from Drawing to Decision", 12, bold=True)
    ax.add_patch(Rectangle((0.2, 4.4), 18.6, 3.5, fc=LGREY, ec="black", lw=1.2))
    txt(ax, 0.5, 7.6, "Main thread (browser UI)", 8.5, ha="left", italic=True)
    ax.add_patch(Rectangle((6.4, 0.4), 6.2, 3.4, fc="white", ec="black", lw=1.4, ls="--"))
    txt(ax, 12.4, 3.5, "Web Worker (off main thread)", 8.5, ha="right", italic=True)
    box(ax, 0.6, 5.0, 2.8, 1.9, "Graph on\nCanvas\n(React Flow)", 9, fill="white", rounded=True)
    box(ax, 4.2, 5.0, 2.8, 1.9, "Structural\nValidation\n(connectivity)", 9, fill="white", rounded=True)
    box(ax, 7.8, 5.0, 2.8, 1.9, "SimPy Script\nGenerator", 9, fill=GREY, rounded=True)
    box(ax, 7.8, 0.9, 2.8, 1.9, "Pyodide\n(CPython in\nWebAssembly)", 9, fill=GREY, rounded=True)
    box(ax, 11.4, 5.0, 3.2, 1.9, "Analytics Engine\nKPIs, Little's Law,\nHealth Score", 9, fill="white", rounded=True)
    box(ax, 15.4, 5.0, 3.1, 1.9, "Dashboard, Digital\nTwin, Monte Carlo,\nReport, Export", 9, fill="white", rounded=True)
    arr(ax, (3.4, 5.95), (4.2, 5.95))
    arr(ax, (7.0, 5.95), (7.8, 5.95))
    arr(ax, (9.2, 5.0), (9.2, 2.8))
    txt(ax, 9.5, 4.1, "script", 8, ha="left", italic=True)
    line(ax, [(10.6, 1.85), (13.0, 1.85)])
    arr(ax, (13.0, 1.85), (13.0, 5.0))
    txt(ax, 13.25, 3.3, "event trace", 8, ha="left", italic=True)
    txt(ax, 13.25, 2.85, "+ logs", 8, ha="left", italic=True)
    arr(ax, (14.6, 5.95), (15.4, 5.95))
    txt(ax, 9.5, -0.35, "Persistence of graph, run summaries and chat history (Supabase / PostgreSQL) runs alongside, under Row-Level Security", 8, italic=True)
    save(fig, "f_pipeline")


# ---------- 4. Testing strategy ----------
def testing():
    fig, ax = canvas(8.4, 5.2, (0, 16.8), (0, 10.4))
    txt(ax, 8.4, 9.9, "Layered Testing Strategy", 12, bold=True)
    layers = ["Acceptance and cross-browser testing", "Security testing (Row-Level Security)",
              "Integration testing (store, worker, analytics, dashboard)",
              "Analytical verification (M/M/1, M/M/c, Little's Law)",
              "Structural graph testing (connectivity, sources, sinks)",
              "Unit testing (samplers, analytics functions)"]
    ys = [8.0 - i * 1.25 for i in range(6)]
    widths = [7.2, 9.0, 11.0, 12.6, 14.2, 15.4]
    for i, (t, y, w) in enumerate(zip(layers, ys, widths)):
        box(ax, (16.8 - w) / 2 + 0.4, y, w - 0.8, 1.1, t, 9, fill=GREY if i in (2, 3) else "white")
    txt(ax, 8.4, 0.5, "Lower layers are cheap and run constantly; upper layers are broader and run before each release", 8.5, italic=True)
    save(fig, "f_testing")


# ---------- 5. Jira workflow ----------
def jira():
    fig, ax = canvas(9, 3.6, (0, 18), (0, 7.2))
    txt(ax, 9, 6.8, "Jira Issue Workflow Used for JustCmul8", 12, bold=True)
    st = ["Backlog", "To Do", "In Progress", "In Review", "Testing", "Done"]
    w = 2.3
    gap = 0.6
    x0 = (18 - (6 * w + 5 * gap)) / 2
    for i, s in enumerate(st):
        box(ax, x0 + i * (w + gap), 3.3, w, 1.5, s, 10, fill=GREY if s == "Done" else "white", rounded=True, bold=(s == "Done"))
        if i < 5:
            arr(ax, (x0 + i * (w + gap) + w, 4.05), (x0 + (i + 1) * (w + gap), 4.05))
    line(ax, [(x0 + 4 * (w + gap) + w / 2, 3.3), (x0 + 4 * (w + gap) + w / 2, 2.4), (x0 + 2 * (w + gap) + w / 2, 2.4)], ls="--")
    arr(ax, (x0 + 2 * (w + gap) + w / 2, 2.4), (x0 + 2 * (w + gap) + w / 2, 3.3), ls="--")
    txt(ax, 9, 1.85, "defect found: issue returns to In Progress", 8.5, italic=True)
    txt(ax, 9, 0.6, "Issue types: Epic (module)  >  Story (feature)  >  Task / Sub-task  |  Bug (defect)", 9)
    save(fig, "f_jira")


# ---------- 6/7. Verification charts (real data: verification/SCORECARD.md) ----------
def charts():
    labels = ["B1  utilisation\n(theory 0.800)", "B1  Wq\n(theory 4.000)", "B1  W\n(theory 5.000)", "B1  Lq\n(theory 3.200)",
              "B2  utilisation\n(theory 0.800)", "B2  Wq\n(theory 1.079)", "B2  W\n(theory 2.079)"]
    theory = np.array([0.8, 4.0, 5.0, 3.2, 0.8, 1.0787, 2.0787])
    sim = np.array([0.7979, 4.005, 5.004, 3.188, 0.7983, 1.101, 2.1])
    fig, ax = plt.subplots(figsize=(8.6, 4.4))
    x = np.arange(len(labels))
    w = 0.38
    ax.bar(x - w / 2, theory, w, fc="#F6C177", ec="black", label="Analytical (theory)")
    ax.bar(x + w / 2, sim, w, fc="#2F6FED", ec="black", label="JustCmul8 engine (simulated)")
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=8)
    ax.set_ylabel("Value (seconds, or utilisation fraction)", fontsize=9)
    ax.set_title("Simulated Results against Queueing Theory", fontsize=11, fontweight="bold")
    ax.legend(fontsize=8.5, frameon=True, edgecolor="black", fancybox=False)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.grid(axis="y", ls=":", color="#999999")
    fig.tight_layout()
    fig.savefig(OUT + "f_bench_bars.png", dpi=220, facecolor="white")
    plt.close(fig)

    names = ["B1 rho", "B1 Wq", "B1 W", "B1 Lq", "B1v rho", "B1v Wq", "B1v W", "B1v L", "B2 rho", "B2 Wq", "B2 W", "B3 arr.", "B3 comp.", "B3 rho", "B5 WIP"]
    delta = np.array([-0.27, 0.13, 0.08, -0.39, -0.27, 0.13, 0.08, -0.51, -0.21, 2.09, 1.03, -1.55, 0.53, -0.32, -0.46])
    tol = np.array([3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 4.0, 4.0, 4.0, 5.0, 5.0, 2.0, 8.0])
    fig, ax = plt.subplots(figsize=(8.6, 4.4))
    x = np.arange(len(names))
    ax.bar(x, delta, 0.6, fc="#2F6FED", ec="black", label="Deviation from theory (%)")
    ax.step(np.append(x - 0.5, x[-1] + 0.5), np.append(tol, tol[-1]), where="post", color="black", ls="--", lw=1.1, label="Accepted tolerance (+/-)")
    ax.step(np.append(x - 0.5, x[-1] + 0.5), np.append(-tol, -tol[-1]), where="post", color="black", ls="--", lw=1.1)
    ax.axhline(0, color="black", lw=0.8)
    ax.set_xticks(x)
    ax.set_xticklabels(names, rotation=45, ha="right", fontsize=8)
    ax.set_ylabel("Deviation (%)", fontsize=9)
    ax.set_title("Deviation of Simulated Metrics from Theory against Tolerance", fontsize=11, fontweight="bold")
    ax.legend(fontsize=8.5, frameon=True, edgecolor="black", fancybox=False, loc="lower left")
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.grid(axis="y", ls=":", color="#999999")
    fig.tight_layout()
    fig.savefig(OUT + "f_bench_delta.png", dpi=220, facecolor="white")
    plt.close(fig)


sdlc()
modules()
pipeline()
testing()
jira()
charts()

print("done")
