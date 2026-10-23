import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Apps } from './Apps';

// 앱이 등록한 슬래시 명령 (/deploy 등). 입력하면 앱 주소로 요청을 보낸다
@Index('appcommands_workspace_command', ['WorkspaceId', 'command'], {
  unique: true,
})
@Entity({ name: 'appcommands' })
export class AppCommands {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'AppId' })
  AppId: number;

  @Column('int', { name: 'WorkspaceId' })
  WorkspaceId: number;

  // '/' 없이 소문자 (deploy)
  @Column('varchar', { name: 'command', length: 32 })
  command: string;

  @Column('varchar', { name: 'url', length: 500 })
  url: string;

  @Column('varchar', { name: 'description', length: 100, nullable: true })
  description: string | null;

  // 입력 예 (예: 서버이름)
  @Column('varchar', { name: 'usageHint', length: 100, nullable: true })
  usageHint: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Apps, (app) => app.Commands, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'AppId', referencedColumnName: 'id' }])
  App: Apps;
}
