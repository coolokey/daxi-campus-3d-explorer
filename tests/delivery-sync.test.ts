import {it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {JSDOM} from 'jsdom';
const root=process.cwd();

it('bundles pure 3D campus explorer scripts, cache-busts entry shell, and versions gate guide',()=>{
 const files=new Map<string,string>(),dist=path.join(root,'dist');
 files.set(path.join(dist,'index.html'),'<html><head><link href="./assets/main.css" rel="stylesheet"><script type="module" src="./assets/main.js"></script></head><body><div id="root"></div></body></html>');
 const fake={
  readFileSync:(p:string)=>files.has(p)?files.get(p):fs.readFileSync(p.startsWith(dist+path.sep)?p.replace(dist,path.join(root,'public')):p,'utf8'),
  writeFileSync:(p:string,s:string)=>files.set(p,s)
 };
 vm.runInNewContext(fs.readFileSync('scripts/package-explorer.cjs','utf8'),{
  require:(name:string)=>({'node:fs':fake,'node:path':path,'node:crypto':crypto,'node:vm':vm}[name]),
  __dirname:path.join(root,'scripts'),
  console:{log(){}}
 });

 const entryHtml=files.get(path.join(dist,'index.html'))!;
 const viewerHtml=files.get(path.join(dist,'campus-explorer/index.html'))!;
 const bundle=/src="(campus\.[^"]+\.js)"/.exec(viewerHtml)?.[1];
 const styleBundle=/href="(campus\.[^"]+\.css)"/.exec(viewerHtml)?.[1];
 expect(bundle).toBeTruthy();
 expect(styleBundle).toBeTruthy();
 expect(entryHtml).toContain('./campus-explorer/'+bundle);

 const expected=crypto.createHash('sha256').update(viewerHtml).digest('hex').slice(0,12);
 const dom=new JSDOM(entryHtml,{url:'https://campus.test/?view=bird',runScripts:'outside-only'});
 dom.window.eval(dom.window.document.querySelector('script:not([src])')!.textContent!);
 const url=new URL(dom.window.document.querySelector('iframe')!.src);
 expect(url.searchParams.get('build')).toBe(expected);
 expect(url.searchParams.get('view')).toBe('bird');
 dom.window.close();

 const gateHtml=files.get(path.join(dist,'campus-explorer/gate.html'))!;
 expect(gateHtml).toContain(`name="campus-build" content="${expected}"`);
 expect(gateHtml).toMatch(/gate-guide\.js\?build=[a-f0-9]{12}/);

 for(const suffix of ['css','html']){
  const changed=new Map<string,string>();
  const fakeChanged={
   readFileSync:(p:string)=>{
    if(changed.has(p))return changed.get(p);
    if(p===path.join(dist,'index.html'))return '<html><head><script type="module" src="./assets/main.js"></script></head><body><div id="root"></div></body></html>';
    let value=fs.readFileSync(p.startsWith(dist+path.sep)?p.replace(dist,path.join(root,'public')):p,'utf8');
    if(p.endsWith('field-guide.css')&&suffix==='css')value+='\n.audit-change{color:red}';
    if(p.endsWith('campus-explorer'+path.sep+'index.html')&&suffix==='html')value=value.replace('</head>','<meta name="audit-change"></head>');
    return value;
   },
   writeFileSync:(p:string,s:string)=>changed.set(p,s)
  };
  vm.runInNewContext(fs.readFileSync('scripts/package-explorer.cjs','utf8'),{
   require:(name:string)=>({'node:fs':fakeChanged,'node:path':path,'node:crypto':crypto,'node:vm':vm}[name]),
   __dirname:path.join(root,'scripts'),
   console:{log(){}}
  });
  const token=(s:string)=>/build=([a-f0-9]{12})/.exec(s)?.[1];
  expect(token(changed.get(path.join(dist,'index.html'))!),suffix).toBeTruthy();
  expect(token(changed.get(path.join(dist,'index.html'))!),suffix).not.toBe(token(entryHtml));
 }
});
