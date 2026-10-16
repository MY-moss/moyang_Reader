import { chromium } from "@playwright/test";
import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
const browser = await chromium.launch({headless: true});
try {
  await fs.mkdir("docs/screenshots", {recursive:true});
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({viewport:{width:1440,height:960},colorScheme:theme});
    await page.goto(process.env.MOYANG_CAPTURE_URL || "http://127.0.0.1:4174");
    await page.screenshot({path:`docs/screenshots/welcome-${theme}.png`});
    await page.locator('input[type="file"]').setInputFiles({name:"阅读的意义.md",mimeType:"text/markdown",buffer:Buffer.from("---\ntitle: 阅读的意义\ntags: [生活, 随笔]\n---\n\n# 给阅读留一点时间\n\n不必读得很快。找一个安静的下午，从你感兴趣的一页开始。\n\n## 让文字慢下来\n\n阅读是一段只属于自己的时间。把散落的想法放在一起，慢慢地，它们就有了新的联系。\n\n> 在文字与生活之间，留下一些空白。\n\n## 从一页到一本书\n\n- 把常读的资料放进阅读库\n- 用目录找到想看的章节\n- 记录一个让你停下来的想法\n\n## 写下自己的发现\n\n读过的故事会沉淀，写下的文字会留下。\n")});
    await page.locator('.reader-content h1').waitFor();
    await page.screenshot({path:`docs/screenshots/reader-${theme}.png`});
    await page.locator('.toolbar-overflow-trigger').click();
    await page.locator('.settings-trigger').click();
    await page.screenshot({path:`docs/screenshots/settings-${theme}.png`});
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:480,height:800});
    await page.screenshot({path:`docs/screenshots/compact-reader-${theme}.png`});
    await page.close();
  }
} finally { await browser.close(); }
