import { BadRequestException, Injectable } from '@nestjs/common';
import archiver = require('archiver');
import { PassThrough } from 'stream';
import { ProviderService } from '../../modules/provider/provider.service';
import { ClientDocumentService } from '../../modules/client-document/client-document.service';
import { LoaTemplateService } from './loa-template.service';
import { LoaTokenBuilderService } from './loa-token-builder.service';
import { LoaAutofillService } from './loa-autofill.service';
import { DocumentGeneratorService } from './document-generator.service';
import { ClientDocumentType, UPLOADABLE_DOCUMENT_TYPES } from '../../common/enums/domain.enums';

export interface PackManifestEntry { documentType: string; fileName: string; included: boolean }
export interface BuiltPack {
  zip: Buffer;
  manifest: PackManifestEntry[];
  missingRequired: string[];
  loaTemplateId: string;
  loaVersion: number;
}

@Injectable()
export class ProviderPackService {
  constructor(
    private readonly providers: ProviderService,
    private readonly documents: ClientDocumentService,
    private readonly templates: LoaTemplateService,
    private readonly tokenBuilder: LoaTokenBuilderService,
    private readonly autofill: LoaAutofillService,
    private readonly generator: DocumentGeneratorService,
  ) {}

  async buildPack(params: { householdId: string; providerId: string; loaTemplateId?: string; adviserId: string }): Promise<BuiltPack> {
    const provider = await this.providers.findOneOrFail(params.providerId);

    const template = params.loaTemplateId
      ? await this.templates.findWithBytes(params.loaTemplateId)
      : await this.resolveDefaultTemplate();

    const tokens = await this.tokenBuilder.buildTokens(params.householdId, params.adviserId);
    tokens.provider_name = provider.providerName;

    const loa = await this.autofill.autofill(template, tokens);
    const factFind = await this.generator.generateFactFind(params.householdId);
    const policySummary = await this.generator.generatePolicySummary(params.householdId);
    const adviserDetails = await this.generator.generateAdviserDetails(params.adviserId);

    const entries: { name: string; data: Buffer; documentType: string; included: boolean }[] = [
      { name: loa.fileName, data: loa.buffer, documentType: ClientDocumentType.LOA, included: true },
      { name: 'fact_find.pdf', data: factFind, documentType: ClientDocumentType.FACT_FIND, included: true },
      { name: 'policy_summary.pdf', data: policySummary, documentType: ClientDocumentType.POLICY_SUMMARY, included: true },
      { name: 'adviser_details.pdf', data: adviserDetails, documentType: ClientDocumentType.ADVISER_DETAILS, included: true },
    ];

    for (const docType of UPLOADABLE_DOCUMENT_TYPES) {
      const doc = await this.documents.findLatestUploadedByType(params.householdId, docType);
      if (doc) {
        entries.push({ name: doc.fileName, data: doc.fileData, documentType: docType, included: true });
      } else {
        entries.push({ name: `${docType}.missing`, data: Buffer.alloc(0), documentType: docType, included: false });
      }
    }

    const zip = await zipBuffer(entries.filter((e) => e.included).map((e) => ({ name: e.name, data: e.data })));
    const manifest: PackManifestEntry[] = entries.map((e) => ({ documentType: e.documentType, fileName: e.name, included: e.included }));
    const missingRequired = crossReferenceMissing(provider.requiredDocuments, manifest);

    return { zip, manifest, missingRequired, loaTemplateId: template.id, loaVersion: template.version };
  }

  private async resolveDefaultTemplate() {
    const active = await this.templates.listActive();
    if (active.length === 0) throw new BadRequestException('No active LOA template — upload one first.');
    if (active.length > 1) throw new BadRequestException('Multiple active LOA templates — specify which one to use (loaTemplateId).');
    return this.templates.findWithBytes(active[0].id);
  }
}

const REQUIRED_LABEL_TO_DOC_TYPE: Record<string, string> = {
  'LOA': ClientDocumentType.LOA,
  'Client Fact Find': ClientDocumentType.FACT_FIND,
  'KYC': ClientDocumentType.KYC,
  'ID Proof': ClientDocumentType.ID_PROOF,
  'Address Proof': ClientDocumentType.ADDRESS_PROOF,
  'Bank Statements': ClientDocumentType.BANK_STATEMENT,
  'Policy Numbers (if available)': ClientDocumentType.POLICY_SUMMARY,
};

function crossReferenceMissing(requiredDocuments: string[], manifest: PackManifestEntry[]): string[] {
  const includedTypes = new Set(manifest.filter((m) => m.included).map((m) => m.documentType));
  return requiredDocuments.filter((label) => {
    const docType = REQUIRED_LABEL_TO_DOC_TYPE[label];
    // "Policy Numbers (if available)" is explicitly optional per its own label — never flagged as missing.
    if (!docType || label.includes('if available')) return false;
    return !includedTypes.has(docType);
  });
}

function zipBuffer(entries: { name: string; data: Buffer }[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    const stream = new PassThrough();
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    archive.on('error', reject);
    archive.pipe(stream);
    for (const entry of entries) archive.append(entry.data, { name: entry.name });
    archive.finalize();
  });
}
