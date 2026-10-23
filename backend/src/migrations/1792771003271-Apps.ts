import { MigrationInterface, QueryRunner } from 'typeorm';

export class Apps1792771003271 implements MigrationInterface {
  name = 'Apps1792771003271';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`appcommands\` (\`id\` int NOT NULL AUTO_INCREMENT, \`AppId\` int NOT NULL, \`WorkspaceId\` int NOT NULL, \`command\` varchar(32) NOT NULL, \`url\` varchar(500) NOT NULL, \`description\` varchar(100) NULL, \`usageHint\` varchar(100) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`appcommands_workspace_command\` (\`WorkspaceId\`, \`command\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`apps\` (\`id\` int NOT NULL AUTO_INCREMENT, \`WorkspaceId\` int NOT NULL, \`name\` varchar(30) NOT NULL, \`description\` varchar(200) NULL, \`BotUserId\` int NOT NULL, \`tokenHash\` char(64) NOT NULL, \`tokenHint\` varchar(8) NOT NULL, \`signingSecret\` varchar(64) NOT NULL, \`eventUrl\` varchar(500) NULL, \`events\` varchar(100) NOT NULL DEFAULT '', \`lastEventAt\` datetime NULL, \`lastEventError\` varchar(200) NULL, \`CreatorId\` int NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`apps_workspace\` (\`WorkspaceId\`), UNIQUE INDEX \`apps_token\` (\`tokenHash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`appcommands\` ADD CONSTRAINT \`FK_b8cb0b84082ecd02a53b0685070\` FOREIGN KEY (\`AppId\`) REFERENCES \`apps\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`apps\` ADD CONSTRAINT \`FK_3889663f4abf7f3c83c9b9b6217\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`apps\` ADD CONSTRAINT \`FK_722f79d589ed1d2aafce15bdb23\` FOREIGN KEY (\`BotUserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`apps\` DROP FOREIGN KEY \`FK_722f79d589ed1d2aafce15bdb23\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`apps\` DROP FOREIGN KEY \`FK_3889663f4abf7f3c83c9b9b6217\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`appcommands\` DROP FOREIGN KEY \`FK_b8cb0b84082ecd02a53b0685070\``,
    );
    await queryRunner.query(`DROP INDEX \`apps_token\` ON \`apps\``);
    await queryRunner.query(`DROP INDEX \`apps_workspace\` ON \`apps\``);
    await queryRunner.query(`DROP TABLE \`apps\``);
    await queryRunner.query(
      `DROP INDEX \`appcommands_workspace_command\` ON \`appcommands\``,
    );
    await queryRunner.query(`DROP TABLE \`appcommands\``);
  }
}
