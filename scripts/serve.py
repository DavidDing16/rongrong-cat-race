"""Minimal same-origin local static preview; does not install dependencies."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])
class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
ThreadingHTTPServer(('127.0.0.1', 8767), Handler).serve_forever()
