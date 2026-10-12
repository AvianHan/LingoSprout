import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
createServer(async (req, res) => {
  try {
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    const pathname = decodeURIComponent(new URL(req.url,'http://127.0.0.1:8766').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/demo-page.html' : pathname));
    if(!file.startsWith(root + (root.endsWith(sep)?'':sep)) || !types[extname(file)]) {res.writeHead(404);res.end('Not found');return;}
    const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(8766,'127.0.0.1',()=>console.log('LingoSprout preview: http://127.0.0.1:8766/demo-page.html\nPress Ctrl+C to stop.'));
