import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1704957597056 implements MigrationInterface {
  name = 'Migrations1704957597056';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `mentions` RENAME COLUMN `category` TO `type`',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `mentions` RENAME COLUMN `type` TO `category`',
    );
  }
}
