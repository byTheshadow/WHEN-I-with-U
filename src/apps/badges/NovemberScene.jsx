// src/apps/badges/NovemberScene.jsx
//
// 十一月限定赛季——"从秋收走到长夜"场景（纯渲染，不碰数据库）。
// 由 BadgeDancingLineBoard.jsx 在赛季的 sceneKind === 'november' 时使用，
// 样式在同目录的 novemberScene.css（所有类名都带 nv- 前缀，不会跟别处冲突）。
//
// 五处地标从左到右（黄昏到长夜）：
//   丰收谷仓  = 节点 0（第一个条件）
//   枫叶长桌  = 节点 1（第二个条件）
//   炉火小屋  = 节点 2（第三个条件）
//   暖汤小铺  = 纯场景装饰，不可点；跟终点一起亮灯
//   圭表观星台 = 节点 3（终点，三个条件全部点亮才亮）
//
// 地标本身是一段段"拼 SVG 字符串"的绘制函数（等距 2.5D），内容全部是写死的
// 静态字符串，用 dangerouslySetInnerHTML 放进页面，不含任何用户输入。
//
// Props（跟万圣节场景保持同一套接口）：
//   lit          [boolean, boolean, boolean, boolean]  四个节点是否点亮
//   selectedIdx  number  当前选中的节点（0-3）
//   fxEnabled    boolean 是否启用动效（视差、飘落的叶子和雪、灯火动画）
//   onNodeClick  (i: number) => void

import React, { useEffect, useMemo, useRef } from 'react';

import './novemberScene.css';

export const NOVEMBER_SCENE_HEIGHT = 480;

/** 前三个条件节点对应的小图标类型（第四个终点是 'gnomon'）。 */
export const NOVEMBER_NODE_TYPES = ['barn', 'table', 'cabin'];

/* ─────────────────────────────────────────────
   地标绘制（等距 2.5D 工具 + 五个地标）
───────────────────────────────────────────── */
const lockIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><circle cx="12" cy="14.6" r="1.2" fill="currentColor" stroke="none"/><path d="M12 15.6v1.6"/></svg>';
const r1=n=>Math.round(n*10)/10;
const pt=p=>r1(p[0])+','+r1(p[1]);
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const up=(p,z)=>[p[0],p[1]-z];
const poly=(ps,fill,ex='')=>`<polygon points="${ps.map(pt).join(' ')}" fill="${fill}" ${ex}/>`;
const line=(a,b,c,w=1,ex='')=>`<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" ${ex}/>`;
function iso(cx,cy,w,d){return {F:[cx,cy],L:[cx-w,cy-w/2],R:[cx+d,cy-d/2],B:[cx-w+d,cy-(w+d)/2]}}
/* 立方体：左面受光，右面背光，顶面最亮 */
function box(cx,cy,w,d,h,[cl,cr,ct],edge=true){
  const k=iso(cx,cy,w,d);
  let s=poly([k.L,k.F,up(k.F,h),up(k.L,h)],cl)+poly([k.F,k.R,up(k.R,h),up(k.F,h)],cr);
  if(ct) s+=poly([up(k.L,h),up(k.F,h),up(k.R,h),up(k.B,h)],ct);
  if(edge){
    s+=line(k.F,up(k.F,h),'rgba(255,255,255,.22)',.8);
    if(ct) s+=line(up(k.L,h),up(k.F,h),'rgba(255,255,255,.35)',.8)+line(up(k.F,h),up(k.R,h),'rgba(255,255,255,.2)',.8);
  }
  return s;
}
/* 在左/右墙面上画东西：组内坐标就是墙面的正视坐标 */
const LF=(cx,cy,w,inner)=>`<g transform="matrix(1 .5 0 1 ${cx-w} ${cy-w/2})">${inner}</g>`;
const RF=(cx,cy,inner)=>`<g transform="matrix(1 -.5 0 1 ${cx} ${cy})">${inner}</g>`;
/* 双坡屋顶：山墙朝右前方 */
function roof(cx,cy,w,d,h,rh,[back,gable,front]){
  const k=iso(cx,cy,w,d);
  const Lt=up(k.L,h),Ft=up(k.F,h),Rt=up(k.R,h),Bt=up(k.B,h);
  const Mf=[(Ft[0]+Rt[0])/2,(Ft[1]+Rt[1])/2-rh], Mb=[(Lt[0]+Bt[0])/2,(Lt[1]+Bt[1])/2-rh];
  const s=poly([Rt,Mf,Mb,Bt],back)+(gable?poly([Ft,Rt,Mf],gable):'')+poly([Lt,Ft,Mf,Mb],front);
  return {s,Lt,Ft,Rt,Bt,Mf,Mb};
}
const ao=(x,y,rx,ry,o=.35)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#1a0f22" opacity="${o}" filter="url(#nvfAO)"/>`;
const glowDot=(x,y,r,cool)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${cool?'nvgCool':'nvgWarm'})"/>`;

