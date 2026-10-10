# syntax=docker/dockerfile:1

# 1) 프론트 빌드 (front/dist)
FROM node:22-bookworm-slim AS front
WORKDIR /app/front
COPY front/package.json front/package-lock.json ./
RUN npm ci
COPY front/ ./
RUN npm run build

# 2) 백엔드 빌드 (dist) + 실행 이미지
# 시작할 때 스키마 동기화/시드를 ts-node 로 실행하므로 devDependencies 도 함께 설치한다.
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json dataSource.ts ./
COPY src ./src
RUN npm run build
COPY --from=front /app/front/index.html ./front/index.html
COPY --from=front /app/front/dist ./front/dist
COPY docker-entrypoint.sh ./

ENV NODE_ENV=production \
    PORT=3002
EXPOSE 3002
VOLUME ["/app/uploads"]
ENTRYPOINT ["./docker-entrypoint.sh"]
