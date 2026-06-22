import yauzl from 'yauzl';
import { createExtractorFromFile } from 'node-unrar-js';
import fs from 'fs';
import path from 'path';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export async function parseCbz(filePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      const pages = [];
      let coverBuffer = null;

      zip.on('entry', (entry) => {
        if (!entry.fileName.endsWith('/') && IMAGE_EXT.test(entry.fileName)) {
          pages.push(entry.fileName);
        }
        zip.readEntry();
      });

      zip.on('end', async () => {
        pages.sort(naturalSort);
        if (pages.length > 0) {
          try {
            coverBuffer = await extractZipEntry(filePath, pages[0]);
          } catch (e) { /* no cover available */ }
        }
        resolve({
          pageCount: pages.length,
          pages,
          coverBuffer,
          coverExt: path.extname(pages[0] || '.jpg').replace('.', '') || 'jpg',
        });
      });
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}

function extractZipEntry(filePath, entryName) {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      let found = false;
      zip.on('entry', (entry) => {
        if (entry.fileName === entryName) {
          found = true;
          zip.openReadStream(entry, (err, stream) => {
            if (err) return reject(err);
            const chunks = [];
            stream.on('data', (c) => chunks.push(c));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
          });
        } else {
          zip.readEntry();
        }
      });
      zip.on('end', () => { if (!found) resolve(null); });
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}

export async function parseCbr(filePath) {
  const buf = fs.readFileSync(filePath);
  const extractor = await createExtractorFromFile({ filepath: filePath });
  const list = extractor.getFileList();
  const fileHeaders = [...list.fileHeaders];
  const pages = fileHeaders
    .filter((h) => !h.flags.directory && IMAGE_EXT.test(h.name))
    .map((h) => h.name)
    .sort(naturalSort);

  let coverBuffer = null;
  if (pages.length > 0) {
    const extracted = extractor.extract({ files: [pages[0]] });
    const files = [...extracted.files];
    if (files[0]?.extraction) {
      coverBuffer = Buffer.from(files[0].extraction);
    }
  }

  return {
    pageCount: pages.length,
    pages,
    coverBuffer,
    coverExt: path.extname(pages[0] || '.jpg').replace('.', '') || 'jpg',
  };
}

export async function extractComicPage(filePath, format, entryName) {
  if (format === 'cbz') {
    return extractZipEntry(filePath, entryName);
  } else {
    const extractor = await createExtractorFromFile({ filepath: filePath });
    const extracted = extractor.extract({ files: [entryName] });
    const files = [...extracted.files];
    if (files[0]?.extraction) return Buffer.from(files[0].extraction);
    return null;
  }
}

export async function getComicPageList(filePath, format) {
  if (format === 'cbz') {
    const { pages } = await parseCbz(filePath);
    return pages;
  } else {
    const extractor = await createExtractorFromFile({ filepath: filePath });
    const list = extractor.getFileList();
    const fileHeaders = [...list.fileHeaders];
    return fileHeaders
      .filter((h) => !h.flags.directory && IMAGE_EXT.test(h.name))
      .map((h) => h.name)
      .sort(naturalSort);
  }
}
