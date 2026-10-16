import { expect, test } from "@playwright/test";

for (const extension of ["txt", "md"]) {
  test(`source ${extension} selection survives bookmarking and becomes the excerpt quote`, async ({ page }) => {
    await page.goto("/");
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: `source-position.${extension}`,
        mimeType: "text/plain",
        buffer: Buffer.from("first line\nselected source evidence\nlast line"),
      });
    if (extension === "md") await page.getByRole("button", { name: "源文本模式", exact: true }).click();
    const editor = page.locator(".reader-pane.is-active .cm-content");
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press("Control+Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page.getByRole("button", { name: "收藏当前位置", exact: true }).click();
    await page.getByRole("button", { name: "添加摘录", exact: true }).click();
    await expect(page.locator(".excerpt-composer textarea").first()).toHaveValue("selected source evidence");
    await page.locator(".excerpt-composer textarea").nth(1).fill("source selection regression");
    await page.getByRole("button", { name: "保存摘录", exact: true }).click();
    await page.locator(".reader-collection-nav").getByRole("button", { name: "收藏", exact: true }).click();
    await page.locator(".bookroom-rows section").getByRole("button").first().click();
    await expect(editor).toBeVisible();
    await expect
      .poll(() =>
        editor.evaluate((element) => {
          const content = element as HTMLElement & {
            cmTile: {
              root: {
                view: {
                  state: {
                    selection: { main: { from: number; to: number } };
                    sliceDoc: (from: number, to: number) => string;
                  };
                };
              };
            };
          };
          const state = content.cmTile.root.view.state,
            { from, to } = state.selection.main;
          return state.sliceDoc(from, to);
        }),
      )
      .toBe("selected source evidence");
  });
}

test("a cross-paragraph excerpt returns to the complete original text range", async ({ page }) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "cross-paragraph.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Heading\n\nFirst evidence paragraph.\n\nSecond evidence paragraph."),
    });
  await page.getByRole("button", { name: "直接返回阅读模式", exact: true }).click();
  await page.locator("[data-source-body]").evaluate((body) => {
    const paragraphs = body.querySelectorAll("p"),
      range = document.createRange();
    range.setStart(paragraphs[0].firstChild!, 0);
    range.setEnd(paragraphs[1].firstChild!, paragraphs[1].textContent!.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.getByRole("button", { name: "添加摘录", exact: true }).click();
  await expect(page.locator(".excerpt-composer textarea").first()).toHaveValue(
    "First evidence paragraph.\n\nSecond evidence paragraph.",
  );
  await page.getByRole("button", { name: "保存摘录", exact: true }).click();
  await page.locator(".reader-collection-nav").getByRole("button", { name: "摘录与批注", exact: true }).click();
  await page.getByRole("button", { name: "查看来源", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.getRangeAt(0).toString().replace(/\s+/g, " ").trim()))
    .toBe("First evidence paragraph. Second evidence paragraph.");
  expect((await page.locator(".settings-notice").allTextContents()).join(" ")).not.toContain("未能找到");
});

function pdfPages(texts: string[]) {
  const font = 3 + texts.length * 2;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${texts.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${texts.length} >>`,
  ];
  for (const [i, text] of texts.entries()) {
    const stream = `BT /F1 18 Tf 50 700 Td (${text}) Tj ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${4 + i * 2} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((offset) => String(offset).padStart(10, "0") + " 00000 n \n")
      .join("");
  return Buffer.from(pdf + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}

test("PDF panes retain their independent physical pages through activation changes", async ({ page }) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "pane-pages.pdf",
      mimeType: "application/pdf",
      buffer: pdfPages(["one", "two", "three", "four"]),
    });
  await expect(page.locator('.pdf-canvas-stage[aria-busy="false"]')).toBeVisible();
  await page.getByRole("button", { name: "双窗格", exact: true }).click();
  const left = page.getByRole("region", { name: "左侧文档窗格" }),
    right = page.getByRole("region", { name: "右侧文档窗格" });
  await left.getByLabel("PDF 页码", { exact: true }).fill("3");
  await left.getByLabel("PDF 页码", { exact: true }).press("Enter");
  await right.getByRole("button", { name: "在此窗格工作", exact: true }).click();
  await expect(left.getByLabel("PDF 页码", { exact: true })).toHaveValue("3");
  await expect(right.locator('.pdf-canvas-stage[aria-busy="false"]')).toBeVisible();
  await right.getByLabel("PDF 页码", { exact: true }).fill("2");
  await right.getByLabel("PDF 页码", { exact: true }).press("Enter");
  await left.getByRole("button", { name: "在此窗格工作", exact: true }).click();
  await expect(left.getByLabel("PDF 页码", { exact: true })).toHaveValue("3");
  await expect(right.getByLabel("PDF 页码", { exact: true })).toHaveValue("2");
});
