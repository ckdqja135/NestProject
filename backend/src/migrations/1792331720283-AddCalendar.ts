import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCalendar1792331720283 implements MigrationInterface {
  name = 'AddCalendar1792331720283';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`calendarattendees\` (\`EventId\` int NOT NULL, \`UserId\` int NOT NULL, \`status\` varchar(10) NOT NULL DEFAULT 'pending', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`EventId\`, \`UserId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`calendarevents\` (\`id\` int NOT NULL AUTO_INCREMENT, \`WorkspaceId\` int NOT NULL, \`title\` varchar(120) NOT NULL, \`description\` text NULL, \`location\` varchar(120) NULL, \`startAt\` datetime NOT NULL, \`endAt\` datetime NOT NULL, \`allDay\` tinyint NOT NULL DEFAULT 0, \`color\` varchar(20) NULL, \`visibility\` varchar(10) NOT NULL DEFAULT 'public', \`reminderMinutes\` int NULL, \`remindedAt\` datetime NULL, \`OwnerId\` int NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`calendarevents_range\` (\`WorkspaceId\`, \`startAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`calendarfollows\` (\`WorkspaceId\` int NOT NULL, \`UserId\` int NOT NULL, \`FollowingId\` int NOT NULL, PRIMARY KEY (\`WorkspaceId\`, \`UserId\`, \`FollowingId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`bot\` tinyint NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarattendees\` ADD CONSTRAINT \`FK_fb7d9e80536bce0b65bbbff66a0\` FOREIGN KEY (\`EventId\`) REFERENCES \`calendarevents\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarattendees\` ADD CONSTRAINT \`FK_56e99d3c4196564eccaaceb863f\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevents\` ADD CONSTRAINT \`FK_1e481186b873712c81a4daa02d0\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevents\` ADD CONSTRAINT \`FK_212629b4f2026fd929ff9f782c3\` FOREIGN KEY (\`OwnerId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarfollows\` ADD CONSTRAINT \`FK_0cc92e995ac3efb71fc34cc1c00\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarfollows\` ADD CONSTRAINT \`FK_a67d1ccfca459651b24a393418b\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarfollows\` ADD CONSTRAINT \`FK_31cca22410cdf5250d81926b446\` FOREIGN KEY (\`FollowingId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`calendarfollows\` DROP FOREIGN KEY \`FK_31cca22410cdf5250d81926b446\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarfollows\` DROP FOREIGN KEY \`FK_a67d1ccfca459651b24a393418b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarfollows\` DROP FOREIGN KEY \`FK_0cc92e995ac3efb71fc34cc1c00\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevents\` DROP FOREIGN KEY \`FK_212629b4f2026fd929ff9f782c3\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevents\` DROP FOREIGN KEY \`FK_1e481186b873712c81a4daa02d0\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarattendees\` DROP FOREIGN KEY \`FK_56e99d3c4196564eccaaceb863f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarattendees\` DROP FOREIGN KEY \`FK_fb7d9e80536bce0b65bbbff66a0\``,
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`bot\``);
    await queryRunner.query(`DROP TABLE \`calendarfollows\``);
    await queryRunner.query(
      `DROP INDEX \`calendarevents_range\` ON \`calendarevents\``,
    );
    await queryRunner.query(`DROP TABLE \`calendarevents\``);
    await queryRunner.query(`DROP TABLE \`calendarattendees\``);
  }
}
