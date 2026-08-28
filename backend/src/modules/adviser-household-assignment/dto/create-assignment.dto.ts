import { IsUUID } from 'class-validator';
export class CreateAssignmentDto {
  @IsUUID() adviserId: string;
  @IsUUID() householdId: string;
}
