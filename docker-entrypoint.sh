#!/bin/sh
# 컨테이너 시작 시: 스키마 동기화 → 기본 데이터(워크스페이스/채널) → 서버 실행
set -e
npm run schema:sync
npm run seed
exec node dist/main
