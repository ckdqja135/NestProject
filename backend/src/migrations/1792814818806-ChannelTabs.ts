import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChannelTabs1792814818806 implements MigrationInterface {
  name = 'ChannelTabs1792814818806';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`channeltabs\` (\`id\` int NOT NULL AUTO_INCREMENT, \`ChannelId\` int NOT NULL, \`DocId\` int NOT NULL, \`access\` varchar(10) NOT NULL DEFAULT 'none', \`position\` int NOT NULL DEFAULT '0', \`CreatorId\` int NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`channeltabs_doc\` (\`DocId\`), UNIQUE INDEX \`channeltabs_channel_doc\` (\`ChannelId\`, \`DocId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`channeltabs\` ADD CONSTRAINT \`FK_8a490276dbb6d1434486b245c11\` FOREIGN KEY (\`ChannelId\`) REFERENCES \`channels\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`channeltabs\` ADD CONSTRAINT \`FK_424928cac4be369b58bbb8d5962\` FOREIGN KEY (\`DocId\`) REFERENCES \`docs\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`channeltabs\` DROP FOREIGN KEY \`FK_424928cac4be369b58bbb8d5962\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`channeltabs\` DROP FOREIGN KEY \`FK_8a490276dbb6d1434486b245c11\``,
    );
    await queryRunner.query(
      `DROP INDEX \`channeltabs_channel_doc\` ON \`channeltabs\``,
    );
    await queryRunner.query(
      `DROP INDEX \`channeltabs_doc\` ON \`channeltabs\``,
    );
    await queryRunner.query(`DROP TABLE \`channeltabs\``);
  }
}
