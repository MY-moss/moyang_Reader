import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const initial = process.env.MOYANG_DESKTOP_E2E_DOCUMENT;
const root = path.dirname(initial);
const invoke = (command, args) => browser.execute((command, args) => window.__TAURI_INTERNALS__.invoke(command, args), command, args);
async function reader() { await browser.execute(() => { const select = document.querySelector('select[aria-label="工作空间"]'); select.value = "reader"; select.dispatchEvent(new window.Event("change", { bubbles: true })); }); }
async function search(query) {
  await reader(); await browser.$('.workbench-primary-actions button').click();
  const input = await browser.$('input[aria-label="全文搜索阅读库"]'); await input.waitForDisplayed(); await input.setValue(query);
}
async function openHit(title, index = 0) {
  await browser.execute((title,index) => {
    const section = [...document.querySelectorAll(".bookroom-results section")].find((section)=>section.querySelector("h2")?.textContent===title);
    section.querySelectorAll("button")[index].click();
  },title,index);
  await browser.waitUntil(()=>browser.execute((title)=>document.querySelector(".document-title")?.textContent===title && !document.querySelector(".bookroom-page"),title));
}
function pdfFixture() {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>"];
  for (const [index, text] of ["First page marker", "Unique second page evidence"].entries()) {
    const stream = `BT /F1 18 Tf 50 700 Td (${text}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 7 0 R >> >> /Contents ${4 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n", offsets = [0];
  objects.forEach((object,index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index+1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n` + offsets.slice(1).map((offset) => String(offset).padStart(10,"0") + " 00000 n \n").join("");
  return Buffer.from(pdf + `trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}
describe("Reader workbench acceptance", () => {
  it("indexes four formats and navigates to a specific text hit and PDF physical page", async () => {
    await reader();
    fs.writeFileSync(path.join(root,"多证据.md"), "# 森林记录\n\n检索针叶林，第一段是气候资料。\n\n检索针叶林，第二段是土壤证据。\n");
    fs.writeFileSync(path.join(root,"纯文本.txt"), "检索针叶林，纯文本资料。");
    const docx = new JSZip();
    docx.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    docx.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    docx.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>检索针叶林，Word 正文证据。</w:t></w:r></w:p></w:body></w:document>');
    fs.writeFileSync(path.join(root,"Word资料.docx"), await docx.generateAsync({ type:"nodebuffer" }));
    fs.writeFileSync(path.join(root,"pages.pdf"), pdfFixture());
    await search("检索针叶林");
    await browser.waitUntil(async () => (await browser.$$(".bookroom-results section")).length >= 3, { timeout: 30000, timeoutMsg: "MD, TXT and DOCX were not indexed" }).catch(async(error) => { console.error("Index details",await browser.execute(() => document.querySelector(".bookroom-page")?.textContent));throw error; });
    const sections = await browser.$$(".bookroom-results section");
    let note;
    for (const section of sections) if ((await section.$("h2").getText()) === "多证据.md") note = section;
    assert.ok(note); assert.equal((await note.$$("button")).length,2);
    await (await note.$$("button"))[1].click();
    await browser.$('[data-source-target="true"]').waitForDisplayed();
    assert.match(await browser.$('[data-source-target="true"]').getText(), /土壤证据/);
    await search("Unique second page evidence");
    await browser.waitUntil(async () => (await browser.$(".bookroom-results").getText()).includes("pages.pdf"), { timeout: 30000 });
    await openHit("pages.pdf");
    await browser.$('.pdf-canvas-stage[aria-busy="false"]').waitForDisplayed();
    assert.equal(await browser.execute(() => document.querySelector(".controlled-pdf [role=alert]")?.textContent ?? ""), "");
    assert.equal(await browser.$('input[aria-label="PDF 页码"]').getValue(), "2");
    assert.equal(await browser.execute(() => document.querySelector(".pdf-canvas-stage canvas").width > 0),true);
    await browser.execute(() => [...document.querySelectorAll(".controlled-pdf button")].find((button) => button.textContent === "上一页")?.click());
    await browser.waitUntil(() => browser.execute(() => document.querySelector('input[aria-label="PDF 页码"]')?.value === "1"));
    await browser.execute(() => { const select = document.querySelector('select[aria-label="PDF 缩放"]'); select.value = "150"; select.dispatchEvent(new window.Event("change", { bubbles:true })); });
    await browser.$('.pdf-canvas-stage[aria-busy="false"]').waitForDisplayed();
    await browser.waitUntil(() => browser.execute(() => document.querySelector(".pdf-canvas-stage canvas").width >= 900));
  });
  it("keeps file versions, rejects stale saves, and restores recycled files without overwriting", async () => {
    const file = path.join(root,"恢复验证.md"); fs.writeFileSync(file,"original");
    await invoke("write_text_file",{ path:file, contents:"first save", expectedContents:"original" });
    const versions = await invoke("bookroom_request",{request:{action:"history.list",path:file}});
    assert.equal(versions.length,2);
    assert.equal(await invoke("bookroom_request",{request:{action:"history.get",path:file,id:versions.at(-1).id}}),"original");
    await assert.rejects(invoke("write_text_file",{path:file,contents:"wrong overwrite",expectedContents:"original"}));
    assert.equal(fs.readFileSync(file,"utf8"),"first save");
    await invoke("delete_workspace_entry",{root,entryPath:"恢复验证.md"});
    fs.writeFileSync(file,"new original path");
    const items = await invoke("bookroom_request",{request:{action:"trash.list",root}});
    const item = items.find((entry) => entry.name === "恢复验证.md"); assert.ok(item);
    const restored = await invoke("bookroom_request",{request:{action:"trash.restore",root,id:item.id}});
    assert.equal(fs.readFileSync(restored,"utf8"),"first save"); assert.equal(fs.readFileSync(file,"utf8"),"new original path");
  });
  it("shares same-file drafts between panes, waits for composition, and restores the focused pane", async () => {
    const file = path.join(root,"同窗验证.md"); const original = "# 同窗验证\n\n桌面同窗验证，原始文字。\n";
    fs.writeFileSync(file,original); await search("桌面同窗验证");
    await browser.waitUntil(() => browser.execute(() => document.querySelector(".bookroom-results")?.textContent.includes("同窗验证.md")), { timeout:30000 });
    await openHit("同窗验证.md");
    await browser.$('button[aria-label="双窗格"]').click();
    await browser.$("button=在此窗格工作").click();
    await browser.execute(() => document.querySelector('.reader-pane.is-active button[aria-label="源文本模式"]')?.click());
    await browser.$('.reader-pane.is-active [aria-label="Markdown 源文本"]').waitForDisplayed();
    await browser.execute(() => {
      const target = document.querySelector('.reader-pane.is-active [aria-label="Markdown 源文本"]');
      target.dispatchEvent(new window.CompositionEvent("compositionstart",{bubbles:true}));
      const view = target.cmTile.root.view; view.dispatch({changes:{from:view.state.doc.length,insert:"中文组词完成，两侧同步。\n"}});
    });
    await browser.pause(1500); assert.equal(fs.readFileSync(file,"utf8"),original);
    await browser.waitUntil(() => browser.execute(() => document.querySelector('.reader-pane:not(.is-active) .reader-content')?.textContent.includes("中文组词完成，两侧同步")));
    await browser.execute(() => document.querySelector('.reader-pane.is-active [aria-label="Markdown 源文本"]').dispatchEvent(new window.CompositionEvent("compositionend",{bubbles:true})));
    await browser.waitUntil(() => fs.readFileSync(file,"utf8").includes("中文组词完成，两侧同步"));
    await browser.refresh();
    await browser.waitUntil(() => browser.execute(() => document.querySelector('.reader-pane.is-active')?.getAttribute("aria-label") === "右侧文档窗格"));
    assert.equal(await browser.execute(() => document.querySelectorAll('.reader-pane').length),2);
    // This driver restarts the webview with the explicit original command-line file.
    // The preserved tab must still restore its own view when selected again.
    await browser.execute(() => [...document.querySelectorAll('.reader-pane.is-active .pane-tabs button')].find((button)=>button.textContent.trim()==="同窗验证.md")?.click());
    await browser.$('.reader-pane.is-active [aria-label="Markdown 源文本"]').waitForDisplayed();
    assert.match(await browser.execute(() => document.querySelector('.reader-pane.is-active [aria-label="Markdown 源文本"]').textContent), /中文组词完成/);
    await browser.execute(() => document.querySelector('button[aria-label="单窗格"]')?.click());
  });
  it("merges local and external content and keeps excerpts, bookmarks and recycle previews", async () => {
    const file = path.join(root,"批注验证.md"); const original = "# 批注验证\n\n桌面批注验证的唯一证据。\n";
    fs.writeFileSync(file,original); await search("桌面批注验证");
    await browser.waitUntil(() => browser.execute(() => document.querySelector(".bookroom-results")?.textContent.includes("批注验证.md")),{timeout:30000});
    await openHit("批注验证.md");
    await browser.$('.reader-pane.is-active [data-source-body]').waitForDisplayed();
    await browser.execute(() => { const p = document.querySelector('.reader-pane.is-active [data-source-body] p'); const range = document.createRange(); range.selectNodeContents(p); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); });
    await browser.$('button[aria-label="收藏当前位置"]').click();
    await browser.$('button[aria-label="添加摘录"]').click();
    await browser.$('.excerpt-composer textarea').waitForDisplayed();
    const fields = await browser.$$('.excerpt-composer textarea'); await fields[1].setValue("有来源的批注");
    await browser.$("button=保存摘录").click();
    await browser.waitUntil(async () => (await invoke("bookroom_request",{request:{action:"metadata.list",category:"annotation"}})).some((entry) => entry.comment === "有来源的批注"));
    const bookmarks = await invoke("bookroom_request",{request:{action:"metadata.list",category:"bookmark"}});
    assert.ok(bookmarks.some((entry) => entry.location.quote?.includes("唯一证据")));
    await browser.execute(() => document.querySelector('.reader-pane.is-active button[aria-label="源文本模式"]')?.click());
    await browser.$('.reader-pane.is-active [aria-label="Markdown 源文本"]').waitForDisplayed();
    await browser.execute(() => { const target = document.querySelector('.reader-pane.is-active [aria-label="Markdown 源文本"]'); target.dispatchEvent(new window.CompositionEvent("compositionstart",{bubbles:true})); const view=target.cmTile.root.view; view.dispatch({changes:{from:view.state.doc.length,insert:"我的修改\n"}}); });
    fs.writeFileSync(file,original+"外部修改\n");
    await browser.$("button=比较与合并").waitForDisplayed(); await browser.$("button=比较与合并").click();
    await browser.$(".conflict-dialog textarea").setValue(original+"我的修改\n外部修改\n");
    await browser.execute(() => window.dispatchEvent(new window.CompositionEvent("compositionend",{bubbles:true})));
    await browser.$("button=采用合并结果").click();
    await browser.waitUntil(() => fs.readFileSync(file,"utf8").includes("我的修改\n外部修改"));
    const recycleFile = path.join(root,"回收预览.md"); fs.writeFileSync(recycleFile,"# 回收预览\n\n可以在恢复前检查这段内容。");
    await invoke("delete_workspace_entry",{root,entryPath:"回收预览.md"});
    await browser.$("button=恢复中心").click();
    await browser.waitUntil(() => browser.execute(() => document.querySelector(".bookroom-page")?.textContent.includes("回收预览.md")));
    await browser.execute(() => { const section=[...document.querySelectorAll(".bookroom-rows section")].find((section) => section.textContent.includes("回收预览.md")); [...section.querySelectorAll("button")].find((button)=>button.textContent==="预览").click(); });
    await browser.waitUntil(() => browser.execute(() => document.querySelector(".recycle-preview")?.textContent.includes("可以在恢复前检查")));
  });
  it("renames a linked file through the workspace and preserves aliases, anchors and the open draft", async () => {
    const target = path.join(root,"链接目标.md"), ref = path.join(root,"链接引用.md");
    fs.writeFileSync(target,"# 章节\n\n目标内容。");
    fs.writeFileSync(ref,"# 链接引用\n\n桌面链接维护验证。\n\n[[链接目标#章节|别名]]\n\n[相对引用](链接目标.md#章节)\n\n`[[链接目标]]`\n");
    await search("桌面链接维护验证");
    await browser.waitUntil(() => browser.execute(() => document.querySelector(".bookroom-results")?.textContent.includes("链接引用.md")),{timeout:30000});
    await openHit("链接引用.md");
    await browser.execute(() => document.querySelector('.reader-pane.is-active button[aria-label="源文本模式"]')?.click());
    await browser.$('.reader-pane.is-active [aria-label="Markdown 源文本"]').waitForDisplayed();
    await browser.execute(() => { const view = document.querySelector('.reader-pane.is-active [aria-label="Markdown 源文本"]').cmTile.root.view; view.dispatch({changes:{from:view.state.doc.length,insert:"未保存的额外说明。\n"}}); window.__renamePrompt=window.prompt; window.prompt=()=>"链接新目标.md"; });
    try {
      await browser.$('.workspace-file[title*="链接目标.md"]').waitForDisplayed();
      await browser.execute(() => { const target=document.querySelector('.workspace-file[title*="链接目标.md"]'); const rect=target.getBoundingClientRect(); target.dispatchEvent(new window.MouseEvent("contextmenu",{bubbles:true,cancelable:true,clientX:rect.left+20,clientY:rect.top+10})); });
      await browser.$("button=重命名文件").waitForDisplayed();
      await browser.$("button=重命名文件").click();
      // The native operation moves the target before writing reference patches.
      // Wait for its completed UI receipt, not an intermediate filesystem state.
      await browser.waitUntil(() => browser.execute(() => [...document.querySelectorAll(".settings-notice")].some((notice) => notice.textContent.includes("已重命名：链接新目标.md，更新"))), {timeout:30000,timeoutMsg:"重命名及引用更新尚未完成"});
      assert.equal(fs.existsSync(path.join(root,"链接新目标.md")),true);
      const contents = fs.readFileSync(ref,"utf8");
      assert.match(contents,/\[\[链接新目标#章节\|别名\]\]/);
      assert.match(contents,/\[相对引用\]\(链接新目标\.md#章节\)/);
      assert.ok(contents.includes("`[[链接目标]]`")); assert.ok(contents.includes("未保存的额外说明"));
      assert.equal(fs.existsSync(target),false);
      await browser.waitUntil(() => browser.execute(() => document.querySelector('.reader-pane.is-active [aria-label="Markdown 源文本"]')?.textContent.includes("链接新目标")));
    } finally { await browser.execute(() => { window.prompt=window.__renamePrompt; delete window.__renamePrompt; }); }
  });

  it("scrolls a deep TXT search fragment into view instead of the full pre element's beginning", async () => {
    const name = "deep-source.txt";
    fs.writeFileSync(path.join(root, name), Array.from({ length: 500 }, (_, i) => `background paragraph ${i} ${"background ".repeat(8)}`).join("\n\n") + "\n\nDeepTXTNeedle unique evidence");
    await search("DeepTXTNeedle");
    await browser.waitUntil(() => browser.execute((name) => document.querySelector(".bookroom-results")?.textContent.includes(name), name), { timeout: 30000 });
    await openHit(name);
    await browser.waitUntil(() => browser.execute(() => {
      const selection = window.getSelection();
      return selection?.rangeCount && selection.getRangeAt(0).toString().includes("DeepTXTNeedle");
    }));
    const position = await browser.execute(() => {
      const content = document.querySelector(".reader-pane.is-active .content-area");
      const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
      const viewport = content.getBoundingClientRect();
      return { scroll: content.scrollTop, visible: rect.bottom > viewport.top && rect.top < viewport.bottom };
    });
    assert.ok(position.scroll > 1000, "TXT source navigation must scroll past the beginning");
    assert.equal(position.visible, true, "the matching text range must be on screen");
  });

  it("relocates changed PDF quote evidence and warns for old page-only bookmarks", async () => {
    const name = "source-relocation.pdf", file = path.join(root, name);
    fs.writeFileSync(file, sourcePdfFixture(["first page", "PDFRelocationNeedle unique evidence"]));
    await search("PDFRelocationNeedle");
    await browser.waitUntil(() => browser.execute((name) => document.querySelector(".bookroom-results")?.textContent.includes(name), name), { timeout: 30000 });
    await openHit(name);
    await browser.$('.reader-pane.is-active .pdf-canvas-stage[aria-busy="false"]').waitForDisplayed();
    assert.equal(await browser.$('.reader-pane.is-active input[aria-label="PDF 页码"]').getValue(), "2");
    await browser.$('button[aria-label="收藏当前位置"]').click();
    await browser.waitUntil(async () => (await invoke("bookroom_request", { request: { action: "metadata.list", category: "bookmark" } })).some((item) => item.location.path.endsWith(name) && item.location.page === 2));
    const saved = (await invoke("bookroom_request", { request: { action: "metadata.list", category: "bookmark" } })).find((item) => item.location.path.endsWith(name) && item.location.page === 2);
    await browser.$('button[aria-label="添加摘录"]').click();
    const fields = await browser.$$(".excerpt-composer textarea");
    await fields[0].setValue("PDFRelocationNeedle unique evidence");
    await fields[1].setValue("PDF changed-source regression");
    await browser.$("button=保存摘录").click();
    await browser.waitUntil(async () => (await invoke("bookroom_request", { request: { action: "metadata.list", category: "annotation" } })).some((item) => item.comment === "PDF changed-source regression"));
    fs.writeFileSync(file, sourcePdfFixture(["inserted introduction", "first page", "PDFRelocationNeedle unique evidence"]));
    await browser.$("button=摘录与批注").click();
    await browser.execute(() => {
      const section = [...document.querySelectorAll(".bookroom-rows section")].find((item) => item.textContent.includes("PDF changed-source regression"));
      [...section.querySelectorAll("button")].find((button) => button.textContent === "查看来源").click();
    });
    await browser.waitUntil(() => browser.execute(() => document.querySelector('.reader-pane.is-active input[aria-label="PDF 页码"]')?.value === "3"), { timeout: 30000 });
    assert.ok((await browser.$(".reader-pane.is-active .settings-notice").getText()).includes("重新定位"));
    await browser.$("button=收藏").click();
    await browser.execute((title) => [...document.querySelectorAll(".bookroom-rows section")].find((item) => item.querySelector("strong")?.textContent === title).querySelector("button").click(), saved.title);
    await browser.waitUntil(() => browser.execute(() => document.querySelector(".reader-pane.is-active .settings-notice")?.textContent.includes("原页码可能不再对应")));
    assert.equal(await browser.$('.reader-pane.is-active input[aria-label="PDF 页码"]').getValue(), "2");
  });
});

describe("Saved search acceptance", () => {
  it("restores a saved view and a bookmarked search after a native page reload", async () => {
    const file = path.join(root,"saved-view.md");
    fs.writeFileSync(file,"# Saved view\n\nsaved-view-evidence\n");
    await search("saved-view-evidence");
    // The embedded driver does not emit a select change when clicking an option.
    // Dispatch the DOM event used by the other native select acceptance flows.
    await browser.execute(() => {
      const filters = document.querySelectorAll(".bookroom-search-controls select");
      filters[0].value = "markdown";
      filters[0].dispatchEvent(new window.Event("change", { bubbles: true }));
      filters[2].value = "name";
      filters[2].dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    await browser.waitUntil(() => browser.execute(() => document.querySelector(".bookroom-results")?.textContent.includes("saved-view-evidence")));
    await browser.$('input[aria-label="视图名称"]').setValue("My saved view");
    await browser.$("button=保存视图").click();
    await browser.waitUntil(() => browser.execute(() => document.body.textContent.includes("已保存当前视图")));
    await browser.$("button=收藏此搜索").click();
    await browser.waitUntil(() => browser.execute(() => document.body.textContent.includes("已收藏当前搜索与筛选")));
    await browser.refresh();
    await browser.$('select[aria-label="工作空间"]').waitForExist();
    await reader();
    await browser.$("button=保存的视图").click();
    const view = await browser.$("//div[@class='bookroom-rows']//button[strong[.='My saved view']]");
    await view.waitForDisplayed();
    await view.click();
    await browser.$('input[aria-label="全文搜索阅读库"]').waitForDisplayed();
    const state = () => browser.execute(() => ({query:document.querySelector('input[aria-label="全文搜索阅读库"]')?.value,filters:[...document.querySelectorAll(".bookroom-search-controls select")].map((v)=>v.value)}));
    assert.deepEqual(await state(),{query:"saved-view-evidence",filters:["markdown","","name"]});
    await browser.$('input[aria-label="全文搜索阅读库"]').setValue("unrelated");
    await browser.$("button=收藏").click();
    const bookmark = await browser.$("//div[@class='bookroom-rows']//button[strong[contains(., 'saved-view-evidence')]]");
    await bookmark.waitForDisplayed();
    await bookmark.click();
    await browser.$('input[aria-label="全文搜索阅读库"]').waitForDisplayed();
    assert.deepEqual(await state(),{query:"saved-view-evidence",filters:["markdown","","name"]});
  });
});

function sourcePdfFixture(texts) {
  const font = 3 + texts.length * 2;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${texts.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${texts.length} >>`];
  for (const [i, text] of texts.entries()) {
    const stream = `BT /F1 18 Tf 50 700 Td (${text}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${4 + i * 2} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map((offset) => String(offset).padStart(10, "0") + " 00000 n \n").join("");
  return Buffer.from(pdf + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}
