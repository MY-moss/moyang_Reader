import type { Root as HastRoot } from "hast";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import type { RenderedMarkdown } from "../../../shared/types";
import type { RenderOptions } from "./markdown";
import { collectToc, readingStats, textContent } from "./text";

const docxSanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src ?? []), "data"],
  },
};

function schemaFor(options: RenderOptions) {
  if (options.allowRemoteResources) return docxSanitizeSchema;

  return {
    ...docxSanitizeSchema,
    protocols: {
      ...docxSanitizeSchema.protocols,
      src: ["data", "moyang-embed"],
    },
  };
}

function createHtmlProcessor(options: RenderOptions) {
  return unified().use(rehypeParse, { fragment: true }).use(rehypeSanitize, schemaFor(options)).use(rehypeSlug);
}

const localHtmlProcessor = createHtmlProcessor({ allowRemoteResources: false });
const remoteHtmlProcessor = createHtmlProcessor({ allowRemoteResources: true });
const htmlStringifyProcessor = unified().use(rehypeStringify);

export async function renderHtmlFragment(source: string, options: RenderOptions = {}): Promise<RenderedMarkdown> {
  const processor = options.allowRemoteResources ? remoteHtmlProcessor : localHtmlProcessor;
  const tree = processor.parse(source);
  const processed = (await processor.run(tree)) as HastRoot;
  const html = htmlStringifyProcessor.stringify(processed);
  const plainText = processed.children.map(textContent).join(" ");

  return {
    html,
    toc: collectToc(processed),
    ...readingStats(plainText),
  };
}
