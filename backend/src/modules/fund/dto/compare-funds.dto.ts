import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class CompareFundsDto {
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(5) @IsUUID('4', { each: true })
  fundIds: string[];
}
