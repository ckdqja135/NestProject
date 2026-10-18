import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class MarkReadDto {
  @IsInt()
  @Min(1)
  @ApiProperty({ example: 42, description: '읽은 마지막 메시지 id' })
  public lastId: number;
}
