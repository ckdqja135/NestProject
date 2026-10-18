import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocs1792328484013 implements MigrationInterface {
  name = 'AddDocs1792328484013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`docfolders\` (\`id\` int NOT NULL AUTO_INCREMENT, \`WorkspaceId\` int NOT NULL, \`name\` varchar(60) NOT NULL, \`ParentId\` int NULL, \`OwnerId\` int NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`workspace_owner\` (\`WorkspaceId\`, \`OwnerId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`docshares\` (\`DocId\` int NOT NULL, \`UserId\` int NOT NULL, \`role\` varchar(10) NOT NULL DEFAULT 'view', PRIMARY KEY (\`DocId\`, \`UserId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`docs\` (\`id\` int NOT NULL AUTO_INCREMENT, \`WorkspaceId\` int NOT NULL, \`type\` varchar(10) NOT NULL DEFAULT 'doc', \`title\` varchar(200) NOT NULL, \`content\` mediumtext NOT NULL, \`visibility\` varchar(10) NOT NULL DEFAULT 'private', \`FolderId\` int NULL, \`ParentId\` int NULL, \`OwnerId\` int NULL, \`LastEditorId\` int NULL, \`version\` int NOT NULL DEFAULT '1', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, INDEX \`WorkspaceId\` (\`WorkspaceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`docuserstates\` (\`UserId\` int NOT NULL, \`DocId\` int NOT NULL, \`favorite\` tinyint NOT NULL DEFAULT 0, \`viewedAt\` datetime NULL, PRIMARY KEY (\`UserId\`, \`DocId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docfolders\` ADD CONSTRAINT \`FK_31075eb96c18f298195304715b2\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docfolders\` ADD CONSTRAINT \`FK_6d0be0810b204fa35bd7c9a1bb2\` FOREIGN KEY (\`ParentId\`) REFERENCES \`docfolders\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docfolders\` ADD CONSTRAINT \`FK_76e871f52665ca2b64cef0bc443\` FOREIGN KEY (\`OwnerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docshares\` ADD CONSTRAINT \`FK_d4b5ba67f13214919539a37e0c1\` FOREIGN KEY (\`DocId\`) REFERENCES \`docs\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docshares\` ADD CONSTRAINT \`FK_551ae81198845fd27edc0f0bf16\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docs\` ADD CONSTRAINT \`FK_608718a0a940495f242b2003775\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docs\` ADD CONSTRAINT \`FK_c183f0d55c4541f99b8fcca5924\` FOREIGN KEY (\`FolderId\`) REFERENCES \`docfolders\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docs\` ADD CONSTRAINT \`FK_d20852ab0f5dd5e3cc2683cb23d\` FOREIGN KEY (\`ParentId\`) REFERENCES \`docs\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docs\` ADD CONSTRAINT \`FK_71bc2539510775aecd0c19c0a5b\` FOREIGN KEY (\`OwnerId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docs\` ADD CONSTRAINT \`FK_9af9f0f042a1af98f603e462267\` FOREIGN KEY (\`LastEditorId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docuserstates\` ADD CONSTRAINT \`FK_a8ca2009d4df1af676ef5aedb34\` FOREIGN KEY (\`DocId\`) REFERENCES \`docs\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docuserstates\` ADD CONSTRAINT \`FK_ef1c160edede223740da9b5e096\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`docuserstates\` DROP FOREIGN KEY \`FK_ef1c160edede223740da9b5e096\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`docuserstates\` DROP FOREIGN KEY \`FK_a8ca2009d4df1af676ef5aedb34\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`docs\` DROP FOREIGN KEY \`FK_9af9f0f042a1af98f603e462267\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`docs\` DROP FOREIGN KEY \`FK_71bc2539510775aecd0c19c0a5b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`docs\` DROP FOREIGN KEY \`FK_d20852ab0f5dd5e3cc2683cb23d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`docs\` DROP FOREIGN KEY \`FK_c183f0d55c4541f99b8fcca5924\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`docs\` DROP FOREIGN KEY \`FK_608718a0a940495f242b2003775\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`docshares\` DROP FOREIGN KEY \`FK_551ae81198845fd27edc0f0bf16\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`docshares\` DROP FOREIGN KEY \`FK_d4b5ba67f13214919539a37e0c1\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`docfolders\` DROP FOREIGN KEY \`FK_76e871f52665ca2b64cef0bc443\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`docfolders\` DROP FOREIGN KEY \`FK_6d0be0810b204fa35bd7c9a1bb2\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`docfolders\` DROP FOREIGN KEY \`FK_31075eb96c18f298195304715b2\``,
    );
    await queryRunner.query(`DROP TABLE \`docuserstates\``);
    await queryRunner.query(`DROP INDEX \`WorkspaceId\` ON \`docs\``);
    await queryRunner.query(`DROP TABLE \`docs\``);
    await queryRunner.query(`DROP TABLE \`docshares\``);
    await queryRunner.query(`DROP INDEX \`workspace_owner\` ON \`docfolders\``);
    await queryRunner.query(`DROP TABLE \`docfolders\``);
  }
}
