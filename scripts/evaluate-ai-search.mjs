import fs from "node:fs/promises";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {performance} from "node:perf_hooks";
import {resolveSharedCargoTargetDir} from "./shared-cargo-target.mjs";
import {connectMcp} from "./mcp-test-client.mjs";
const executable=path.join(resolveSharedCargoTargetDir(),"debug",process.platform==="win32"?"moyang-ai-mcp.exe":"moyang-ai-mcp");
const output=path.resolve("artifacts/ai-evaluation"),reuse=process.argv.includes("--reuse"),directory=reuse?JSON.parse(await fs.readFile(path.join(output,"results.json"),"utf8")).directory:path.join(output,`database-${Date.now()}`);
await fs.mkdir(directory,{recursive:true});
function request(operation,payload={}){const r=spawnSync(executable,["--data-dir",directory,"--request",operation],{input:JSON.stringify(payload),encoding:"utf8",windowsHide:true,maxBuffer:40_000_000,timeout:240_000});if(r.error||r.status!==0)throw r.error??new Error(r.stderr);return JSON.parse(r.stdout);}
const records=[],cases=[];
function add(key,title,body,extra={}){const r=request("save",{kind:"knowledge",title,body,source:`evaluation://${key}`,sharing:"global",...extra});records.push(r);return r.id;}
if(!reuse){
const topics=[
 ["阅读主题","书房界面采用暖白背景和墨绿色点缀，正文使用清晰的中文排版。","暖白 墨绿色","阅读界面用什么配色看起来舒服"],
 ["自动保存","停止输入 1.2 秒后自动保存；中文输入法组词期间暂缓保存，组词结束后继续。","输入法 自动保存","打字选字时会不会突然把半句话存进去"],
 ["临时标签","单击文件打开临时预览标签；双击文件或者开始编辑后，标签会保留。","临时标签 双击","怎样把一眼看看的文件留在工作区里"],
 ["双窗格","阅读器固定支持两个窗格。相同文件共享内容和保存队列，各自记录滚动位置。","双窗格 滚动","左右打开同一篇文章时翻页位置会互相影响吗"],
 ["PDF 定位","文字型 PDF 搜索结果使用物理页码定位。阅读器支持输入页码、翻页和缩放。","PDF 物理页码","找到 PDF 的文字以后怎么跳到那一页"],
 ["技能资源","技能目录以 SKILL.md 说明适用场景和步骤。参考资料与脚本按需单独读取，不在检索时全部载入。","SKILL.md 资源","一个技能有很多附件时需要一次全部给模型吗"],
 ["记忆纠正","用户明确更正偏好时替代旧规则并保留历史；推测出的矛盾进入待处理列表。","记忆 更正 历史","以前的要求现在改了，AI 应该保留哪一个"],
 ["回收站期限","应用回收站默认保留删除的文件三十天。恢复遇到同名文件时保留双方，不覆盖已有内容。","回收站 三十天","误删的笔记还能找回来多久"],
 ["历史版本","连续编辑产生的历史按六十秒合并，每篇笔记最多保存五十个版本。恢复前可以比较正文。","六十秒 五十个","频繁打字会不会生成无数份历史副本"],
 ["共享范围","全局偏好跨 Agent 使用，项目知识只在对应项目召回，原 Agent 专属数据迁移后不扩大范围。","共享范围 迁移","换了助手还能记得我的习惯但别串项目怎么办"],
 ["网页导入","网页正文显式导入成为独立快照。需要登录或复杂脚本的页面可粘贴正文，来源更新先检查差异。","网页 快照 差异","网页后来改了会自动把我保存的资料覆盖吗"],
 ["主题密度","界面密度支持舒适与紧凑两种。正文字号单独设置，窄窗口临时收起侧栏而不改桌面布局。","密度 正文字号","我想让按钮紧一点但文章文字还是大一点"],
 ["内部链接","文件重命名后维护能唯一确认的内部链接、相对路径和嵌入引用；保留别名和锚点，歧义单独提示。","重命名 别名 锚点","把笔记改名会不会弄坏其他文档指向它的链接"],
 ["检查点","任务检查点绑定客户端、会话和原始轮次。重复结束回调不重复沉淀，钩子最多补充一次处理。","检查点 重复 回调","助手结束时触发两遍通知会把同一段经验存两次吗"],
 ["检索模型","本机使用 qwen3-embedding:0.6b 生成向量。先返回关键词结果，再补语义结果，不另装重排模型。","qwen3-embedding 关键词","搜索能先马上给我文字匹配再补充意思相近的资料吗"],
];
for(const [i,[title,body,exact,semantic]] of topics.entries()){const id=add(`topic-${i}`,title,body);cases.push({category:"exact",query:exact,expected:[id]},{category:"semantic",query:semantic,expected:[id]});}
for(let i=0;i<10;i++){
  const project=`长文项目-${i}`,title=`长文 ${i} 的故障处理与发布`;
  const filler="以下是独立的背景材料，描述阅读与笔记整理过程。".repeat(70);
  const body=`# 恢复策略\n\n${project} 出错后先备份数据库，再对照日志检查版本。\n\n${filler}\n\n# 发布要求\n\n${project} 发布前必须完成真实桌面重启验证，并检查搜索结果。\n\n${filler}\n\n# 验证资料\n\n故障恢复与发布检查使用同一份可追溯报告。`;
  const id=add(`long-${i}`,title,body,{sharing:"project",project});cases.push({category:"long_multi",query:"数据库备份和发布前验证有哪些要求",project,include_global:false,expected:[id],min_fragments:2});
}
for(let i=0;i<5;i++){
  const title=`项目 ${i} 的发布日`,project=`时效项目-${i}`;
  add(`old-${i}`,`${title}旧记录`,`该项目发布日曾定为周一，此安排已过期。`,{kind:"memory",sharing:"project",project,expires_at:1});
  const id=add(`new-${i}`,title,"用户明确更正：发布日改成周四，周一的安排不再适用。",{kind:"memory",sharing:"project",project});
  cases.push({category:"temporal",query:"发布日",project,include_global:false,expected:[id]},{category:"temporal",query:"现在安排在哪天发布",project,include_global:false,expected:[id]});
}
for(let i=0;i<5;i++){
  const project=`范围项目-${i}`;
  const id=add(`scope-${i}`,"格式约定",`本项目文档使用两空格缩进，仓库代号为纸舟 ${i}。`,{kind:"memory",sharing:"project",project,agent:"codex"});
  const legacy=add(`legacy-${i}`,"旧专属格式",`仅限原 Agent 的旧记录：文档使用制表符，编号 legacy-${i}。`,{kind:"memory",sharing:"legacy",project,agent:"codex"});
  cases.push({category:"scope",query:"文档缩进",project,agent:"claude",include_global:false,expected:[id],forbidden:[legacy]},{category:"scope",query:`纸舟 ${i}`,project,agent:"other",include_global:false,expected:[id],forbidden:[legacy]},{category:"scope",query:"制表符",project,agent:"codex",include_global:false,expected:[legacy]});
}
for(const query of ["企鹅的迁徙路线","火星岩石化学组成","蝴蝶幼虫生命周期","古埃及石碑文字翻译","雨林树冠的高度分布","为什么海水呈蓝色","小提琴琴弦的共振频率","酵母发酵产生什么气体","土星环的冰粒来源","布料染色的传统工艺","候鸟在夜间如何辨别方向","玻璃吹制的成型温度","珊瑚礁中鱼类的觅食习惯","自行车变速器的机械结构","铅笔石墨与黏土的配比"])cases.push({category:"no_answer",query,expected:[]});
}else{records.push(...JSON.parse(await fs.readFile(path.join(output,"corpus.json"),"utf8")));cases.push(...JSON.parse(await fs.readFile(path.join(output,"cases.json"),"utf8")));}
if(cases.length!==80)throw new Error(`Expected 80 cases, got ${cases.length}`);
await fs.writeFile(path.join(output,"corpus.json"),JSON.stringify(records,null,2));await fs.writeFile(path.join(output,"cases.json"),JSON.stringify(cases,null,2));
request("semantic_config",{enabled:true,endpoint:"http://127.0.0.1:11434",model:"qwen3-embedding:0.6b"});
const mcp=await connectMcp(executable,directory,240_000);
try{
 let remaining=1,indexMs=0;while(remaining){const start=performance.now(),batch=await mcp.call("index_semantic");indexMs+=performance.now()-start;remaining=batch.remaining;console.log(`Indexed ${batch.processed}; remaining ${remaining}`);}
 const results=[];for(const [i,c] of cases.entries()){
   const q={query:c.query,project:c.project??null,agent:c.agent??null,include_global:c.include_global??true,semantic:true,limit:5};
   const start=performance.now(),result=await mcp.call("search",q),elapsed=performance.now()-start;
   const ids=result.items.map(h=>h.id),hit=c.expected.length?c.expected.some(id=>ids.includes(id)):ids.length===0;
   const fragments=Math.max(0,...result.items.filter(h=>c.expected.includes(h.id)).map(h=>h.fragments?.length??0));
   const scopeSafe=!(c.forbidden??[]).some(id=>ids.includes(id));
   results.push({...c,passed:hit&&scopeSafe&&(!c.min_fragments||fragments>=c.min_fragments),hit,scopeSafe,fragments,elapsed_ms:Math.round(elapsed),returned:result.items.map(h=>({id:h.id,title:h.title,score:h.score,fragments:h.fragments?.map(f=>({ordinal:f.ordinal,quote:f.location.quote,score:f.score}))})),warning:result.warning});
   if((i+1)%10===0)console.log(`Evaluated ${i+1}/80`);
 }
 const elapsed=results.map(r=>r.elapsed_ms).sort((a,b)=>a-b),categories={};for(const c of [...new Set(cases.map(c=>c.category))]){const rows=results.filter(r=>r.category===c);categories[c]={passed:rows.filter(r=>r.passed).length,total:rows.length};}
 const report={timestamp:new Date().toISOString(),model:"qwen3-embedding:0.6b",runtime:"Ollama 0.40.4 CPU",directory,records:records.length,cases:80,index_ms:Math.round(indexMs),passed:results.filter(r=>r.passed).length,median_ms:elapsed[40],p95_ms:elapsed[75],categories,results};
 await fs.writeFile(path.join(output,"results.json"),JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,results:undefined},null,2));
}finally{await mcp.close();}
