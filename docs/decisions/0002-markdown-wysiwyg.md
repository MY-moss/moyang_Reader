# Markdown 真源与懒加载所见即所得编辑

Moyang Reader 采用 Markdown 作为唯一持久化真源，使用按需加载的 Markdown 所见即所得编辑器提供编辑体验，并保留 CodeMirror 源码模式。这样可以改善高频编辑效率，同时避免把编辑器内部 JSON 变成用户文件格式；无法安全往返的语法必须回退源码模式，不能静默丢失内容。
