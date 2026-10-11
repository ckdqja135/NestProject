import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserGroups1791721741148 implements MigrationInterface {
  name = 'AddUserGroups1791721741148';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`usergroupmembers\` (\`GroupId\` int NOT NULL, \`UserId\` int NOT NULL, INDEX \`UserId\` (\`UserId\`), PRIMARY KEY (\`GroupId\`, \`UserId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`usergroups\` (\`id\` int NOT NULL AUTO_INCREMENT, \`WorkspaceId\` int NOT NULL, \`name\` varchar(30) NOT NULL, \`description\` varchar(100) NULL, \`CreatorId\` int NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`workspace_name\` (\`WorkspaceId\`, \`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`usergroupmembers\` ADD CONSTRAINT \`FK_52c2c4e03d8ed331289d106fe6f\` FOREIGN KEY (\`GroupId\`) REFERENCES \`usergroups\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`usergroupmembers\` ADD CONSTRAINT \`FK_bc5d06b4d0be58e4612d2e9f1b8\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`usergroups\` ADD CONSTRAINT \`FK_7358820422174c93b0e67794d3d\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`usergroups\` ADD CONSTRAINT \`FK_c75d5cfab2bec9263f4265611e4\` FOREIGN KEY (\`CreatorId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`usergroups\` DROP FOREIGN KEY \`FK_c75d5cfab2bec9263f4265611e4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`usergroups\` DROP FOREIGN KEY \`FK_7358820422174c93b0e67794d3d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`usergroupmembers\` DROP FOREIGN KEY \`FK_bc5d06b4d0be58e4612d2e9f1b8\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`usergroupmembers\` DROP FOREIGN KEY \`FK_52c2c4e03d8ed331289d106fe6f\``,
    );
    await queryRunner.query(`DROP INDEX \`workspace_name\` ON \`usergroups\``);
    await queryRunner.query(`DROP TABLE \`usergroups\``);
    await queryRunner.query(`DROP INDEX \`UserId\` ON \`usergroupmembers\``);
    await queryRunner.query(`DROP TABLE \`usergroupmembers\``);
  }
}
