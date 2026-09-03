import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { TransactionType } from '../../../common/enums/domain.enums';
export class CreateTransactionDto {
  @IsUUID() accountId: string;
  @IsOptional() @IsUUID() assetId?: string;
  @IsEnum(TransactionType) transactionType: TransactionType;
  @IsDateString() transactionDate: string;
  // Required for STOCK_SPLIT (the signed net change in units — positive
  // for a split/bonus issue, negative for a consolidation); optional for
  // every other type, but still type-checked whenever it IS supplied.
  @ValidateIf((o) => o.transactionType === TransactionType.STOCK_SPLIT || o.quantity !== undefined)
  @IsNumber()
  quantity?: number;
  @IsNumber() amount: number;
  @IsUUID() currencyId: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() externalRef?: string;
}
