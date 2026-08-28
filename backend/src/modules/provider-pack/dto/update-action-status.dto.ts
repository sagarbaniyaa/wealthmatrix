import { IsIn } from 'class-validator';
import { ProviderActionStatus } from '../../../common/enums/domain.enums';

export class UpdateActionStatusDto {
  @IsIn(Object.values(ProviderActionStatus))
  status: ProviderActionStatus;
}
