import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { LoaTemplateEntity } from '../../database/entities';

@Injectable()
export class LoaTemplateService {
  private get repo() {
    return TenantContext.getManager().getRepository(LoaTemplateEntity);
  }

  /** Metadata only — no file bytes (select:false on the entity). */
  async listActive(): Promise<LoaTemplateEntity[]> {
    return this.repo.find({ where: { isActive: true } as any, order: { createdAt: 'DESC' } as any });
  }

  async findWithBytes(id: string): Promise<LoaTemplateEntity> {
    const template = await this.repo.createQueryBuilder('t').addSelect('t.fileData').where('t.id = :id', { id }).getOne();
    if (!template) throw new NotFoundException(`LOA template ${id} not found`);
    return template;
  }

  /**
   * Uploading a template with a `name` that already has an active version
   * bumps the version number and deactivates the old one — "versioning"
   * here, same generic-audit-trigger-plus-explicit-version-column pattern
   * as the rest of this schema, not a bespoke parallel history table.
   */
  async upload(params: {
    name: string; fileName: string; mimeType: string; fileData: Buffer; fieldMap: Record<string, string> | null; uploadedBy: string;
  }): Promise<Omit<LoaTemplateEntity, 'fileData'>> {
    const existing = await this.repo.findOne({ where: { name: params.name, isActive: true } as any });
    if (existing) {
      await this.repo.update(existing.id, { isActive: false });
    }

    const entity = this.repo.create({
      firmId: TenantContext.getFirmId(),
      name: params.name,
      fileName: params.fileName,
      mimeType: params.mimeType,
      fileData: params.fileData,
      fieldMap: params.fieldMap,
      version: (existing?.version ?? 0) + 1,
      isActive: true,
      uploadedBy: params.uploadedBy,
    });
    const saved = await this.repo.save(entity);
    const { fileData, ...meta } = saved;
    return meta;
  }

  async remove(id: string): Promise<void> {
    const template = await this.repo.findOne({ where: { id } as any });
    if (!template) throw new NotFoundException(`LOA template ${id} not found`);
    await this.repo.remove(template);
  }
}
