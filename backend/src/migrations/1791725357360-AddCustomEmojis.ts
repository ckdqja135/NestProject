import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomEmojis1791725357360 implements MigrationInterface {
  name = 'AddCustomEmojis1791725357360';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`customemojis\` (\`id\` int NOT NULL AUTO_INCREMENT, \`WorkspaceId\` int NOT NULL, \`name\` varchar(14) NOT NULL, \`image\` mediumtext NOT NULL, \`CreatorId\` int NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`workspace_name\` (\`WorkspaceId\`, \`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`customemojis\` ADD CONSTRAINT \`FK_36dda27566d10e253095824496f\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`customemojis\` ADD CONSTRAINT \`FK_3ebd52eb3b61c96f3cbd40ef455\` FOREIGN KEY (\`CreatorId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`customemojis\` DROP FOREIGN KEY \`FK_3ebd52eb3b61c96f3cbd40ef455\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`customemojis\` DROP FOREIGN KEY \`FK_36dda27566d10e253095824496f\``,
    );
    await queryRunner.query(
      `DROP INDEX \`workspace_name\` ON \`customemojis\``,
    );
    await queryRunner.query(`DROP TABLE \`customemojis\``);
  }
}
