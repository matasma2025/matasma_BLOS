import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { XMLValidator } from "fast-xml-parser";
import path from "node:path";
import type { EntityPnlExportPayload } from "./entityPnlExportService";

const TEXT = /<a:t\b[^>]*>[\s\S]*?<\/a:t>/g;
const MONEY = new Set(["Revenue", "Employee Benefits", "Outsourcing Cost", "Consultancy Charges",
  "CI Charges & Other Revenue", "Facilities Cost", "Other Expenses", "Total Expenses", "EBIT"]);
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
function textOf(xml: string) {
  return (xml.match(TEXT) ?? []).map((part) => part.replace(/<[^>]+>/g, "")).join("")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
}
function setText(xml: string, value: string) {
  let first = true;
  return xml.replace(TEXT, () => {
    const text = first ? escape(value) : "";
    first = false;
    return `<a:t>${text}</a:t>`;
  });
}

function setTitleText(xml: string, value: string) {
  if ((xml.match(TEXT) ?? []).length < 2) return setText(xml, value);
  const [period, ...comparison] = value.split(" – ");
  let index = 0;
  return xml.replace(TEXT, () => `<a:t>${escape(index++ === 0 ? period : index === 2 ? ` – ${comparison.join(" – ")}` : "")}</a:t>`);
}
function canonicalKey(text: string) {
  const key = text.toLowerCase().replace(/%/g, "percent").replace(/[^a-z0-9]/g, "");
  return ({
    ebitpercentoftns: "ebitpercent",
    consultancycost: "consultancycharges",
    avgcapacityoverall: "avgcapacityonroll",
  } as Record<string, string>)[key] ?? key;
}

function displayValue(label: string, value: number | null | undefined, variance = false, referenceStyle = false) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (label === "EBIT%") return `${value.toFixed(variance && referenceStyle ? 2 : 1)}${variance ? " pp" : "%"}`;
  const scaled = MONEY.has(label) ? value / 1_000_000 : value;
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: referenceStyle ? 0 : 1 })
    .format(referenceStyle ? Math.abs(scaled) : scaled);
  return referenceStyle && scaled < 0 ? `(${formatted})` : formatted;
}

type TemplateFiles = Record<string, Uint8Array>;

