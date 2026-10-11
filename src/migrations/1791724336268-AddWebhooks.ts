import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhooks1791724336268 implements MigrationInterface {
  name = 'AddWebhooks1791724336268';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`webhooks\` (\`id\` int NOT NULL AUTO_INCREMENT, \`ChannelId\` int NOT NULL, \`name\` varchar(40) NOT NULL, \`token\` varchar(64) NOT NULL, \`CreatorId\` int NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`token\` (\`token\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`channelchats\` ADD \`botName\` varchar(40) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`webhooks\` ADD CONSTRAINT \`FK_c91360484c1055ae8468577c3f5\` FOREIGN KEY (\`ChannelId\`) REFERENCES \`channels\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`webhooks\` ADD CONSTRAINT \`FK_e3471efe3dcd2bdf49150a0975a\` FOREIGN KEY (\`CreatorId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`webhooks\` DROP FOREIGN KEY \`FK_e3471efe3dcd2bdf49150a0975a\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`webhooks\` DROP FOREIGN KEY \`FK_c91360484c1055ae8468577c3f5\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`channelchats\` DROP COLUMN \`botName\``,
    );
    await queryRunner.query(`DROP INDEX \`token\` ON \`webhooks\``);
    await queryRunner.query(`DROP TABLE \`webhooks\``);
  }
}
