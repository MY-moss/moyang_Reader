import { bookroomRequest } from "../../platform/bookroom-bridge";
import { fileMetadata, readBinaryFile, readTextFile } from "../../platform/bridge";
import { extractSourceChunks } from "../documents/source-chunks";
import type { WorkspaceFile, WorkspaceIndexEntry } from "../../shared/types";

type Job = { file: WorkspaceFile; tags: string[]; tagKey: string };
type Manifest = { path: string; stamp: string; tags: string };

/** The workspace delta retains unchanged file objects. Only new identities or tags enter the queue. */
export class BodyIndexer {
  private observed = new Map<string, Job>();
  private pending = new Map<string, Job>();
  private errors = new Map<string, string>();
  private known = new Map<string, Manifest>();
  private initialized = false;
  private running = false;
  private disposed = false;
  constructor(
    private root: string,
    private report: (progress: string, errors: string[], changed: boolean) => void,
  ) {}
  retry() {
    for (const [path, job] of this.observed)
      if (this.errors.has(path) || !this.initialized) this.pending.set(path, job);
    this.errors.delete(this.root);
    void this.run();
  }
  dispose() {
    this.disposed = true;
    this.pending.clear();
  }
  update(files: WorkspaceFile[], entries: WorkspaceIndexEntry[]) {
    const tags = new Map(entries.map((entry) => [entry.file.path, entry.tags]));
    const next = new Map<string, Job>();
    for (const file of files) {
      if (file.kind === "image") continue;
      const values = tags.get(file.path) ?? [];
      const tagKey = JSON.stringify(values);
      const old = this.observed.get(file.path);
      if (old?.file === file && old.tagKey === tagKey) next.set(file.path, old);
      else {
        const job = { file, tags: values, tagKey };
        next.set(file.path, job);
        this.pending.set(file.path, job);
      }
    }
    this.observed = next;
    for (const path of this.pending.keys()) if (!next.has(path)) this.pending.delete(path);
    for (const path of this.errors.keys()) if (!next.has(path)) this.errors.delete(path);
    void this.run();
  }
  private current(job: Job) {
    return !this.disposed && this.observed.get(job.file.path) === job;
  }
  private async run() {
    if (this.running || this.disposed || !this.pending.size) return;
    this.running = true;
    let changed = false;
    try {
      if (!this.initialized) {
        const manifest = await bookroomRequest<Manifest[]>({ action: "index.manifest", root: this.root });
        if (this.disposed) return;
        this.known = new Map(manifest.map((item) => [item.path, item]));
        this.initialized = true;
      }
      while (!this.disposed && this.pending.size) {
        const [path, job] = this.pending.entries().next().value!;
        this.pending.delete(path);
        try {
          const stamp = JSON.stringify(await fileMetadata(path));
          if (!this.current(job)) continue;
          const previous = this.known.get(path);
          if (previous?.stamp === stamp) {
            if (previous.tags !== job.tagKey) {
              await bookroomRequest({ action: "index.attributes", path, tags: job.tags });
              changed = true;
            }
          } else {
            this.report(
              `正在整理正文 · ${job.file.name}（剩余 ${this.pending.size}）`,
              [...this.errors.values()],
              false,
            );
            const source =
              job.file.kind === "markdown" || job.file.kind === "text"
                ? await readTextFile(path)
                : await readBinaryFile(path);
            if (!this.current(job)) continue;
            const extracted = await extractSourceChunks(path, job.file.kind, source);
            if (!this.current(job)) continue;
            if (JSON.stringify(await fileMetadata(path)) !== stamp) throw new Error("内容正在变化，请刷新重试");
            if (!this.current(job)) continue;
            await bookroomRequest({
              action: "index.replace",
              root: this.root,
              path,
              title: job.file.name,
              kind: job.file.kind,
              tags: job.tags,
              stamp,
              ...extracted,
            });
            changed = true;
          }
          this.known.set(path, { path, stamp, tags: job.tagKey });
          this.errors.delete(path);
        } catch (cause) {
          if (this.current(job)) this.errors.set(path, `${job.file.name}：${String(cause)}`);
        }
      }
    } catch (cause) {
      if (!this.disposed) this.errors.set(this.root, String(cause));
    } finally {
      this.running = false;
      if (!this.disposed) this.report("", [...this.errors.values()], changed);
    }
  }
}
