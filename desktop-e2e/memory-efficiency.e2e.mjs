import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
const ai=(operation,payload={})=>browser.execute((operation,payload)=>window.__TAURI_INTERNALS__.invoke("ai_request",{operation,payload}),operation,payload);
const chat=(operation,payload={})=>browser.execute((operation,payload)=>window.__TAURI_INTERNALS__.invoke("chat_request",{operation,payload}),operation,payload);
describe("memory efficiency and storage choices",()=>{
  it("uses shared services for organization and embedding, preserving native paths and resource reads",async()=>{
    const received=[];
    const server=http.createServer(async(req,res)=>{
      let raw="";for await(const chunk of req)raw+=chunk;
      const body=JSON.parse(raw);received.push({url:req.url,body,authorized:req.headers.authorization==="Bearer isolated-native-key"});
      const result=req.url.endsWith("/embeddings")?{data:body.input.map((_,index)=>({index,embedding:[0.7,0.4,0.2]}))}:{choices:[{message:{content:JSON.stringify({purpose:"原生验收",overview:"只保留明确、可追溯的中文结论。",merge_with:null})}}],usage:{total_tokens:54}};
      res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify(result));
    });
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    const base=`http://127.0.0.1:${server.address().port}/v1`;
    const modelDirectory=path.join(process.env.MOYANG_DESKTOP_E2E_EXPORT_ROOT,"自行选择的模型目录");fs.mkdirSync(modelDirectory,{recursive:true});
    try{
      await chat("save_provider",{id:"native-memory-upgrade",name:"隔离验收服务",protocol:"openai",baseUrl:base,model:"fixture-chat",apiKey:"isolated-native-key"});
      const record=await ai("save",{kind:"memory",title:"原生整理目标",body:"偏好明确、可追溯的中文结论。",project:"native-efficiency",sharing:"project",source:"隔离验收"});
      const model=await ai("model_config",{model:"qwen3-embedding:4b",directory:modelDirectory});
      assert.equal(model.directory,modelDirectory);assert.equal(model.presets.length,3);assert.equal(model.download.state,"idle");
      await ai("organization_config",{enabled:true,provider:"native-memory-upgrade",model:"fixture-organizer",daily_tokens:6000,auto_merge:false});
      await browser.waitUntil(async()=>{const result=await ai("read_context",{items:[{id:record.id,layer:"l1"}]});return result.items[0].overview_status==="ready";},{timeout:35000});
      const status=await ai("organization_status");assert.ok(status.used>=54);assert.equal(status.estimated,0);
      await ai("organization_action",{action:"pause"});
      await ai("semantic_config",{enabled:true,protocol:"openai",provider:"native-memory-upgrade",endpoint:base,model:"fixture-embedding"});
      await ai("semantic_index");
      const hits=await ai("search",{query:"中文结论",project:"native-efficiency",semantic:true});assert.ok(hits.items.some(r=>r.id===record.id));
      const skill=await ai("save",{kind:"skill",title:"native-resource-check",summary:"资源按需读取",body:"只读取所需参考资料",assets:[{path:"refs/test.txt",encoding:"utf8",content:"完整资源字节"}]});
      const view=await ai("record_view",{id:skill.id});assert.equal(view.assets,undefined);assert.equal(view.resources.length,1);assert.ok(!JSON.stringify(view).includes("完整资源字节"));
      assert.equal((await ai("asset",{id:skill.id,path:"refs/test.txt"})).content,"完整资源字节");
      assert.ok(received.length>=2);assert.ok(received.every(r=>r.authorized));
      const backup=await ai("backup");assert.ok(!JSON.stringify(backup).includes("isolated-native-key"));
      fs.writeFileSync(path.join(process.cwd(),"artifacts","desktop-memory-efficiency.json"),JSON.stringify({organizationUsed:status.used,estimated:status.estimated,requests:received.map(r=>({url:r.url,model:r.body.model})),modelDirectory,resourceRead:true},null,2));
    }finally{
      await ai("organization_action",{action:"pause"}).catch(()=>{});
      await ai("semantic_config",{enabled:false,protocol:"openai",provider:"native-memory-upgrade",endpoint:base,model:"fixture-embedding"}).catch(()=>{});
      server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    }
  });
});
