import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateContactDto {
  @IsString()
  @IsNotEmpty({ message: '이름을 입력해주세요.' })
  @MaxLength(40)
  @ApiProperty({ example: '홍길동', description: '이름' })
  public name: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @ApiProperty({ example: '(주)거래처', required: false, description: '회사' })
  public company?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @ApiProperty({ example: '구매팀', required: false, description: '부서' })
  public department?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @ApiProperty({ example: '과장', required: false, description: '직책' })
  public jobTitle?: string | null;

  // 빈 칸이면 검사하지 않는다
  @IsOptional()
  @ValidateIf((_, value) => !!value)
  @IsEmail({}, { message: '이메일 형식이 올바르지 않습니다.' })
  @MaxLength(100)
  @ApiProperty({ example: 'hong@example.com', required: false })
  public email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9+\-() ]*$/, {
    message: '전화번호는 숫자와 + - ( ) 만 쓸 수 있습니다.',
  })
  @ApiProperty({ example: '010-1234-5678', required: false })
  public phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiProperty({ required: false, description: '메모' })
  public memo?: string | null;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ required: false, description: '별표' })
  public starred?: boolean;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}
