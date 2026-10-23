import { MigrationInterface, QueryRunner } from 'typeorm';

export class SectionsPushDnd1792744285744 implements MigrationInterface {
  name = 'SectionsPushDnd1792744285744';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`sidebarsectionitems\` (\`id\` int NOT NULL AUTO_INCREMENT, \`SectionId\` int NOT NULL, \`UserId\` int NOT NULL, \`WorkspaceId\` int NOT NULL, \`kind\` varchar(10) NOT NULL, \`TargetId\` int NOT NULL, UNIQUE INDEX \`sidebarsectionitems_target\` (\`UserId\`, \`WorkspaceId\`, \`kind\`, \`TargetId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`sidebarsections\` (\`id\` int NOT NULL AUTO_INCREMENT, \`UserId\` int NOT NULL, \`WorkspaceId\` int NOT NULL, \`name\` varchar(40) NOT NULL, \`position\` int NOT NULL DEFAULT '0', \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`sidebarsections_user\` (\`UserId\`, \`WorkspaceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`pushsubscriptions\` (\`id\` int NOT NULL AUTO_INCREMENT, \`UserId\` int NOT NULL, \`endpoint\` varchar(500) NOT NULL, \`p256dh\` varchar(200) NOT NULL, \`auth\` varchar(100) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`pushsubscriptions_endpoint\` (\`endpoint\`), INDEX \`pushsubscriptions_user\` (\`UserId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`appsettings\` (\`key\` varchar(60) NOT NULL, \`value\` text NOT NULL, PRIMARY KEY (\`key\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`dndSchedule\` varchar(200) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sidebarsectionitems\` ADD CONSTRAINT \`FK_122db62721dc40a505162c58c7b\` FOREIGN KEY (\`SectionId\`) REFERENCES \`sidebarsections\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`sidebarsectionitems\` DROP FOREIGN KEY \`FK_122db62721dc40a505162c58c7b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`dndSchedule\``,
    );
    await queryRunner.query(`DROP TABLE \`appsettings\``);
    await queryRunner.query(
      `DROP INDEX \`pushsubscriptions_user\` ON \`pushsubscriptions\``,
    );
    await queryRunner.query(
      `DROP INDEX \`pushsubscriptions_endpoint\` ON \`pushsubscriptions\``,
    );
    await queryRunner.query(`DROP TABLE \`pushsubscriptions\``);
    await queryRunner.query(
      `DROP INDEX \`sidebarsections_user\` ON \`sidebarsections\``,
    );
    await queryRunner.query(`DROP TABLE \`sidebarsections\``);
    await queryRunner.query(
      `DROP INDEX \`sidebarsectionitems_target\` ON \`sidebarsectionitems\``,
    );
    await queryRunner.query(`DROP TABLE \`sidebarsectionitems\``);
  }
}
