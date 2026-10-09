# Shlack (Slack 클론)

NestJS + TypeORM(MariaDB) + Socket.IO 백엔드와 React 프론트엔드(`front/`)로 구성된 Slack 클론입니다.
API 명세는 [API.md](./API.md) 참고, Swagger 는 서버 실행 후 http://localhost:3002/api 에서 볼 수 있습니다.

## 1. 환경 변수 (`.env`)

```
SECRET=세션_시크릿
DB_USER=root
DB_PW=비밀번호
DB_NAME=shlack
# 선택: DB_HOST(기본 localhost), DB_PORT(기본 3306), PORT(기본 3002)
# 선택: GIF 검색 사용 시 GIPHY API 키 (https://developers.giphy.com 에서 무료 발급)
GIPHY_API_KEY=
```

## 2. DB 준비 (최초 1회)

MariaDB 설치 및 root 비밀번호 설정 (macOS/Homebrew):

```bash
brew install mariadb
brew services start mariadb
mariadb -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '123456';"
```


```bash
npm install
npm run db:setup   # DB 생성 → 스키마 동기화 → 기본 워크스페이스(shlack)/채널(일반) 시드
```

개별 실행: `npm run db:create`, `npm run schema:sync`, `npm run seed`

## 3. 실행

```bash
# 백엔드 (http://localhost:3002)
npm run start:dev

# 프론트엔드 (http://localhost:3090, /api 요청은 3002로 프록시)
cd front
npm install
npm run dev
```

http://localhost:3090 접속 → 회원가입 → 로그인하면 기본 워크스페이스 `shlack` 의 `#일반` 채널로 이동합니다.

## 주요 기능

- 회원가입/로그인, 워크스페이스·채널 생성 및 초대, DM, 이미지 업로드(드래그 앤 드롭)
- 실시간 채팅, 온라인 표시, 안 읽은 메시지 수
- Mattermost 기능 대응
  - 메시지 수정/삭제 (채널, DM) · `(수정됨)` 표시
  - 이모지 리액션 (채널 메시지)
  - 스레드 답글 (오른쪽 스레드 패널)
  - 메시지 고정 (📌 고정 목록 패널)
  - 메시지 검색 (상단 검색창, 채널 + DM)
  - 입력 중 표시 (채널, DM)
  - 채널 나가기 (`#일반` 제외)
  - 공개/비공개 채널: 공개 채널은 `채널 둘러보기`에서 직접 참여, 🔒 비공개 채널은 초대받은 사람만 보고 참여
  - GIF 검색해서 보내기 (GIPHY, `GIPHY_API_KEY` 필요)
  - 이미지/GIF 첨부 버튼, 붙여넣기 업로드 (JPG/PNG/GIF/WebP, 20MB 이하)
- 보안
  - 소켓도 로그인 세션으로 사용자를 확인하고, 참여 중인 채널 방에만 들어간다
  - 채널 API는 채널 멤버만 사용 가능 (비공개 채널은 비멤버에게 404)

> 이미 DB를 만들어 둔 상태에서 업데이트했다면 `npm run schema:sync` 로 새 컬럼/테이블을 반영하세요.

## 구조

- `src/users` 회원가입/로그인/로그아웃 (passport-local + express-session)
- `src/workspaces` 워크스페이스 생성, 멤버 조회/초대/강퇴
- `src/channels` 채널 생성/조회, 채팅, 이미지 업로드, 안 읽은 메시지 수
- `src/dms` DM 채팅, 이미지 업로드, 안 읽은 메시지 수
- `src/search` 메시지 검색 (채널 + DM)
- `src/gifs` GIF 검색 (GIPHY 프록시, API 키는 서버에만 보관)
- `src/events` Socket.IO 게이트웨이 (`/ws-{워크스페이스url}` 네임스페이스, `login`/`onlineList`/`message`/`dm`/`typing` 등)
- 업로드한 이미지는 `uploads/` 에 저장되고 `/uploads/*` 로 서빙됩니다.
