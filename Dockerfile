FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 10000 \
 && npm config set fetch-retry-maxtimeout 60000 \
 && npm install --omit=dev \
 && npm cache clean --force
COPY . .
ENV NODE_ENV=production
ENV PORT=3000
ENV PROMO_DATA_DIR=/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["npm", "start"]
