import { strToU8, zipSync } from "fflate";
import { formatMonthLabel, parseDateKey } from "../jira/dates";
import type { WorklogEntry } from "../jira/types";

/**
 * Месячный отчёт в формате «рыбы» (Отчет сентябрь.xlsx):
 * ФИО | Вых/раб | Дата | Кол-во часов | Номера задач, описание (E:G объединены).
 * Выходные подсвечены светло-зелёным, как в шаблоне.
 */
export type MonthReportInput = {
  fullName: string;
  keys: string[];
  days: Record<string, WorklogEntry[]>;
};

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// Индексы cellXfs в styles.xml
const S_HEADER = 1;
const S_TEXT = 2;
const S_DATE = 3;
const S_HOURS = 4;
const S_DESC = 5;
const WEEKEND_OFFSET = 4; // 6..9 — те же стили с заливкой
const S_TOTAL_LABEL = 10;
const S_TOTAL_HOURS = 11;

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // управляющие символы запрещены в XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function excelSerial(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

function isWeekend(dateKey: string): boolean {
  const day = parseDateKey(dateKey).getDay();
  return day === 0 || day === 6;
}

/** Строки описания: по одной на задачу, комментарии через «; », без дублей. */
export function describeDay(entries: WorklogEntry[]): string {
  const byIssue = new Map<string, { summary: string; notes: string[] }>();
  for (const entry of entries) {
    const item = byIssue.get(entry.issueKey) ?? { summary: entry.summary, notes: [] };
    const note = entry.comment.trim();
    if (note && !item.notes.includes(note)) item.notes.push(note);
    byIssue.set(entry.issueKey, item);
  }
  return [...byIssue.entries()]
    .map(([key, { summary, notes }]) =>
      `${key} ${summary}${notes.length ? ` — ${notes.join("; ")}` : ""}`.trim(),
    )
    .join("\n");
}

function hoursOf(entries: WorklogEntry[]): number {
  const seconds = entries.reduce((sum, e) => sum + e.timeSpentSeconds, 0);
  return Math.round((seconds / 3600) * 100) / 100;
}

function str(ref: string, style: number, value: string): string {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function num(ref: string, style: number, value: number | null): string {
  return value === null
    ? `<c r="${ref}" s="${style}"/>`
    : `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

function sheetXml(input: MonthReportInput): string {
  const rows: string[] = [];
  rows.push(
    `<row r="1">${[
      str("A1", S_HEADER, "ФИО"),
      str("B1", S_HEADER, "Вых/раб"),
      str("C1", S_HEADER, "Дата"),
      str("D1", S_HEADER, "Кол-во часов"),
      str("E1", S_HEADER, "Номера задач, описание"),
      num("F1", S_HEADER, null),
      num("G1", S_HEADER, null),
    ].join("")}</row>`,
  );

  const merges = ["E1:G1"];
  input.keys.forEach((key, i) => {
    const r = i + 2;
    const entries = input.days[key] || [];
    const weekend = isWeekend(key);
    const off = weekend ? WEEKEND_OFFSET : 0;
    const hours = hoursOf(entries);
    const desc = describeDay(entries);
    const lines = desc ? desc.split("\n").length : 1;
    const height = lines > 1 ? ` ht="${lines * 15}" customHeight="1"` : "";
    rows.push(
      `<row r="${r}"${height}>${[
        str(`A${r}`, S_TEXT + off, input.fullName),
        str(`B${r}`, S_TEXT + off, weekend ? "Вых" : "Раб"),
        num(`C${r}`, S_DATE + off, excelSerial(key)),
        num(`D${r}`, S_HOURS + off, hours || null),
        desc ? str(`E${r}`, S_DESC + off, desc) : num(`E${r}`, S_DESC + off, null),
        num(`F${r}`, S_DESC + off, null),
        num(`G${r}`, S_DESC + off, null),
      ].join("")}</row>`,
    );
    merges.push(`E${r}:G${r}`);
  });

  const last = input.keys.length + 1;
  const totalRow = last + 1;
  const total = input.keys.reduce((sum, key) => sum + hoursOf(input.days[key] || []), 0);
  rows.push(
    `<row r="${totalRow}">${[
      str(`C${totalRow}`, S_TOTAL_LABEL, "Итого"),
      `<c r="D${totalRow}" s="${S_TOTAL_HOURS}"><f>SUM(D2:D${last})</f><v>${Math.round(total * 100) / 100}</v></c>`,
    ].join("")}</row>`,
  );

  return (
    XML_HEAD +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    "<cols>" +
    '<col min="1" max="1" width="32" customWidth="1"/>' +
    '<col min="2" max="2" width="9.71" customWidth="1"/>' +
    '<col min="3" max="3" width="14.71" customWidth="1"/>' +
    '<col min="4" max="4" width="14" customWidth="1"/>' +
    '<col min="5" max="6" width="9.14" customWidth="1"/>' +
    '<col min="7" max="7" width="79.57" customWidth="1"/>' +
    "</cols>" +
    `<sheetData>${rows.join("")}</sheetData>` +
    `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    "</worksheet>"
  );
}

const STYLES_XML =
  XML_HEAD +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/></numFmts>' +
  '<fonts count="2">' +
  '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>' +
  '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>' +
  "</fonts>" +
  '<fills count="3">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/><bgColor indexed="64"/></patternFill></fill>' +
  "</fills>" +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="12">' +
  // 0 default
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  // 1 header
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  // 2..5 рабочие дни
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>' +
  '<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  // 6..9 выходные
  '<xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
  '<xf numFmtId="164" fontId="0" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>' +
  '<xf numFmtId="2" fontId="0" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  // 10..11 итог
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="2" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

const CONTENT_TYPES_XML =
  XML_HEAD +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  "</Types>";

const ROOT_RELS_XML =
  XML_HEAD +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  "</Relationships>";

const WORKBOOK_RELS_XML =
  XML_HEAD +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  "</Relationships>";

function workbookXml(sheetName: string): string {
  return (
    XML_HEAD +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    "</workbook>"
  );
}

export function buildMonthReportXlsx(input: MonthReportInput): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8(CONTENT_TYPES_XML),
    "_rels/.rels": strToU8(ROOT_RELS_XML),
    "xl/workbook.xml": strToU8(workbookXml("Лист1")),
    "xl/_rels/workbook.xml.rels": strToU8(WORKBOOK_RELS_XML),
    "xl/styles.xml": strToU8(STYLES_XML),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml(input)),
  });
}

/** «Отчет сентябрь 2026.xlsx» */
export function monthReportFileName(firstKey: string): string {
  const [month, year] = formatMonthLabel(parseDateKey(firstKey)).split(" ");
  return `Отчет ${month} ${year}.xlsx`;
}

export function downloadMonthReport(input: MonthReportInput): void {
  const bytes = buildMonthReportXlsx(input);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = monthReportFileName(input.keys[0]);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
