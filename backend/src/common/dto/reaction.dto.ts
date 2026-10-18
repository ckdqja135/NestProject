import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReactionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  @ApiProperty({ example: '👍', description: '이모지' })
  public emoji: string;
}
