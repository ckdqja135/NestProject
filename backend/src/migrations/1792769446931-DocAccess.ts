import { MigrationInterface, QueryRunner } from 'typeorm';

export class DocAccess1792769446931 implements MigrationInterface {
  name = 'DocAccess1792769446931';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`docaccessrequests\` (\`id\` int NOT NULL AUTO_INCREMENT, \`DocId\` int NOT NULL, \`UserId\` int NOT NULL, \`role\` varchar(10) NOT NULL DEFAULT 'view', \`message\` varchar(300) NULL, \`requestedAt\` datetime NOT NULL, UNIQUE INDEX \`docaccessrequests_doc_user\` (\`DocId\`, \`UserId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docs\` ADD \`linkRole\` varchar(10) NOT NULL DEFAULT 'view'`,
    );
    // 위키는 워크스페이스 모두가 함께 고치는 곳이라 편집 그대로 둔다 (다른 공개 문서는 이제 기본이 보기만)
    await queryRunner.query(
      `UPDATE \`docs\` SET \`linkRole\` = 'edit' WHERE \`type\` = 'wiki'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docaccessrequests\` ADD CONSTRAINT \`FK_2848f4b4293481182362d38c93a\` FOREIGN KEY (\`DocId\`) REFERENCES \`docs\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`docaccessrequests\` ADD CONSTRAINT \`FK_a9a87db606fbf4c105449910be3\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`docaccessrequests\` DROP FOREIGN KEY \`FK_a9a87db606fbf4c105449910be3\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`docaccessrequests\` DROP FOREIGN KEY \`FK_2848f4b4293481182362d38c93a\``,
    );
    await queryRunner.query(`ALTER TABLE \`docs\` DROP COLUMN \`linkRole\``);
    await queryRunner.query(
      `DROP INDEX \`docaccessrequests_doc_user\` ON \`docaccessrequests\``,
    );
    await queryRunner.query(`DROP TABLE \`docaccessrequests\``);
  }
}
