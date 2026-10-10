# Shlack (Slack 클론)

NestJS + TypeORM(MariaDB) + Socket.IO 백엔드와 React 프론트엔드(`front/`)로 구성된 Slack 클론입니다.
API 명세는 [API.md](./API.md) 참고, Swagger 는 서버 실행 후 http://localhost:3002/api 에서 볼 수 있습니다.

## 빠른 실행 (Docker Compose)

MariaDB, Redis, 앱(프론트 포함)을 한 번에 띄웁니다. Docker 가 설치되어 있어야 합니다.

```bash
cp .env.example .env      # SECRET, DB_PW 를 채우세요
docker compose up -d --build
```

http://localhost:3002 접속. 처음 시작할 때 스키마와 기본 워크스페이스(`shlack`)가 자동으로 만들어지고,
DB·Redis·업로드 파일은 볼륨에 보존됩니다. 포트를 바꾸려면 `.env` 에 `APP_PORT=8080` 처럼 지정하세요.

아래는 Docker 없이 직접 실행하는 방법입니다.

## 1. 환경 변수 (`.env`)

`.env` 는 비밀번호가 들어가므로 git 에 올리지 않습니다. 예시 파일을 복사해서 값을 채우세요.

```bash
cp .env.example .env
```

| 이름 | 설명 |
|---|---|
| `SECRET` | 세션 쿠키 서명용 비밀값 |
| `DB_USER`, `DB_PW`, `DB_NAME` | MariaDB 접속 정보 (DB 이름 기본 `shlack`) |
| `DB_HOST`, `DB_PORT`, `PORT` | 선택. 기본값 localhost / 3306 / 3002 |
| `REDIS_URL` | 선택. 세션 저장소 (예: `redis://localhost:6379`). 없으면 메모리에 저장되어 서버 재시작 시 로그아웃 |
| `GIPHY_API_KEY` | 선택. GIF 검색용 키 (https://developers.giphy.com 에서 무료 발급) |

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

## 테스트

```bash
npm test                 # 단위 테스트 (Jest)
npm run test:e2e         # API e2e 테스트 (Jest, .env 의 DB 사용)
```

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
