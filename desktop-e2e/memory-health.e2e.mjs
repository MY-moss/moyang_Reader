import assert from "node:assert/strict";
const invoke=(operation,payload={})=>browser.execute((operation,payload)=>window.__TAURI_INTERNALS__.invoke("ai_request",{operation,payload}),operation,payload);
const click=async(name,scope=".ai-activity")=>browser.execute((name,scope)=>{ const button=[...document.querySelectorAll(`${scope} button`)].find(b=>b.textContent.trim()===name); if(!button)throw new Error(`Missing ${name}`);button.click(); },name,scope);
const waitText=async(text)=>browser.waitUntil(()=>browser.execute(text=>document.querySelector(".ai-health")?.textContent.includes(text),text));
describe("local memory maintenance",()=>{
  it("reviews SQLite records through the UI, archives and restores without a model",async()=>{
    const fields={kind:"memory",body:"先核对原始来源，再保存长期决定。",project:"desktop-health",sharing:"project",source:"",agent:"desktop-fixture"};
    const a=await invoke("save",{...fields,title:"资料检查原件"});
    const b=await invoke("save",{...fields,title:"资料检查副本",body:fields.body+"\r\n"});
    // Save deduplication is narrower than this review: an explicit update may converge bodies.
    let second=b;
    if(a.id===b.id){
      second=await invoke("save",{...fields,title:"资料检查副本",body:"临时不同正文"});
      second=await invoke("save",{...fields,id:second.id,expected_revision:second.revision,title:"资料检查副本"});
    }
    await browser.execute(()=>{const select=document.querySelector('select[aria-label="工作空间"]');select.value="ai";select.dispatchEvent(new window.Event("change",{bubbles:true}));});
    await browser.$(".ai-sidebar").waitForDisplayed();
    await click("近期活动与冲突",".ai-sidebar");await click("资料检查");
    await browser.waitUntil(()=>browser.execute(()=>[...document.querySelectorAll(".ai-health select option")].some(o=>o.value==="desktop-health")));
    await browser.execute(()=>{const select=document.querySelector(".ai-health select");select.value="desktop-health";select.dispatchEvent(new window.Event("change",{bubbles:true}));});
    await waitText("检查了 2 条");await click("正文相同 2");
    await browser.$(".ai-health-item").waitForDisplayed();
    await browser.execute(()=>[...document.querySelector(".ai-health-item").querySelectorAll("button")].find(b=>b.textContent.trim()==="归档").click());
    await waitText("当前条件下没有发现待核对项");await click("撤销归档");await waitText("正文相同 2");
    const report=await invoke("health",{project:"desktop-health",issue:"duplicate"});
    assert.equal(report.total,2);assert.equal(report.counts.missing_source,2);
    assert.equal((await invoke("get",{id:a.id})).body,fields.body);
    assert.equal((await invoke("get",{id:second.id})).state,"active");
    const context=await invoke("context",{query:"核对来源",project:"desktop-health",max_chars:1000});
    assert.ok(context.text.includes("范围：desktop-health"));assert.ok([...context.text].length<=1000);
  });
});
