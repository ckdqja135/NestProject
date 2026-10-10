import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvatarStyle1791605394664 implements MigrationInterface {
  name = 'AddAvatarStyle1791605394664';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`avatarStyle\` varchar(20) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`avatarStyle\``,
    );
  }
}
