import { useMemo, useState } from "react";
import type { OpenDocument } from "../../../shared/types";
import { PropertiesEditor } from "../../documents/PropertiesEditor";
import { summarizeProperties } from "../../documents/frontmatter";

export function PropertiesPanel({
  documentState: doc,
  sourceDraft,
  onUpdateSource,
}: {
  documentState: OpenDocument;
  sourceDraft: string;
  onUpdateSource: (source: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const properties = useMemo(
    () => (doc.kind === "markdown" ? summarizeProperties(sourceDraft) : []),
    [doc.kind, sourceDraft],
  );
  return (
    <section className="context-properties" aria-labelledby="context-properties-title">
      <h3 id="context-properties-title">文档属性</h3>
      <dl>
        <div>
          <dt>类型</dt>
          <dd>{doc.kind === "markdown" ? "Markdown" : doc.kind === "text" ? "纯文本" : doc.kind.toUpperCase()}</dd>
        </div>
        <div>
          <dt>字数</dt>
          <dd>{doc.rendered.wordCount.toLocaleString("zh-CN")}</dd>
        </div>
        <div>
          <dt>阅读时间</dt>
          <dd>{doc.rendered.readingMinutes} 分钟</dd>
        </div>
        <div>
          <dt>路径</dt>
          <dd title={doc.path}>{doc.path}</dd>
        </div>
      </dl>
      {properties.length > 0 && (
        <div className="context-frontmatter">
          <h4>自定义属性</h4>
          <dl>
            {properties.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd title={value}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {doc.kind === "markdown" && (
        <button className="quiet-button" onClick={() => setEditing(true)}>
          编辑文档属性
        </button>
      )}
      {editing && <PropertiesEditor source={sourceDraft} onApply={onUpdateSource} onClose={() => setEditing(false)} />}
    </section>
  );
}
