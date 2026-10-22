import { readFileSync } from "node:fs";
import path from "node:path";
import PptxGenJS from "pptxgenjs";
import { strFromU8, strToU8 } from "fflate";

const SOURCE_SLIDE_WIDTH = 10_972_800;
const SOURCE_STRIP_WIDTH = 10_970_260;
const SOURCE_STRIP_HEIGHT = 129_540;
const SOURCE_LOGO_X = 9_759_600;
const SOURCE_LOGO_Y = 5_464_811;
const SOURCE_LOGO_WIDTH = 1_094_400;
const SOURCE_LOGO_HEIGHT = 575_309;
const INTERNAL_FOOTER_X = 593_090;
const INTERNAL_FOOTER_Y = 5_643_880;
const INTERNAL_FOOTER_WIDTH = 9_152_890;
const INTERNAL_FOOTER_HEIGHT = 107_950;
const COPYRIGHT_FOOTER_Y = 5_748_656;
const COPYRIGHT_FOOTER_HEIGHT = 215_900;
const SOURCE_STRIP_Y = 6_041_389;

const INTERNAL_FOOTER_TEXT = "Internal | Governed Enterprise Data";
const COPYRIGHT_FOOTER_TEXT =
  "© Bosch Global Software Technologies Company Limited 2022. All rights reserved, also regarding any disposal, exploitation, reproduction, editing, distribution, as well as in the event of applications for industrial property rights.";
const BOSCH_RED = "D70012";
const COPYRIGHT_GRAY = "B2B3B5";
const LOGO_MEDIA_PATH = "ppt/media/ledgerlm-bosch-logo.png";
const STRIP_MEDIA_PATH = "ppt/media/ledgerlm-bosch-footer-strip.png";
const LOGO_REL_TARGET = "../media/ledgerlm-bosch-logo.png";
const STRIP_REL_TARGET = "../media/ledgerlm-bosch-footer-strip.png";
const IMAGE_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

const assetDirectory = path.resolve(process.cwd(), "server/assets");
const logoBytes = new Uint8Array(readFileSync(path.join(assetDirectory, "bosch-logo.png")));
const stripBytes = new Uint8Array(readFileSync(path.join(assetDirectory, "bosch-footer-strip.png")));
const logoData = `data:image/png;base64,${Buffer.from(logoBytes).toString("base64")}`;
const stripData = `data:image/png;base64,${Buffer.from(stripBytes).toString("base64")}`;

type PptxInstance = InstanceType<typeof PptxGenJS>;
type PptxSlide = ReturnType<PptxInstance["addSlide"]>;
export type PptxTemplateFiles = Record<string, Uint8Array>;

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textBoxXml(
  id: number,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  color: string,
  bold: boolean,
) {
  const weight = bold ? ' b="1"' : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr userDrawn="1"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr marR="0" eaLnBrk="1" fontAlgn="auto" latinLnBrk="0" hangingPunct="1"/><a:r><a:rPr lang="en-US" sz="600"${weight}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Bosch Office Sans"/></a:rPr><a:t>${xmlEscape(text)}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

function pictureXml(id: number, name: string, relId: string, x: number, y: number, w: number, h: number, descr: string) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}" descr="${descr}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

function footerGeometry(slideWidth: number, slideHeight: number) {
  const scale = slideWidth / SOURCE_SLIDE_WIDTH;
  const stripHeight = Math.round(SOURCE_STRIP_HEIGHT * scale);
  const stripY = slideHeight - stripHeight;
  const logoWidth = Math.round(SOURCE_LOGO_WIDTH * scale);
  const logoHeight = Math.round(SOURCE_LOGO_HEIGHT * scale);
  const logoX = Math.round(SOURCE_LOGO_X * scale);
  const logoY = stripY - logoHeight;
  return {
    scale,
    strip: { x: 0, y: stripY, w: Math.round(SOURCE_STRIP_WIDTH * scale), h: stripHeight },
    logo: { x: logoX, y: logoY, w: logoWidth, h: logoHeight },
    internal: {
      x: Math.round(INTERNAL_FOOTER_X * scale),
      y: stripY - Math.round((SOURCE_STRIP_Y - INTERNAL_FOOTER_Y) * scale),
      w: Math.round(INTERNAL_FOOTER_WIDTH * scale),
      h: Math.round(INTERNAL_FOOTER_HEIGHT * scale),
    },
    copyright: {
      x: Math.round(INTERNAL_FOOTER_X * scale),
      y: stripY - Math.round((SOURCE_STRIP_Y - COPYRIGHT_FOOTER_Y) * scale),
      w: Math.round(INTERNAL_FOOTER_WIDTH * scale),
      h: Math.round(COPYRIGHT_FOOTER_HEIGHT * scale),
    },
  };
}

