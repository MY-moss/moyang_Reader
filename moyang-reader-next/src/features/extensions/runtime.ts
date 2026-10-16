import type { ExtensionInput, ExtensionOutput, ExtensionPackage } from "../../shared/extension-types";

export function runExtension(
  pkg: ExtensionPackage,
  input: ExtensionInput,
  signal?: AbortSignal,
): Promise<ExtensionOutput> {
  if (pkg.kind !== "reader" || !pkg.entry || !pkg.files?.[pkg.entry])
    return Promise.reject(new Error("此扩展没有可运行的阅读命令。"));
  const command = pkg.commands?.find((c) => c.id === input.command);
  if (!command) return Promise.reject(new Error("扩展命令不存在。"));
  if (signal?.aborted) return Promise.reject(new Error("运行已取消。"));
  const entryUrl = URL.createObjectURL(new Blob([pkg.files[pkg.entry]], { type: "text/javascript" }));
  const source = `import run from ${JSON.stringify(entryUrl)}; self.onmessage=async(event)=>{try{self.postMessage({ok:true,result:await run(event.data)})}catch(e){self.postMessage({ok:false,error:String(e)})}};`;
  const workerUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      worker?.terminate();
      URL.revokeObjectURL(workerUrl);
      URL.revokeObjectURL(entryUrl);
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };
    const cancel = () => fail("运行已取消，文档没有改变。");
    const timer = setTimeout(() => fail("插件运行超过 15 秒，已停止。文档没有改变。"), 15000);
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      worker = new Worker(workerUrl, { type: "module", name: pkg.id });
      worker.onerror = () => fail("插件未能运行，请检查入口代码或禁用此插件。");
      worker.onmessage = (event: MessageEvent) => {
        if (!event.data?.ok) {
          fail(event.data?.error || "插件运行失败。");
          return;
        }
        const result = event.data.result as ExtensionOutput;
        if (
          !result ||
          typeof result !== "object" ||
          (result.report !== undefined && typeof result.report !== "string") ||
          (result.replacement !== undefined && typeof result.replacement !== "string")
        ) {
          fail("插件返回的结果格式无效。");
          return;
        }
        if (result.replacement !== undefined && !command.modifiesDocument) {
          fail("此命令没有声明修改正文能力，结果未应用。");
          return;
        }
        if (!result.report && result.replacement === undefined) {
          fail("插件没有返回阅读报告或修改结果。");
          return;
        }
        cleanup();
        resolve(result);
      };
      worker.postMessage(input);
    } catch (error) {
      fail(String(error));
    }
  });
}
