FROM node:24-bookworm-slim
WORKDIR /app
# Explicit allowlist: local knowledge, .env and original runs never enter the image.
COPY --chown=node:node package.json ./
COPY --chown=node:node config/model.json config/sources.json ./config/
COPY --chown=node:node src ./src
COPY --chown=node:node web ./web
COPY --chown=node:node demo ./demo
ENV NODE_ENV=production SOURCE_MODE=demo OFFICIAL_SEARCH=0 HOST=0.0.0.0 PORT=7860
USER node
EXPOSE 7860
CMD ["node", "src/server.cjs"]
