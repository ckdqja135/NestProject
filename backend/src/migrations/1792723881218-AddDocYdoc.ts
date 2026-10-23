import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocYdoc1792723881218 implements MigrationInterface {
  name = 'AddDocYdoc1792723881218';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`docs\` ADD \`ydoc\` longblob NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`docs\` DROP COLUMN \`ydoc\``);
  }
}