/** The combined template marks its layouts explicitly; legacy templates are untouched. */
function selectComparisonLayout(files: TemplateFiles, comparison: EntityPnlExportPayload["comparison"]) {
  const layouts = Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .map((name) => ({ name, mode: strFromU8(files[name]).match(/\bname="EntityPnLLayout:(qoq|yoy)"/)?.[1] }))
    .filter((slide) => slide.mode);
  if (!layouts.length) return false;
  const matches = layouts.filter((slide) => slide.mode === comparison);
  if (matches.length !== 1) throw new Error(`Entity P&L template requires exactly one ${comparison.toUpperCase()} layout.`);
  const selectedName = matches[0].name;
  const selectedRelsName = selectedName.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels";
  const selectedSlide = files[selectedName];
  const selectedRels = files[selectedRelsName];
  const relsName = "ppt/_rels/presentation.xml.rels";
  const rels = files[relsName] && strFromU8(files[relsName]);
  const relationships = rels?.match(/<Relationship\b[^>]*\/>/g) ?? [];
  const slideRelationships = relationships.filter((rel) => /\/relationships\/slide"/.test(rel));
  const selectedRelationship = slideRelationships.find((rel) => {
    const target = rel.match(/\bTarget="([^"]+)"/)?.[1];
    return target && path.posix.normalize(path.posix.join("ppt", target)) === selectedName;
  });
  const relationshipId = selectedRelationship?.match(/\bId="([^"]+)"/)?.[1];
  const presentationName = "ppt/presentation.xml";
  const presentation = files[presentationName] && strFromU8(files[presentationName]);
  const selectedId = presentation?.match(/<p:sldId\b[^>]*\/>/g)?.find((id) => id.includes(`r:id="${relationshipId}"`));
  if (!rels || !presentation || !selectedRelationship || !relationshipId || !selectedId) {
    throw new Error("Entity P&L template layout has no valid presentation relationship.");
  }
  for (const name of Object.keys(files)) {
    if (/^ppt\/slides\/(?:_rels\/)?slide\d+\.xml(?:\.rels)?$/.test(name)
      || /^ppt\/notesSlides\//.test(name)) delete files[name];
  }
  files["ppt/slides/slide1.xml"] = selectedSlide;
  if (selectedRels) {
    files["ppt/slides/_rels/slide1.xml.rels"] = strToU8(strFromU8(selectedRels)
      .replace(/<Relationship\b[^>]*Type="[^"]*\/notesSlide"[^>]*\/>/g, ""));
  }
  files[relsName] = strToU8(rels.replace(/<Relationship\b[^>]*\/>/g, (rel) => {
    if (!slideRelationships.includes(rel)) return rel;
    return rel === selectedRelationship ? rel.replace(/\bTarget="[^"]+"/, 'Target="slides/slide1.xml"') : "";
  }));
  files[presentationName] = strToU8(presentation.replace(
    /<p:sldIdLst\b[^>]*>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${selectedId}</p:sldIdLst>`,
  ));
  const typesName = "[Content_Types].xml";
  files[typesName] = strToU8(strFromU8(files[typesName]).replace(/<Override\b[^>]*\/>/g, (override) => {
    const part = override.match(/\bPartName="([^"]+)"/)?.[1] ?? "";
    if (/^\/ppt\/notesSlides\//.test(part)) return "";
    if (!/^\/ppt\/slides\/slide\d+\.xml$/.test(part)) return override;
    return part === `/${selectedName}` ? override.replace(part, "/ppt/slides/slide1.xml") : "";
  }));
  if (files["docProps/app.xml"]) {
    files["docProps/app.xml"] = strToU8(strFromU8(files["docProps/app.xml"]).replace(/<Slides>\d+<\/Slides>/, "<Slides>1</Slides>"));
  }
  return true;
}

function referencePeriod(label: string) {
  const quarter = label.match(/^Q([1-4]) (\d{4})$/);
  if (quarter) return `${["Mar", "Jun", "Sep", "Dec"][Number(quarter[1]) - 1]}'${quarter[2].slice(-2)}`;
  const ytd = label.match(/^([A-Za-z]+) (\d{4}) YTD$/);
  if (!ytd) return label;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    .indexOf(ytd[1].slice(0, 3));
  return month < 0 ? label : `YTD${String(month + 1).padStart(2, "0")}'${ytd[2].slice(-2)}`;
}

function referenceTitle(payload: EntityPnlExportPayload) {
  const [year, month] = payload.asOf.split("-").map(Number);
  const shortYear = String(year).slice(-2);
  const period = payload.comparison === "qoq" ? `Q${Math.ceil(month / 3)}'${shortYear}`
    : month === 6 ? `H1'${shortYear}` : month === 12 ? `FY'${shortYear}` : `YTD${String(month).padStart(2, "0")}'${shortYear}`;
  return `P&L ${period} – ${payload.comparison === "qoq" ? "QoQ" : "YoY"} : ${referencePeriod(payload.currentLabel)} v ${referencePeriod(payload.comparisonLabel)}`;
}

/** Repair the generator's ID collision, then check XML and internal package targets. */
export function validateAndNormalizePptx(bytes: Buffer): Buffer {
  const files = unzipSync(new Uint8Array(bytes));
  for (const name of Object.keys(files)) {
    if (!name.endsWith(".xml") && !name.endsWith(".rels")) continue;
    let xml = strFromU8(files[name]);
    if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) {
      const tags = xml.match(/<p:cNvPr\b[^>]*>/g) ?? [];
      let nextId = Math.max(0, ...tags.map((tag) => Number(tag.match(/\bid="(\d+)"/)?.[1] ?? 0)));
      const seen = new Set<string>();
      xml = xml.replace(/<p:cNvPr\b[^>]*>/g, (tag) => {
        const id = tag.match(/\bid="(\d+)"/)?.[1];
        if (!id) throw new Error(`Missing slide-object ID: ${name}`);
        if (seen.has(id)) return tag.replace(/\bid="\d+"/, `id="${++nextId}"`);
        seen.add(id);
        return tag;
      });
      files[name] = strToU8(xml);
    }
    if (XMLValidator.validate(xml) !== true) throw new Error(`Invalid PowerPoint XML: ${name}`);
    for (const graphic of xml.match(/<a:graphicData\b[^>]*>[\s\S]*?<\/a:graphicData>/g) ?? []) {
      if (/<a:tbl\b/.test(graphic) && !/\buri="http:\/\/schemas\.openxmlformats\.org\/drawingml\/2006\/table"/.test(graphic)) {
        throw new Error(`Invalid PowerPoint table graphic URI: ${name}`);
      }
    }
    if (name.endsWith(".rels")) {
      const base = name === "_rels/.rels" ? "" : path.posix.dirname(path.posix.dirname(name));
      for (const relationship of xml.match(/<Relationship\b[^>]*\/>/g) ?? []) {
        if (/TargetMode="External"/.test(relationship)) continue;
        const target = relationship.match(/\bTarget="([^"]+)"/)?.[1];
        if (!target) throw new Error(`Missing PowerPoint relationship target: ${name}`);
        const resolved = target.startsWith("/") ? target.slice(1) : path.posix.normalize(path.posix.join(base, target));
        if (!files[resolved]) throw new Error(`Missing PowerPoint package part: ${resolved}`);
      }
    }
  }
  return Buffer.from(zipSync(files));
}

/** Populate the supplied seven-column Entity P&L template without rebuilding its layout. */
export function renderEntityPnlTemplate(base64: string, payload: EntityPnlExportPayload): Buffer {
  const files = unzipSync(new Uint8Array(Buffer.from(base64, "base64")));
  const referenceStyle = selectComparisonLayout(files, payload.comparison);
  const metrics = new Map(payload.lines.map((line) => [canonicalKey(line.label), line]));
  // Old saved reports called the combined average "Overall". Convert that
  // legacy value to the reference's on-roll measure without altering the report.
  const legacyAverage = payload.lines.find((line) => line.label === "Avg Capacity Overall");
  if (legacyAverage) {
    if (referenceStyle && payload.comparison === "qoq") {
      throw new Error("Regenerate this saved Entity P&L report to calculate quarter capacity averages before exporting the QoQ layout.");
    }
    const outsourcing = payload.lines.find((line) => line.label === "Avg Capacity Outsourcing");
    const values = Object.fromEntries(payload.columns.map((column) => {
      const total = legacyAverage.values[column];
      const external = outsourcing?.values[column];
      return [column, total == null || external == null ? null : total - external];
    }));
    const actual = values[payload.currentLabel];
    const prior = values[payload.comparisonLabel];
    const variance = actual == null || prior == null ? null : actual - prior;
    metrics.set("avgcapacityonroll", {
      label: "Avg Capacity On-roll", values, variance,
      variancePercent: variance == null || prior == null || prior === 0 ? null : variance / Math.abs(prior) * 100,
    });
  }
  // The template uses "EBIT% of TNS" whereas the governed metric is named "EBIT%".
  const yearEnd = payload.yearEndLabel ?? payload.columns[payload.columns.length - 1];
  const forecast = payload.forecastLabel ?? payload.columns.find((column) =>
    column !== payload.currentLabel && column !== payload.comparisonLabel && column !== yearEnd);
  const period = payload.currentLabel;
  const forecastHeader = forecast
    ? forecast.endsWith(" YTD") ? `${forecast.slice(0, -4)} · ${period}` : forecast
    : "Forecast —";
  const headers = referenceStyle
    ? [payload.entity, `YE ${yearEnd.match(/\d{4}/)?.[0] ?? yearEnd}`,
      forecast ? forecastHeader.replace(" · ", "\n").replace(/ (Q[1-4] \d{4})$/, "\n$1") : "Forecast —",
      referencePeriod(period), referencePeriod(payload.comparisonLabel), "Variance", "%"]
    : [payload.entity, `${yearEnd} Actual`, forecastHeader,
      `${period} Actual`, `${payload.comparisonLabel} Actual`, "Variance", "Variance %"];
  const columnKeys = [yearEnd, forecast, payload.currentLabel, payload.comparisonLabel];
  let populatedTables = 0;
  for (const name of Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))) {
    let xml = strFromU8(files[name]);
    let populatedThisSlide = false;
    xml = xml.replace(/<a:tbl\b[^>]*>[\s\S]*?<\/a:tbl>/g, (table) => {
      const rows = table.match(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g) ?? [];
      if (!rows.some((row) => textOf(row).includes("Employee Benefits"))) return table;
      let rowIndex = 0;
      const seen = new Set<string>();
      const updated = table.replace(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g, (row) => {
        const cells = row.match(/<a:tc\b[^>]*>[\s\S]*?<\/a:tc>/g) ?? [];
        if (cells.length !== 7) throw new Error("Entity P&L template must have seven table columns.");
        let values: string[];
        const isHeader = rowIndex++ === 0;
        if (isHeader) values = headers;
        else if (!textOf(cells[0]) && cells.every((cell) => !textOf(cell))) return row;
        else {
          const key = canonicalKey(textOf(cells[0]));
          const line = metrics.get(key);
          if (!line) throw new Error(`Unsupported Entity P&L template row: ${textOf(cells[0])}`);
          seen.add(key);
          values = [line.label === "EBIT%" && referenceStyle ? "EBIT% of TNS" : line.label,
            ...columnKeys.map((column) => displayValue(line.label, column ? line.values[column] : null, false, referenceStyle)),
            displayValue(line.label, line.variance, true, referenceStyle),
            line.label === "EBIT%" || line.variancePercent == null ? "—" : `${line.variancePercent.toFixed(referenceStyle ? 0 : 1).replace(/^-0$/, "0")}%`];
        }
        let cellIndex = 0;
        let updatedRow = row.replace(/<a:tc\b[^>]*>[\s\S]*?<\/a:tc>/g, (cell) => {
          const updatedCell = setText(cell, values[cellIndex++]);
          return isHeader && !referenceStyle ? updatedCell.replace(/\bsz="\d+"/g, 'sz="600"') : updatedCell;
        });
        if (isHeader && !referenceStyle) updatedRow = updatedRow.replace(/(<a:tr\b[^>]*\bh=")\d+"/, '$1365760"');
        return updatedRow;
      });
      if (payload.lines.some((line) => !seen.has(canonicalKey(line.label)))) throw new Error("Entity P&L template is missing required metric rows.");
      populatedTables++;
      populatedThisSlide = true;
      return updated;
    });
    if (!populatedThisSlide) continue;
    let narrativeMetric: EntityPnlExportPayload["lines"][number] | undefined;
    xml = xml.replace(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g, (shape) => {
      const text = textOf(shape);
      if (!text) return shape;
      let replacement: string | undefined;
      if (/^P&L\b/.test(text)) replacement = referenceStyle ? referenceTitle(payload) : `P&L ${period} – ${payload.comparison.toUpperCase()} vs ${payload.comparisonLabel}`;
      else if (text.includes("{{entity}}")) replacement = `Entity P&L Analysis · ${payload.entity}`;
      else if (/^Values in/.test(text)) replacement = `Values in m${payload.currency} · ${referenceStyle ? payload.comparison === "qoq" ? "QoQ" : "YoY" : payload.comparison.toUpperCase()}`;
      else if (text.includes("{{as_of_month}}")) replacement = period;
      else if (text.includes("{{currency}}")) replacement = `m${payload.currency}`;
      else if (text.includes("{{evidence_note}}")) replacement = referenceStyle
        ? `${payload.comparison === "qoq" ? "Quarter financials and capacity averages" : "YTD financials and capacity averages"}; end capacity is point-in-time. YE averages are full-year. Unavailable values: —.`
        : [...payload.warnings, ...payload.evidence].slice(0, 2).join(" · ");
      else if (/^Source:/.test(text)) replacement = "Source: Enterprise cube. Monetary values in millions; capacity unscaled. Variance: current Actual − comparison Actual.";
      else if (/^Revenue: Driven/.test(text)) replacement = "Period comparison · governed figures";
      else {
        const metric = metrics.get(canonicalKey(text));
        if (metric) narrativeMetric = metric;
        else if (narrativeMetric) {
          const line = narrativeMetric;
          replacement = line.variance == null ? "Comparison unavailable: required source snapshots are missing."
            : `Movement vs ${payload.comparisonLabel}: ${displayValue(line.label, line.variance, false, referenceStyle)}${MONEY.has(line.label) ? ` m${payload.currency}` : ""}. Business causes require owner commentary.`;
          narrativeMetric = undefined;
        }
      }
      return replacement === undefined ? shape
        : referenceStyle && /^P&L\b/.test(text) ? setTitleText(shape, replacement) : setText(shape, replacement);
    });
    if (/\{\{[^}]+\}\}/.test(xml)) throw new Error("Entity P&L template contains unsupported placeholders.");
    files[name] = strToU8(xml);
  }
  if (!populatedTables) throw new Error("Uploaded template does not contain a supported Entity P&L table.");
  return validateAndNormalizePptx(Buffer.from(zipSync(files)));
}
