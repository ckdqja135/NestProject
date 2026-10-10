import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1791604622335 implements MigrationInterface {
  name = 'Init1791604622335';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`dms\` (\`id\` int NOT NULL AUTO_INCREMENT, \`content\` text NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`editedAt\` datetime NULL, \`WorkspaceId\` int NULL, \`SenderId\` int NULL, \`ReceiverId\` int NULL, INDEX \`dms_ibfk_3\` (\`ReceiverId\`), INDEX \`dms_ibfk_2\` (\`SenderId\`), INDEX \`WorkspaceId\` (\`WorkspaceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`mentions\` (\`id\` int NOT NULL AUTO_INCREMENT, \`category\` enum ('chat', 'dm', 'system') NOT NULL, \`ChatId\` int NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`readAt\` datetime NULL, \`WorkspaceId\` int NULL, \`SenderId\` int NULL, \`ReceiverId\` int NULL, INDEX \`ReceiverId\` (\`ReceiverId\`), INDEX \`SenderId\` (\`SenderId\`), INDEX \`WorkspaceId\` (\`WorkspaceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`workspacemembers\` (\`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`WorkspaceId\` int NOT NULL, \`UserId\` int NOT NULL, \`loggedInAt\` datetime NULL, INDEX \`UserId\` (\`UserId\`), PRIMARY KEY (\`WorkspaceId\`, \`UserId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`workspaces\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(30) NOT NULL, \`url\` varchar(30) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`OwnerId\` int NULL, INDEX \`OwnerId\` (\`OwnerId\`), UNIQUE INDEX \`url\` (\`url\`), UNIQUE INDEX \`name\` (\`name\`), UNIQUE INDEX \`IDX_de659ece27e93d8fe29339d0a4\` (\`name\`), UNIQUE INDEX \`IDX_22a04f0c0bf6ffd5961a28f5b7\` (\`url\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`channels\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(30) NOT NULL, \`private\` tinyint NULL DEFAULT 0, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`WorkspaceId\` int NULL, INDEX \`WorkspaceId\` (\`WorkspaceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`channelmembers\` (\`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`ChannelId\` int NOT NULL, \`UserId\` int NOT NULL, INDEX \`UserId\` (\`UserId\`), PRIMARY KEY (\`ChannelId\`, \`UserId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`id\` int NOT NULL AUTO_INCREMENT, \`email\` varchar(30) NOT NULL, \`nickname\` varchar(30) NOT NULL, \`password\` varchar(100) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, UNIQUE INDEX \`email\` (\`email\`), UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`reactions\` (\`id\` int NOT NULL AUTO_INCREMENT, \`emoji\` varchar(16) CHARACTER SET "utf8mb4" COLLATE "utf8mb4_bin" NOT NULL, \`ChatId\` int NOT NULL, \`UserId\` int NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`UserId\` (\`UserId\`), UNIQUE INDEX \`chat_user_emoji\` (\`ChatId\`, \`UserId\`, \`emoji\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`channelchats\` (\`id\` int NOT NULL AUTO_INCREMENT, \`content\` text NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`editedAt\` datetime NULL, \`UserId\` int NULL, \`ChannelId\` int NULL, \`ParentId\` int NULL, \`pinned\` tinyint NOT NULL DEFAULT 0, INDEX \`ParentId\` (\`ParentId\`), INDEX \`ChannelId\` (\`ChannelId\`), INDEX \`UserId\` (\`UserId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`dms\` ADD CONSTRAINT \`FK_904b6c6393befe39400ad9ff29c\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`dms\` ADD CONSTRAINT \`FK_e0b2f87fa1167f44f12aea6f5ca\` FOREIGN KEY (\`SenderId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`dms\` ADD CONSTRAINT \`FK_ccb84506be7d2dcb3df1163e8ac\` FOREIGN KEY (\`ReceiverId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`mentions\` ADD CONSTRAINT \`FK_51792a8377dc294a53b2bf7b213\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`mentions\` ADD CONSTRAINT \`FK_f2a3d51cdda2918df6295336ebb\` FOREIGN KEY (\`SenderId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`mentions\` ADD CONSTRAINT \`FK_9cdbb618081d505406bde0e248e\` FOREIGN KEY (\`ReceiverId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`workspacemembers\` ADD CONSTRAINT \`FK_77afc26dfe5a8633e6ce35eaa44\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`workspacemembers\` ADD CONSTRAINT \`FK_1f3af49b8195937f52d3a66e566\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`workspaces\` ADD CONSTRAINT \`FK_d9a20240a57a1c75e626ef56b2f\` FOREIGN KEY (\`OwnerId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`channels\` ADD CONSTRAINT \`FK_9fb12216c2d8cac3fad686e293b\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`channelmembers\` ADD CONSTRAINT \`FK_e53905ed6170fb65083051881e7\` FOREIGN KEY (\`ChannelId\`) REFERENCES \`channels\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`channelmembers\` ADD CONSTRAINT \`FK_3446cc443ce59a7f7ae62acc168\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reactions\` ADD CONSTRAINT \`FK_e5ac2b38b5d127e629eb5bb1b85\` FOREIGN KEY (\`ChatId\`) REFERENCES \`channelchats\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reactions\` ADD CONSTRAINT \`FK_186078b39de1e7f08b8740d37b8\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`channelchats\` ADD CONSTRAINT \`FK_d94a7a11d2bc17e56ed7c9790c3\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`channelchats\` ADD CONSTRAINT \`FK_8494e7d49237c46d648fbab8cf4\` FOREIGN KEY (\`ChannelId\`) REFERENCES \`channels\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`channelchats\` ADD CONSTRAINT \`FK_6f299d0bf72515604db585ceef9\` FOREIGN KEY (\`ParentId\`) REFERENCES \`channelchats\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`channelchats\` DROP FOREIGN KEY \`FK_6f299d0bf72515604db585ceef9\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`channelchats\` DROP FOREIGN KEY \`FK_8494e7d49237c46d648fbab8cf4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`channelchats\` DROP FOREIGN KEY \`FK_d94a7a11d2bc17e56ed7c9790c3\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reactions\` DROP FOREIGN KEY \`FK_186078b39de1e7f08b8740d37b8\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reactions\` DROP FOREIGN KEY \`FK_e5ac2b38b5d127e629eb5bb1b85\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`channelmembers\` DROP FOREIGN KEY \`FK_3446cc443ce59a7f7ae62acc168\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`channelmembers\` DROP FOREIGN KEY \`FK_e53905ed6170fb65083051881e7\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`channels\` DROP FOREIGN KEY \`FK_9fb12216c2d8cac3fad686e293b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`workspaces\` DROP FOREIGN KEY \`FK_d9a20240a57a1c75e626ef56b2f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`workspacemembers\` DROP FOREIGN KEY \`FK_1f3af49b8195937f52d3a66e566\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`workspacemembers\` DROP FOREIGN KEY \`FK_77afc26dfe5a8633e6ce35eaa44\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`mentions\` DROP FOREIGN KEY \`FK_9cdbb618081d505406bde0e248e\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`mentions\` DROP FOREIGN KEY \`FK_f2a3d51cdda2918df6295336ebb\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`mentions\` DROP FOREIGN KEY \`FK_51792a8377dc294a53b2bf7b213\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`dms\` DROP FOREIGN KEY \`FK_ccb84506be7d2dcb3df1163e8ac\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`dms\` DROP FOREIGN KEY \`FK_e0b2f87fa1167f44f12aea6f5ca\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`dms\` DROP FOREIGN KEY \`FK_904b6c6393befe39400ad9ff29c\``,
    );
    await queryRunner.query(`DROP INDEX \`UserId\` ON \`channelchats\``);
    await queryRunner.query(`DROP INDEX \`ChannelId\` ON \`channelchats\``);
    await queryRunner.query(`DROP INDEX \`ParentId\` ON \`channelchats\``);
    await queryRunner.query(`DROP TABLE \`channelchats\``);
    await queryRunner.query(`DROP INDEX \`chat_user_emoji\` ON \`reactions\``);
    await queryRunner.query(`DROP INDEX \`UserId\` ON \`reactions\``);
    await queryRunner.query(`DROP TABLE \`reactions\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\``,
    );
    await queryRunner.query(`DROP INDEX \`email\` ON \`users\``);
    await queryRunner.query(`DROP TABLE \`users\``);
    await queryRunner.query(`DROP INDEX \`UserId\` ON \`channelmembers\``);
    await queryRunner.query(`DROP TABLE \`channelmembers\``);
    await queryRunner.query(`DROP INDEX \`WorkspaceId\` ON \`channels\``);
    await queryRunner.query(`DROP TABLE \`channels\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_22a04f0c0bf6ffd5961a28f5b7\` ON \`workspaces\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_de659ece27e93d8fe29339d0a4\` ON \`workspaces\``,
    );
    await queryRunner.query(`DROP INDEX \`name\` ON \`workspaces\``);
    await queryRunner.query(`DROP INDEX \`url\` ON \`workspaces\``);
    await queryRunner.query(`DROP INDEX \`OwnerId\` ON \`workspaces\``);
    await queryRunner.query(`DROP TABLE \`workspaces\``);
    await queryRunner.query(`DROP INDEX \`UserId\` ON \`workspacemembers\``);
    await queryRunner.query(`DROP TABLE \`workspacemembers\``);
    await queryRunner.query(`DROP INDEX \`WorkspaceId\` ON \`mentions\``);
    await queryRunner.query(`DROP INDEX \`SenderId\` ON \`mentions\``);
    await queryRunner.query(`DROP INDEX \`ReceiverId\` ON \`mentions\``);
    await queryRunner.query(`DROP TABLE \`mentions\``);
    await queryRunner.query(`DROP INDEX \`WorkspaceId\` ON \`dms\``);
    await queryRunner.query(`DROP INDEX \`dms_ibfk_2\` ON \`dms\``);
    await queryRunner.query(`DROP INDEX \`dms_ibfk_3\` ON \`dms\``);
    await queryRunner.query(`DROP TABLE \`dms\``);
  }
}
