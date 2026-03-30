- name: Dockerfile oluştur
        run: |
          cat > Dockerfile << 'EOF'
          FROM node:alpine
          WORKDIR /var/stremio_addon
          
          # package.json'ı kopyala, yarn.lock varsa onu da al (yoksa hata verme)
          COPY package.json yarn.lock* ./
          
          # Eğer lock dosyası varsa ona göre, yoksa normal kur
          RUN if [ -f yarn.lock ]; then yarn install --production --frozen-lockfile; else npm install --only=prod; fi
          
          COPY dist/ ./dist/
          COPY static/ ./static/
          
          EXPOSE 80
          ENV NODE_ENV=production
          CMD ["node", "dist/index.js"]
          EOF
