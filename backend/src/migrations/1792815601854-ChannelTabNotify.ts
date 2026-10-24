import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChannelTabNotify1792815601854 implements MigrationInterface {
  name = 'ChannelTabNotify1792815601854';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`channeltabs\` ADD \`notify\` tinyint NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`channeltabs\` DROP COLUMN \`notify\``,
    );
  }
}
