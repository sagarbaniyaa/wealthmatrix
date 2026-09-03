import { IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { AccountType, TaxWrapper } from '../../../common/enums/domain.enums';
export class CreateAccountDto {
  @ValidateIf((o) => !o.ownerEntityId) @IsUUID() ownerPersonId?: string;
  @ValidateIf((o) => !o.ownerPersonId) @IsUUID() ownerEntityId?: string;
  @IsEnum(AccountType) accountType: AccountType;
  @IsOptional() @IsString() provider?: string;
  @IsUUID() currencyId: string;
  @IsOptional() @IsEnum(TaxWrapper) taxWrapper?: TaxWrapper;
}
