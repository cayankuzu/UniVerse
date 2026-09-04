const fs=require('fs'),path=require('path');
const [,,ROOT,THEME,SRC,SURFACES]=process.argv;
const themeSrc=fs.readFileSync(path.join(ROOT,THEME),'utf8');
const C={};for(const m of themeSrc.matchAll(/(\w+):\s*['"](#[0-9a-fA-F]{6})['"]/g))C[m[1]]=m[2];
function lum(h){const n=h.replace('#','');const c=[0,2,4].map(s=>parseInt(n.slice(s,s+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
const cr=(f,b)=>{const a=lum(f),d=lum(b),hi=Math.max(a,d),lo=Math.min(a,d);return (hi+0.05)/(lo+0.05);};
const layers=SURFACES.split(',').filter(s=>C[s]);
// tokens meant for dark/inverse layers are judged elsewhere; list them so they're explicit
const INVERSE=/^(on[A-Z]|textInverse|surface|background|.*Bg$|.*Border.*|.*Overlay.*|.*Cover.*|deep|glass|camera|controls|light|map|marker)/;
const files=[];(function w(d){let es;try{es=fs.readdirSync(d,{withFileTypes:true});}catch{return;}
 for(const e of es){if(e.name==='node_modules'||e.name==='.git')continue;const p=path.join(d,e.name);
  if(e.isDirectory())w(p);else if(/\.tsx?$/.test(e.name)&&!/\.(test|spec)\.tsx?$/.test(e.name))files.push(p);}})(path.join(ROOT,SRC));
const rows=[];
for(const f of files){const s=fs.readFileSync(f,'utf8');
 s.split(/\r?\n/).forEach((l,i)=>{
  const t=l.match(/(?<!background)(?<![A-Za-z])color:\s*(?:colors|theme\.colors|tokens\.colors|palette)\.(\w+)/);
  const g=l.match(/color=\{(?:colors|theme\.colors|tokens\.colors|palette)\.(\w+)\}/);
  const tok=t?.[1]||g?.[1];
  if(!tok||!C[tok]||INVERSE.test(tok))return;
  const worst=Math.min(...layers.map(L=>cr(C[tok],C[L])));
  const need=t?4.5:3;
  if(worst<need)rows.push({f:path.relative(ROOT,f).split(path.sep).join('/'),l:i+1,tok,worst:worst.toFixed(2),need,kind:t?'text':'icon'});
 });}
console.log(`REAL LIGHT-LAYER VIOLATIONS: ${rows.length}`);
for(const r of rows)console.log(`  ${r.f}:${r.l} ${r.kind} ${r.tok}(${C[r.tok]}) = ${r.worst} needs ${r.need}`);
