import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSyncAndPreferences1791723768343 implements MigrationInterface {
  name = 'AddSyncAndPreferences1791723768343';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`readmarkers\` (\`UserId\` int NOT NULL, \`WorkspaceId\` int NOT NULL, \`key\` varchar(40) NOT NULL, \`lastReadAt\` datetime(3) NOT NULL, PRIMARY KEY (\`UserId\`, \`WorkspaceId\`, \`key\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`drafts\` (\`UserId\` int NOT NULL, \`WorkspaceId\` int NOT NULL, \`key\` varchar(60) NOT NULL, \`content\` text NOT NULL, \`updatedAt\` datetime(3) NOT NULL, PRIMARY KEY (\`UserId\`, \`WorkspaceId\`, \`key\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`theme\` varchar(10) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`notificationsPaused\` tinyint NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`notificationsPaused\``,
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`theme\``);
    await queryRunner.query(`DROP TABLE \`drafts\``);
    await queryRunner.query(`DROP TABLE \`readmarkers\``);
  }
}
