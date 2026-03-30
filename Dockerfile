- name: Dockerfile oluştur
        run: |
          cat > Dockerfile << 'EOF'
          FROM node:alpine
          WORKDIR /var/stremio_addon
          
          # Yıldız işareti sayesinde yarn.lock yoksa bile build çökmez
          COPY package.json yarn.lock* ./
          
          # Eğer yarn.lock varsa yarn ile, yoksa npm ile kurar
          RUN if [ -f yarn.lock ]; then yarn install --production --frozen-lockfile; else npm install --only=prod; fi
          
          # Derlenmiş dosyaları kopyala
          COPY dist/ ./dist/
          COPY static/ ./static/
          
          EXPOSE 80
          ENV NODE_ENV=production
          CMD ["node", "dist/index.js"]
          EOF
