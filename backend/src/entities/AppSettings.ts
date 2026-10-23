import { Column, Entity } from 'typeorm';

// 서버 설정 값 (예: 푸시 알림 서명 키). .env 에 없으면 처음 켤 때 만들어 여기에 둔다
@Entity({ name: 'appsettings' })
export class AppSettings {
  @Column('varchar', { primary: true, name: 'key', length: 60 })
  key: string;

  @Column('text', { name: 'value' })
  value: string;
}
