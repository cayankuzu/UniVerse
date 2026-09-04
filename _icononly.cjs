const fs=require('fs'),path=require('path');
const parser=require('@typescript-eslint/parser');
const [,,ROOT,SRC]=process.argv;
const P=new Set(['Pressable','TouchableOpacity','TouchableHighlight','TouchableWithoutFeedback','InstantPressable','AppPressable']);
const TEXTISH=/^(Text|AppText|Title|Subtitle|Label|Paragraph|Caption)$/;
const files=[];(function w(d){let es;try{es=fs.readdirSync(d,{withFileTypes:true});}catch{return;}
 for(const e of es){if(e.name==='node_modules'||e.name==='.git')continue;const p=path.join(d,e.name);
  if(e.isDirectory())w(p);else if(/\.tsx$/.test(e.name)&&!/\.(test|spec)\.tsx$/.test(e.name))files.push(p);}})(path.join(ROOT,SRC));
function walk(n,v){if(!n||typeof n!=='object')return;v(n);for(const [k,val] of Object.entries(n)){if(k==='parent')continue;
 if(Array.isArray(val))val.forEach(c=>walk(c,v));else if(val&&typeof val.type==='string')walk(val,v);}}
const out=[];
for(const f of files){const src=fs.readFileSync(f,'utf8');let ast;
 try{ast=parser.parse(src,{jsx:true,loc:true,sourceType:'module'});}catch{continue;}
 walk(ast,n=>{if(n.type!=='JSXElement'||n.openingElement.name?.type!=='JSXIdentifier'||!P.has(n.openingElement.name.name))return;
  const attrs=n.openingElement.attributes.filter(a=>a.type==='JSXAttribute');const names=attrs.map(a=>a.name&&a.name.name);
  const hidden=names.includes('accessibilityElementsHidden')||names.includes('importantForAccessibility')||
    attrs.some(a=>a.name&&a.name.name==='accessible'&&a.value&&a.value.expression&&a.value.expression.value===false);
  if(hidden)return;
  if(names.includes('accessibilityLabel')||names.includes('accessibilityLabelledBy'))return;
  // does any descendant render text?
  let hasText=false;
  walk(n,c=>{if(c.type==='JSXOpeningElement'&&c.name?.type==='JSXIdentifier'&&TEXTISH.test(c.name.name))hasText=true;
    if(c.type==='JSXText'&&c.value.trim())hasText=true;
    if(c.type==='JSXExpressionContainer'&&c.expression&&(c.expression.type==='Identifier'||c.expression.type==='MemberExpression'||c.expression.type==='CallExpression'))hasText=hasText;});
  if(hasText)return;
  out.push(`${path.relative(ROOT,f).split(path.sep).join('/')}:${n.loc.start.line} ${n.openingElement.name.name}`);
 });}
console.log(`ICON-ONLY PRESSABLES WITHOUT A LABEL: ${out.length}`);
out.forEach(l=>console.log('  '+l));
