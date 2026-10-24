import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppButtons1792815994184 implements MigrationInterface {
  name = 'AppButtons1792815994184';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`apptickets\` (\`id\` int NOT NULL AUTO_INCREMENT, \`tokenHash\` char(64) NOT NULL, \`AppId\` int NOT NULL, \`url\` varchar(30) NOT NULL, \`UserId\` int NOT NULL, \`channel\` varchar(80) NULL, \`dmUserId\` int NULL, \`expiresAt\` datetime NOT NULL, \`uses\` int NOT NULL DEFAULT '0', UNIQUE INDEX \`apptickets_token\` (\`tokenHash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`apps\` ADD \`interactionUrl\` varchar(500) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`apptickets\` ADD CONSTRAINT \`FK_bb55c7a24fe8771076b942020b2\` FOREIGN KEY (\`AppId\`) REFERENCES \`apps\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`apptickets\` DROP FOREIGN KEY \`FK_bb55c7a24fe8771076b942020b2\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`apps\` DROP COLUMN \`interactionUrl\``,
    );
    await queryRunner.query(
      `DROP INDEX \`apptickets_token\` ON \`apptickets\``,
    );
    await queryRunner.query(`DROP TABLE \`apptickets\``);
  }
}