/* 浮空小岛：岩层侧壁 + 厚边 + 顶面高光 */
function island(kind){
  const T={autumn:['url(#nvgTopA)','#9a6332','url(#nvgCliffA)'],mix:['url(#nvgTopM)','#86664e','url(#nvgCliffM)'],snow:['url(#nvgTopS)','#a4aecb','url(#nvgCliffS)']}[kind];
  return `
  <path d="M16 140 C17 156 28 164 38 172 C46 179 56 178 64 188 C72 198 84 196 92 208 C96 213 104 213 108 207 C116 196 126 199 134 189 C142 180 152 180 160 171 C170 163 183 155 184 140Z" fill="${T[2]}"/>
  <path d="M22 156 C60 170 140 170 178 156" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1.2"/>
  <path d="M40 174 C74 184 126 184 158 172" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="1.2"/>
  <path d="M66 192 C86 198 112 198 132 190" fill="none" stroke="rgba(0,0,0,.14)" stroke-width="1"/>
  <path d="M30 160 L40 176 M150 168 L144 182 M92 196 L98 208" stroke="rgba(255,255,255,.10)" stroke-width="1.4"/>
  ${kind==='snow'?'<path d="M60 182 l2 9 l2 -9 M120 186 l1.6 7 l1.6 -7 M150 172 l1.4 6 l1.4 -6" fill="#e9eefa"/>':'<path d="M70 186 q-2 8 2 12 M128 186 q3 6 0 10" stroke="#3b2418" stroke-width="1.2" fill="none"/>'}
  <ellipse cx="100" cy="146" rx="84" ry="34" fill="${T[1]}"/>
  <ellipse cx="100" cy="140" rx="84" ry="34" fill="${T[0]}"/>
  <ellipse cx="100" cy="140" rx="84" ry="34" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1" stroke-dasharray="0 70 120 400"/>`;
}
const tuft=(x,y,c='#8a5a22')=>`<path d="M${x-3} ${y} q1 -5 2 -1 q1 -6 2 0 q1 -4 2 1" fill="none" stroke="${c}" stroke-width="1" stroke-linecap="round"/>`;
const leafDot=(x,y,c,r=0)=>`<path d="M${x} ${y} q3 -3 6 0 q-3 3 -6 0z" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`;
const snowLump=(x,y,rx)=>`<ellipse cx="${x}" cy="${y+rx*.12}" rx="${rx}" ry="${rx*.38}" fill="#cfd7ea"/><path d="M${x-rx} ${y+rx*.1} Q${x-rx*.6} ${y-rx*.55} ${x-rx*.1} ${y-rx*.3} Q${x+rx*.35} ${y-rx*.7} ${x+rx*.95} ${y+rx*.05} Q${x} ${y+rx*.35} ${x-rx} ${y+rx*.1}Z" fill="#fff"/><ellipse cx="${x-rx*.35}" cy="${y-rx*.2}" rx="${rx*.25}" ry="${rx*.09}" fill="#fff" opacity=".9"/>`;
function pumpkin(x,y,r){
  return `${ao(x,y+r*.6,r*1.1,r*.35,.4)}
  <ellipse cx="${x}" cy="${y}" rx="${r*1.15}" ry="${r*.85}" fill="url(#nvgPump)"/>
  <path d="M${x-r*.45} ${y-r*.8} q-${r*.35} ${r*.8} 0 ${r*1.6} M${x+r*.45} ${y-r*.8} q${r*.35} ${r*.8} 0 ${r*1.6} M${x} ${y-r*.85} v${r*1.7}" stroke="#b2501c" stroke-width=".8" fill="none" opacity=".8"/>
  <ellipse cx="${x-r*.4}" cy="${y-r*.3}" rx="${r*.25}" ry="${r*.14}" fill="#fff" opacity=".35"/>
  <path d="M${x} ${y-r*.8} q.5 -${r*.5} ${r*.4} -${r*.6}" stroke="#4e6b2a" stroke-width="${r*.22}" stroke-linecap="round" fill="none"/>`;
}
function pine(x,y,s){
  return `<g transform="translate(${x} ${y}) scale(${s})">${ao(0,0,14,4,.35)}
  <rect x="-1.6" y="-6" width="3.2" height="7" fill="#4a3428"/>
  <path d="M-15 -5 L0 -24 L15 -5Z" fill="#33536a"/><path d="M0 -24 L15 -5 L0 -5Z" fill="#253f55"/>
  <path d="M-12 -17 L0 -36 L12 -17Z" fill="#3a5e77"/><path d="M0 -36 L12 -17 L0 -17Z" fill="#2a4760"/>
  <path d="M-8.5 -29 L0 -47 L8.5 -29Z" fill="#41688a"/><path d="M0 -47 L8.5 -29 L0 -29Z" fill="#2f4f6b"/>
  <path d="M-5 -40 L0 -47 L5 -40 L2.5 -38.5 L0 -40.5 L-2.5 -38 Z M-10 -20 L-6 -24 L-2 -21 L-6 -19.5Z M3 -30 L7 -32 L9 -29.5 L5 -28.5Z M-13 -7 L-9 -11 L-5 -8 L-9 -6.5Z" fill="#f4f7fd"/>
  </g>`;
}
/* 圆柱段（蒸笼、粮仓用） */
function cyl(cx,y,rx,ry,h,fill,band){
  return `<path d="M${cx-rx} ${y} A${rx} ${ry} 0 0 0 ${cx+rx} ${y} V${y-h} A${rx} ${ry} 0 0 1 ${cx-rx} ${y-h}Z" fill="${fill}"/>`+
    (band?`<path d="M${cx-rx} ${y-h} A${rx} ${ry} 0 0 0 ${cx+rx} ${y-h}" fill="none" stroke="${band}" stroke-width="1"/>`:'');
}

