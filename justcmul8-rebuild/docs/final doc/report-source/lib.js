const fs = require("fs");
const path = require("path");
const D = require("docx");
const {
  Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType, ImageRun,
  HeadingLevel, PageBreak, TabStopType, LevelFormat, VerticalAlign, HeightRule, TableLayoutType,
} = D;

const FONT = "Times New Roman";
const W = 9026; // usable width in DXA on A4 with 1" margins
const sizes = JSON.parse(fs.readFileSync(path.join(__dirname, "sizes.json"), "utf8"));

const reg = { fig: {}, tab: {}, counters: {}, chap: 0 };
let pass = 1;
function resetPass(p) { pass = p; reg.counters = {}; reg.chap = 0; }
function ref(id) {
  const f = reg.fig[id] || reg.tab[id];
  return f ? f : "??";
}

// ---- inline markup:  **bold**  *italic*  `code`  {ref:id} ----
function runs(text, base = {}) {
  text = String(text).replace(/\{ref:([\w-]+)\}/g, (_, id) => ref(id));
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, font: FONT, ...base }));
    else if (t.startsWith("`")) out.push(new TextRun({ text: t.slice(1, -1), font: "Courier New", ...base, size: (base.size || 24) - 2 }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, font: FONT, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, ...base }));
  return out;
}

const BODY = { spacing: { line: 360, after: 120 }, alignment: AlignmentType.JUSTIFIED };

const p = (text, opts = {}) => new Paragraph({ ...BODY, ...opts, children: runs(text, opts.run || {}) });
const pc = (text, opts = {}) => p(text, { ...opts, alignment: AlignmentType.CENTER });

const h1 = (text) => {
  reg.chap += 1; reg.counters = {};
  return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text: text.toUpperCase(), font: FONT })] });
};
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text, font: FONT })] });
const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, children: [new TextRun({ text, font: FONT })] });

const bullets = (items, level = 0) => items.map((t) => new Paragraph({
  numbering: { reference: "bul", level }, spacing: { line: 336, after: 60 }, alignment: AlignmentType.JUSTIFIED, children: runs(t),
}));
let numRef = 0;
const numbered = (items) => {
  numRef += 1;
  return items.map((t) => new Paragraph({ numbering: { reference: "num" + numRef, level: 0 }, spacing: { line: 336, after: 60 }, alignment: AlignmentType.JUSTIFIED, children: runs(t) }));
};
const numConfigs = () => Array.from({ length: 60 }, (_, i) => ({
  reference: "num" + (i + 1),
  levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { font: FONT } } }],
}));

// ---- captions ----
function nextNo(kind, id) {
  reg.counters[kind] = (reg.counters[kind] || 0) + 1;
  const no = `${reg.chap}.${reg.counters[kind]}`;
  const label = kind === "fig" ? `Figure ${no}` : `Table ${no}`;
  if (id) (kind === "fig" ? reg.fig : reg.tab)[id] = label;
  return label;
}
const capStyle = (kind) => (kind === "fig" ? "FigCaption" : "TabCaption");
function caption(kind, id, text, keepNext = false) {
  const label = nextNo(kind, id);
  return new Paragraph({
    style: capStyle(kind), keepNext, alignment: AlignmentType.CENTER, spacing: { before: kind === "fig" ? 60 : 200, after: kind === "fig" ? 200 : 80 },
    children: [new TextRun({ text: `${label}: ${text}`, bold: true, font: FONT, size: 22 })],
  });
}

// ---- figures / placeholders ----
function fig(file, id, text, widthIn = 6.2) {
  const s = sizes[file];
  const wpx = Math.round(widthIn * 96);
  let hpx = Math.round((wpx * s.h) / s.w);
  const maxH = 8.4 * 96;
  let w2 = wpx;
  if (hpx > maxH) { w2 = Math.round((maxH * s.w) / s.h); hpx = Math.round(maxH); }
  const ext = path.extname(file).slice(1).replace("jpeg", "jpg");
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type: ext, data: fs.readFileSync(path.join(__dirname, "img", file)), transformation: { width: w2, height: hpx },
        altText: { title: text, description: text, name: id } })] }),
    caption("fig", id, text),
  ];
}
const thin = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const dashed = { style: BorderStyle.DASHED, size: 8, color: "000000" };
function placeholder(id, what, text, heightIn = 3.2) {
  const cell = new TableCell({
    width: { size: W, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    borders: { top: dashed, bottom: dashed, left: dashed, right: dashed },
    margins: { top: 200, bottom: 200, left: 300, right: 300 },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "[ SCREENSHOT PLACEHOLDER ]", bold: true, font: FONT, size: 24 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 300 }, children: runs(what, { size: 22 }) }),
    ],
  });
  return [
    new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [new TableRow({ height: { value: Math.round(heightIn * 1440), rule: HeightRule.ATLEAST }, cantSplit: true, children: [cell] })] }),
    caption("fig", id, text),
  ];
}

// ---- tables ----
function table(headers, rows, widths, opts = {}) {
  const fs_ = opts.size || 21;
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (t, w, o = {}) => new TableCell({
    width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    borders: { top: thin, bottom: thin, left: thin, right: thin },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(t).split("\n").map((line) => new Paragraph({
      spacing: { line: 264, after: 0 }, alignment: o.head ? AlignmentType.CENTER : (o.align || AlignmentType.LEFT),
      children: runs(line, { size: fs_, bold: !!o.head }),
    })),
  });
  const rws = [new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, widths[i], { head: true })) })];
  rows.forEach((r, ri) => rws.push(new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], { align: (opts.center || []).includes(i) ? AlignmentType.CENTER : AlignmentType.LEFT, shade: opts.boldFirst && i === 0 && false })) })));
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED, rows: rws });
}
function tab(id, text, headers, rows, widths, opts = {}) {
  return [caption("tab", id, text, true), table(headers, rows, widths, opts), new Paragraph({ spacing: { after: 120 }, children: [] })];
}

// ---- code block ----
function code(lines, title) {
  const ps = lines.map((l) => new Paragraph({ spacing: { line: 240, after: 0 }, alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: l === "" ? " " : l, font: "Courier New", size: 18 })] }));
  const c = new TableCell({ width: { size: W, type: WidthType.DXA }, borders: { top: thin, bottom: thin, left: thin, right: thin },
    margins: { top: 100, bottom: 100, left: 160, right: 160 }, children: ps });
  const out = [];
  if (title) out.push(new Paragraph({ keepNext: true, spacing: { before: 120, after: 60 }, children: [new TextRun({ text: title, bold: true, font: FONT, size: 22 })] }));
  out.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [new TableRow({ children: [c] })] }));
  out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  return out;
}

// equation / calc block (centered, monospace-free)
const eq = (lines) => lines.map((l) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 300, after: 40 }, children: runs(l, { italics: false }) }));

const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

module.exports = { D, FONT, W, runs, p, pc, h1, h2, h3, bullets, numbered, numConfigs, caption, fig, placeholder, table, tab, code, eq, spacer, pageBreak, reg, resetPass, ref, sizes, thin };
