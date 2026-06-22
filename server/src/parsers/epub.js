import yauzl from 'yauzl';
import xml2js from 'xml2js';
import path from 'path';

function openZip(filePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      resolve(zip);
    });
  });
}

function readEntryText(zip, entry) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err) return reject(err);
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  });
}

async function findEntries(filePath, predicate) {
  const zip = await openZip(filePath);
  const found = {};
  return new Promise((resolve, reject) => {
    zip.on('entry', async (entry) => {
      if (predicate(entry.fileName)) {
        try {
          const buf = await readEntryText(zip, entry);
          found[entry.fileName] = buf;
        } catch (e) { /* skip unreadable entry */ }
      }
      zip.readEntry();
    });
    zip.on('end', () => resolve(found));
    zip.on('error', reject);
    zip.readEntry();
  });
}

async function readSingleEntry(filePath, entryName) {
  const zip = await openZip(filePath);
  return new Promise((resolve, reject) => {
    let resolved = false;
    zip.on('entry', async (entry) => {
      if (entry.fileName === entryName) {
        resolved = true;
        try {
          const buf = await readEntryText(zip, entry);
          resolve(buf);
        } catch (e) { reject(e); }
        return;
      }
      zip.readEntry();
    });
    zip.on('end', () => { if (!resolved) resolve(null); });
    zip.on('error', reject);
    zip.readEntry();
  });
}

export async function parseEpub(filePath) {
  const result = {
    title: null, author: null, description: null,
    series: null, seriesIndex: null, coverBuffer: null, coverExt: 'jpg',
    pageCount: null,
  };

  try {
    // 1. Find container.xml to locate the OPF file
    const containerBuf = await readSingleEntry(filePath, 'META-INF/container.xml');
    if (!containerBuf) return result;
    const container = await xml2js.parseStringPromise(containerBuf.toString('utf8'));
    const opfPath = container.container.rootfiles[0].rootfile[0].$['full-path'];
    const opfDir = path.dirname(opfPath);

    const opfBuf = await readSingleEntry(filePath, opfPath);
    if (!opfBuf) return result;
    const opf = await xml2js.parseStringPromise(opfBuf.toString('utf8'));

    const metadata = opf.package.metadata?.[0];
    const manifest = opf.package.manifest?.[0]?.item || [];
    const spine = opf.package.spine?.[0]?.itemref || [];

    if (metadata) {
      const titleNode = metadata['dc:title']?.[0];
      result.title = typeof titleNode === 'string' ? titleNode : titleNode?._ || null;

      const creatorNode = metadata['dc:creator']?.[0];
      result.author = typeof creatorNode === 'string' ? creatorNode : creatorNode?._ || null;

      const descNode = metadata['dc:description']?.[0];
      result.description = typeof descNode === 'string' ? descNode : descNode?._ || null;

      // Calibre-style series metadata
      const metas = metadata.meta || [];
      for (const m of metas) {
        const name = m.$?.name;
        if (name === 'calibre:series') result.series = m.$.content;
        if (name === 'calibre:series_index') result.seriesIndex = parseFloat(m.$.content);
      }
    }

    result.pageCount = spine.length || null;

    // 2. Find cover image — check manifest for 'cover-image' property or id containing 'cover'
    let coverItem = manifest.find((m) => m.$.properties === 'cover-image');
    if (!coverItem) {
      const coverMeta = (metadata?.meta || []).find((m) => m.$?.name === 'cover');
      const coverId = coverMeta?.$?.content;
      if (coverId) coverItem = manifest.find((m) => m.$.id === coverId);
    }
    if (!coverItem) {
      coverItem = manifest.find((m) => /cover/i.test(m.$.id || '') && /image/.test(m.$['media-type'] || ''));
    }

    if (coverItem) {
      const coverPath = path.join(opfDir, coverItem.$.href).replace(/\\/g, '/').replace(/^\.\//, '');
      const coverBuf = await readSingleEntry(filePath, coverPath);
      if (coverBuf) {
        result.coverBuffer = coverBuf;
        result.coverExt = (coverItem.$['media-type'] || '').includes('png') ? 'png' : 'jpg';
      }
    }
  } catch (e) {
    console.error('EPUB parse error:', e.message);
  }

  return result;
}
