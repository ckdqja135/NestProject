import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSidebarPins1792715786161 implements MigrationInterface {
  name = 'AddSidebarPins1792715786161';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`sidebarpins\` (\`id\` int NOT NULL AUTO_INCREMENT, \`UserId\` int NOT NULL, \`WorkspaceId\` int NOT NULL, \`kind\` varchar(10) NOT NULL, \`ChannelId\` int NULL, \`PeerId\` int NULL, \`ChatId\` int NULL, \`position\` int NOT NULL DEFAULT '0', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`sidebarpins_thread\` (\`UserId\`, \`ChatId\`), UNIQUE INDEX \`sidebarpins_dm\` (\`UserId\`, \`WorkspaceId\`, \`PeerId\`), UNIQUE INDEX \`sidebarpins_channel\` (\`UserId\`, \`ChannelId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sidebarpins\` ADD CONSTRAINT \`FK_a2b58e894ede745b89c5d62acf6\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sidebarpins\` ADD CONSTRAINT \`FK_14318d86465a36cd5ff8ce33574\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sidebarpins\` ADD CONSTRAINT \`FK_30fe205a959d6026d1399cdd1f4\` FOREIGN KEY (\`ChannelId\`) REFERENCES \`channels\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sidebarpins\` ADD CONSTRAINT \`FK_185973d84105b0cf6a8b93cb1a6\` FOREIGN KEY (\`PeerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sidebarpins\` ADD CONSTRAINT \`FK_8453d24b247430570aabec39b38\` FOREIGN KEY (\`ChatId\`) REFERENCES \`channelchats\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`sidebarpins\` DROP FOREIGN KEY \`FK_8453d24b247430570aabec39b38\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sidebarpins\` DROP FOREIGN KEY \`FK_185973d84105b0cf6a8b93cb1a6\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sidebarpins\` DROP FOREIGN KEY \`FK_30fe205a959d6026d1399cdd1f4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sidebarpins\` DROP FOREIGN KEY \`FK_14318d86465a36cd5ff8ce33574\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`sidebarpins\` DROP FOREIGN KEY \`FK_a2b58e894ede745b89c5d62acf6\``,
    );
    await queryRunner.query(
      `DROP INDEX \`sidebarpins_channel\` ON \`sidebarpins\``,
    );
    await queryRunner.query(`DROP INDEX \`sidebarpins_dm\` ON \`sidebarpins\``);
    await queryRunner.query(
      `DROP INDEX \`sidebarpins_thread\` ON \`sidebarpins\``,
    );
    await queryRunner.query(`DROP TABLE \`sidebarpins\``);
  }
}
