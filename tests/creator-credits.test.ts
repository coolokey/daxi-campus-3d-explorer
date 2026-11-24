import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const root='public/campus-explorer/';
it('keeps one credits block mounted in document body',()=>{
 const dom=new JSDOM(readFileSync(root+'index.html','utf8'),{runScripts:'outside-only'});
 try{
  const w=dom.window,footer=w.document.getElementById('campus-credits');
  expect(footer).not.toBeNull();
  w.eval(readFileSync(root+'creator-credits.js','utf8'));
  expect(footer?.parentElement).toBe(w.document.body);
  expect(w.document.querySelectorAll('#campus-credits')).toHaveLength(1);
 }finally{dom.window.close()}
});
it('updates the reserved control space when the credits wrap after a resize',()=>{
 const dom=new JSDOM(readFileSync(root+'index.html','utf8'),{runScripts:'outside-only'});
 try{
  const w=dom.window as any,footer=w.document.getElementById('campus-credits');
  expect(footer).not.toBeNull();
  let height=48,notify=()=>{};footer.getBoundingClientRect=()=>({height});
  w.ResizeObserver=class{constructor(cb:()=>void){notify=cb}observe(){}};
  w.eval(readFileSync(root+'creator-credits.js','utf8'));
  expect(w.document.documentElement.style.getPropertyValue('--campus-credit-height')).toBe('48px');
  height=74;notify();
  expect(w.document.documentElement.style.getPropertyValue('--campus-credit-height')).toBe('74px');
 }finally{dom.window.close()}
});
