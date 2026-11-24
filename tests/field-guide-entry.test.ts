import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync('public/campus-explorer/index.html','utf8');
describe('開啟網址直接進入 3D 導覽模式',()=>{
 it('移除手冊首頁封面對話框，並保留 3D 畫布與創作者資訊',()=>{
  const dom=new JSDOM(html),d=dom.window.document;
  expect(d.querySelector('#guide-landing')).toBeNull();
  expect(d.querySelector('#webgl-canvas')).not.toBeNull();
  expect(d.querySelector('#campus-credits')).not.toBeNull();
  dom.window.close();
 });
 it.each(['','?to=library','?view=bird'])('任何參數進入皆無封面首頁阻擋：%s',query=>{
  const dom=new JSDOM(html,{url:'https://campus.example/'+query});
  expect(dom.window.document.querySelector('#guide-landing')).toBeNull();
  dom.window.close();
 });
});
