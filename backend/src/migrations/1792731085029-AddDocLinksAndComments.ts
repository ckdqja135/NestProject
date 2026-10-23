import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocLinksAndComments1792731085029 implements MigrationInterface {
  name = 'AddDocLinksAndComments1792731085029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`doclinks\` (\`FromId\` int NOT NULL, \`ToId\` int NOT NULL, INDEX \`doclinks_to\` (\`ToId\`), PRIMARY KEY (\`FromId\`, \`ToId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`doccomments\` (\`id\` int NOT NULL AUTO_INCREMENT, \`DocId\` int NOT NULL, \`UserId\` int NULL, \`threadId\` varchar(40) NOT NULL, \`content\` text NOT NULL, \`quote\` varchar(300) NULL, \`resolved\` tinyint NOT NULL DEFAULT 0, \`editedAt\` datetime NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`doccomments_doc\` (\`DocId\`, \`threadId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`doclinks\` ADD CONSTRAINT \`FK_37c7d4a9839db4f6dfd4ce136e9\` FOREIGN KEY (\`FromId\`) REFERENCES \`docs\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`doclinks\` ADD CONSTRAINT \`FK_094ded60a27a6cb15233e358b81\` FOREIGN KEY (\`ToId\`) REFERENCES \`docs\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`doccomments\` ADD CONSTRAINT \`FK_228549b46efe789d45128bfc2f5\` FOREIGN KEY (\`DocId\`) REFERENCES \`docs\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`doccomments\` ADD CONSTRAINT \`FK_8af64c037885915caa4c274d7fd\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`doccomments\` DROP FOREIGN KEY \`FK_8af64c037885915caa4c274d7fd\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`doccomments\` DROP FOREIGN KEY \`FK_228549b46efe789d45128bfc2f5\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`doclinks\` DROP FOREIGN KEY \`FK_094ded60a27a6cb15233e358b81\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`doclinks\` DROP FOREIGN KEY \`FK_37c7d4a9839db4f6dfd4ce136e9\``,
    );
    await queryRunner.query(
      `DROP INDEX \`doccomments_doc\` ON \`doccomments\``,
    );
    await queryRunner.query(`DROP TABLE \`doccomments\``);
    await queryRunner.query(`DROP INDEX \`doclinks_to\` ON \`doclinks\``);
    await queryRunner.query(`DROP TABLE \`doclinks\``);
  }
}
