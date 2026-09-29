const L = require("./lib");
const { D, FONT, W, p, pc, runs, table, tab, spacer, sizes } = L;
const { Paragraph, TextRun, AlignmentType, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, TableOfContents, StyleLevel } = D;
const fs = require("fs");
const img = (f, wpx) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 },
  children: [new ImageRun({ type: f.endsWith(".jpg") ? "jpg" : "png", data: fs.readFileSync("img/" + f), transformation: { width: wpx, height: Math.round((wpx * sizes[f].h) / sizes[f].w) } })] });
const line = (t, size = 24, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: o.before || 0, after: o.after ?? 120, line: 300 },
  children: [new TextRun({ text: t, font: FONT, size, bold: !!o.bold, italics: !!o.italics, allCaps: !!o.caps })] });
const noB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

function cover() {
  return [
    img("college_banner.jpg", 610),
    line("DEPARTMENT OF INFORMATION TECHNOLOGY", 28, { bold: true, before: 240, after: 240 }),
    line("A PROJECT REPORT ON", 24, { before: 120, after: 160 }),
    line("Browser Based Discrete – Event Simulator", 36, { bold: true, after: 120 }),
    line("“JustCmul8: A No-Code, Browser-Based Discrete Event Simulation Platform”", 26, { italics: true, after: 300 }),
    img("college_logo.jpg", 130),
    line("SUBMITTED BY", 24, { bold: true, before: 240, after: 100 }),
    line("Ms. Khushi Singh – 261713", 28, { after: 40 }),
    line("Mr. Mohit Gupta – 261715", 28, { after: 240 }),
    line("UNDER THE GUIDANCE OF", 24, { bold: true, after: 100 }),
    line("Ms. Jinal Gujar", 28, { after: 240 }),
    line("Submitted in partial fulfilment of the requirements for qualifying", 24, { after: 60 }),
    line("BACHELOR OF SCIENCE (INFORMATION TECHNOLOGY)", 26, { bold: true, after: 60 }),
    line("Semester – V Examination", 24, { after: 240 }),
    line("THAKUR COLLEGE OF SCIENCE AND COMMERCE", 26, { bold: true, after: 40 }),
    line("(Empowered Autonomous College, Permanently Affiliated to University of Mumbai)", 22, { italics: true, after: 40 }),
    line("THAKUR VILLAGE, KANDIVALI (EAST), MUMBAI – 400 101, MAHARASHTRA", 22, { after: 160 }),
    line("ACADEMIC YEAR  2026 – 2027", 26, { bold: true }),
  ];
}

const title = (t, pb = true) => new Paragraph({ style: "FrontTitle", pageBreakBefore: pb, children: [new TextRun({ text: t, font: FONT })] });

function sigTable(cells) {
  const w = W / 2;
  const c = (a, b) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: { top: noB, bottom: noB, left: noB, right: noB },
    margins: { top: 500, bottom: 100, left: 100, right: 100 },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: "______________________________", font: FONT })] }),
      ...a.map((t, i) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: t, font: FONT, bold: i === 0, size: 24 })] }))] });
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [w, w],
    rows: cells.map((r) => new TableRow({ cantSplit: true, children: r.map((a) => c(a)) })) });
}

function certificate() {
  return [
    img("college_banner.jpg", 610),
    title("CERTIFICATE OF APPROVAL", false),
    p("This certifies that the project titled “**Browser Based Discrete – Event Simulator**” was carried out at Thakur College of Science and Commerce by **Ms. Khushi Singh (Roll No. 261713)** and **Mr. Mohit Gupta (Roll No. 261715)**, students of Bachelor of Science (Information Technology). It is submitted in partial fulfilment of the Semester–V examination for the B.Sc. (Information Technology) degree of the University of Mumbai, academic year 2026 – 2027."),
    p("The students have finished every phase of the project. The work in this report is theirs, and it has not been offered to any other university or institute for a degree or diploma."),
    spacer(),
    sigTable([[["Ms. Jinal Gujar", "Project Guide"], ["Prof. Dr. Santosh Kumar Singh", "Head of Department"]], [["External Examiner"], ["Principal"]]]),
    spacer(),
    p("Date: ______________                                        College Seal / Stamp: ______________", { alignment: AlignmentType.LEFT }),
  ];
}

