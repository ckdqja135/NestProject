import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContacts1792717705857 implements MigrationInterface {
  name = 'AddContacts1792717705857';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`contacts\` (\`id\` int NOT NULL AUTO_INCREMENT, \`OwnerId\` int NOT NULL, \`WorkspaceId\` int NOT NULL, \`name\` varchar(40) NOT NULL, \`company\` varchar(60) NULL, \`department\` varchar(40) NULL, \`jobTitle\` varchar(40) NULL, \`email\` varchar(100) NULL, \`phone\` varchar(30) NULL, \`memo\` varchar(500) NULL, \`starred\` tinyint NOT NULL DEFAULT 0, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`contacts_owner\` (\`OwnerId\`, \`WorkspaceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`contactstars\` (\`UserId\` int NOT NULL, \`WorkspaceId\` int NOT NULL, \`MemberId\` int NOT NULL, PRIMARY KEY (\`UserId\`, \`WorkspaceId\`, \`MemberId\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`department\` varchar(40) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`jobTitle\` varchar(40) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`phone\` varchar(30) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`contacts\` ADD CONSTRAINT \`FK_2c18b027003391aa67c14ff27c6\` FOREIGN KEY (\`OwnerId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`contacts\` ADD CONSTRAINT \`FK_c59ef252ac90abd4496ae743d77\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`contactstars\` ADD CONSTRAINT \`FK_39e7ee51cadc5b59203ceb43738\` FOREIGN KEY (\`UserId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`contactstars\` ADD CONSTRAINT \`FK_05d82afd0f52042be6f27b5af4c\` FOREIGN KEY (\`WorkspaceId\`) REFERENCES \`workspaces\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`contactstars\` ADD CONSTRAINT \`FK_b1e71ea81a69e1c13e754c5dbf2\` FOREIGN KEY (\`MemberId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`contactstars\` DROP FOREIGN KEY \`FK_b1e71ea81a69e1c13e754c5dbf2\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`contactstars\` DROP FOREIGN KEY \`FK_05d82afd0f52042be6f27b5af4c\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`contactstars\` DROP FOREIGN KEY \`FK_39e7ee51cadc5b59203ceb43738\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`contacts\` DROP FOREIGN KEY \`FK_c59ef252ac90abd4496ae743d77\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`contacts\` DROP FOREIGN KEY \`FK_2c18b027003391aa67c14ff27c6\``,
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`phone\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`jobTitle\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`department\``);
    await queryRunner.query(`DROP TABLE \`contactstars\``);
    await queryRunner.query(`DROP INDEX \`contacts_owner\` ON \`contacts\``);
    await queryRunner.query(`DROP TABLE \`contacts\``);
  }
}
