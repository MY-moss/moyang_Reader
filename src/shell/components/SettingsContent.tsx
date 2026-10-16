import type { ReadingFont, EditorFont, ExportTemplate } from "../../features/settings/appearance";
import { translate, type Locale, type MessageKey } from "../../features/settings/i18n";
import type { ExportMargin, ExportOrientation, ExportPaper, ReadingWidth } from "../../shared/types";
import type { TopBarProps } from "./toolbar-types";

export function SettingsContent(p: TopBarProps & { section?: string }) {
  const t = (key: MessageKey) => translate(p.locale, key);
  const en = p.locale === "en-US";
  const status = p.settingsPersistenceStatus;
  const statusLabel =
    status === "saving"
      ? en
        ? "Saving settings…"
        : "正在保存设置…"
      : status === "error"
        ? en
          ? "Settings could not be saved"
          : "设置保存失败"
        : status === "fallback"
          ? en
            ? "Saved with local fallback"
            : "设置已保存（使用本机备用存储）"
          : en
            ? "Settings saved locally"
            : "设置已保存到本机";
  return (
    <div className="settings-content">
      <section
        hidden={Boolean(p.section && p.section !== "reading")}
        id="settings-reading"
        className="settings-section"
        tabIndex={-1}
        aria-labelledby="settings-reading-title"
      >
        <h3 id="settings-reading-title">{en ? "Appearance" : "外观"}</h3>
        <button onClick={p.onCycleTheme}>
          {en ? "Theme" : "主题"}：{p.theme === "dark" ? "深色" : p.theme === "light" ? "浅色" : "跟随系统"} · 点击切换
        </button>
        <p>{en ? "Make this space comfortable for you." : "选一个舒服的字体，让每一页都适合你。"}</p>
        <label className="settings-select-option">
          <span>{en ? "Reading font" : "正文字体"}</span>
          <select
            aria-label="正文字体"
            value={p.readingFont}
            onChange={(e) => p.onReadingFontChange(e.target.value as ReadingFont)}
          >
            <option value="serif">{en ? "Book serif" : "书籍衬线"}</option>
            <option value="sans">{en ? "Clean sans" : "清晰无衬线"}</option>
            <option value="system">{en ? "System font" : "系统字体"}</option>
          </select>
        </label>

        <div className="settings-range-option">
          <div className="settings-range-heading">
            <span>{t("settings.fontSize")}</span>
            <output aria-live="polite">{p.readingZoom}%</output>
          </div>
          <input
            aria-label="阅读缩放"
            type="range"
            min="75"
            max="150"
            step="5"
            value={p.readingZoom}
            onChange={(e) => p.onReadingZoomChange(Number(e.target.value))}
          />
          <div className="settings-range-footer">
            <small>{t("settings.zoomHint")}</small>
            <button className="quiet-button" onClick={() => p.onReadingZoomChange(100)}>
              {t("settings.zoomReset")}
            </button>
          </div>
        </div>
        <label className="settings-select-option">
          <span>{t("settings.width")}</span>
          <select
            aria-label="正文宽度"
            value={p.readingWidth}
            onChange={(e) => p.onReadingWidthChange(e.target.value as ReadingWidth)}
          >
            <option value="narrow">{t("settings.width.narrow")}</option>
            <option value="standard">{t("settings.width.standard")}</option>
            <option value="wide">{t("settings.width.wide")}</option>
          </select>
        </label>
        <div className={`settings-type-preview reading-font-${p.readingFont}`}>
          <span>{en ? "A page, a quiet moment." : "翻开一页，留一点时间给自己。"}</span>
          <small>{en ? "Your documents, your pace." : "文字有自己的节奏，阅读也是。"}</small>
        </div>
      </section>
      <section
        hidden={Boolean(p.section && p.section !== "editing")}
        id="settings-editing"
        className="settings-section"
      >
        <h3>{en ? "Editing" : "编辑"}</h3>
        <label className="settings-select-option">
          <span>{en ? "Editor font" : "编辑字体"}</span>
          <select
            aria-label="编辑字体"
            value={p.editorFont}
            onChange={(e) => p.onEditorFontChange(e.target.value as EditorFont)}
          >
            <option value="mono">{en ? "Monospace" : "等宽字体"}</option>
            <option value="system">{en ? "System font" : "系统字体"}</option>
          </select>
        </label>
        <p>停止输入约 1.2 秒后自动保存。中文组词期间暂停；Ctrl+S 随时保存。</p>
        <p>Markdown 支持选区工具条与 / 插入菜单。特殊结构保留源码编辑。</p>
        <button onClick={p.onOpenRecovery}>查看恢复草稿</button>
      </section>
      <section
        hidden={Boolean(p.section && p.section !== "export")}
        id="settings-export"
        className="settings-section"
        tabIndex={-1}
        aria-labelledby="settings-export-title"
      >
        <h3 id="settings-export-title">{en ? "Export layout" : "导出版式"}</h3>
        <p>{en ? "Prepare a copy to read, print, or share." : "为阅读、打印或分享准备一份排版整齐的副本。"}</p>
        <label className="settings-select-option">
          <span>{en ? "Layout" : "导出版式"}</span>
          <select
            aria-label="导出版式"
            value={p.exportTemplate}
            onChange={(e) => p.onExportTemplateChange(e.target.value as ExportTemplate)}
          >
            <option value="book">{en ? "Book" : "书籍阅读"}</option>
            <option value="report">{en ? "Report" : "工作报告"}</option>
            <option value="compact">{en ? "Handout" : "紧凑讲义"}</option>
          </select>
        </label>
        <label className="settings-select-option">
          <span>{t("settings.paper")}</span>
          <select
            aria-label="导出纸张"
            value={p.exportPaper}
            onChange={(e) => p.onExportPaperChange(e.target.value as ExportPaper)}
          >
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>
        </label>
        <label className="settings-select-option">
          <span>{t("settings.orientation")}</span>
          <select
            aria-label="导出方向"
            value={p.exportOrientation}
            onChange={(e) => p.onExportOrientationChange(e.target.value as ExportOrientation)}
          >
            <option value="portrait">{t("settings.orientation.portrait")}</option>
            <option value="landscape">{t("settings.orientation.landscape")}</option>
          </select>
        </label>
        <label className="settings-select-option">
          <span>{t("settings.margin")}</span>
          <select
            aria-label="导出页边距"
            value={p.exportMargin}
            onChange={(e) => p.onExportMarginChange(e.target.value as ExportMargin)}
          >
            <option value="compact">{t("settings.margin.compact")}</option>
            <option value="standard">{t("settings.margin.standard")}</option>
            <option value="wide">{t("settings.margin.wide")}</option>
          </select>
        </label>
        <small className="settings-note">{t("settings.exportNote")}</small>
      </section>
      <section
        hidden={Boolean(p.section && p.section !== "general")}
        id="settings-general"
        className="settings-section"
        tabIndex={-1}
        aria-labelledby="settings-general-title"
      >
        <h3 id="settings-general-title">{en ? "General & privacy" : "通用与隐私"}</h3>
        <p>{en ? "Your files stay in their original folders." : "文档留在原来的文件夹中，由你掌控。"}</p>
        <label className="settings-select-option">
          <span>{t("settings.language")}</span>
          <select
            aria-label={t("settings.language")}
            value={p.locale}
            onChange={(e) => p.onLocaleChange(e.target.value as Locale)}
          >
            <option value="zh-CN">{t("settings.language.zh")}</option>
            <option value="en-US">{t("settings.language.en")}</option>
          </select>
        </label>
        <label className="settings-option">
          <input
            type="checkbox"
            checked={p.allowRemoteResources}
            onChange={(e) => p.onAllowRemoteResourcesChange(e.target.checked)}
          />
          <span>
            <strong>{t("settings.allowRemoteImages")}</strong>
            <small>{t("settings.remoteImagesNote")}</small>
          </span>
        </label>
      </section>
      <section
        hidden={Boolean(p.section && p.section !== "backup")}
        id="settings-backup"
        className="settings-section"
        tabIndex={-1}
        aria-labelledby="settings-backup-title"
      >
        <h3 id="settings-backup-title">{en ? "Backup & help" : "备份与帮助"}</h3>
        <p>{t("settings.backupNote")}</p>
        <div className="settings-actions">
          <button className="quiet-button" onClick={p.onExportSettings}>
            {t("settings.exportSettings")}
          </button>
          <button className="quiet-button" onClick={p.onImportSettings}>
            {t("settings.importSettings")}
          </button>
          <button className="quiet-button" onClick={p.onOpenGuide}>
            {en ? "User guide" : "使用教程"}
          </button>
        </div>
        <div className={`settings-persistence-status settings-persistence-${status}`} role="status" aria-live="polite">
          <span className="settings-persistence-dot" aria-hidden="true" />
          <span>{statusLabel}</span>
        </div>
        <small className="settings-note">Moyang Reader Next · {en ? "Local edition" : "本地版"}</small>
      </section>
    </div>
  );
}
