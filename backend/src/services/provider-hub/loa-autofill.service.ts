import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import PizZip from 'pizzip';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Docxtemplater = require('docxtemplater');
import { PDFDocument, PDFTextField } from 'pdf-lib';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';

export interface AutofillResult {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

/**
 * The LOA autofill engine (spec part 2). Two supported template kinds:
 *
 *  - DOCX with {{token}} markers in the document text — the reliable,
 *    general case. Handled with docxtemplater; any {{token}} not present
 *    in our token map renders as blank rather than throwing, so a
 *    template with an extra marker we don't know about doesn't hard-fail
 *    the whole autofill.
 *  - PDF with a fillable AcroForm, where `field_map` (set when the
 *    template was uploaded) maps our token names onto that PDF's actual
 *    field names — filled via pdf-lib, then the form is flattened so the
 *    exported LOA is a clean, non-editable document.
 *
 * NOT supported: a flat/scanned PDF with literal "{{token}}" text and no
 * form fields. Genuinely replacing text inside an arbitrary PDF's content
 * stream (find the token's exact position, erase it, redraw the value in
 * the right font/size) is a much harder problem than either case above —
 * it's not implemented here. See README Known gaps.
 */
@Injectable()
export class LoaAutofillService {
  private readonly logger = new Logger(LoaAutofillService.name);

  async autofill(template: { fileName: string; mimeType: string; fileData: Buffer; fieldMap: Record<string, string> | null }, tokens: Record<string, string>): Promise<AutofillResult> {
    if (template.mimeType === DOCX_MIME) {
      return { buffer: this.fillDocx(template.fileData, tokens), mimeType: DOCX_MIME, fileName: withSuffix(template.fileName, 'filled') };
    }
    if (template.mimeType === PDF_MIME) {
      return { buffer: await this.fillPdfForm(template.fileData, tokens, template.fieldMap), mimeType: PDF_MIME, fileName: withSuffix(template.fileName, 'filled') };
    }
    throw new BadRequestException(`Unsupported LOA template type: ${template.mimeType}. Upload a .docx with {{token}} markers or a fillable PDF form.`);
  }

  private fillDocx(buffer: Buffer, tokens: Record<string, string>): Buffer {
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      nullGetter: () => '', // an unrecognised {{token}} renders blank instead of throwing
    });
    try {
      doc.render(tokens);
    } catch (err) {
      this.logger.error(`DOCX autofill failed: ${err}`);
      throw new BadRequestException('Could not fill this LOA template — check it is a valid .docx file.');
    }
    return doc.getZip().generate({ type: 'nodebuffer' });
  }

  private async fillPdfForm(buffer: Buffer, tokens: Record<string, string>, fieldMap: Record<string, string> | null): Promise<Buffer> {
    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(buffer);
    } catch (err) {
      throw new BadRequestException('Could not read this LOA template as a PDF.');
    }
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    if (fields.length === 0) {
      throw new BadRequestException(
        'This PDF has no fillable form fields. Only DOCX templates with {{token}} markers, or PDFs with a fillable AcroForm, are supported — see the Fund Research... Provider Hub README section.',
      );
    }

    for (const field of fields) {
      const pdfFieldName = field.getName();
      const tokenName = fieldMap
        ? Object.keys(fieldMap).find((token) => fieldMap[token] === pdfFieldName)
        : pdfFieldName; // no explicit map — assume the PDF field is literally named after the token
      if (!tokenName) continue;
      const value = tokens[tokenName];
      if (value === undefined) continue;
      if (field instanceof PDFTextField) {
        try { field.setText(value); } catch { /* field too small / wrong type for this value — leave as-is rather than fail the whole document */ }
      }
    }

    form.flatten();
    return Buffer.from(await pdfDoc.save());
  }
}

function withSuffix(fileName: string, suffix: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot === -1) return `${fileName}_${suffix}`;
  return `${fileName.slice(0, dot)}_${suffix}${fileName.slice(dot)}`;
}
