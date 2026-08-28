import { ContextMenu } from "./ContextMenu";

export type ReaderContextTarget = {
  x: number;
  y: number;
  selectedText: string;
  linkHref: string | null;
};

type ReaderContextMenuProps = {
  target: ReaderContextTarget;
  documentPath?: string | null;
  canEdit: boolean;
  editLabel: string;
  onCopySelection: (text: string) => void;
  onFindSelection: (text: string) => void;
  onCopyLink: (href: string) => void;
  onOpenLink: (href: string) => void;
  onEdit: () => void;
  onCopyDocumentPath: () => void;
  onClose: () => void;
};

export function ReaderContextMenu({
  target,
  documentPath,
  canEdit,
  editLabel,
  onCopySelection,
  onFindSelection,
  onCopyLink,
  onOpenLink,
  onEdit,
  onCopyDocumentPath,
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
        ...(canEdit || documentPath
          ? [
              {
                label: "文档",
                items: [
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
      onClose={onClose}
    />
  );
}