function declaration() {
  return [
    title("CANDIDATES’ DECLARATION"),
    p("We declare that the project described in this report, “**Browser Based Discrete – Event Simulator**”, is our own work. It was done during the academic year 2026 – 2027 under the guidance of Ms. Jinal Gujar and is submitted to the Department of Information Technology, Thakur College of Science and Commerce, in partial fulfilment of the Bachelor of Science in Information Technology (Semester–V) degree."),
    p("The analysis, design, source code, integration of the simulation engine, testing and write-up were all done by the two of us. Where we drew on published literature, official technical documentation or open-source libraries, we have said so in the text and listed the source under References. None of this material has been submitted, wholly or partly, to another university or institute for any degree or diploma."),
    p("We accept that any lapse in academic integrity, whenever it is found, can lead to disciplinary action under the rules of the college and the University of Mumbai."),
    spacer(),
    p("Place: Mumbai", { alignment: AlignmentType.LEFT }),
    p("Date:  ______________", { alignment: AlignmentType.LEFT }),
    sigTable([[["Ms. Khushi Singh", "Roll No. 261713"], ["Mr. Mohit Gupta", "Roll No. 261715"]]]),
  ];
}

function acknowledgement() {
  return [
    title("ACKNOWLEDGEMENT"),
    p("Many people helped this project along, and we would like to thank them here."),
    p("Our first thanks go to our guide, **Ms. Jinal Gujar** of the Department of Information Technology, who kept us on course through the whole development of JustCmul8. She insisted that the simulation engine be checked before any feature was stacked on it. We had planned it the other way round, and following her advice spared us a lot of rework. She also read our early drafts, and the shape of this report came out of her comments."),
    p("**Prof. Dr. Santosh Kumar Singh**, Head of the Department of Information Technology, made it possible for students to take on a project of this size, and his suggestions in the review sessions were useful. We are grateful to him."),
    p("We thank the Principal and management of Thakur College of Science and Commerce for the laboratory, network and machines we used. Testing a WebAssembly Python runtime, and trying real-time collaboration on several computers at once, needed the department laboratory."),
    p("The faculty of the department taught us data structures, database systems, software engineering and web technologies, and we used that material directly: priority queues, normalisation and the life-cycle models all appear in the work below. The laboratory assistants also deserve thanks for sorting out machine access and configuration during long testing sessions."),
    spacer(),
    p("Ms. Khushi Singh – 261713", { alignment: AlignmentType.RIGHT, spacing: { after: 20 } }),
    p("Mr. Mohit Gupta – 261715", { alignment: AlignmentType.RIGHT }),
  ];
}

