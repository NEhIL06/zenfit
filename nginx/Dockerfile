FROM nginx:1.25-alpine

RUN apk --no-cache add curl

RUN rm -rf /etc/nginx/conf.d/* /usr/share/nginx/html/*

COPY nginx.conf /etc/nginx/nginx.conf
COPY html/ /usr/share/nginx/html/

RUN mkdir -p /etc/nginx/ssl /var/www/certbot /var/log/nginx && \
    chmod 755 /var/www/certbot && \
    chown -R nginx:nginx /var/log/nginx /usr/share/nginx/html

EXPOSE 80 443

HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=5s \
    CMD curl -f http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
