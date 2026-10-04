export type ReadDocument = { name: string; text: string; pages: number | null };

export async function readDocument(file: File): Promise<ReadDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['pdf', 'docx'].includes(extension ?? '')) throw new Error('Choose a PDF or Word (.docx) file. For an older .doc file, save it as .docx in Word first.');
  if (file.size === 0) throw new Error('This file is empty. Choose a readable PDF or Word document.');
  if (file.size > 10 * 1024 * 1024) throw new Error('This file is larger than 10 MB. Choose a smaller document.');
  const buffer = await file.arrayBuffer();
  let text: string;
  let pages: number | null = null;
  if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    const { default: pdfWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer), standardFontDataUrl: "/pdfjs/standard_fonts/", cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, wasmUrl: "/pdfjs/wasm/" });
    try {
      const pdf = await task.promise;
      pages = pdf.numPages;
      if (pages > 100) throw new Error('This PDF has more than 100 pages. Choose a shorter document.');
      const pageTexts: string[] = [];
      for (let number = 1; number <= pages; number++) {
        const page = await pdf.getPage(number);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
        if (pageText.replace(/\s/g, '').length < 10) throw new Error(`Page ${number} has no readable text. Use a text-based PDF or a Word document; scanned pages cannot be assessed yet.`);
        pageTexts.push(pageText);
      }
      text = pageTexts.join('\n\n');
    } catch (error) {
      if (error instanceof Error && /password/i.test(error.name + error.message)) throw new Error('This PDF is password-protected. Upload an unlocked copy.');
      if (error instanceof Error && /Page |100 pages/.test(error.message)) throw error;
      throw new Error('This PDF could not be read. Upload a readable, unlocked PDF or Word document.');
    } finally { await task.destroy(); }
  } else {
    try {
      const { default: mammoth } = await import("mammoth/mammoth.browser");
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      text = result.value.trim();
    } catch {
      throw new Error('This Word file could not be read. Open it in Word and save a new .docx copy, then try again.');
    }
  }
  if (text.trim().length < 30) throw new Error('There is too little readable text. Scanned images cannot be assessed yet; upload a text-based PDF or Word document.');
  if (text.length > 80000) throw new Error('This document has more than 80,000 characters. Choose a shorter document; no text has been silently removed.');
  return { name: file.name, text, pages };
}
