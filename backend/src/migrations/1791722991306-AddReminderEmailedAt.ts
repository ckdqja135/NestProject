import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReminderEmailedAt1791722991306 implements MigrationInterface {
  name = 'AddReminderEmailedAt1791722991306';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`reminders\` ADD \`emailedAt\` datetime NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`reminders\` DROP COLUMN \`emailedAt\``,
    );
  }
}