function bottomFooterBackgroundShapes(spTree: string, slideWidth: number, slideHeight: number) {
  const footerCandidates = Array.from(spTree.matchAll(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g))
    .map(([shape]) => {
      const x = shape.match(/<a:off\b[^>]*\bx="(-?\d+)"[^>]*\by="(-?\d+)"/);
      const size = shape.match(/<a:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/);
      const visibleText = Array.from(shape.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
        .map(([, text]) => text.replace(/&amp;/g, "&").trim())
        .join("")
        .trim();
      if (!x || !size || visibleText || !/<a:prstGeom\b[^>]*\bprst="rect"/.test(shape)) return null;
      const [, xValue, yValue] = x;
      const [, widthValue, heightValue] = size;
      const box = {
        shape,
        x: Number(xValue),
        y: Number(yValue),
        width: Number(widthValue),
        height: Number(heightValue),
      };
      if (
        box.y < slideHeight - 600_000 ||
        Math.abs(box.y + box.height - slideHeight) > 5_000 ||
        box.x < -5_000 ||
        box.x + box.width > slideWidth + 5_000
      ) return null;
      return box;
    })
    .filter((box): box is NonNullable<typeof box> => box !== null);

  const groups = new Map<string, typeof footerCandidates>();
  for (const candidate of footerCandidates) {
    if (!candidate) continue;
    const key = `${candidate.y}:${candidate.height}`;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  let footerShapes = new Set<string>();
  groups.forEach((group) => {
    if (group.length < 2) return;
    const ordered = [...group].sort((left, right) => left.x - right.x);
    let coveredUntil = 0;
    let isContinuous = ordered[0].x <= 5_000;
    for (const part of ordered) {
      if (part.x > coveredUntil + 5_000) isContinuous = false;
      coveredUntil = Math.max(coveredUntil, part.x + part.width);
    }
    if (isContinuous && coveredUntil >= slideWidth - 5_000) {
      ordered.forEach(({ shape }) => footerShapes.add(shape));
    }
  });
  return footerShapes;
}

function removeOldFooterShapes(spTree: string, slideWidth: number, slideHeight: number) {
  const backgroundShapes = bottomFooterBackgroundShapes(spTree, slideWidth, slideHeight);
  return spTree.replace(/<p:(?:sp|pic)\b[^>]*>[\s\S]*?<\/p:(?:sp|pic)>/g, (shape) => {
    const name = shape.match(/<p:cNvPr\b[^>]*\bname="([^"]+)"/)?.[1] ?? "";
    const visibleText = Array.from(shape.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
      .map(([, text]) => text.replace(/&amp;/g, "&").trim())
      .join("")
      .trim();
    const oldKpiFooter = visibleText === "Internal | Governed Enterprise Data | KPI Metrics Board";
    return name.startsWith("Bosch Footer") ||
      visibleText.toUpperCase() === "BOSCH" ||
      oldKpiFooter ||
      backgroundShapes.has(shape)
      ? ""
      : shape;
  });
}

function repositionKpiSlideLabel(spTree: string, slideWidth: number, logoY: number, scale: number) {
  const labelX = Math.round(INTERNAL_FOOTER_X * scale);
  const labelWidth = Math.round(2_600_000 * scale);
  const labelHeight = Math.round(118_872 * scale);
  return spTree.replace(/<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g, (shape) => {
    const text = Array.from(shape.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
      .map(([, value]) => value)
      .join("");
    if (!/Slide\s+\d+\s+of\s+\d+/i.test(text)) return shape;
    return shape
      .replace(/<a:off\b[^>]*\/>/, `<a:off x="${labelX}" y="${logoY}"/>`)
      .replace(/<a:ext\b[^>]*\/>/, `<a:ext cx="${labelWidth}" cy="${labelHeight}"/>`);
  });
}

/**
 * Insert the exact Bosch logo and multicolor strip from the Entity P&L template,
 * plus its two footer text lines. Existing footer-only objects are replaced.
 */
export function addBoschFooterToSlideXml(
  xml: string,
  slideWidth: number,
  slideHeight: number,
  logoRelId: string,
  stripRelId: string,
) {
  const spTreeMatch = xml.match(/<p:spTree\b[\s\S]*?<\/p:spTree>/);
  if (!spTreeMatch) throw new Error("PowerPoint slide is missing its shape tree");

  const geometry = footerGeometry(slideWidth, slideHeight);
  let spTree = removeOldFooterShapes(spTreeMatch[0], slideWidth, slideHeight);
  spTree = repositionKpiSlideLabel(spTree, slideWidth, geometry.logo.y, geometry.scale);

  const existingIds = Array.from(spTree.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g))
    .map(([, id]) => Number(id));
  let nextId = Math.max(0, ...existingIds) + 1;
  const added = [
    pictureXml(
      nextId++, "Bosch Footer Logo", logoRelId,
      geometry.logo.x, geometry.logo.y, geometry.logo.w, geometry.logo.h,
      "Bosch logo",
    ),
    textBoxXml(
      nextId++, "Bosch Footer Internal", geometry.internal.x, geometry.internal.y,
      geometry.internal.w, geometry.internal.h, INTERNAL_FOOTER_TEXT, BOSCH_RED, true,
    ),
    textBoxXml(
      nextId++, "Bosch Footer Copyright", geometry.copyright.x, geometry.copyright.y,
      geometry.copyright.w, geometry.copyright.h, COPYRIGHT_FOOTER_TEXT, COPYRIGHT_GRAY, false,
    ),
    pictureXml(
      nextId++, "Bosch Footer Strip", stripRelId,
      geometry.strip.x, geometry.strip.y, geometry.strip.w, geometry.strip.h,
      "Bosch multicolor footer strip",
    ),
  ];
  spTree = spTree.replace("</p:spTree>", `${added.join("")}</p:spTree>`);
  return xml.replace(spTreeMatch[0], spTree);
}

function nextRelationshipId(relsXml: string) {
  const ids = Array.from(relsXml.matchAll(/\bId="rId(\d+)"/g), ([, id]) => Number(id));
  return Math.max(0, ...ids) + 1;
}

function ensureImageRelationship(relsXml: string, target: string) {
  const existing = Array.from(relsXml.matchAll(/<Relationship\b[^>]*\/>/g))
    .find(([relationship]) => relationship.includes(`Target="${target}"`));
  if (existing) return { relsXml, id: existing[0].match(/\bId="([^"]+)"/)?.[1] ?? "" };

  const id = `rId${nextRelationshipId(relsXml)}`;
  const relation = `<Relationship Id="${id}" Type="${IMAGE_REL_TYPE}" Target="${target}"/>`;
  if (!relsXml.includes("</Relationships>")) throw new Error("PowerPoint slide relationships part is invalid");
  return { relsXml: relsXml.replace("</Relationships>", `${relation}</Relationships>`), id };
}

function ensurePngContentType(files: PptxTemplateFiles) {
  const pathName = "[Content_Types].xml";
  const xml = files[pathName] ? strFromU8(files[pathName]) : "";
  if (!xml) throw new Error("PowerPoint package is missing content types");
  if (/<Default\b[^>]*\bExtension="png"/i.test(xml)) return;
  files[pathName] = strToU8(xml.replace(
    "</Types>",
    '<Default Extension="png" ContentType="image/png"/></Types>',
  ));
}

export function addBoschFooterToTemplateSlide(
  files: PptxTemplateFiles,
  slideName: string,
  slideWidth: number,
  slideHeight: number,
) {
  const slideNumber = slideName.match(/slide(\d+)\.xml$/i)?.[1];
  if (!slideNumber || !files[slideName]) throw new Error(`Invalid PowerPoint slide part: ${slideName}`);
  files[LOGO_MEDIA_PATH] = logoBytes;
  files[STRIP_MEDIA_PATH] = stripBytes;
  ensurePngContentType(files);

  const relPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
  let relsXml = files[relPath]
    ? strFromU8(files[relPath])
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const logoRel = ensureImageRelationship(relsXml, LOGO_REL_TARGET);
  relsXml = logoRel.relsXml;
  const stripRel = ensureImageRelationship(relsXml, STRIP_REL_TARGET);
  files[relPath] = strToU8(stripRel.relsXml);
  files[slideName] = strToU8(
    addBoschFooterToSlideXml(strFromU8(files[slideName]), slideWidth, slideHeight, logoRel.id, stripRel.id),
  );
}

export function addBoschFooterToGeneratedSlide(
  pptx: PptxInstance,
  slide: PptxSlide,
  slideWidth = 13.333,
  slideHeight = 7.5,
) {
  const widthEmu = Math.round(slideWidth * 914_400);
  const heightEmu = Math.round(slideHeight * 914_400);
  const geometry = footerGeometry(widthEmu, heightEmu);
  const toInches = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => ({
    x: x / 914_400,
    y: y / 914_400,
    w: w / 914_400,
    h: h / 914_400,
  });
  slide.addImage({ data: logoData, ...toInches(geometry.logo) });
  slide.addText(INTERNAL_FOOTER_TEXT, {
    ...toInches(geometry.internal),
    fontFace: "Bosch Office Sans",
    fontSize: 6,
    bold: true,
    color: BOSCH_RED,
    margin: 0,
    breakLine: false,
    fit: "shrink",
  });
  slide.addText(COPYRIGHT_FOOTER_TEXT, {
    ...toInches(geometry.copyright),
    fontFace: "Bosch Office Sans",
    fontSize: 6,
    color: COPYRIGHT_GRAY,
    margin: 0,
    breakLine: false,
    fit: "shrink",
  });
  slide.addImage({ data: stripData, ...toInches(geometry.strip) });
}

export function slideSizeFromPresentationXml(xml: string) {
  const size = xml.match(/<p:sldSz\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/);
  return size
    ? { width: Number(size[1]), height: Number(size[2]) }
    : { width: Math.round(13.333 * 914_400), height: Math.round(7.5 * 914_400) };
}
