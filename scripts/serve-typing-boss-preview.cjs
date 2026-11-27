// Lightweight local preview of the checked production build, with the live API.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../build'),port=Number(process.env.TYPING_BOSS_PREVIEW_PORT || 3003);
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.ico':'image/x-icon'};
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
    const proxy=http.request({hostname:'127.0.0.1',port:4000,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:4000'}},response=>{
      res.writeHead(response.statusCode,response.headers);response.pipe(res);
    });
    proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('The local backend is unavailable.');});
    req.pipe(proxy);req.on('aborted',()=>proxy.destroy());return;
  }
  let file;
  try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname));}catch{res.writeHead(400);res.end();return;}
  if(file!==root && !file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if(!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if(path.extname(url.pathname)){res.writeHead(404);res.end();return;}
    file=path.join(root,'index.html');
  }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});
  fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`Typing Boss preview: http://localhost:${port}/typing-boss`));
