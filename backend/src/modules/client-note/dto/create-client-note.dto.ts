import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateClientNoteDto {
  @IsUUID() householdId: string;
  @IsString() @MinLength(1) note: string;
}