function abstract() {
  return [
    title("ABSTRACT"),
    p("Discrete Event Simulation (DES) can show how a queue, a production line or a delivery network will behave before anyone spends money changing it, but few of the people who could use it ever do. Commercial packages such as AnyLogic, Arena and Simul8 charge licence fees of thousands of dollars a year. The main open-source option, SimPy, is a Python library, so a user must write and debug code before a first model runs. Nearly all of these tools are desktop programs that need installing, which is a problem in shared laboratories and on managed machines. Drawing tools such as Visio and Lucidchart go the other way: they are easy, but their diagrams never execute and cannot say what happens if one more counter is opened."),
    p("**JustCmul8** is our attempt at filling that gap. Users drag nodes onto a canvas, connect them, fill in each node through ordinary form fields and run the model, all in the browser with nothing to install. The key design choice is that the model is never approximated in JavaScript. The graph is compiled into a real Python SimPy script, which a CPython interpreter built for WebAssembly (Pyodide) runs inside a Web Worker so the interface does not freeze. The numbers on screen therefore come from the same engine a researcher would run in a terminal."),
    p("The front end is a client-heavy single-page application written with Next.js 16, React 19 and TypeScript; the canvas uses React Flow and shared state lives in Zustand. Supabase handles sign-in, storage and real-time channels, and PostgreSQL Row-Level Security keeps projects separate at the database instead of relying on client code. There are twelve functional modules and fifteen node types covering six domains: human queues, vehicle traffic, liquid and material flow, manufacturing, logistics and network signalling. After a run, the analytics layer works out utilisation, waiting times, throughput, queue lengths, a Little’s Law consistency check and a composite system health score, and it names the bottleneck node. A Monte Carlo facility repeats the run over independent replications and gives 95 per cent confidence intervals rather than a single figure. Around these sit an animated digital-twin playback, a cost and return-on-investment panel, a Python code inspector with Jupyter export, executive PDF reports and read-only share links that can be revoked. A Google Gemini assistant, reached through a model router that watches model health and falls back automatically, turns a plain-English description into a candidate graph and suggests fixes for the bottleneck it finds."),
    p("We checked the engine against closed-form queueing theory. The verification suite passed all 28 analytical checks (M/M/1, M/M/c and saturated-queue benchmarks) and all 22 structural invariants of a multi-stage hospital-flow model, with simulated utilisation, waiting time and queue length within 3.5 per cent of theory. The outcome is a working platform that removes the cost, coding and installation barriers to simulation and keeps the accuracy of the underlying engine."),
    p("**Keywords:** discrete event simulation, SimPy, WebAssembly, Pyodide, no-code modelling, Monte Carlo analysis, Next.js, Supabase, AI-assisted modelling.", { alignment: AlignmentType.LEFT }),
  ];
}

function index() {
  const toc = new TableOfContents("Index", { hyperlink: true, headingStyleRange: "1-2" });
  const lof = new TableOfContents("List of Figures", { hyperlink: true, stylesWithLevels: [new StyleLevel("Fig Caption", 3)] });
  const lot = new TableOfContents("List of Tables", { hyperlink: true, stylesWithLevels: [new StyleLevel("Tab Caption", 3)] });
  return [
    title("INDEX"), toc,
    title("LIST OF FIGURES"), lof,
    title("LIST OF TABLES"), lot,
  ];
}

function abbreviations() {
  const A = [
    ["AI", "Artificial Intelligence", "NFR", "Non-Functional Requirement"],
    ["API", "Application Programming Interface", "OAuth", "Open Authorization"],
    ["COCOMO", "Constructive Cost Model", "PK / FK", "Primary Key / Foreign Key"],
    ["CRUD", "Create, Read, Update, Delete", "PM", "Person-Months"],
    ["CSV", "Comma-Separated Values", "PRNG", "Pseudo-Random Number Generator"],
    ["DES", "Discrete Event Simulation", "Pyodide", "CPython distribution for WebAssembly"],
    ["DFD", "Data Flow Diagram", "RBAC", "Role-Based Access Control"],
    ["ERD", "Entity Relationship Diagram", "RLS", "Row-Level Security"],
    ["FIFO / LIFO", "First / Last In, First Out", "SDLC", "Software Development Life Cycle"],
    ["FP / FPA", "Function Point / Analysis", "SimPy", "Simulation in Python (DES library)"],
    ["FR", "Functional Requirement", "SLOC / KSLOC", "(Thousand) Source Lines of Code"],
    ["HCI", "Human–Computer Interaction", "SPA", "Single-Page Application"],
    ["JSON / JSONB", "JavaScript Object Notation / Binary", "SRS", "Software Requirements Specification"],
    ["KPI", "Key Performance Indicator", "TLS", "Transport Layer Security"],
    ["LLM", "Large Language Model", "UAT", "User Acceptance Testing"],
    ["M/M/1, M/M/c", "Markovian queues with 1 or c servers", "UFP / VAF", "Unadjusted FP / Value Adjustment Factor"],
    ["ML", "Machine Learning", "UML", "Unified Modeling Language"],
    ["WASM", "WebAssembly", "UUID", "Universally Unique Identifier"],
  ];
  return [
    title("LIST OF ABBREVIATIONS"),
    table(["Term", "Meaning", "Term", "Meaning"], A, [1500, 3013, 1500, 3013], { size: 20 }),
  ];
}

module.exports = { cover, certificate, declaration, acknowledgement, abstract, index, abbreviations };
