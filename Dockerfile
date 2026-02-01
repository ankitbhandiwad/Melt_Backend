FROM oven/bun:1
WORKDIR /app

COPY . .
RUN bun install

EXPOSE 3000
ENTRYPOINT [ "bun", "run", "src/index.ts" ]
