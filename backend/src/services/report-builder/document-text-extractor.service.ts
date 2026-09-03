import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp']);

/**
 * Pulls plain text out of an uploaded document (DOCX, PDF, or a scanned
 * image) — shared by the Report Template Builder (a format reference)
 * and Document Intake (OCR + NLP auto-fill from an uploaded fact-find/
 * KYC/statement). One-way, one-time extraction; the original bytes are
 * kept separately for download/re-checking.
 *
 * Image OCR uses tesseract.js — a WASM Tesseract build with no native
 * binary or paid API key required (the free/no-cost path this platform
 * has stuck to throughout). Known trade-off, documented rather than
 * hidden: tesseract.js downloads its ~15MB core+language data from a
 * public CDN on first use per process, so the very first OCR request
 * after a cold start (Render free tier spins down) is noticeably
 * slower than a cached/warm one. There's no bundled offline alternative
 * here — acceptable for a document a client hands to their adviser
 * occasionally, not for a high-volume pipeline.
 *
 * A SCANNED PDF (a photographed/scanned document saved as PDF, with no
 * actual text layer) is a known gap: pdf-parse only reads text that's
 * already embedded in the PDF, and rendering PDF pages to images for
 * OCR needs a native PDF-rasteriser (poppler/ghostscript) this platform
 * deliberately doesn't take on as a dependency. `extractText` detects
 * this case (near-empty output) and returns a clear error asking the
 * adviser to re-upload the document as a PNG/JPG photo instead, which
 * OCR handles directly — rather than silently returning nothing.
 */
@Injectable()
export class DocumentTextExtractorService {
  private readonly logger = new Logger(DocumentTextExtractorService.name);

  async extractText(mimeType: string, fileData: Buffer): Promise<string> {
    // Live Client Call transcripts arrive as plain text (see
    // services/call-session) — no parsing needed, just decode.
    if (mimeType.startsWith('text/')) {
      return fileData.toString('utf8').trim();
    }

    if (mimeType === DOCX_MIME) {
      const result = await mammoth.extractRawText({ buffer: fileData });
      return result.value.trim();
    }

    if (mimeType === PDF_MIME) {
      const parser = new PDFParse({ data: fileData });
      let text: string;
      try {
        const result = await parser.getText();
        text = result.text.trim();
      } finally {
        await parser.destroy?.();
      }
      if (text.length < 20) {
        throw new BadRequestException(
          'This PDF has no readable text (it looks like a scan/photo saved as PDF). ' +
            'Re-upload it as a PNG or JPG image instead so OCR can read it.',
        );
      }
      return text;
    }

    if (IMAGE_MIMES.has(mimeType)) {
      return this.ocrImage(fileData);
    }

    throw new BadRequestException(`Unsupported file type for text extraction: ${mimeType}`);
  }

  private async ocrImage(fileData: Buffer): Promise<string> {
    const worker = await createWorker('eng');
    try {
      const { data } = await worker.recognize(fileData);
      return (data.text ?? '').trim();
    } finally {
      await worker.terminate();
    }
  }
}
