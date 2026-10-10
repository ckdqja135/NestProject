import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDmReactionsPinSaved1791607873466 implements MigrationInterface {
  name = 'AddDmReactionsPinSaved1791607873466';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`dmreactions\` (\`id\` int NOT NULL AUTO_INCREMENT, \`emoji\` varchar(16) CHARACTER SET "utf8mb4" COLLATE "utf8mb4_bin" NOT NULL, \`DMId\` int NOT NULL, \`UserId\` int NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`UserId\` (\`UserId\`), UNIQUE INDEX \`dm_user_emoji\` (\`DMId\`, \`UserId\`, \`emoji\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`saveditems\` (\`id\` int NOT NULL AUTO_INCREMENT, \`UserId\` int NOT NULL, \`WorkspaceId\` int NOT NULL, \`ChatId\` int NULL, \`DMId\` int NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`user_dm\` (\`UserId\`, \`DMId\`), UNIQUE INDEX \`user_chat\` (\`UserId\`, \`ChatId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`dms\` ADD \`pinned\` tinyint NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`dmreactions\` ADD CONSTRAINT \`FK_70e9c7b7abe1d89b6d64d7cf43a\` FOREIGN KEY (\`DMId\`) REFERENCES \`dms\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`dmreactions\` ADD CONSTRAINT \`FK_00a2245dbdb3bc5c46d2e64a0e5\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`saveditems\` ADD CONSTRAINT \`FK_1705030d50b99d433e98a4b978b\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`saveditems\` ADD CONSTRAINT \`FK_0afd5f15c3160093eb2a34456e0\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`saveditems\` ADD CONSTRAINT \`FK_81bacea826ee2b662f1a3516fc2\` FOREIGN KEY (\`ChatId\`) REFERENCES \`channelchats\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`saveditems\` ADD CONSTRAINT \`FK_ca8ea6ac7c17995fc85d7d2f816\` FOREIGN KEY (\`DMId\`) REFERENCES \`dms\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`saveditems\` DROP FOREIGN KEY \`FK_ca8ea6ac7c17995fc85d7d2f816\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`saveditems\` DROP FOREIGN KEY \`FK_81bacea826ee2b662f1a3516fc2\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`saveditems\` DROP FOREIGN KEY \`FK_0afd5f15c3160093eb2a34456e0\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`saveditems\` DROP FOREIGN KEY \`FK_1705030d50b99d433e98a4b978b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`dmreactions\` DROP FOREIGN KEY \`FK_00a2245dbdb3bc5c46d2e64a0e5\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`dmreactions\` DROP FOREIGN KEY \`FK_70e9c7b7abe1d89b6d64d7cf43a\``,
    );
    await queryRunner.query(`ALTER TABLE \`dms\` DROP COLUMN \`pinned\``);
    await queryRunner.query(`DROP INDEX \`user_chat\` ON \`saveditems\``);
    await queryRunner.query(`DROP INDEX \`user_dm\` ON \`saveditems\``);
    await queryRunner.query(`DROP TABLE \`saveditems\``);
    await queryRunner.query(`DROP INDEX \`dm_user_emoji\` ON \`dmreactions\``);
    await queryRunner.query(`DROP INDEX \`UserId\` ON \`dmreactions\``);
    await queryRunner.query(`DROP TABLE \`dmreactions\``);
  }
}
