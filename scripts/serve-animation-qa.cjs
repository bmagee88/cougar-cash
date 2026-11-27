// Isolated source preview for visual QA; the user-facing route is in the full app.
const esbuild=require('esbuild'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/animation-qa');
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const contents=`import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import{ThemeProvider,createTheme,CssBaseline}from'@mui/material';import AnimationPreview from './src/TypingBoss/AnimationPreview';createRoot(document.getElementById('root')!).render(<ThemeProvider theme={createTheme({palette:{mode:'dark'}})}><CssBaseline/><BrowserRouter><AnimationPreview/></BrowserRouter></ThemeProvider>);`;
  const context=await esbuild.context({stdin:{contents,loader:'tsx',resolveDir:root},bundle:true,outfile:path.join(out,'app.js'),platform:'browser',define:{'process.env.NODE_ENV':'"development"','process.env.PUBLIC_URL':'""','process.env':'{}'},loader:{'.woff2':'dataurl','.png':'file','.webp':'file'},logLevel:'warning'});
  await context.rebuild();await context.watch();
  http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost'),asset=url.pathname.startsWith('/assets/'),base=asset?path.join(root,'public'):out;
    const file=path.resolve(base,'.'+url.pathname);
    if(file!==base&&!file.startsWith(base+path.sep)){res.writeHead(403);return res.end();}
    if(fs.existsSync(file)&&fs.statSync(file).isFile()){
      const mime={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg'};res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);
    }else if(!path.extname(url.pathname)){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Animation QA</title><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>');}
    else{res.writeHead(404);res.end();}
  }).listen(3004,'127.0.0.1',()=>console.log('Animation QA http://localhost:3004/typing-boss/animations'));
})().catch(e=>{console.error(e);process.exitCode=1;});
