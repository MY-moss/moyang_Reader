# 本机设置使用 SQLite 提交

2026-10-16，阅读工作台真实关闭/重启验收。

本机加密的 Windows AppData 目录中，同目录临时文件的 MoveFileExW 替换返回 ERROR_NOT_SAME_DEVICE（17）。单独复现了带/不带 WRITE_THROUGH 两种情况；ReplaceFileW 返回访问拒绝。正文在测试阅读库正常保存，但 JSON 设置写入失败会阻止正常关闭。不能据“目录路径相同”假定所有 Windows 文件系统都支持这种替换。

采用已有 SQLite 依赖，将本机设置正文保存于应用配置目录的 settings.sqlite 单行表。WAL + FULL 同步及事务负责提交；不通过非原子的覆盖复制来保存设置。读取先查数据库，再兼容旧 settings.json；旧文件保留原样。前端设置结构、导入导出 JSON 和启动方式不变。

备份需在退出应用后复制整个应用配置目录。恢复旧版时可使用导出的设置 JSON；回滚程序不会把新设置自动写回旧 JSON。阅读元数据 reader.sqlite 与 AI 数据库仍独立。

验证包含旧 JSON 读取、后续两次更新、旧文件不变，以及本机真实关闭和无参数重新启动。实际结果记入工作台验证报告。

参考：[Microsoft MoveFileExW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw)、[ReplaceFileW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-replacefilew)。本次未修改系统加密或访问权限。
