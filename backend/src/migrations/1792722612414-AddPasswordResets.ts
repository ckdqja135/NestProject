import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResets1792722612414 implements MigrationInterface {
  name = 'AddPasswordResets1792722612414';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`passwordresets\` (\`id\` int NOT NULL AUTO_INCREMENT, \`UserId\` int NOT NULL, \`tokenHash\` char(64) NOT NULL, \`expiresAt\` datetime NOT NULL, \`usedAt\` datetime NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`passwordresets_token\` (\`tokenHash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`passwordresets\` ADD CONSTRAINT \`FK_5784b9d61d3566a7972ff71356f\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`passwordresets\` DROP FOREIGN KEY \`FK_5784b9d61d3566a7972ff71356f\``,
    );
    await queryRunner.query(
      `DROP INDEX \`passwordresets_token\` ON \`passwordresets\``,
    );
    await queryRunner.query(`DROP TABLE \`passwordresets\``);
  }
}
