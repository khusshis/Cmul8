const fs = require("fs");
const L = require("./lib");
const { D, FONT } = L;
const { Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber, NumberFormat, BorderStyle, TabStopType } = D;
const c0 = require("./c0");
const { ch1, ch2 } = require("./c1");
const { ch3, ch4 } = require("./c3");
const { ch5, ch6 } = require("./c5");
const { ch7, ch8, ch9, ch10, refs } = require("./c7");

function content() {
  return {
    front: [...c0.certificate(), ...c0.declaration(), ...c0.acknowledgement(), ...c0.abstract(), ...c0.index(), ...c0.abbreviations()],
    main: [...ch1(), ...ch2(), ...ch3(), ...ch4(), ...ch5(), ...ch6(), ...ch7(), ...ch8(), ...ch9(), ...ch10(), ...refs()],
  };
}

// pass 1 registers figure/table numbers; pass 2 resolves {ref:...}
L.resetPass(1); content();
L.resetPass(2); const { front, main } = content();

const black = "000000";
const rule = { style: BorderStyle.SINGLE, size: 8, color: black, space: 4 };
const styles = {
  default: { document: { run: { font: FONT, size: 24, color: black }, paragraph: { spacing: { line: 360, after: 120 } } } },
  paragraphStyles: [
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: FONT, size: 36, bold: true, color: black }, paragraph: { spacing: { before: 0, after: 300, line: 300 }, keepNext: true, outlineLevel: 0, border: { bottom: rule }, alignment: AlignmentType.LEFT } },
    { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: FONT, size: 28, bold: true, color: black }, paragraph: { spacing: { before: 360, after: 140, line: 300 }, keepNext: true, outlineLevel: 1 } },
    { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { font: FONT, size: 24, bold: true, italics: true, color: black }, paragraph: { spacing: { before: 240, after: 100, line: 300 }, keepNext: true, outlineLevel: 2 } },
    { id: "FrontTitle", name: "Front Title", basedOn: "Normal", next: "Normal",
      run: { font: FONT, size: 36, bold: true, color: black }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 360, line: 300 }, border: { bottom: rule } } },
    { id: "FigCaption", name: "Fig Caption", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 22, bold: true }, paragraph: { alignment: AlignmentType.CENTER } },
    { id: "TabCaption", name: "Tab Caption", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 22, bold: true }, paragraph: { alignment: AlignmentType.CENTER } },
    { id: "TOC1", name: "toc 1", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 24, bold: true }, paragraph: { spacing: { before: 120, after: 40, line: 300 } } },
    { id: "TOC2", name: "toc 2", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 24 }, paragraph: { indent: { left: 360 }, spacing: { before: 0, after: 20, line: 300 } } },
    { id: "TOC3", name: "toc 3", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 22 }, paragraph: { spacing: { before: 0, after: 20, line: 288 } } },
  ],
};

const numbering = {
  config: [
    { reference: "bul", levels: [
      { level: 0, format: D.LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { font: FONT } } },
      { level: 1, format: D.LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } }, run: { font: FONT } } } ] },
    ...L.numConfigs(),
  ],
};

const pageA4 = { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440, header: 720, footer: 720 } };

const footer = () => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 },
  border: { top: { style: BorderStyle.SINGLE, size: 4, color: black, space: 6 } },
  children: [new TextRun({ children: ["Page ", PageNumber.CURRENT], font: FONT, size: 20 })] })] });
const header = () => new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: black, space: 4 } },
  children: [new TextRun({ text: "JustCmul8: Browser Based Discrete Event Simulator", font: FONT, size: 20, italics: true })] })] });

const cover = c0.cover();
const doc = new Document({
  creator: "Khushi Singh, Mohit Gupta", title: "JustCmul8: Project Report", description: "Browser Based Discrete Event Simulator, B.Sc. (IT) Semester V Project Report",
  styles, numbering,
  sections: [
    { properties: { page: { ...pageA4, borders: { pageBorders: { display: D.PageBorderDisplay.ALL_PAGES, offsetFrom: D.PageBorderOffsetFrom.PAGE },
        pageBorderTop: { style: BorderStyle.DOUBLE, size: 12, color: black, space: 24 }, pageBorderBottom: { style: BorderStyle.DOUBLE, size: 12, color: black, space: 24 },
        pageBorderLeft: { style: BorderStyle.DOUBLE, size: 12, color: black, space: 24 }, pageBorderRight: { style: BorderStyle.DOUBLE, size: 12, color: black, space: 24 } } } }, children: cover },
    { properties: { page: { ...pageA4, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } } }, footers: { default: footer() }, headers: { default: header() }, children: front },
    { properties: { page: { ...pageA4, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } }, footers: { default: footer() }, headers: { default: header() }, children: main },
  ],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync("JustCmul8_Project_Report_Final.docx", buf); console.log("written", buf.length); });
