
import fs from 'node:fs'
import path from 'node:path'
const ROOT = process.argv[2]
const tokens = ['NanmiCoder','relakkes','relakkesyangs','yunce','cchaha','haha','Haha','HAHA','cc-haha','claude-code','ClaudeCode','cchaha.ai','atomgit','cchaha.com']
const SKIP_DIRS = new Set(['.git','node_modules','dist','dist-electron','release','build','coverage','target','artifacts','.cache','.vite','.expo','.gradle','Pods','.next','out'])
const TEXT_EXT = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.md','.yml','.yaml','.toml','.rs','.html','.css','.scss','.sh','.ps1','.bat','.nsh','.plist','.xml','.m','.mm','.swift','.kt','.gradle','.properties','.txt','.svg','.vue','.svelte'])
function walk(d, out){ let es; try{ es = fs.readdirSync(d,{withFileTypes:true}) }catch(e){return} for(const e of es){ const f = path.join(d,e.name); if(e.isDirectory()){ if(SKIP_DIRS.has(e.name)) continue; walk(f,out) } else if(e.isFile()) out.push(f) } }
const files=[]; walk(ROOT, files)
const counts=new Map(); for(const t of tokens) counts.set(t,0); const samples=new Map(); for(const t of tokens) samples.set(t,[])
for(const f of files){ if(f.startsWith(path.join(ROOT,'oem'))) continue; const ext=path.extname(f).toLowerCase(); if(!TEXT_EXT.has(ext) && !['.gitignore'].includes(path.basename(f))) continue; let s; try{ s=fs.readFileSync(f,'utf8') }catch(e){ continue } for(const t of tokens){ let n=0,i=0; while((i=s.indexOf(t,i))!==-1){n++;i+=t.length} if(n){ counts.set(t, counts.get(t)+n); if(samples.get(t).length<6) samples.get(t).push(path.relative(ROOT,f).split(path.sep).join('/')) } } }
for(const t of tokens){ console.log(t.padEnd(16), String(counts.get(t)).padStart(6), (samples.get(t)||[]).join(' | ')) }
