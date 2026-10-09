import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {applyHarborTheme} from './theme.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const globals='document,window,history,location,fetch,matchMedia,addEventListener,removeEventListener,scrollTo,setTimeout,clearTimeout,requestAnimationFrame,cancelAnimationFrame,IntersectionObserver,ResizeObserver,MutationObserver';

function compileModule(name,input){
 const exports=[...input.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+(\w+)/gm)].map(match=>match[1]);
 let source=input.replace(/^import\s+\{([^}]+)\}\s+from\s+['"]\.\/([^?'"\n]+)(?:\?[^'"\n]*)?['"];?\s*$/gm,(_match,names,file)=>`const {${names}}=__require(${JSON.stringify(file)});`).replace(/^export\s+/gm,'');
 source=source.replace(/(['"`(=])assets\//g,'$1/spooktober/assets/');
 const file=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const transformed=ts.transform(file,[context=>{
  const visit=node=>{
   if(ts.isIdentifier(node)&&['scrollY','innerHeight','innerWidth'].includes(node.text)&&!(ts.isPropertyAccessExpression(node.parent)&&node.parent.name===node))return ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__env'),node.text);
   if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&['getBoundingClientRect','scrollIntoView'].includes(node.expression.name.text)){
    const method=node.expression.name.text==='getBoundingClientRect'?'rect':'scrollIntoView';
    return ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__env'),method),undefined,[ts.visitNode(node.expression.expression,visit),...node.arguments.map(arg=>ts.visitNode(arg,visit))]);
   }
   return ts.visitEachChild(node,visit,context);
  };
  return node=>ts.visitNode(node,visit);
 }]);
 const printed=ts.createPrinter().printFile(transformed.transformed[0]);transformed.dispose();
 return `${JSON.stringify(name)}:(__env,__require,__exports)=>{\nconst {${globals}}=__env;\n${printed}\nObject.assign(__exports,{${exports.join(',')}});\n}`;
}

export async function buildNativeRuntime(source,sourceFiles){
 const output=new Map();const modules=[];
 for(const name of [...sourceFiles].filter(name=>name.endsWith('.js')).sort()){
  const code=await readFile(name==='harbor-bridge.js'?path.join(here,'bridge.js'):path.join(source,name),'utf8');
  modules.push(compileModule(name,code));
 }
 output.set('native-runtime.js',`// Generated from the approved Spooktober modules; each mount owns its module state.\nconst factories={\n${modules.join(',\n')}\n};\nexport function startSpooktoberRuntime(env){const cache=new Map();const require=name=>{if(cache.has(name))return cache.get(name);const exports={};cache.set(name,exports);if(!factories[name])throw Error('Unknown Spooktober module: '+name);factories[name](env,require,exports);return exports};return require('app.js')}\n`);
 const runtimeVersion=createHash('sha256').update(output.get('native-runtime.js')).digest('hex').slice(0,12);
 for(const [name,from] of [['native-entry.js','entry.js'],['native-environment.js','environment.js']]){
  const code=await readFile(path.join(here,from),'utf8');
  output.set(name,name==='native-entry.js'?code.replace("'./native-runtime.js'",`'./native-runtime.js?v=${runtimeVersion}'`):code);
 }
 const index=await readFile(path.join(source,'index.html'),'utf8');
 const body=index.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];if(!body)throw Error('Spooktober index has no body.');
 output.set('native-layout.html',body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/(['"])(assets\/)/g,'$1/spooktober/$2'));
 const styles=[...index.matchAll(/<link\b[^>]*href=["']([^"']+\.css)(?:\?[^"']*)?["'][^>]*>/gi)].map(match=>match[1]);
 let css=(await Promise.all(styles.map(name=>readFile(path.join(source,name),'utf8')))).join('\n');
 css=css.replaceAll('Nightmare','SpookNightmare').replaceAll('Plus Jakarta Sans','SpookJakarta').replaceAll('Switzer','SpookSwitzer');
 const fonts=[];
 css=css.replace(/@font-face\s*\{([^}]+)\}/g,(_block,definition)=>{
  const family=definition.match(/font-family\s*:\s*['"]?([^;'"]+)/)?.[1]?.trim();
  const url=definition.match(/src\s*:\s*url\(['"]?([^)'"\s]+)/)?.[1];
  if(family&&url){const descriptors={};for(const key of ['weight','style','display']){const value=definition.match(new RegExp(`font-${key}\\s*:\\s*([^;]+)`))?.[1]?.trim();if(value)descriptors[key]=value}fonts.push({family,source:`url('/spooktober/${url}')`,descriptors})}return '';
 });
 css=css.replace(/(?<![\w.-])body(?=[\s{:.>])/g,'.spook-native-body').replace(/(?<![\w.-])html(?=[\s{:.>])/g,'.spook-native-body').replaceAll(':root',':is(.spook-native-body,.spook-native-viewport)');
 css=css.replace(/@media\s*(\((?:min|max)-width:[^{]+)/g,'@container spooktober $1');
 css=css.replace(/(-?[\d.]+)vw\b/g,'$1cqw').replace(/(-?[\d.]+)(?:dvh|svh|vh)\b/g,(_match,value)=>`calc(var(--spook-height) * ${Number(value)/100})`);
 css=css.replace(/position\s*:\s*fixed/g,'position:absolute').replace(/url\(['"]?(assets\/[^)'"\s]+)['"]?\)/g,"url('/spooktober/$1')");
 const scope=`:host{display:block;position:relative;container:spooktober / inline-size;isolation:isolate;min-height:100%;color-scheme:inherit} .spook-native-body{position:relative;min-height:var(--spook-height);margin:0;overflow:clip;font-synthesis:none} .spook-native-overlay{position:sticky;top:0;height:0;z-index:100;pointer-events:none}.spook-native-viewport{position:absolute;top:0;left:0;width:100%;height:var(--spook-height);pointer-events:none}.spook-native-viewport>*{pointer-events:auto}.spook-native-body>main{margin:0}.spook-native-viewport [hidden]{display:none!important}\n`;
 css=applyHarborTheme(css).replaceAll('color-scheme:dark','color-scheme:inherit');
 const theme=await readFile(path.join(here,'theme.css'),'utf8');
 output.set('native-styles.css',scope+css+theme+'\n.spook-native-body{padding:0;border:0;border-radius:0}.spook-native-viewport{background:transparent!important}.harbor-native .page-navigation{display:none}.harbor-native .route-page-content{padding-top:28px}\n');
 output.set('native-fonts.json',JSON.stringify(fonts,null,2)+'\n');
 return output;
}
