import { ContextMenu } from "./ContextMenu";
import type { AnnotationSelection } from "../annotations";

export type ReaderContextTarget = {
  x: number;
  y: number;
  selectedText: string;
  linkHref: string | null;
  headingId?: string | null;
  annotationSelection?: AnnotationSelection | null;
  restoreFocusTarget?: HTMLElement | null;
  fallbackFocusTarget?: HTMLElement | null;
};

type ReaderContextMenuProps = {
  target: ReaderContextTarget;
  documentPath?: string | null;
  canEdit: boolean;
  canBookmark?: boolean;
  isBookmarked?: boolean;
  canAnnotate?: boolean;
  editLabel: string;
  onCopySelection: (text: string) => void;
  onFindSelection: (text: string) => void;
  onCopyLink: (href: string) => void;
  onOpenLink: (href: string) => void;
  onEdit: () => void;
  onCopyDocumentPath: () => void;
  onToggleBookmark?: () => void;
  onAddAnnotation?: () => void;
  onClose: () => void;
};

export function ReaderContextMenu({
  target,
  documentPath,
  canEdit,
  canBookmark = false,
  isBookmarked = false,
  canAnnotate = false,
  editLabel,
  onCopySelection,
  onFindSelection,
  onCopyLink,
  onOpenLink,
  onEdit,
  onCopyDocumentPath,
  onToggleBookmark,
  onAddAnnotation,
  onClose,
}: ReaderContextMenuProps) {
  const hasSelection = Boolean(target.selectedText.trim());
  const hasLink = Boolean(target.linkHref);

  return (
    <ContextMenu
      x={target.x}
      y={target.y}
      title="阅读操作"
      ariaLabel="阅读内容菜单"
      groups={[
        {
          label: "文本",
          items: [
            {
              id: "reader-copy-selection",
              label: "复制选中文本",
              shortcut: "Ctrl C",
              disabled: !hasSelection,
              onSelect: () => onCopySelection(target.selectedText),
            },
            {
              id: "reader-find-selection",
              label: "查找选中文本",
              shortcut: "Ctrl F",
              disabled: !hasSelection,
              onSelect: () => onFindSelection(target.selectedText),
            },
            ...(canAnnotate
              ? [
                  {
                    id: "reader-add-annotation",
                    label: "高亮 / 批注",
                    disabled: !hasSelection || !target.annotationSelection || !onAddAnnotation,
                    onSelect: () => onAddAnnotation?.(),
                  },
                ]
              : []),
          ],
        },
        ...(hasLink
          ? [
              {
                label: "链接",
                items: [
                  {
                    id: "reader-copy-link",
                    label: "复制链接地址",
                    onSelect: () => onCopyLink(target.linkHref as string),
                  },
                  {
                    id: "reader-open-link",
                    label: "打开链接",
                    onSelect: () => onOpenLink(target.linkHref as string),
                  },
                ],
              },
            ]
          : []),
        ...(canEdit || documentPath || (canBookmark && onToggleBookmark)
          ? [
              {
                label: "文档",
                items: [
                  ...(canBookmark && onToggleBookmark
                    ? [
                        {
                          id: "reader-toggle-bookmark",
                          label: isBookmarked ? "移除当前书签" : "添加书签",
                          onSelect: onToggleBookmark,
                        },
                      ]
                    : []),
                  ...(canEdit
                    ? [
                        {
                          id: "reader-edit-document",
                          label: editLabel,
                          onSelect: onEdit,
                        },
                      ]
                    : []),
                  ...(documentPath
                    ? [
                        {
                          id: "reader-copy-document-path",
                          label: "复制文档路径",
                          onSelect: onCopyDocumentPath,
                        },
                      ]
                    : []),
                ],
              },
            ]
          : []),
      ]}
      restoreFocusTarget={target.restoreFocusTarget}
      fallbackFocusTarget={target.fallbackFocusTarget}
      onClose={onClose}
    />
  );
}
