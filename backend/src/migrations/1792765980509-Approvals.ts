import { MigrationInterface, QueryRunner } from 'typeorm';

export class Approvals1792765980509 implements MigrationInterface {
  name = 'Approvals1792765980509';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`approvalsteps\` (\`id\` int NOT NULL AUTO_INCREMENT, \`ApprovalId\` int NOT NULL, \`position\` int NOT NULL, \`ApproverId\` int NOT NULL, \`status\` varchar(10) NOT NULL, \`comment\` varchar(500) NULL, \`decidedAt\` datetime NULL, INDEX \`approvalsteps_approver\` (\`ApproverId\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`approvals\` (\`id\` int NOT NULL AUTO_INCREMENT, \`WorkspaceId\` int NOT NULL, \`RequesterId\` int NOT NULL, \`kind\` varchar(20) NOT NULL DEFAULT 'general', \`title\` varchar(200) NOT NULL, \`body\` text NULL, \`fields\` varchar(1000) NULL, \`status\` varchar(10) NOT NULL DEFAULT 'pending', \`ChannelId\` int NULL, \`PeerId\` int NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`decidedAt\` datetime NULL, INDEX \`approvals_workspace\` (\`WorkspaceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`approvalsteps\` ADD CONSTRAINT \`FK_8a6256b8e4d66c38883c5bfa9ef\` FOREIGN KEY (\`ApprovalId\`) REFERENCES \`approvals\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`approvalsteps\` DROP FOREIGN KEY \`FK_8a6256b8e4d66c38883c5bfa9ef\``,
    );
    await queryRunner.query(
      `DROP INDEX \`approvals_workspace\` ON \`approvals\``,
    );
    await queryRunner.query(`DROP TABLE \`approvals\``);
    await queryRunner.query(
      `DROP INDEX \`approvalsteps_approver\` ON \`approvalsteps\``,
    );
    await queryRunner.query(`DROP TABLE \`approvalsteps\``);
  }
}
