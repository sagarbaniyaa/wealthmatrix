import { IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { ScenarioEventType } from '../../../common/enums/domain.enums';
export class CreateScenarioDto {
  @IsUUID() householdId: string;
  @IsString() name: string;
  @IsEnum(ScenarioEventType) eventType: ScenarioEventType;
  @IsDateString() eventDate: string;
  @IsOptional() @IsObject() parameters?: Record<string, unknown>;
}
