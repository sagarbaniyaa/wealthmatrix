import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { ReportTemplateEntity } from '../../database/entities';
import { DocumentTextExtractorService } from './document-text-extractor.service';

@Injectable()
export class ReportTemplateService {
  constructor(private readonly extractor: DocumentTextExtractorService) {}

  private get repo() {
    return TenantContext.getManager().getRepository(ReportTemplateEntity);
  }

  /** Metadata only (no file bytes, no extracted text — both select:false on the entity). */
  async listActive(): Promise<ReportTemplateEntity[]> {
    return this.repo.find({ where: { isActive: true } as any, order: { reportType: 'ASC', createdAt: 'DESC' } as any });
  }

  async findWithBytes(id: string): Promise<ReportTemplateEntity> {
    const template = await this.repo.createQueryBuilder('t').addSelect('t.fileData').where('t.id = :id', { id }).getOne();
    if (!template) throw new NotFoundException(`Report template ${id} not found`);
    return template;
  }

  async findWithText(id: string): Promise<ReportTemplateEntity> {
    const template = await this.repo.createQueryBuilder('t').addSelect('t.extractedText').where('t.id = :id', { id }).getOne();
    if (!template) throw new NotFoundException(`Report template ${id} not found`);
    return template;
  }

  /** Same versioning pattern as LoaTemplateService: re-uploading the same `name` bumps version and retires the old one. */
  async upload(params: {
    name: string; reportType: string; fileName: string; mimeType: string; fileData: Buffer; uploadedBy: string;
  }): Promise<Omit<ReportTemplateEntity, 'fileData' | 'extractedText'>> {
    const extractedText = await this.extractor.extractText(params.mimeType, params.fileData);

    const existing = await this.repo.findOne({ where: { name: params.name, isActive: true } as any });
    if (existing) {
      await this.repo.update(existing.id, { isActive: false });
    }

    const entity = this.repo.create({
      firmId: TenantContext.getFirmId(),
      name: params.name,
      reportType: params.reportType,
      fileName: params.fileName,
      mimeType: params.mimeType,
      fileData: params.fileData,
      extractedText,
      version: (existing?.version ?? 0) + 1,
      isActive: true,
      uploadedBy: params.uploadedBy,
    });
    const saved = await this.repo.save(entity);
    const { fileData, extractedText: _text, ...meta } = saved;
    return meta;
  }

  async remove(id: string): Promise<void> {
    const template = await this.repo.findOne({ where: { id } as any });
    if (!template) throw new NotFoundException(`Report template ${id} not found`);
    await this.repo.remove(template);
  }
}
