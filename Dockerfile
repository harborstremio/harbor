# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

RUN npm install -g corepack@latest && corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@11.8.0 --activate
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 1420

CMD ["pnpm", "dev", "--host", "0.0.0.0"]
