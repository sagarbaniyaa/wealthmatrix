import { IsIn, IsOptional, IsString } from 'class-validator';
import { ACTION_TYPES } from '../../../services/client-action/action-requirements.constants';

export class SetClientActionDto {
  @IsIn(ACTION_TYPES) actionType: string;
  @IsOptional() @IsString() notes?: string;
}
