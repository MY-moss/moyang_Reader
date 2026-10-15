//! pdf: extracted from the verified local working copy.
use super::*;

#[tauri::command]
pub fn export_pdf_file(
    path: String,
    html: String,
    access: State<'_, AccessRegistry>,
) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !is_write_allowed_for_new_path(&access, &path) {
        return Err("拒绝写入未通过用户文件选择的路径。请重新选择保存位置。".to_string());
    }
    if html.trim().is_empty() {
        return Err("没有可导出的文档内容。".to_string());
    }
    if html.len() > MAX_PDF_HTML_BYTES {
        return Err("文档内容过大，暂时无法生成 PDF。请先拆分文档后重试。".to_string());
    }

    #[cfg(windows)]
    {
        export_pdf_file_windows(path, &html)
    }
    #[cfg(not(windows))]
    {
        let _ = (path, html);
        Err("PDF 文件导出仅支持 Windows 桌面版。".to_string())
    }
}

pub(super) fn has_pdf_header(bytes: &[u8]) -> bool {
    bytes.get(..5) == Some(b"%PDF-".as_slice())
}

#[cfg(windows)]
pub(super) fn find_edge_executable() -> Option<PathBuf> {
    const CHANNELS: [&str; 4] = ["Edge", "Edge Beta", "Edge Dev", "Edge SxS"];
    const ROOT_VARIABLES: [&str; 3] = ["ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"];

    ROOT_VARIABLES
        .iter()
        .filter_map(std::env::var_os)
        .find_map(|root| {
            CHANNELS
                .iter()
                .map(|channel| {
                    PathBuf::from(&root)
                        .join("Microsoft")
                        .join(channel)
                        .join("Application")
                        .join("msedge.exe")
                })
                .find(|candidate| candidate.is_file())
        })
}

#[cfg(windows)]
pub(super) fn edge_file_url(path: &Path) -> String {
    const EDGE_FILE_URL_ENCODE_SET: &percent_encoding::AsciiSet = &percent_encoding::CONTROLS
        .add(b' ')
        .add(b'#')
        .add(b'?')
        .add(b'%');
    let normalized = path.to_string_lossy().replace('\\', "/");
    format!(
        "file:///{}",
        percent_encoding::utf8_percent_encode(&normalized, EDGE_FILE_URL_ENCODE_SET)
    )
}

#[cfg(windows)]
pub(super) fn is_valid_pdf_file(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if metadata.len() < 5 {
        return false;
    }

    let Ok(mut file) = File::open(path) else {
        return false;
    };
    let mut header = [0_u8; 5];
    file.read_exact(&mut header).is_ok() && has_pdf_header(&header)
}

#[cfg(windows)]
pub(super) fn export_pdf_file_windows(path: PathBuf, html: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    let parent = path
        .parent()
        .ok_or_else(|| "PDF 文件路径没有父目录。".to_string())?
        .to_path_buf();
    fs::create_dir_all(&parent).map_err(|error| format!("创建 PDF 文件目录失败：{error}"))?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "PDF 文件名无法解析。".to_string())?;
    let nonce = TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp_root = std::env::temp_dir();
    let temp_html = temp_root.join(format!(
        "moyang-reader-pdf-{}-{nonce}.html",
        std::process::id()
    ));
    let temp_profile = temp_root.join(format!(
        "moyang-reader-pdf-profile-{}-{nonce}",
        std::process::id()
    ));
    let temp_pdf = parent.join(format!(
        ".{file_name}.moyang-pdf-{}-{nonce}.tmp.pdf",
        std::process::id()
    ));

    let result = (|| {
        let edge = find_edge_executable().ok_or_else(|| {
            "未找到 Microsoft Edge，无法生成 PDF。请安装或修复 Microsoft Edge 后重试。".to_string()
        })?;
        fs::write(&temp_html, html.as_bytes())
            .map_err(|error| format!("准备 PDF 内容失败：{error}"))?;

        let status = Command::new(edge)
            .arg("--headless=new")
            .arg("--disable-gpu")
            .arg("--disable-extensions")
            .arg("--disable-javascript")
            .arg("--no-first-run")
            .arg("--no-default-browser-check")
            .arg("--no-pdf-header-footer")
            .arg("--run-all-compositor-stages-before-draw")
            .arg("--virtual-time-budget=1000")
            .arg(format!("--user-data-dir={}", temp_profile.display()))
            .arg(format!("--print-to-pdf={}", temp_pdf.display()))
            .arg(edge_file_url(&temp_html))
            .creation_flags(0x0800_0000)
            .status()
            .map_err(|error| format!("启动 PDF 渲染器失败：{error}"))?;
        if !status.success() {
            return Err(format!(
                "Microsoft Edge 生成 PDF 失败（退出码 {}）。",
                status
                    .code()
                    .map_or_else(|| "未知".to_string(), |code| code.to_string())
            ));
        }
        let mut valid_pdf = false;
        for _ in 0..50 {
            if is_valid_pdf_file(&temp_pdf) {
                valid_pdf = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        if !valid_pdf {
            return Err("PDF 渲染器未生成有效文件，请稍后重试。".to_string());
        }

        replace_file(&temp_pdf, &path).map_err(|error| format!("保存 PDF 文件失败：{error}"))?;
        Ok(())
    })();

    let _ = fs::remove_file(&temp_html);
    let _ = fs::remove_file(&temp_pdf);
    let _ = fs::remove_dir_all(&temp_profile);
    result
}
