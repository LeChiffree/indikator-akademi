#!/usr/bin/env python3
# ==========================================================================
# İndikatör Akademi — minik statik sunucu (bağımlılıksız, Python 3)
# Kullanım: python3 serve.py            → http://0.0.0.0:8080
#           PORT=4173 python3 serve.py  → başka port
# Node kurulu olmayan makineler (ör. macOS) için serve.mjs'in eşdeğeridir.
# ==========================================================================
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get('PORT', '8080'))

MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.txt': 'text/plain; charset=utf-8',
}


class Handler(BaseHTTPRequestHandler):
    server_version = 'IndikatorAkademi/1.0'
    protocol_version = 'HTTP/1.1'

    def _resolve(self):
        path = unquote(urlsplit(self.path).path)
        if path == '/':
            path = '/index.html'
        target = os.path.normpath(os.path.join(ROOT, path.lstrip('/')))
        if not target.startswith(ROOT + os.sep) and target != ROOT:
            return None
        if os.path.isdir(target):
            target = os.path.join(target, 'index.html')
        return target

    def _serve(self, body_ok=True):
        target = self._resolve()
        if target is None:
            self.send_error(403, 'Forbidden')
            return
        if not os.path.isfile(target):
            self.send_error(404, 'Bulunamadi: %s' % self.path)
            return
        try:
            with open(target, 'rb') as f:
                body = f.read()
        except OSError:
            self.send_error(500)
            return
        ext = os.path.splitext(target)[1].lower()
        self.send_response(200)
        self.send_header('Content-Type', MIME.get(ext, 'application/octet-stream'))
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        if body_ok:
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass  # istemci sayfayı erken kapattı; günlüğü kirletme

    def do_GET(self):
        self._serve(True)

    def do_HEAD(self):
        self._serve(False)

    def log_message(self, fmt, *args):
        sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))


def main():
    srv = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    sys.stderr.write('Indikator Akademi sunucusu -> http://0.0.0.0:%d (kok: %s)\n' % (PORT, ROOT))
    sys.stderr.flush()
    srv.serve_forever()


if __name__ == '__main__':
    main()
