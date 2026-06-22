import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

export async function parsePdf(filePath) {
  const result = { title: null, author: null, pageCount: null };
  try {
    const bytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
    result.title = pdfDoc.getTitle() || null;
    result.author = pdfDoc.getAuthor() || null;
    result.pageCount = pdfDoc.getPageCount();
  } catch (e) {
    console.error('PDF parse error:', e.message);
  }
  return result;
}
