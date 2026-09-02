import { IsIn, IsOptional, IsString } from 'class-validator';

const OUTCOME_VALUES = ['met', 'concern', 'not_assessed'] as const;

export class CreateConsumerDutyReviewDto {
  @IsOptional() @IsString() reviewDate?: string;

  @IsIn(OUTCOME_VALUES) priceValueOutcome: string;
  @IsOptional() @IsString() priceValueNotes?: string;

  @IsIn(OUTCOME_VALUES) productsServicesOutcome: string;
  @IsOptional() @IsString() productsServicesNotes?: string;

  @IsIn(OUTCOME_VALUES) understandingOutcome: string;
  @IsOptional() @IsString() understandingNotes?: string;

  @IsIn(OUTCOME_VALUES) supportOutcome: string;
  @IsOptional() @IsString() supportNotes?: string;

  @IsOptional() @IsString() overallNotes?: string;
}
