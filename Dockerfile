# syntax=docker/dockerfile:1

# 1) 프론트 빌드 (front/dist)
FROM node:22-bookworm-slim AS front
WORKDIR /app/front
COPY front/package.json front/package-lock.json ./
RUN npm ci
COPY front/ ./
RUN npm run build

# 2) 백엔드 빌드 (dist) + 실행 이미지
# 시작할 때 마이그레이션/시드를 ts-node 로 실행하므로 devDependencies 도 함께 설치한다.
FROM node:22-bookworm-slim
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json backend/dataSource.ts ./
COPY backend/src ./src
RUN npm run build
COPY --from=front /app/front/index.html /app/front/index.html
COPY --from=front /app/front/dist /app/front/dist
COPY backend/docker-entrypoint.sh ./

ENV NODE_ENV=production \
    PORT=3002
EXPOSE 3002
ENTRYPOINT ["./docker-entrypoint.sh"]
