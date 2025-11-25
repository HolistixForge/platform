# Build and serve the frontend for semi production

## install

check /etc/nginx/nginx.conf, make sure gzip is enabled

```text
http {
    ...
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    ...
}
```

check /etc/nginx/sites-available/default, make sure the following is present:

```text
server {
    server_name dev-001.demiurge.co;

    root /tmp/app-frontend-build;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location ~* \.(js|css|html|svg|ttf|woff|woff2)$ {
        gzip_static on;
        expires max;
        add_header Cache-Control public;
    }

    listen 443 ssl; # managed by Certbot
    # ... certbot ssl config

}
```

## build

```
$ [NX_SKIP_NX_CACHE=true] npx nx run app-frontend:build:production \
&& sudo rm -rf /tmp/app-frontend-build \
&& sudo cp -ra dist/packages/app-frontend /tmp/app-frontend-build \
&& sudo chown -R www-data /tmp/app-frontend-build
```

for bundle analyser report, go to **(change XXX)** https://dev-XXX.demiurge.co/bundle-analyse/index.html

## Documentation

- [Frontend Architecture](../../doc/architecture/FRONTEND_ARCHITECTURE.md)
