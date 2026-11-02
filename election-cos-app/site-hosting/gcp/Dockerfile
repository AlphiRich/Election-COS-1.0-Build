# Election Campaign OS: the public site on Google Cloud Run (nginx serving the static build).
# Build context is the election-cos-app directory, after `npm run build:site`:
#   docker build -f site-hosting/gcp/Dockerfile -t ecos-site .
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY site-hosting/gcp/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist-site /usr/share/nginx/html
# Cloud Run sends traffic to $PORT (8080 by default); nginx listens on 8080.
EXPOSE 8080
