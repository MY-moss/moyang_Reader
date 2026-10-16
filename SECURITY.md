# 安全问题与发布核验

当前维护的是仓库根目录的 Moyang Reader 0.13 系列。旧工程留作历史，问题请先在当前版本核对。

发现可能泄露文件、API 密钥，或影响更新签名的问题，请通过 [GitHub 私密漏洞报告](https://github.com/MY-moss/moyang_Reader/security/advisories/new) 联系维护者。此仓库的 Private Vulnerability Reporting 已于 2026-10-16 开启并通过 API 回读确认。普通功能问题仍使用 Issues；不要在公开 Issue 中上传密钥、个人资料或完整敏感日志。

请提供版本、系统、复现步骤和去除个人数据后的最小样本。作为个人项目，维护者尽力在 7 天内确认、14 天内给出初步处理结果；这不是服务承诺。修复与公开时间通过私密报告协调，不需要企业账号或额外安全平台。

便携更新采用独立签名，下载后验证签名，包内二进制附 SHA-256 清单。发布者签名与 Windows Authenticode 是两件事：当前 EXE 未使用商业 Authenticode 证书，Windows 可能显示未知发布者。下载请使用本仓库的 [Releases](https://github.com/MY-moss/moyang_Reader/releases)，核对版本与 `SHA256SUMS.txt`。不要跳过应用内签名检查。

自己的 API 密钥保存在本机聊天数据库；目前没有声称使用系统凭据保险库加密。不要公开整个数据目录或含密钥的系统备份。插件预设和聊天导出不包含密钥。存储迁移与恢复见 [存储说明](docs/STORAGE-LOCATIONS.md)，发布过程见 [在线更新](docs/ONLINE-UPDATES.md)。
