import type { ExtensionInput, ExtensionOutput } from "../../shared/extension-types";

self.onmessage = async (event: MessageEvent<{ entry: string; input: ExtensionInput; analyze: boolean }>) => {
  try {
    const { entry, input, analyze } = event.data;
    if (analyze && input.format === "markdown") {
      const { analyzeDocument } = await import("./document-analysis");
      input.analysis = analyzeDocument(input.text);
    }
    const { default: run } = (await import(/* @vite-ignore */ entry)) as {
      default: (input: ExtensionInput) => ExtensionOutput | Promise<ExtensionOutput>;
    };
    self.postMessage({ ok: true, result: await run(input) });
  } catch (error) {
    self.postMessage({ ok: false, error: String(error) });
  }
};
