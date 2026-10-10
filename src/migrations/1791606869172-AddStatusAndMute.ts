import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusAndMute1791606869172 implements MigrationInterface {
  name = 'AddStatusAndMute1791606869172';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`channelmembers\` ADD \`muted\` tinyint NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`statusEmoji\` varchar(16) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`statusText\` varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`away\` tinyint NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`away\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`statusText\``);
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`statusEmoji\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`channelmembers\` DROP COLUMN \`muted\``,
    );
  }
}