const art={
barn(){
  const cx=100,cy=152,w=46,d=34,h=31;
  const k=iso(cx,cy,w,d), r=roof(cx,cy,w,d,h,21,['#4a1b14','#a3391f','#6e2a1f']);
  const cream='#f6e8d0';
  let s=island('autumn');
  // 粮仓
  s+=ao(40,128,18,6)+cyl(40,126,13,5.5,52,'url(#nvgSilo)')+
     `<path d="M27 74 Q27 57 40 54 Q53 57 53 74 A13 5.5 0 0 1 27 74Z" fill="url(#nvgSiloTop)"/>`+
     [86,98,110].map(y=>`<path d="M27 ${y} A13 5.5 0 0 0 53 ${y}" fill="none" stroke="rgba(80,60,40,.25)" stroke-width=".9"/>`).join('')+
     `<rect x="31" y="75" width="2.2" height="52" fill="#fff" opacity=".35"/><circle cx="40" cy="54" r="1.4" fill="#9aa0aa"/>`;
  // 主体
  s+=ao(cx-6,cy-12,44,12,.45);
  s+=box(cx,cy,w,d,h,['#c84b30','#9c3520']);
  s+=LF(cx,cy,w,
     Array.from({length:12},(_,i)=>`<path d="M${i*3.9+2} ${-h} V0" stroke="rgba(60,10,0,.14)" stroke-width=".8"/>`).join('')+
     `<rect x="0" y="-3" width="${w}" height="3" fill="#7a2617"/>`+
     [8,28].map(x=>`<rect x="${x}" y="-22" width="10" height="10" fill="#3a1711"/><rect class="nv-lit" x="${x}" y="-22" width="10" height="10" fill="#ffd47e" filter="url(#nvfGlow)"/><path d="M${x+5} -22v10M${x} -17h10" stroke="${cream}" stroke-width="1"/><rect x="${x}" y="-22" width="10" height="10" fill="none" stroke="${cream}" stroke-width="1.4"/>`).join(''));
  s+=RF(cx,cy,
     Array.from({length:8},(_,i)=>`<path d="M${i*4.2+2} ${-h} V0" stroke="rgba(40,5,0,.16)" stroke-width=".8"/>`).join('')+
     `<rect x="0" y="-3" width="${d}" height="3" fill="#5f1d12"/>
      <rect x="8" y="-21" width="18" height="21" fill="#7a2516"/>
      <path d="M8 -21 L26 0 M26 -21 L8 0 M17 -21 V0" stroke="${cream}" stroke-width="1.3"/>
      <rect x="8" y="-21" width="18" height="21" fill="none" stroke="${cream}" stroke-width="1.6"/>
      <rect x="6" y="-23.5" width="22" height="2" fill="${cream}"/>`);
  // 山墙
  s+=r.s;
  s+=RF(cx,cy,`<rect x="12.5" y="${-h-13}" width="9" height="8" fill="#3a1711"/><rect class="nv-lit" x="12.5" y="${-h-13}" width="9" height="8" fill="#ffd47e" filter="url(#nvfGlow)"/><rect x="12.5" y="${-h-13}" width="9" height="8" fill="none" stroke="${cream}" stroke-width="1.2"/><path d="M17 ${-h-13}v8" stroke="${cream}" stroke-width=".9"/>`);
  for(let t=.12;t<1;t+=.11) s+=line(lerp(r.Lt,r.Ft,t),lerp(r.Mb,r.Mf,t),'rgba(255,200,170,.14)',.9);
  s+=line(r.Lt,r.Ft,cream,1.8)+line(r.Ft,r.Mf,cream,1.8)+line(r.Mf,r.Rt,cream,1.8)+line(r.Mb,r.Mf,'#8c3a2a',1.4);
  s+=line(k.L,up(k.L,h),cream,1.4)+line(k.F,up(k.F,h),cream,1.6)+line(k.R,up(k.R,h),cream,1.4);
  // 风向标
  const v=lerp(r.Mb,r.Mf,.55);
  s+=line(v,up(v,13),'#3a2a22',1)+`<path d="M${v[0]-5} ${v[1]-10} h10 l-2.5 -2 M${v[0]+5} ${v[1]-10} l-2.5 2" stroke="#3a2a22" stroke-width="1" fill="none"/>`;
  // 干草卷 + 南瓜 + 落叶
  s+=ao(60,166,12,4)+`<path d="M52 154 h9 a7 8 0 0 1 0 16 h-9z" fill="#c9923a"/><ellipse cx="52" cy="162" rx="7" ry="8" fill="#f2c96c"/>
      <path d="M52 162 m-4.5 0 a4.5 5 0 1 0 4.5 -5 m0 2.5 a2 2.3 0 1 1 -2 2.3" fill="none" stroke="#c9923a" stroke-width=".9"/>`;
  s+=pumpkin(150,156,6.5)+pumpkin(138,165,5)+pumpkin(124,170,4);
  s+=leafDot(70,170,'#d9622b',20)+leafDot(160,146,'#e8892f',-30)+leafDot(34,150,'#b8402a',60)+tuft(30,142)+tuft(166,152)+tuft(84,174);
  return `<svg class="nv-landmark" viewBox="0 22 200 194" aria-hidden="true">${s}</svg>`;
},

table(){
  let s=island('autumn');
  // 枫树
  s+=ao(60,132,26,8,.45)+`<path d="M53 134 C55 114 56 100 57 84 L63 84 C63 100 64 114 68 134 Z" fill="url(#nvgTrunk)"/>
     <path d="M60 98 C52 92 46 90 40 82 M61 92 C68 86 76 84 82 78" stroke="#4b2d1c" stroke-width="2.2" fill="none" stroke-linecap="round"/>
     <circle cx="38" cy="74" r="17" fill="url(#nvgCanopy)"/><circle cx="84" cy="70" r="19" fill="url(#nvgCanopy)"/>
     <circle cx="60" cy="60" r="27" fill="url(#nvgCanopy)"/><circle cx="50" cy="40" r="15" fill="url(#nvgCanopy2)"/><circle cx="72" cy="38" r="13" fill="url(#nvgCanopy2)"/>
     <circle cx="46" cy="44" r="5" fill="#ffd27a" opacity=".35"/><circle cx="30" cy="70" r="3" fill="#ffd27a" opacity=".3"/>`+
     [[40,58,'#c4401f'],[70,52,'#b8381c'],[86,78,'#c4401f'],[54,80,'#a8341a'],[28,82,'#b8381c']].map(([x,y,c])=>`<path d="M${x} ${y} l2 -4 l2 4 l3 -1 l-2 3 l2 2 l-5 0 l-2 3 l-2 -3 l-5 0 l2 -2 l-2 -3z" fill="${c}" opacity=".75"/>`).join('');
  // 长桌
  const cx=120,cy=138,w=54,d=20,h=4;
  const k=iso(cx,cy,w,d);
  const leg=(p,c)=>line(p,[p[0],p[1]+16],c,2.4);
  s+=ao(104,150,40,10,.4);
  s+=leg(k.L,'#5e3a20')+leg(lerp(k.L,k.F,.5),'#6b4226');
  s+=box(cx,cy,w,d,h,['#e7d4b4','#c8b08c','#f6ead6']);
  s+=leg(k.F,'#7a4c2c')+leg(k.R,'#5e3a20');
  // 桌布垂边 + 桌旗
  s+=LF(cx,cy,w,`<path d="M0 0 h${w} v4 q-${w/8} 2 -${w/4} 0 q-${w/8} 2 -${w/4} 0 q-${w/8} 2 -${w/4} 0 q-${w/8} 2 -${w/4} 0z" fill="#e7d4b4"/>`);
  const Lt=up(k.L,h),Ft=up(k.F,h),Bt=up(k.B,h);
  const P=(u,v)=>[Lt[0]+u*(Ft[0]-Lt[0])+v*(Bt[0]-Lt[0]), Lt[1]+u*(Ft[1]-Lt[1])+v*(Bt[1]-Lt[1])];
  s+=poly([P(0,.38),P(1,.38),P(1,.62),P(0,.62)],'#c65a2a')+line(P(0,.4),P(1,.4),'#f0b45a',.6)+line(P(0,.6),P(1,.6),'#f0b45a',.6);
  s+=LF(cx,cy,w,`<path d="M${w*.0} 0 h0" />`)+poly([P(1,.38),P(1,.62),[P(1,.62)[0],P(1,.62)[1]+7],[P(1,.38)[0],P(1,.38)[1]+7]],'#a9481f');
  // 餐盘
  [[.25,.14],[.62,.14],[.3,.86],[.7,.86]].forEach(([u,v])=>{const p=P(u,v);s+=`<ellipse cx="${r1(p[0])}" cy="${r1(p[1])}" rx="4.6" ry="2.2" fill="#fff"/><ellipse cx="${r1(p[0])}" cy="${r1(p[1])}" rx="3" ry="1.3" fill="#e7ecf4"/>`});
  // 火鸡
  const t=P(.5,.5);
  s+=`<ellipse cx="${t[0]}" cy="${t[1]+1}" rx="11" ry="4.6" fill="#fff"/><ellipse cx="${t[0]}" cy="${t[1]+1}" rx="9" ry="3.4" fill="#dfe5ee"/>
      <ellipse cx="${t[0]}" cy="${t[1]-3.5}" rx="8.5" ry="6" fill="url(#nvgTurkey)"/>
      <ellipse cx="${t[0]-6}" cy="${t[1]-1}" rx="3.6" ry="2.4" fill="#b8642a" transform="rotate(-25 ${t[0]-6} ${t[1]-1})"/><circle cx="${t[0]-9.5}" cy="${t[1]+.6}" r="1.2" fill="#fff"/>
      <ellipse cx="${t[0]+6}" cy="${t[1]-1}" rx="3.6" ry="2.4" fill="#9e5222" transform="rotate(25 ${t[0]+6} ${t[1]-1})"/><circle cx="${t[0]+9.5}" cy="${t[1]+.6}" r="1.2" fill="#fff"/>
      <ellipse cx="${t[0]-2.5}" cy="${t[1]-6.5}" rx="3" ry="1.4" fill="#fff" opacity=".45"/>
      <path d="M${t[0]-12} ${t[1]+2} q2 -2 4 0 M${t[0]+8} ${t[1]+3} q2 -2 4 0" stroke="#5b8a3a" stroke-width="1.4" fill="none"/>`;
  // 南瓜派
  const pi=P(.86,.5); s+=`<ellipse cx="${pi[0]}" cy="${pi[1]}" rx="5" ry="2.4" fill="#d9a45c"/><ellipse cx="${pi[0]}" cy="${pi[1]-.4}" rx="3.6" ry="1.6" fill="#c96a2a"/><path d="M${pi[0]-5} ${pi[1]} v1.2 a5 2.4 0 0 0 10 0 v-1.2" fill="#b8843f"/>`;
  s+=pumpkin(...P(.14,.5).map((n,i)=>i?n-2:n),3.4);
  // 蜡烛
  [.35,.66].forEach(u=>{const p=P(u,.5);const x=r1(p[0]),y=r1(p[1]);
    s+=`<rect x="${x-1.4}" y="${y-11}" width="2.8" height="9" rx="1" fill="#fbf3e2"/><rect x="${x-1.4}" y="${y-11}" width="1" height="9" fill="#fff" opacity=".7"/><ellipse cx="${x}" cy="${y-2}" rx="2.4" ry="1" fill="#c9a24f"/>
    <g class="nv-lit">${glowDot(x,y-14,9)}<path class="nv-flame" d="M${x} ${y-17.5} q2.2 3 0 4.5 q-2.2 -1.5 0 -4.5z" fill="#ffcf5a"/></g>
    <path class="nv-dim" d="M${x} ${y-11} v-2" stroke="#5a4636" stroke-width=".8"/>`;});
  // 落叶
  s+=leafDot(150,160,'#d9622b',10)+leafDot(130,168,'#e8892f',-40)+leafDot(80,160,'#b8402a',80)+leafDot(40,150,'#d9622b',-10)+leafDot(160,140,'#e8892f',30)+tuft(28,140)+tuft(176,146);
  return `<svg class="nv-landmark" viewBox="0 22 200 194" aria-hidden="true">${s}</svg>`;
},

cabin(){
  const cx=102,cy=152,w=40,d=34,h=24;
  const k=iso(cx,cy,w,d), r=roof(cx,cy,w,d,h,22,['#26232c','#6a3f24','#3d3944']);
  let s=island('mix');
  s+=snowLump(150,150,16)+snowLump(60,170,10)+snowLump(132,170,8);
  s+=pine(160,128,.95)+pine(36,136,.62);
  s+=ao(cx-4,cy-14,40,11,.45);
  s+=box(cx,cy,w,d,h,['#8f5a35','#6a3f24']);
  s+=LF(cx,cy,w,[4,8,12,16,20].map(y=>`<path d="M0 ${-y} H${w}" stroke="#5a341d" stroke-width="1.1"/><path d="M0 ${-y+1} H${w}" stroke="rgba(255,220,170,.16)" stroke-width=".8"/>`).join('')+
     `<rect x="11" y="-18" width="13" height="11" fill="#2a2433"/><rect class="nv-lit" x="11" y="-18" width="13" height="11" fill="#ffcf6b" filter="url(#nvfGlow)"/>
      <path d="M17.5 -18v11M11 -12.5h13" stroke="#4b2c19" stroke-width="1.2"/><rect x="11" y="-18" width="13" height="11" fill="none" stroke="#4b2c19" stroke-width="1.6"/>
      <rect x="10" y="-7" width="15" height="2.6" fill="#f2efe9"/>`);
  s+=RF(cx,cy,[4,8,12,16,20].map(y=>`<path d="M0 ${-y} H${d}" stroke="#4b2c19" stroke-width="1.1"/>`).join('')+
     `<rect x="12" y="-17" width="11" height="17" rx="1" fill="#46291a"/><rect x="12" y="-17" width="11" height="17" rx="1" fill="none" stroke="#2e1a10" stroke-width="1"/><circle cx="20.5" cy="-8" r=".9" fill="#e0b04f"/>
      <rect x="25.5" y="-18" width="3" height="4" fill="#2a2433"/><g class="nv-lit"><rect x="25.5" y="-18" width="3" height="4" fill="#ffd47e"/></g>`);
  // 圆木端头
  for(let z=2;z<=22;z+=4) s+=`<circle cx="${cx}" cy="${cy-z}" r="2" fill="#c08b58" stroke="#6a3f24" stroke-width=".7"/>`;
  s+=`<g class="nv-lit">${glowDot(cx-24,cy-22,14)}${glowDot(cx+22,cy-27,9)}</g>`;
  // 屋顶 + 积雪
  s+=r.s;
  const a=lerp(r.Mb,r.Lt,.62), b=lerp(r.Mf,r.Ft,.62);
  let edge=[];for(let i=0;i<=8;i++){const p=lerp(a,b,i/8);edge.push([p[0],p[1]+(i%2?2.6:0)])}
  s+=poly([r.Mb,r.Mf,...edge.reverse()],'#f5f7fc')+poly([r.Mb,r.Mf,lerp(r.Mf,b,.25),lerp(r.Mb,a,.25)],'#ffffff');
  s+=line(r.Ft,r.Mf,'#f5f7fc',2.6)+line(r.Mf,r.Rt,'#f5f7fc',2.6)+line(r.Lt,r.Ft,'#2a2730',1.4);
  [.2,.45,.7,.9].forEach(t=>{const p=lerp(r.Lt,r.Ft,t);s+=`<path d="M${r1(p[0])} ${r1(p[1])} l.9 ${3+t*2} l.9 -${3+t*2}" fill="#e9eefa"/>`});
  // 烟囱
  const c=lerp(lerp(r.Lt,r.Ft,.24),lerp(r.Mb,r.Mf,.24),.62);
  s+=box(c[0],c[1],7,7,19,['#958d88','#6f6763','#aaa29c'])+poly([up([c[0]-7,c[1]-3.5],19),up(c,19),up([c[0]+7,c[1]-3.5],19),up([c[0],c[1]-7],19)].map(p=>[p[0],p[1]-1.4]),'#fff');
  const top=up([c[0],c[1]-3.5],22);
  s+=`<g class="nv-smoke" fill="#efeaf3">${[0,1,2].map(()=>`<circle cx="${r1(top[0])}" cy="${r1(top[1])}" r="4.5"/>`).join('')}</g>`;
  // 柴火堆
  s+=ao(56,164,14,4)+box(62,166,16,10,10,['#7a4a2a','#5c3720','#8f5d36'],false)+
     RF(62,166,[[2.6,-2.6],[7.4,-2.6],[5,-7.2]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.4" fill="#d9a46b" stroke="#8a5a32" stroke-width=".7"/>`).join(''))+snowLump(56,153,5);
  s+=leafDot(80,168,'#c4502b',30)+leafDot(140,160,'#e8892f',-20)+tuft(44,152,'#6e5a3a');
  return `<svg class="nv-landmark" viewBox="0 22 200 194" aria-hidden="true">${s}</svg>`;
},

stall(){
  const cx=100,cy=156,w=48,d=22,h=20;
  const k=iso(cx,cy,w,d);
  let s=island('snow');
  s+=pine(162,126,.8)+snowLump(40,150,12)+snowLump(150,164,10);
  s+=ao(92,148,40,10,.45);
  const post=(p,c)=>line(p,up(p,54),c,2.6);
  s+=post(k.L,'#5a2b22')+post(k.B,'#4a221b');
  s+=box(cx,cy,w,d,h,['#a9462f','#7d3122','#c99f69']);
  s+=LF(cx,cy,w,`<rect x="0" y="-3" width="${w}" height="3" fill="#6d2a1c"/><path d="M0 ${-h+3} H${w}" stroke="#7f3020" stroke-width="1"/>
     <rect x="12" y="-15" width="24" height="10" rx="1.2" fill="#f0dcb2" stroke="#7a4a1f" stroke-width="1"/>
     <text x="24" y="-7.4" text-anchor="middle" font-size="7.6" fill="#8a2a1c" font-family="'ZCOOL XiaoWei',serif">暖汤</text>`);
  s+=RF(cx,cy,`<rect x="0" y="-3" width="${d}" height="3" fill="#5a2318"/><rect x="5" y="-15" width="12" height="9" fill="#5e2418"/>`);
  s+=post(k.F,'#6d3428')+post(k.R,'#5a2b22');
  // 柜台上的汤锅与汤碗
  const Lt=up(k.L,h),Ft=up(k.F,h),Bt=up(k.B,h);
  const P=(u,v)=>[Lt[0]+u*(Ft[0]-Lt[0])+v*(Bt[0]-Lt[0]), Lt[1]+u*(Ft[1]-Lt[1])+v*(Bt[1]-Lt[1])];
  const st=P(.42,.5).map(r1);
  s+=ao(st[0],st[1]+1,14,3,.4);
  // 汤锅：铁锅 + 锅沿 + 翻滚的热汤
  s+=cyl(st[0],st[1]-1,12.5,4.6,11,'#4b4048','#2a2229');
  s+=`<ellipse cx="${st[0]}" cy="${st[1]-12}" rx="12.5" ry="4.6" fill="#2e262d"/>
      <ellipse cx="${st[0]}" cy="${st[1]-12}" rx="10.6" ry="3.7" fill="#e7a24a"/>
      <ellipse cx="${st[0]-2}" cy="${st[1]-12.4}" rx="6" ry="1.9" fill="#f6c677" opacity=".8"/>
      <circle cx="${st[0]-5}" cy="${st[1]-11.6}" r="1.1" fill="#fff3d6"/><circle cx="${st[0]+3.5}" cy="${st[1]-12.6}" r="1.3" fill="#fff3d6"/><circle cx="${st[0]+6}" cy="${st[1]-11.2}" r=".9" fill="#fff3d6"/>
      <rect x="${st[0]-15.5}" y="${st[1]-9}" width="3.5" height="2" rx="1" fill="#2a2229"/><rect x="${st[0]+12}" y="${st[1]-9}" width="3.5" height="2" rx="1" fill="#2a2229"/>
      <path d="M${st[0]-12.5} ${st[1]-1} v-8" stroke="rgba(255,255,255,.18)" stroke-width="1.4"/>`;
  s+=`<g class="nv-steam" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round">
      <path d="M${st[0]-6} ${st[1]-15} q-4 -7 0 -14 q4 -7 0 -14"/><path d="M${st[0]} ${st[1]-16} q-4 -7 0 -14 q4 -7 0 -14"/><path d="M${st[0]+6} ${st[1]-15} q-4 -7 0 -14 q4 -7 0 -14"/></g>`;
  const bw=P(.82,.5).map(r1);
  s+=`<path d="M${bw[0]-6.5} ${bw[1]-2} a6.5 5 0 0 0 13 0z" fill="#f6f8fc"/><path d="M${bw[0]-6} ${bw[1]} a6 3 0 0 0 12 0" stroke="#4a6fb3" stroke-width=".9" fill="none"/>
      <ellipse cx="${bw[0]}" cy="${bw[1]-2}" rx="6.5" ry="2.3" fill="#e6ebf4"/>
      <ellipse cx="${bw[0]}" cy="${bw[1]-2}" rx="5.2" ry="1.7" fill="#e7a24a"/>
      <circle cx="${bw[0]-2}" cy="${bw[1]-2.2}" r=".8" fill="#fff3d6"/><circle cx="${bw[0]+2}" cy="${bw[1]-1.8}" r=".7" fill="#fff3d6"/>`;
  // 瓦顶
  const r=roof(102,160,56,28,58,14,['#6b1b14','#9e2a1e','#b5332a']);
  s+=r.s;
  for(let t=.2;t<1;t+=.2) s+=line(lerp(r.Lt,r.Mb,t),lerp(r.Ft,r.Mf,t),'rgba(70,10,5,.35)',.9);
  for(let t=.08;t<1;t+=.084) s+=line(lerp(r.Lt,r.Ft,t),lerp(r.Mb,r.Mf,t),'rgba(255,180,150,.16)',.7);
  s+=line(r.Lt,r.Ft,'#e0b04f',1.6)+line(r.Ft,r.Mf,'#7a1e15',1.8)+line(r.Mf,r.Rt,'#7a1e15',1.8);
  // 屋脊积雪 + 起翘
  s+=poly([r.Mb,r.Mf,lerp(r.Mf,r.Ft,.28),lerp(r.Mb,r.Lt,.22)],'#f6f8fd')+line(r.Mb,r.Mf,'#fff',2.4);
  s+=`<path d="M${r1(r.Lt[0])} ${r1(r.Lt[1])} q-4 -1 -5 -6" stroke="#b5332a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M${r1(r.Ft[0])} ${r1(r.Ft[1])} q3 1 5 -4" stroke="#9e2a1e" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  // 灯笼
  [.22,.8].forEach(t=>{const p=lerp(r.Lt,r.Ft,t).map(r1);const x=p[0],y=p[1];
    s+=`<g class="nv-lantern-sway">${line([x,y],[x,y+5],'#5a2b22',.8)}
      <g class="nv-lit">${glowDot(x,y+11,14)}</g>
      <rect x="${x-2.6}" y="${y+5}" width="5.2" height="1.6" fill="#c9a24f"/>
      <ellipse cx="${x}" cy="${y+11}" rx="4.6" ry="5.4" fill="url(#nvgLantern)"/>
      <path d="M${x} ${y+5.6} v10.8 M${x-2.6} ${y+6.4} q-1.4 4.6 0 9.2 M${x+2.6} ${y+6.4} q1.4 4.6 0 9.2" stroke="rgba(120,20,10,.45)" stroke-width=".6" fill="none"/>
      <rect x="${x-2.6}" y="${y+15.8}" width="5.2" height="1.6" fill="#c9a24f"/>${line([x,y+17.4],[x,y+21],'#e0442c',.9)}</g>`;});
  // 招幌
  s+=line([152,150],[152,92],'#5a2b22',1.6)+`<circle cx="152" cy="91" r="1.6" fill="#e0b04f"/>`+
     RF(152,150,`<path d="M1 -56 h12 v26 l-6 -4 l-6 4z" fill="#c23a2c"/><path d="M1 -56 h12 v3 h-12z" fill="#e0b04f"/>
     <text x="7" y="-39" text-anchor="middle" font-size="10" fill="#fff6e4" font-family="'ZCOOL XiaoWei',serif">汤</text>`);
  s+=snowLump(128,168,6);
  return `<svg class="nv-landmark" viewBox="0 22 200 194" aria-hidden="true">${s}</svg>`;
},

gnomon(){
  let s=island('snow');
  s+=pine(164,122,.85)+pine(150,134,.55)+snowLump(56,168,10);
  s+=ao(100,148,50,13,.45);
  s+=box(100,164,44,44,8,['#a3abc2','#7c849f','#e9edf6']);
  s+=LF(100,164,44,[11,22,33].map(x=>`<path d="M${x} -8 V0" stroke="rgba(40,45,80,.25)" stroke-width=".8"/>`).join(''))+RF(100,164,[11,22,33].map(x=>`<path d="M${x} -8 V0" stroke="rgba(30,35,70,.3)" stroke-width=".8"/>`).join(''));
  s+=box(100,150,32,32,8,['#b4bbd0','#8a92ad','#f1f4fa']);
  s+=LF(100,150,32,[8,16,24].map(x=>`<path d="M${x} -8 V0" stroke="rgba(40,45,80,.22)" stroke-width=".8"/>`).join(''))+RF(100,150,[8,16,24].map(x=>`<path d="M${x} -8 V0" stroke="rgba(30,35,70,.28)" stroke-width=".8"/>`).join(''));
  // 圭：铜尺 + 刻度 + 最长的影子
  s+=box(114,134,14,4,1.6,['#b98d3e','#8f6a2c','#e2bd6c'],false);
  const a=[100,126.4],b=[114,133.4];
  for(let t=.15;t<1;t+=.14){const p=lerp(a,b,t);s+=line([p[0],p[1]-1.6],[p[0]+2.4,p[1]-2.8],'#7a5622',.6)}
  s+=poly([[99,125.6],[116,134],[119.4,132.4],[102.4,124]],'rgba(28,32,72,.32)');
  // 表：石柱
  s+=box(100,128.5,5,5,54,['#dfe3ec','#a9b0c4','#f3f5fa']);
  s+=box(100,77,10,10,4,['#c5cbdb','#949cb5','#f6f8fc'])+poly([[90,72],[100,77],[110,72],[100,67]].map(p=>[p[0],p[1]-5.2]),'#fff');
  s+=`<circle cx="100" cy="64" r="3.4" fill="#d8b25c"/><circle cx="99" cy="63" r="1.1" fill="#fff6d8"/>`;
  s+=`<g class="nv-lit">${glowDot(100,62,22,true)}<path d="M100 40 l1.6 5.4 l5.4 1.6 l-5.4 1.6 l-1.6 5.4 l-1.6 -5.4 l-5.4 -1.6 l5.4 -1.6z" fill="#fff"/>
      <path d="M128 52 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1 l3 -1z" fill="#dfe6ff"/></g>`;
  // 浑仪
  s+=ao(42,146,12,3.6,.4)+`<path d="M38 146 h8 l-1.6 -3 h-4.8z" fill="#7c849f"/><path d="M42 143 v-6" stroke="#8f6a2c" stroke-width="1.6"/>
      <circle cx="42" cy="128" r="9.5" fill="none" stroke="#c9a24f" stroke-width="1.6"/>
      <ellipse cx="42" cy="128" rx="9.5" ry="3.4" fill="none" stroke="#b98d3e" stroke-width="1.3"/>
      <ellipse cx="42" cy="128" rx="9.5" ry="3.4" fill="none" stroke="#e2bd6c" stroke-width="1.1" transform="rotate(-38 42 128)"/>
      <circle cx="42" cy="128" r="1.6" fill="#e2bd6c"/>`;
  // 台阶积雪
  s+=`<path d="M56 141 q6 -3 12 1 q-6 2 -12 -1z M128 144 q6 -3 14 -2 q-6 3 -14 2z M82 158 q8 -3 16 1 q-8 2 -16 -1z" fill="#fff"/>`;
  return `<svg class="nv-landmark" viewBox="0 22 200 194" aria-hidden="true">${s}</svg>`;
}
};

/* ─────────────────────────────────────────────
   背景层（远山 / 中景丘陵 / 小路 / 前景枝叶）和共用渐变、滤镜
───────────────────────────────────────────── */
const DEFS_SVG = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="nvgTopA" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#ecc57b"/><stop offset=".6" stop-color="#c88a3e"/><stop offset="1" stop-color="#a36a2c"/></radialGradient>
    <radialGradient id="nvgTopM" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#d9b98a"/><stop offset=".65" stop-color="#a98157"/><stop offset="1" stop-color="#8a6847"/></radialGradient>
    <radialGradient id="nvgTopS" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e3e8f3"/><stop offset="1" stop-color="#c2cbe0"/></radialGradient>
    <linearGradient id="nvgCliffA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d5a34"/><stop offset=".5" stop-color="#5e3622"/><stop offset="1" stop-color="#2e1a14"/></linearGradient>
    <linearGradient id="nvgCliffM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d5d4c"/><stop offset=".5" stop-color="#4f3a3e"/><stop offset="1" stop-color="#241d2c"/></linearGradient>
    <linearGradient id="nvgCliffS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e78a0"/><stop offset=".5" stop-color="#454f7c"/><stop offset="1" stop-color="#1c2148"/></linearGradient>
    <linearGradient id="nvgSilo" x1="0" x2="1"><stop offset="0" stop-color="#f3ece0"/><stop offset=".35" stop-color="#d9cfbf"/><stop offset="1" stop-color="#8e8477"/></linearGradient>
    <linearGradient id="nvgSiloTop" x1="0" x2="1"><stop offset="0" stop-color="#c7cbd2"/><stop offset="1" stop-color="#7c818b"/></linearGradient>
    <radialGradient id="nvgPump" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#ffbb66"/><stop offset=".6" stop-color="#ec7a24"/><stop offset="1" stop-color="#b8501a"/></radialGradient>
    <radialGradient id="nvgCanopy" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#f7ae4c"/><stop offset=".55" stop-color="#e06a2a"/><stop offset="1" stop-color="#a8381c"/></radialGradient>
    <radialGradient id="nvgCanopy2" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffc766"/><stop offset=".6" stop-color="#ef8d33"/><stop offset="1" stop-color="#c25424"/></radialGradient>
    <linearGradient id="nvgTrunk" x1="0" x2="1"><stop offset="0" stop-color="#7a4e30"/><stop offset="1" stop-color="#43281a"/></linearGradient>
    <radialGradient id="nvgTurkey" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#f0a85a"/><stop offset=".6" stop-color="#c06a2a"/><stop offset="1" stop-color="#7f3c18"/></radialGradient>
    <linearGradient id="nvgBamboo" x1="0" x2="1"><stop offset="0" stop-color="#f2d59c"/><stop offset=".45" stop-color="#d6ab68"/><stop offset="1" stop-color="#9a7038"/></linearGradient>
    <radialGradient id="nvgLantern" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffb08a"/><stop offset=".5" stop-color="#e0442c"/><stop offset="1" stop-color="#9c1f16"/></radialGradient>
    <linearGradient id="nvgStone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e8f1"/><stop offset="1" stop-color="#b4bccf"/></linearGradient>
    <radialGradient id="nvgWarm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffb84d" stop-opacity="0"/></radialGradient>
    <radialGradient id="nvgCool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e6ecff" stop-opacity=".9"/><stop offset="1" stop-color="#9fb2ff" stop-opacity="0"/></radialGradient>
    <filter id="nvfAO" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <filter id="nvfGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
</svg>
`;

const LAYER_FAR = `      <svg viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="nvFarG" x1="0" x2="1">
            <stop offset="0" stop-color="#b8766a"/><stop offset=".55" stop-color="#7b5a85"/><stop offset="1" stop-color="#3c4478"/>
          </linearGradient>
        </defs>
        <path d="M0 400 L90 330 L170 370 L260 300 L360 360 L450 310 L560 370 L650 290 L740 340 L830 260 L920 320 L1010 250 L1100 310 L1200 270 L1200 600 L0 600Z" fill="url(#nvFarG)" opacity=".75"/>
        <path d="M830 260 L860 285 L845 284 L830 296 L815 283 L800 285Z M1010 250 L1042 278 L1025 276 L1010 290 L994 276 L978 278Z M1200 270 L1170 290 L1185 292 L1200 282Z M650 290 L672 308 L660 307 L650 316 L640 307 L628 308Z" fill="#eef1f6" opacity=".85"/>
      </svg>
`;

const LAYER_MID = `      <svg viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="nvMidG" x1="0" x2="1">
            <stop offset="0" stop-color="#a2593a"/><stop offset=".45" stop-color="#7c4a52"/><stop offset=".62" stop-color="#8f93b5"/><stop offset="1" stop-color="#c9d0e6"/>
          </linearGradient>
        </defs>
        <path d="M0 470 C150 420 260 450 380 430 C520 405 610 455 760 430 C900 405 1020 440 1200 410 L1200 600 L0 600Z" fill="url(#nvMidG)"/>
        <!-- 秋树 -->
        <g fill="#8a3b22" opacity=".9">
          <circle cx="60" cy="440" r="22"/><circle cx="92" cy="430" r="16"/><circle cx="210" cy="438" r="18"/><circle cx="330" cy="426" r="14"/>
        </g>
        <!-- 雪松 -->
        <g fill="#4d5a82" opacity=".9">
          <path d="M900 430 l14 -40 l14 40z M940 428 l11 -30 l11 30z M1080 424 l15 -44 l15 44z M1130 420 l10 -28 l10 28z"/>
        </g>
        <g fill="#f4f6fb"><path d="M914 390 l5 14 l-10 0z M1095 380 l6 16 l-12 0z"/></g>
      </svg>
`;

const LAYER_ROUTE = `      <svg viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <path d="M170 520 C235 520 255 466 320 466 C400 466 420 512 500 512 C580 512 600 456 680 456 C760 456 790 516 850 516"
              fill="none" stroke="rgba(255,240,220,.55)" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      </svg>
`;

const LAYER_FORE = `      <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true" style="filter:blur(2px)">
        <g fill="#b1401f" opacity=".85">
          <path d="M-20 560 C60 540 120 570 170 600 L-20 600Z" fill="#5a2a1c"/>
          <circle cx="40" cy="560" r="18"/><circle cx="90" cy="575" r="14" fill="#d8742c"/><circle cx="130" cy="590" r="12"/>
        </g>
        <g opacity=".8">
          <path d="M1220 520 L1060 590 L1220 600Z" fill="#2d3560"/>
          <path d="M1220 530 L1090 585 L1220 560Z" fill="#f2f4fa"/>
        </g>
      </svg>
`;

/* ─────────────────────────────────────────────
   五处地标的位置与归属
───────────────────────────────────────────── */
const SPOTS = [
  { id: 'barn', name: '丰收谷仓', fest: '感恩节', x: '16%', y: '9%', bd: '0s', nodeIdx: 0, doneLabel: '达成' },
  { id: 'table', name: '枫叶长桌', fest: '感恩节', x: '32%', y: '18%', bd: '-1.2s', nodeIdx: 1, doneLabel: '达成' },
  { id: 'cabin', name: '炉火小屋', fest: '秋冬之交', x: '50%', y: '10%', bd: '-2.4s', nodeIdx: 2, doneLabel: '达成' },
  { id: 'stall', name: '暖汤小铺', fest: '寒冬', x: '68%', y: '20%', bd: '-3.6s', nodeIdx: null, doneLabel: '' },
  { id: 'gnomon', name: '圭表观星台', fest: '冬至', x: '85%', y: '9%', bd: '-4.8s', nodeIdx: 3, doneLabel: '开启' },
];

/* ─────────────────────────────────────────────
   星星、落叶、雪（固定随机种子，每次渲染位置都一样）
───────────────────────────────────────────── */
const LEAF_COLORS = ['#d9622b', '#e8892f', '#b8402a', '#f0a640'];

const mkRng = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};

const round2 = (n) => Math.round(n * 100) / 100;

const buildParticles = () => {
  const rnd = mkRng(20261105);

  const stars = Array.from({ length: 46 }, () => {
    const x = 45 + rnd() * 55;
    const top = rnd() * 48;
    const t = 2 + rnd() * 3;
    const dl = -rnd() * 4;
    return {
      left: `${round2(x)}%`,
      top: `${round2(top)}%`,
      '--t': `${round2(t)}s`,
      '--dl': `${round2(dl)}s`,
      '--o': round2(0.4 + (x - 45) / 80),
    };
  });

  const leaves = Array.from({ length: 16 }, (_, i) => {
    const left = rnd() * 46;
    const dur = 9 + rnd() * 7;
    const delay = -rnd() * 14;
    const sw = 30 + rnd() * 50;
    return {
      left: `${round2(left)}%`,
      '--c': LEAF_COLORS[i % 4],
      '--dur': `${round2(dur)}s`,
      '--delay': `${round2(delay)}s`,
      '--sw': round2(sw),
    };
  });

  const flakes = Array.from({ length: 44 }, () => {
    const size = 2 + rnd() * 4;
    const left = 50 + rnd() * 52;
    const dur = 8 + rnd() * 8;
    const delay = -rnd() * 14;
    const sw = 10 + rnd() * 30;
    return {
      left: `${round2(left)}%`,
      '--s': `${round2(size)}px`,
      '--dur': `${round2(dur)}s`,
      '--delay': `${round2(delay)}s`,
      '--sw': round2(sw),
      opacity: round2(0.4 + size / 8),
    };
  });

  return { stars, leaves, flakes };
};

const clamp1 = (n) => Math.max(-1, Math.min(1, n));

/* ─────────────────────────────────────────────
   NovemberScene
───────────────────────────────────────────── */
export function NovemberScene({ lit = [], selectedIdx = 0, fxEnabled = true, onNodeClick }) {
  const sceneRef = useRef(null);
  const worldRef = useRef(null);
  const scrollerRef = useRef(null);

  const arts = useMemo(() => SPOTS.map((spot) => art[spot.id]()), []);
  const particles = useMemo(buildParticles, []);

  // 窄屏时把视口居中到中间的地标。
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const raf = requestAnimationFrame(() => {
      scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // 在下方的节点快捷条里换了选中节点时，把场景平滑滚到对应的地标
  // （窄屏一次只看得到两三处地标）。第一次渲染不滚，保持居中。
  const firstSelectRef = useRef(true);
  useEffect(() => {
    if (firstSelectRef.current) {
      firstSelectRef.current = false;
      return;
    }
    const scroller = scrollerRef.current;
    const target = scroller?.querySelector(`[data-node="${selectedIdx}"]`);
    if (!scroller || !target) return;
    const sRect = scroller.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    const delta = (tRect.left + tRect.width / 2) - (sRect.left + sRect.width / 2);
    if (typeof scroller.scrollBy === 'function') {
      scroller.scrollBy({ left: delta, behavior: 'smooth' });
    }
  }, [selectedIdx]);

  // 视差：鼠标 / 陀螺仪 / 空闲时轻摆。关闭光效或系统要求减少动效时保持静止。
  useEffect(() => {
    const root = sceneRef.current;
    const world = worldRef.current;
    if (!root || !world) return undefined;

    let reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      reduce = false;
    }

    world.style.setProperty('--mx', '0');
    world.style.setProperty('--my', '0');

    if (!fxEnabled || reduce) return undefined;

    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let active = false;
    let lastMove = 0;
    let raf = 0;

    const onMove = (e) => {
      if (e.pointerType === 'touch') return;
      const r = root.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      active = true;
      lastMove = performance.now();
    };
    const onLeave = () => {
      active = false;
    };
    const onTilt = (e) => {
      if (e.gamma == null) return;
      tx = clamp1(e.gamma / 25);
      ty = clamp1((e.beta - 45) / 30);
      active = true;
      lastMove = performance.now();
    };
    const tick = (t) => {
      if (!active || t - lastMove > 2500) {
        tx = Math.sin(t / 2600) * 0.45;
        ty = Math.sin(t / 3700) * 0.15;
      }
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      world.style.setProperty('--mx', cx.toFixed(4));
      world.style.setProperty('--my', cy.toFixed(4));
      raf = requestAnimationFrame(tick);
    };

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    window.addEventListener('deviceorientation', onTilt);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, [fxEnabled]);

  return (
    <div
      ref={sceneRef}
      className={`nv-scene${fxEnabled ? '' : ' nv-scene--still'}`}
      role="group"
      aria-label="十一月成就场景"
    >
      <div className="nv-defs" aria-hidden="true" dangerouslySetInnerHTML={{ __html: DEFS_SVG }} />

      <div className="nv-scroller" ref={scrollerRef}>
        <div className="nv-world" ref={worldRef}>
          {/* 天空：从左到右，黄昏到长夜 */}
          <div className="nv-layer nv-sky" aria-hidden="true">
            <div className="nv-sun" />
            <div className="nv-moon" />
            {particles.stars.map((style, i) => (
              <i key={i} className="nv-star" style={style} />
            ))}
          </div>

          <div className="nv-layer nv-far" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LAYER_FAR }} />
          <div className="nv-layer nv-mid" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LAYER_MID }} />
          <div className="nv-layer nv-route" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LAYER_ROUTE }} />

          {/* 五处地标 */}
          <div className="nv-layer nv-islands-layer">
            {SPOTS.map((spot, i) => {
              const interactive = spot.nodeIdx !== null;
              const isLit = Boolean(interactive ? lit[spot.nodeIdx] : lit[3]);
              const isSelected = interactive && spot.nodeIdx === selectedIdx;
              const className = [
                'nv-spot',
                isLit ? 'nv-spot--lit' : '',
                isSelected ? 'nv-spot--selected' : '',
                interactive ? '' : 'nv-spot--decor',
              ].filter(Boolean).join(' ');
              const style = { '--x': spot.x, '--y': spot.y, '--bd': spot.bd };

              const inner = (
                <span className="nv-spot-inner">
                  {interactive && (
                    <span className="nv-slot">
                      <span className="nv-ring" />
                      <span className="nv-slot-lock" dangerouslySetInnerHTML={{ __html: lockIcon }} />
                      <span className="nv-slot-label">{spot.doneLabel}</span>
                    </span>
                  )}
                  <span className="nv-art" dangerouslySetInnerHTML={{ __html: arts[i] }} />
                  <span className="nv-tag">
                    {spot.name}
                    <small>{spot.fest}</small>
                  </span>
                </span>
              );

              if (!interactive) {
                return (
                  <div key={spot.id} className={className} style={style}>
                    {inner}
                  </div>
                );
              }

              return (
                <button
                  key={spot.id}
                  type="button"
                  className={className}
                  style={style}
                  data-node={spot.nodeIdx}
                  aria-pressed={isSelected}
                  aria-label={`${spot.name}，${spot.fest}，${isLit ? '已点亮' : '未点亮'}，查看详情`}
                  onClick={() => onNodeClick?.(spot.nodeIdx)}
                >
                  {inner}
                </button>
              );
            })}
          </div>

          {/* 落叶（左半边）与雪（右半边） */}
          <div className="nv-layer nv-fx" aria-hidden="true">
            {particles.leaves.map((style, i) => (
              <i key={`leaf-${i}`} className="nv-leaf" style={style} />
            ))}
            {particles.flakes.map((style, i) => (
              <i key={`flake-${i}`} className="nv-flake" style={style} />
            ))}
          </div>

          <div className="nv-layer nv-fore" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LAYER_FORE }} />
          <div className="nv-fog" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   小图标 SVG（用于节点快捷条/详情卡，跟万圣节的 NodeIcon 同一个接口）
   type: 'barn' | 'table' | 'cabin' | 'gnomon'
