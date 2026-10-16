import { useRef, useState } from "react";
import { useModalBehavior } from "../../shared/components/useModalBehavior";
import { commonProperties, replaceProperties, splitFrontmatter, updateCommonProperty } from "./frontmatter";

export function PropertiesEditor({
  source,
  onApply,
  onClose,
}: {
  source: string;
  onApply: (source: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [original] = useState(source);
  const [yaml, setYaml] = useState(() => {
    try {
      return splitFrontmatter(source).yaml || "title: \ntags: []";
    } catch {
      return "";
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState(() => commonProperties(yaml).tags);
  const common = commonProperties(yaml);
  const update = (field: "title" | "tags", value: string) => {
    try {
      setYaml(updateCommonProperty(yaml, field, value));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "属性格式无效。");
    }
  };
  useModalBehavior({ containerRef: dialogRef, initialFocusRef: inputRef, onClose });
  const apply = () => {
    try {
      if (source !== original) throw new Error("文档已发生变化，请关闭并重新打开属性编辑，避免覆盖新内容。");
      onApply(replaceProperties(source, yaml));
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "属性格式无效。");
    }
  };
  return (
    <div
      className="command-palette-backdrop"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <section
        className="properties-editor"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="properties-editor-title"
        tabIndex={-1}
      >
        <header>
          <h2 id="properties-editor-title">编辑文档属性</h2>
          <button className="quiet-button" onClick={onClose} aria-label="关闭属性编辑">
            ×
          </button>
        </header>
        <p>给文档一个标题，添加标签，方便以后找到。应用后按 Ctrl+S 保存。</p>
        <div className="property-fields">
          <label>
            标题
            <input
              ref={inputRef}
              value={common.title}
              disabled={!common.valid}
              onChange={(e) => update("title", e.target.value)}
              placeholder="文档的显示标题"
            />
          </label>
          <label>
            标签
            <input
              value={tagsInput}
              disabled={!common.valid}
              onChange={(e) => {
                setTagsInput(e.target.value);
                update("tags", e.target.value);
              }}
              placeholder="阅读, 工作, 灵感"
            />
            <small>多个标签用逗号分隔</small>
          </label>
        </div>
        <details className="property-advanced">
          <summary>更多属性与源格式</summary>
          <p>自定义字段、列表和嵌套内容可以在这里编辑。</p>
          <label htmlFor="properties-yaml">YAML 属性</label>
          <textarea
            id="properties-yaml"
            spellCheck={false}
            value={yaml}
            onChange={(e) => {
              setYaml(e.target.value);
              setTagsInput(commonProperties(e.target.value).tags);
            }}
          />
        </details>
        {error && <p role="alert">{error}</p>}
        <footer>
          <button className="quiet-button" onClick={onClose}>
            取消
          </button>
          <button className="toolbar-button primary" onClick={apply}>
            应用到文档
          </button>
        </footer>
      </section>
    </div>
  );
}
