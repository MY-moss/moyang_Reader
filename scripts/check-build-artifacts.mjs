import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const distDirectory = path.resolve(process.cwd(), "dist");
const assetsDirectory = path.join(distDirectory, "assets");
const indexHtml = await readFile(path.join(distDirectory, "index.html"), "utf8");
const assetNames = (await readdir(assetsDirectory)).filter((name) => name.endsWith(".css"));

if (assetNames.length === 0) throw new Error("构建产物中没有 CSS 资源。");

const cssAssets = await Promise.all(
  assetNames.map(async (name) => ({ name, contents: await readFile(path.join(assetsDirectory, name), "utf8") })),
);
const entryCssNames = [...indexHtml.matchAll(/(?:href|src)=["']([^"']+\.css)["']/g)].map((match) =>
  path.basename(match[1]),
);
const entryCss = cssAssets.filter((asset) => entryCssNames.includes(asset.name));
const katexAssets = cssAssets.filter((asset) => /(?:^|[}\s])\.katex(?:[-\s{.:]|$)/m.test(asset.contents));

if (katexAssets.length === 0) throw new Error("未找到按需加载的 KaTeX CSS 资源。");
if (entryCss.some((asset) => /(?:^|[}\s])\.katex(?:[-\s{.:]|$)/m.test(asset.contents))) {
  throw new Error("KaTeX CSS 被打入首屏 CSS，普通文档仍会提前加载。");
}

console.log(
  JSON.stringify({
    entryCss: entryCss.map((asset) => asset.name),
    cssAssetCount: cssAssets.length,
    katexCssAssets: katexAssets.map((asset) => asset.name),
  }),
);
