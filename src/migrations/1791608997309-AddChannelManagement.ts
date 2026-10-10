import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChannelManagement1791608997309 implements MigrationInterface {
  name = 'AddChannelManagement1791608997309';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`channels\` ADD \`topic\` varchar(250) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`channels\` ADD \`archived\` tinyint NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`channels\` ADD \`OwnerId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`channels\` ADD CONSTRAINT \`FK_3515ab36262d13bae48122226fa\` FOREIGN KEY (\`OwnerId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`channels\` DROP FOREIGN KEY \`FK_3515ab36262d13bae48122226fa\``,
    );
    await queryRunner.query(`ALTER TABLE \`channels\` DROP COLUMN \`OwnerId\``);
    await queryRunner.query(
      `ALTER TABLE \`channels\` DROP COLUMN \`archived\``,
    );
    await queryRunner.query(`ALTER TABLE \`channels\` DROP COLUMN \`topic\``);
  }
}
