import { BadRequestException, Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';

/**
 * Pulls plain text out of an uploaded report template (DOCX or PDF) so it
 * can go into an AI prompt as a structure/format reference. This is a
 * one-way, one-time extraction at upload time — the extracted text is
 * what ReportBuilderService actually reads; the original file bytes are
 * kept only so the template can be downloaded/re-checked later.
 */
@Injectable()
export class DocumentTextExtractorService {
  async extractText(mimeType: string, fileData: Buffer): Promise<string> {
    if (mimeType === DOCX_MIME) {
      const result = await mammoth.extractRawText({ buffer: fileData });
      return result.value.trim();
    }
    if (mimeType === PDF_MIME) {
      const parser = new PDFParse({ data: fileData });
      try {
        const result = await parser.getText();
        return result.text.trim();
      } finally {
        await parser.destroy?.();
      }
    }
    throw new BadRequestException('Report templates must be a .docx or .pdf file.');
  }
}
