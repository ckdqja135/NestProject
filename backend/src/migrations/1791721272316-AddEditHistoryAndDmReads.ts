import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEditHistoryAndDmReads1791721272316
  implements MigrationInterface
{
  name = 'AddEditHistoryAndDmReads1791721272316';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`messageedits\` (\`id\` int NOT NULL AUTO_INCREMENT, \`ChatId\` int NULL, \`DMId\` int NULL, \`content\` text NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`DMId\` (\`DMId\`), INDEX \`ChatId\` (\`ChatId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`dmreads\` (\`WorkspaceId\` int NOT NULL, \`UserId\` int NOT NULL, \`PartnerId\` int NOT NULL, \`lastReadId\` int NOT NULL DEFAULT '0', \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`WorkspaceId\`, \`UserId\`, \`PartnerId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`messageedits\` ADD CONSTRAINT \`FK_4000b556c9e79022beffa971f8d\` FOREIGN KEY (\`ChatId\`) REFERENCES \`channelchats\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`messageedits\` ADD CONSTRAINT \`FK_8ce94a66e11d985f8b58c384d7a\` FOREIGN KEY (\`DMId\`) REFERENCES \`dms\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`messageedits\` DROP FOREIGN KEY \`FK_8ce94a66e11d985f8b58c384d7a\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`messageedits\` DROP FOREIGN KEY \`FK_4000b556c9e79022beffa971f8d\``,
    );
    await queryRunner.query(`DROP TABLE \`dmreads\``);
    await queryRunner.query(`DROP INDEX \`ChatId\` ON \`messageedits\``);
    await queryRunner.query(`DROP INDEX \`DMId\` ON \`messageedits\``);
    await queryRunner.query(`DROP TABLE \`messageedits\``);
  }
}
