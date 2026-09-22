from pathlib import Path

p = Path("/etc/nginx/sites-enabled/arcanyx.ru")
text = p.read_text()

# Drop the buffering-off regex proxy that stalls HTTPS audio from the internet.
old_audio = """    location ~ ^/api/meditations/[^/]+/audio$ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 300;
        proxy_connect_timeout 60;
        proxy_send_timeout 300;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_max_temp_file_size 0;
    }

"""
text = text.replace(old_audio, "")

media = """    location /media/ {
        alias /var/www/arcanyx/media/;
        sendfile on;
        tcp_nopush on;
        gzip off;
        default_type audio/mpeg;
        add_header Accept-Ranges bytes;
        add_header Cache-Control "public, max-age=604800";
        add_header Content-Disposition inline;
    }

"""
if "location /media/" not in text:
    marker = "    location / {"
    if marker not in text:
        raise SystemExit("location / not found")
    text = text.replace(marker, media + marker, 1)

p.write_text(text)
print("nginx media patched")
