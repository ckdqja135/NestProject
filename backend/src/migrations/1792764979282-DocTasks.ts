import { MigrationInterface, QueryRunner } from 'typeorm';

export class DocTasks1792764979282 implements MigrationInterface {
  name = 'DocTasks1792764979282';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`doctasks\` (\`id\` int NOT NULL AUTO_INCREMENT, \`DocId\` int NOT NULL, \`RowId\` varchar(40) NOT NULL, \`WorkspaceId\` int NOT NULL, \`title\` varchar(300) NOT NULL, \`due\` varchar(10) NULL, \`statusName\` varchar(60) NULL, \`done\` tinyint NOT NULL DEFAULT 0, \`assignees\` varchar(500) NOT NULL, \`updatedAt\` datetime NOT NULL, INDEX \`doctasks_workspace\` (\`WorkspaceId\`), UNIQUE INDEX \`doctasks_row\` (\`DocId\`, \`RowId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`doctasks_row\` ON \`doctasks\``);
    await queryRunner.query(
      `DROP INDEX \`doctasks_workspace\` ON \`doctasks\``,
    );
    await queryRunner.query(`DROP TABLE \`doctasks\``);
  }
}
