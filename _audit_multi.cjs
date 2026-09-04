const fs=require('fs'),path=require('path');
const [,,ROOT,THEME,SRC,SURFACES]=process.argv;
const themeSrc=fs.readFileSync(path.join(ROOT,THEME),'utf8');
const C={};
for(const m of themeSrc.matchAll(/(\w+):\s*['"](#[0-9a-fA-F]{6})['"]/g)) C[m[1]]=m[2];
function lum(h){const n=h.replace('#','');const c=[0,2,4].map(s=>parseInt(n.slice(s,s+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
const cr=(f,b)=>{const a=lum(f),d=lum(b),hi=Math.max(a,d),lo=Math.min(a,d);return (hi+0.05)/(lo+0.05);};
const layers=SURFACES.split(',').filter(s=>C[s]);
console.log('theme:',THEME,'| colors:',Object.keys(C).length,'| layers:',layers.map(l=>`${l}=${C[l]}`).join(' '));
const files=[];(function w(d){let es;try{es=fs.readdirSync(d,{withFileTypes:true});}catch{return;}
 for(const e of es){if(e.name==='node_modules'||e.name==='.git')continue;const p=path.join(d,e.name);
  if(e.isDirectory())w(p);else if(/\.tsx?$/.test(e.name)&&!/\.(test|spec)\.tsx?$/.test(e.name))files.push(p);}})(path.join(ROOT,SRC));
const viol=[];const rawHex=[];
for(const f of files){const s=fs.readFileSync(f,'utf8');const lines=s.split(/\r?\n/);
 lines.forEach((l,i)=>{
  const t=l.match(/(?<!background)(?<![A-Za-z])color:\s*(?:colors|theme\.colors|tokens\.colors|palette)\.(\w+)/);
  const g=l.match(/color=\{(?:colors|theme\.colors|tokens\.colors|palette)\.(\w+)\}/);
  const tok=t?.[1]||g?.[1]; if(tok&&C[tok]){
   const worst=Math.min(...layers.map(L=>cr(C[tok],C[L])));
   const need=t?4.5:3;
   if(worst<need) viol.push(`${path.relative(ROOT,f).split(path.sep).join('/')}:${i+1} ${t?'text':'icon'} ${tok} = ${worst.toFixed(2)} (needs ${need})`);
  }
  const rh=l.match(/['"]#[0-9a-fA-F]{3,8}['"]/); if(rh&&!f.includes('theme')) rawHex.push(`${path.relative(ROOT,f).split(path.sep).join('/')}:${i+1} ${rh[0]}`);
 });}
const agg={};for(const v of viol){const k=v.split(' ').slice(1).join(' ').replace(/= [0-9.]+ /,'');agg[k] = (agg[k] || 0) + 1;}
console.log(`\n--- CONTRAST VIOLATIONS: ${viol.length} (files: ${new Set(viol.map(v=>v.split(':')[0])).size})`);
Object.entries(agg).sort((a,b)=>b[1]-a[1]).forEach(([k,n])=>console.log(`  x${String(n).padStart(3)}  ${k}`));
console.log(`\n--- RAW HEX OUTSIDE THEME: ${rawHex.length}`);
rawHex.slice(0,12).forEach(l=>console.log('  '+l));
fs.writeFileSync(path.join(ROOT,'_audit_out.txt'),viol.join('\n'));
