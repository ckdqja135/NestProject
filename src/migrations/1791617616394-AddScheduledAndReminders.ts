import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduledAndReminders1791617616394
  implements MigrationInterface
{
  name = 'AddScheduledAndReminders1791617616394';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`scheduledmessages\` (\`id\` int NOT NULL AUTO_INCREMENT, \`UserId\` int NOT NULL, \`WorkspaceId\` int NOT NULL, \`ChannelId\` int NULL, \`ReceiverId\` int NULL, \`content\` text NOT NULL, \`sendAt\` datetime NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`sendAt\` (\`sendAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`reminders\` (\`id\` int NOT NULL AUTO_INCREMENT, \`UserId\` int NOT NULL, \`WorkspaceId\` int NOT NULL, \`ChatId\` int NULL, \`DMId\` int NULL, \`remindAt\` datetime NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`remindAt\` (\`remindAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`scheduledmessages\` ADD CONSTRAINT \`FK_979437fb1d51c638aec324c3f08\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`scheduledmessages\` ADD CONSTRAINT \`FK_e44ba2820c2c88a1729bb3383e3\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`scheduledmessages\` ADD CONSTRAINT \`FK_3b61d99a824a0aff70fe4b805fe\` FOREIGN KEY (\`ChannelId\`) REFERENCES \`channels\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`scheduledmessages\` ADD CONSTRAINT \`FK_2dd2ff68245af9d98b1c2339bdc\` FOREIGN KEY (\`ReceiverId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reminders\` ADD CONSTRAINT \`FK_2290849e75f9d7d51c041ec54c6\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reminders\` ADD CONSTRAINT \`FK_02846b007be07d48f4267bfb039\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reminders\` ADD CONSTRAINT \`FK_e3cf41f5b962250dcd5ee09b7ce\` FOREIGN KEY (\`ChatId\`) REFERENCES \`channelchats\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reminders\` ADD CONSTRAINT \`FK_d6702667e5b31ab05a37df14f76\` FOREIGN KEY (\`DMId\`) REFERENCES \`dms\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`reminders\` DROP FOREIGN KEY \`FK_d6702667e5b31ab05a37df14f76\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reminders\` DROP FOREIGN KEY \`FK_e3cf41f5b962250dcd5ee09b7ce\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reminders\` DROP FOREIGN KEY \`FK_02846b007be07d48f4267bfb039\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reminders\` DROP FOREIGN KEY \`FK_2290849e75f9d7d51c041ec54c6\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`scheduledmessages\` DROP FOREIGN KEY \`FK_2dd2ff68245af9d98b1c2339bdc\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`scheduledmessages\` DROP FOREIGN KEY \`FK_3b61d99a824a0aff70fe4b805fe\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`scheduledmessages\` DROP FOREIGN KEY \`FK_e44ba2820c2c88a1729bb3383e3\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`scheduledmessages\` DROP FOREIGN KEY \`FK_979437fb1d51c638aec324c3f08\``,
    );
    await queryRunner.query(`DROP INDEX \`remindAt\` ON \`reminders\``);
    await queryRunner.query(`DROP TABLE \`reminders\``);
    await queryRunner.query(`DROP INDEX \`sendAt\` ON \`scheduledmessages\``);
    await queryRunner.query(`DROP TABLE \`scheduledmessages\``);
  }
}
