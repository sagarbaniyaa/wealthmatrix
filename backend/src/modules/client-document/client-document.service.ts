import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { TenantContext } from '../../common/database/tenant-context';
import { ClientDocumentEntity } from '../../database/entities';
import { ClientDocumentType } from '../../common/enums/domain.enums';

@Injectable()
export class ClientDocumentService extends BaseCrudService<ClientDocumentEntity> {
  constructor() { super(ClientDocumentEntity); }

  /** List metadata only (no file bytes — those are select:false on the entity) for a household. */
  async listForHousehold(householdId: string): Promise<ClientDocumentEntity[]> {
    return this.repo.find({ where: { householdId } as any, order: { createdAt: 'DESC' } as any });
  }

  /** Loads one document WITH its bytes — the one path that actually needs them. */
  async findWithBytes(id: string): Promise<ClientDocumentEntity> {
    const doc = await this.repo.createQueryBuilder('d').addSelect('d.fileData').where('d.id = :id', { id }).getOne();
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return doc;
  }

  /** Latest uploaded (never generated) document of a given type for a household, or null. */
  async findLatestUploadedByType(householdId: string, documentType: ClientDocumentType): Promise<ClientDocumentEntity | null> {
    return this.repo.createQueryBuilder('d').addSelect('d.fileData')
      .where('d.household_id = :householdId', { householdId })
      .andWhere('d.document_type = :documentType', { documentType })
      .andWhere("d.source = 'uploaded'")
      .orderBy('d.created_at', 'DESC')
      .getOne();
  }

  async saveGenerated(householdId: string, documentType: ClientDocumentType, fileName: string, mimeType: string, fileData: Buffer): Promise<ClientDocumentEntity> {
    const entity = this.repo.create({
      firmId: TenantContext.getFirmId(), householdId, documentType, fileName, mimeType, fileData, source: 'generated',
    });
    return this.repo.save(entity);
  }

  async saveUploaded(params: {
    householdId: string; documentType: ClientDocumentType; fileName: string; mimeType: string; fileData: Buffer; uploadedBy: string;
  }): Promise<ClientDocumentEntity> {
    const entity = this.repo.create({
      firmId: TenantContext.getFirmId(),
      householdId: params.householdId,
      documentType: params.documentType,
      fileName: params.fileName,
      mimeType: params.mimeType,
      fileData: params.fileData,
      source: 'uploaded',
      uploadedBy: params.uploadedBy,
    });
    const saved = await this.repo.save(entity);
    const { fileData, ...meta } = saved as any;
    return meta;
  }
}
