import { MigrationInterface, QueryRunner } from 'typeorm';

export class MemberRoles1792741545430 implements MigrationInterface {
  name = 'MemberRoles1792741545430';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`workspacemembers\` ADD \`role\` varchar(10) NOT NULL DEFAULT 'member'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`workspacemembers\` DROP COLUMN \`role\``,
    );
  }
}
