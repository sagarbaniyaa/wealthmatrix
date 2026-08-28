import { IsIn } from 'class-validator';
import { ClientDocumentType, UPLOADABLE_DOCUMENT_TYPES } from '../../../common/enums/domain.enums';

export class UploadClientDocumentDto {
  @IsIn(UPLOADABLE_DOCUMENT_TYPES)
  documentType: ClientDocumentType;
}
