const fs=require('fs'),path=require('path');
const parser=require('@typescript-eslint/parser');
const [,,ROOT,SRC]=process.argv;
const P=new Set(['Pressable','TouchableOpacity','TouchableHighlight','TouchableWithoutFeedback','InstantPressable','AppPressable']);
const SIZE=new Set(['height','minHeight','minWidth','width']);
const files=[];(function w(d){let es;try{es=fs.readdirSync(d,{withFileTypes:true});}catch{return;}
 for(const e of es){if(e.name==='node_modules'||e.name==='.git')continue;const p=path.join(d,e.name);
  if(e.isDirectory())w(p);else if(/\.tsx$/.test(e.name)&&!/\.(test|spec)\.tsx$/.test(e.name))files.push(p);}})(path.join(ROOT,SRC));
function walk(n,v){if(!n||typeof n!=='object')return;v(n);for(const [k,val] of Object.entries(n)){if(k==='parent')continue;
 if(Array.isArray(val))val.forEach(c=>walk(c,v));else if(val&&typeof val.type==='string')walk(val,v);}}
function objs(n,acc=[]){if(!n||typeof n!=='object')return acc;
 switch(n.type){case 'JSXAttribute':case 'JSXExpressionContainer':return objs(n.value??n.expression,acc);
 case 'ObjectExpression':acc.push(n);return acc;
 case 'ArrayExpression':n.elements.forEach(e=>objs(e,acc));return acc;
 case 'ConditionalExpression':objs(n.consequent,acc);objs(n.alternate,acc);return acc;
 case 'ArrowFunctionExpression':case 'FunctionExpression':return objs(n.body,acc);
 case 'BlockStatement':{const r=n.body.find(s=>s.type==='ReturnStatement');return objs(r&&r.argument,acc);}
 case 'LogicalExpression':return objs(n.right,acc); default:return acc;}}
const role=[],size=[],label=[];
for(const f of files){const src=fs.readFileSync(f,'utf8');let ast;
 try{ast=parser.parse(src,{jsx:true,loc:true,sourceType:'module'});}catch{continue;}
 walk(ast,n=>{if(n.type!=='JSXOpeningElement'||n.name?.type!=='JSXIdentifier'||!P.has(n.name.name))return;
  const attrs=n.attributes.filter(a=>a.type==='JSXAttribute');const names=attrs.map(a=>a.name&&a.name.name);
  const loc=`${path.relative(ROOT,f).split(path.sep).join('/')}:${n.loc.start.line}`;
  const hidden=names.includes('accessibilityElementsHidden')||names.includes('importantForAccessibility')||
    attrs.some(a=>a.name&&a.name.name==='accessible'&&a.value&&a.value.expression&&a.value.expression.value===false);
  if(!hidden&&!names.includes('accessibilityRole'))role.push(`${loc} ${n.name.name}`);
  if(!hidden&&!names.includes('accessibilityLabel')&&!names.includes('accessibilityLabelledBy'))label.push(`${loc} ${n.name.name}`);
  const st=attrs.find(a=>a.name&&a.name.name==='style');if(!st)return;
  const vals=[];for(const o of objs(st))for(const pr of o.properties){
    if(pr.type!=='Property'||!pr.key||pr.key.type!=='Identifier'||!SIZE.has(pr.key.name))continue;
    if(pr.value&&pr.value.type==='Literal'&&typeof pr.value.value==='number')vals.push(pr.value.value);}
  const small=vals.filter(v=>v>0&&v<44);
  if(small.length&&!names.includes('hitSlop'))size.push(`${loc} ${n.name.name} ${Math.min(...small)}dp`);
 });}
console.log(`files=${files.length}  noRole=${role.length}  noLabel=${label.length}  smallNoHitSlop=${size.length}`);
console.log('\n-- SMALL TARGETS WITHOUT hitSlop --');size.forEach(l=>console.log('  '+l));
console.log('\n-- MISSING accessibilityRole --');role.slice(0,40).forEach(l=>console.log('  '+l));
console.log('\n-- MISSING accessibilityLabel --');label.slice(0,40).forEach(l=>console.log('  '+l));
