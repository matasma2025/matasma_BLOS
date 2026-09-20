const MAX_PPTX_BYTES = 10 * 1024 * 1024;
const MAX_XML_BYTES = 1_000_000;
const MAX_SLIDES = 20;
const MAX_TEMPLATE_CHARS = 5_000;
const MAIN_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';

type ZipEntry = {
  name: string;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

function u16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)
  ) >>> 0;
}

function signature(bytes: Uint8Array, offset: number) {
  return u32(bytes, offset);
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const minimumSize = 22;
  const start = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - minimumSize; offset >= start; offset -= 1) {
    if (signature(bytes, offset) === 0x06054b50) return offset;
  }
  throw new Error('This PowerPoint file is missing its ZIP directory.');
}

function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const end = findEndOfCentralDirectory(bytes);
  const totalEntries = u16(bytes, end + 10);
  const directorySize = u32(bytes, end + 12);
  const directoryOffset = u32(bytes, end + 16);
  if (directoryOffset + directorySize > bytes.length) {
    throw new Error('This PowerPoint file has an invalid ZIP directory.');
  }

  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let offset = directoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (signature(bytes, offset) !== 0x02014b50 || offset + 46 > bytes.length) {
      throw new Error('This PowerPoint file contains an invalid ZIP entry.');
    }
    const nameLength = u16(bytes, offset + 28);
    const extraLength = u16(bytes, offset + 30);
    const commentLength = u16(bytes, offset + 32);
    const endOfEntry = offset + 46 + nameLength + extraLength + commentLength;
    if (endOfEntry > bytes.length) {
      throw new Error('This PowerPoint file contains a truncated ZIP entry.');
    }
    entries.push({
      name: decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength)),
      compression: u16(bytes, offset + 10),
      compressedSize: u32(bytes, offset + 20),
      uncompressedSize: u32(bytes, offset + 24),
      localHeaderOffset: u32(bytes, offset + 42),
    });
    offset = endOfEntry;
  }
  return entries;
}

async function readZipEntry(bytes: Uint8Array, entry: ZipEntry) {
  const localOffset = entry.localHeaderOffset;
  if (signature(bytes, localOffset) !== 0x04034b50 || localOffset + 30 > bytes.length) {
    throw new Error('This PowerPoint file contains an invalid local ZIP entry.');
  }
  const nameLength = u16(bytes, localOffset + 26);
  const extraLength = u16(bytes, localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > bytes.length || entry.uncompressedSize > MAX_XML_BYTES) {
    throw new Error('This PowerPoint slide is too large to import.');
  }
  const compressed = bytes.slice(dataStart, dataEnd);
  if (entry.compression === 0) return compressed;
  if (entry.compression !== 8) {
    throw new Error('This PowerPoint uses an unsupported compression format.');
  }
  const DecompressionStreamConstructor = (globalThis as typeof globalThis & {
    DecompressionStream?: new (format: 'deflate-raw') => DecompressionStream;
  }).DecompressionStream;
  if (!DecompressionStreamConstructor) {
    throw new Error('This browser cannot decompress PowerPoint templates.');
  }
  const stream = new Blob([compressed]).stream().pipeThrough(
    new DecompressionStreamConstructor('deflate-raw'),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function slideText(xmlBytes: Uint8Array) {
  const xml = new TextDecoder().decode(xmlBytes);
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('A PowerPoint slide could not be read.');
  }
  const paragraphs = Array.from(document.getElementsByTagNameNS(MAIN_NS, 'p'));
  return paragraphs
    .map((paragraph) => Array.from(paragraph.getElementsByTagNameNS(MAIN_NS, 't'))
      .map((node) => node.textContent ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean);
}

function slideNumber(name: string) {
  const match = name.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export async function extractPptxReportTemplate(file: File) {
  if (file.size > MAX_PPTX_BYTES) {
    throw new Error('PowerPoint templates must be 10 MB or smaller.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = readZipEntries(bytes)
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
    .sort((left, right) => slideNumber(left.name) - slideNumber(right.name));
  if (!entries.length) {
    throw new Error('The PowerPoint file does not contain any readable slides.');
  }
  if (entries.length > MAX_SLIDES) {
    throw new Error(`PowerPoint templates may contain at most ${MAX_SLIDES} slides.`);
  }

  const slides: string[] = [];
  for (const [index, entry] of entries.entries()) {
    const paragraphs = slideText(await readZipEntry(bytes, entry));
    if (paragraphs.length) {
      slides.push(`## Slide ${index + 1}\n${paragraphs.join('\n')}`);
    }
  }
  if (!slides.length) {
    throw new Error('The PowerPoint file does not contain readable text.');
  }

  const template = [
    '# Imported PowerPoint report template',
    `# Source: ${file.name}`,
    '',
    ...slides,
  ].join('\n\n').slice(0, MAX_TEMPLATE_CHARS);

  return {
    template,
    slideCount: entries.length,
  };
}