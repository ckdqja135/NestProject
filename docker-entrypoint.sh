#!/bin/sh
# 컨테이너 시작 시: 마이그레이션 → 기본 데이터(워크스페이스/채널) → 서버 실행
set -e
npm run migration:run
npm run seed
exec node dist/main
