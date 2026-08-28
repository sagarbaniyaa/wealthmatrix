import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { TransactionType } from '../../../common/enums/domain.enums';
export class CreateTransactionDto {
  @IsUUID() accountId: string;
  @IsOptional() @IsUUID() assetId?: string;
  @IsEnum(TransactionType) transactionType: TransactionType;
  @IsDateString() transactionDate: string;
  @IsOptional() @IsNumber() quantity?: number;
  @IsNumber() amount: number;
  @IsUUID() currencyId: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() externalRef?: string;
}
