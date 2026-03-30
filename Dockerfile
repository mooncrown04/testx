# 1. AŞAMA: DERLEME (Build)
FROM node:alpine AS builder
WORKDIR /app
# Hem package.json hem de yarn.lock dosyasını kopyalıyoruz
COPY package.json yarn.lock ./
RUN yarn install
COPY . .
RUN yarn run build

# 2. AŞAMA: ÇALIŞTIRMA (Production)
FROM node:alpine
WORKDIR /var/stremio_addon

COPY package.json yarn.lock ./
# Sadece production paketlerini kur ve donmuş lockfile kullan
RUN yarn install --production --frozen-lockfile

# Derlenmiş dosyaları ve statik klasörünü ilk aşamadan al
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/static ./static

EXPOSE 80

# Uygulamayı başlat
CMD ["node", "dist/index.js"]
