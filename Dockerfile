FROM node:22-slim

# Install Chromium, CJK fonts, and dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-wqy-zenhei \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    wget \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

# 安装完整依赖用于构建（包括 TypeScript 和 Tailwind 等 devDependencies）
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 构建完成后剔除开发依赖以精简镜像体积
RUN npm prune --omit=dev

ENV NODE_ENV=production

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["npm", "run", "start"]