───────────────────────────────────────────── */
export function NovemberNodeIcon({ type, on, size = 22 }) {
  const c = on
    ? {
      wall: '#c84b30', trim: '#f6e8d0', door: '#7a2516',
      leaf: '#d9622b', vein: '#8a2f1a',
      roof: '#6a3f24', log: '#8f5a35', snow: '#ffffff', glow: '#ffd47e',
      stone: '#dfe3ec', stone2: '#a9b0c4', star: '#f2b84b',
    }
    : {
      wall: '#8b7f8e', trim: '#c9bfcb', door: '#645a68',
      leaf: '#8b7f8e', vein: '#645a68',
      roof: '#645a68', log: '#7b6f80', snow: '#c9bfcb', glow: '#a79cab',
      stone: '#a79cab', stone2: '#7b6f80', star: '#c9bfcb',
    };

  const bodies = {
    barn: (
      <>
        <path d="M4,14 L16,5 L28,14 V27 H4 Z" fill={c.wall} />
        <path d="M4,14 L16,5 L28,14" fill="none" stroke={c.trim} strokeWidth="1.6" strokeLinejoin="round" />
        <rect x="11" y="16" width="10" height="11" fill={c.door} />
        <path d="M11,16 L21,27 M21,16 L11,27" stroke={c.trim} strokeWidth="1.2" />
      </>
    ),
    table: (
      <>
        <path
          d="M16,3 L19,10 L25,8 L23,15 L29,16 L23,20 L25,26 L18,23 L16,29 L14,23 L7,26 L9,20 L3,16 L9,15 L7,8 L13,10 Z"
          fill={c.leaf}
        />
        <path d="M16,9 V27" stroke={c.vein} strokeWidth="1.2" strokeLinecap="round" />
      </>
    ),
    cabin: (
      <>
        <rect x="8" y="15" width="16" height="12" fill={c.log} />
        <path d="M5,15 L16,6 L27,15 Z" fill={c.roof} />
        <path d="M9,12.5 L16,6 L23,12.5 L20,12.5 L16,9 L12,12.5 Z" fill={c.snow} />
        <rect x="13" y="19" width="6" height="8" fill={c.door} />
        <rect x="9.5" y="17" width="3" height="3" fill={c.glow} />
      </>
    ),
    gnomon: (
      <>
        <rect x="12" y="12" width="8" height="14" fill={c.stone} />
        <rect x="7" y="25" width="18" height="3.5" rx="1" fill={c.stone2} />
        <path d="M16,2.5 l1.7,4.6 l4.6,1.7 l-4.6,1.7 l-1.7,4.6 l-1.7,-4.6 l-4.6,-1.7 l4.6,-1.7 z" fill={c.star} />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      {bodies[type] || bodies.barn}
    </svg>
  );
}