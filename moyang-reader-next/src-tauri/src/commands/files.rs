//! files: extracted from the verified local working copy.
use super::*;

pub(super) fn decode_text(bytes: &[u8]) -> Result<String, String> {
    if bytes.starts_with(&[0xFF, 0xFE]) {
        if !(bytes.len() - 2).is_multiple_of(2) {
            return Err("UTF-16 文件末尾存在不完整的字节，无法安全读取。".to_string());
        }
        let values = bytes[2..]
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]));
        let text = String::from_utf16(values.collect::<Vec<_>>().as_slice())
            .map_err(|error| format!("UTF-16 文件无法解析：{error}"))?;
        return reject_suspicious_binary_text(text);
    }

    if bytes.starts_with(&[0xFE, 0xFF]) {
        if !(bytes.len() - 2).is_multiple_of(2) {
            return Err("UTF-16 文件末尾存在不完整的字节，无法安全读取。".to_string());
        }
        let values = bytes[2..]
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| u16::from_be_bytes([pair[0], pair[1]]));
        let text = String::from_utf16(values.collect::<Vec<_>>().as_slice())
            .map_err(|error| format!("UTF-16 文件无法解析：{error}"))?;
        return reject_suspicious_binary_text(text);
    }

    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        let text = String::from_utf8(bytes[3..].to_vec())
            .map_err(|error| format!("UTF-8 文件无法解析：{error}"))?;
        return reject_suspicious_binary_text(text);
    }

    if let Ok(text) = String::from_utf8(bytes.to_vec()) {
        return reject_suspicious_binary_text(text);
    }

    let (decoded, _, had_errors) = encoding_rs::GB18030.decode(bytes);
    if had_errors {
        return Err("文件不是有效的 UTF-8、UTF-16 或 GB18030 文本。".to_string());
    }
    reject_suspicious_binary_text(decoded.into_owned())
}

pub(super) fn reject_suspicious_binary_text(text: String) -> Result<String, String> {
    let character_count = text.chars().count();
    let suspicious_count = text
        .chars()
        .filter(|character| {
            *character == '\u{FFFD}'
                || (character.is_control() && !matches!(*character, '\t' | '\n' | '\r'))
        })
        .count();
    let has_nul = text.contains('\0');
    if has_nul
        || (suspicious_count >= 3
            && suspicious_count.saturating_mul(100) >= character_count.max(1).saturating_mul(2))
    {
        return Err(
            "文件内容疑似二进制或损坏文本，已拒绝按文本打开，以避免乱码覆盖原文件。".to_string(),
        );
    }
    Ok(text)
}

#[tauri::command]
pub fn read_text_file(path: String, access: State<'_, AccessRegistry>) -> Result<String, String> {
    if !access.is_read_allowed(Path::new(&path)) {
        return Err("拒绝读取未通过用户文件选择的路径。请重新选择文件或文件夹。".to_string());
    }
    read_text_file_inner(PathBuf::from(path))
}

pub(super) fn read_text_file_inner(path: PathBuf) -> Result<String, String> {
    let metadata = fs::metadata(&path).map_err(|error| format!("无法读取文件信息：{error}"))?;
    if metadata.len() > MAX_READ_FILE_BYTES {
        return Err("文件过大，暂不支持直接打开超过 100 MB 的文本文件。".to_string());
    }
    let bytes = fs::read(&path).map_err(|error| format!("无法读取文件：{error}"))?;
    decode_text(&bytes)
}

#[tauri::command]
pub fn read_binary_file(
    path: String,
    access: State<'_, AccessRegistry>,
) -> Result<tauri::ipc::Response, String> {
    let path = PathBuf::from(path);
    if !access.is_read_allowed(&path) {
        return Err("拒绝读取未通过用户文件选择的路径。请重新选择文件或文件夹。".to_string());
    }
    let metadata = fs::metadata(&path).map_err(|error| format!("无法读取文件信息：{error}"))?;
    if metadata.len() > MAX_READ_FILE_BYTES {
        return Err("文件过大，暂不支持直接打开超过 100 MB 的附件。".to_string());
    }
    fs::read(&path)
        .map(tauri::ipc::Response::new)
        .map_err(|error| format!("无法读取文件：{error}"))
}

#[tauri::command]
pub fn path_exists(path: String, access: State<'_, AccessRegistry>) -> bool {
    access.is_read_allowed(Path::new(&path)) && path_exists_inner(Path::new(&path))
}

pub(super) fn path_exists_inner(path: &Path) -> bool {
    path.exists()
}

#[tauri::command]
pub fn file_size(path: String, access: State<'_, AccessRegistry>) -> Result<u64, String> {
    if !access.is_read_allowed(Path::new(&path)) {
        return Err("拒绝读取未通过用户文件选择的路径。请重新选择文件或文件夹。".to_string());
    }
    fs::metadata(PathBuf::from(path))
        .map(|metadata| metadata.len())
        .map_err(|error| format!("无法读取文件信息：{error}"))
}

#[derive(Debug, Serialize)]
pub struct FileMetadata {
    pub size: u64,
    pub modified_ms: Option<u64>,
}

#[tauri::command]
pub fn file_metadata(
    path: String,
    access: State<'_, AccessRegistry>,
) -> Result<FileMetadata, String> {
    let path = PathBuf::from(path);
    if !access.is_read_allowed(&path) {
        return Err("拒绝读取未通过用户文件选择的路径。请重新选择文件或文件夹。".to_string());
    }

    let metadata = fs::metadata(&path).map_err(|error| format!("无法读取文件信息：{error}"))?;
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| duration.as_millis().try_into().ok());

    Ok(FileMetadata {
        size: metadata.len(),
        modified_ms,
    })
}

#[tauri::command]
pub fn write_text_file(
    app: AppHandle,
    path: String,
    contents: String,
    expected_contents: Option<String>,
    access: State<'_, AccessRegistry>,
) -> Result<Option<String>, String> {
    let path = PathBuf::from(path);
    if !is_write_allowed_for_new_path(&access, &path) {
        return Err("拒绝写入未通过用户文件选择的路径。请重新选择文件或文件夹。".to_string());
    }
    let editable = path.extension().and_then(|v| v.to_str()).is_some_and(|v| {
        markdown_extension(Some(v))
            || TEXT_EXTENSIONS
                .iter()
                .any(|ext| v.eq_ignore_ascii_case(ext))
    });
    let before = if editable && path.exists() {
        Some(read_text_file_inner(path.clone())?)
    } else {
        None
    };
    if let Some(expected) = expected_contents {
        if before.as_deref() != Some(expected.as_str()) {
            return Err("文件在保存前已变化，请比较差异后重试。".into());
        }
    }
    if editable {
        bookroom::write_with_history(&app, &path, before.as_deref(), &contents)
    } else {
        write_text_file_inner(path, contents)?;
        Ok(None)
    }
}

pub(super) fn write_text_file_inner(path: PathBuf, contents: String) -> Result<(), String> {
    write_bytes_file_inner(path, contents.as_bytes(), true)
}

#[tauri::command]
pub fn write_binary_file(
    path: String,
    contents: Vec<u8>,
    access: State<'_, AccessRegistry>,
) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !is_write_allowed_for_new_path(&access, &path) {
        return Err("拒绝写入未通过用户文件选择的路径。请重新选择保存位置。".to_string());
    }
    write_bytes_file_inner(path, &contents, false)
}

pub(super) fn decode_ipc_path(encoded_path: &str) -> Result<PathBuf, String> {
    percent_encoding::percent_decode_str(encoded_path)
        .decode_utf8()
        .map(|path| PathBuf::from(path.into_owned()))
        .map_err(|_| "IPC 文件路径不是有效的 UTF-8。".to_string())
}

#[tauri::command]
pub fn write_binary_file_raw(
    request: tauri::ipc::Request<'_>,
    access: State<'_, AccessRegistry>,
) -> Result<(), String> {
    let encoded_path = request
        .headers()
        .get("path")
        .ok_or_else(|| "IPC 写入缺少文件路径。".to_string())?;
    let path = decode_ipc_path(
        encoded_path
            .to_str()
            .map_err(|_| "IPC 文件路径不是有效的请求头。".to_string())?,
    )?;
    if !is_write_allowed_for_new_path(&access, &path) {
        return Err("拒绝写入未通过用户文件选择的路径。请重新选择保存位置。".to_string());
    }

    let contents = match request.body() {
        tauri::ipc::InvokeBody::Raw(contents) => contents,
        _ => return Err("IPC 二进制写入需要原始字节请求体。".to_string()),
    };
    write_bytes_file_inner(path, contents, false)
}

pub(super) fn is_write_allowed_for_new_path(access: &AccessRegistry, path: &Path) -> bool {
    let mut candidate = path;
    loop {
        if access.is_write_allowed(candidate) {
            return true;
        }
        if candidate.exists() {
            return false;
        }
        let Some(parent) = candidate.parent() else {
            return false;
        };
        if parent == candidate {
            return false;
        }
        candidate = parent;
    }
}

pub(super) fn write_bytes_file_inner(
    path: PathBuf,
    contents: &[u8],
    create_backup: bool,
) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "文件路径没有父目录。".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("创建文件目录失败：{error}"))?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "文件名无法解析。".to_string())?;

    let backup = if create_backup && path.is_file() {
        let backup = parent.join(format!(".{file_name}.moyang.bak"));
        fs::copy(&path, &backup).map_err(|error| format!("创建备份失败：{error}"))?;
        Some(backup)
    } else {
        None
    };

    let nonce = TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp = parent.join(format!(
        ".{file_name}.moyang.tmp-{}-{nonce}",
        std::process::id()
    ));
    let result = (|| {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp)
            .map_err(|error| format!("创建临时文件失败：{error}"))?;
        file.write_all(contents)
            .map_err(|error| format!("写入临时文件失败：{error}"))?;
        file.sync_all()
            .map_err(|error| format!("刷新临时文件失败：{error}"))?;
        drop(file);

        replace_file(&temp, &path).map_err(|error| format!("完成文件替换失败：{error}"))?;
        if let Some(backup) = backup.as_deref() {
            fs::remove_file(backup).map_err(|error| format!("清理备份失败：{error}"))?;
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[cfg(not(windows))]
pub(super) fn replace_file(temp: &Path, destination: &Path) -> std::io::Result<()> {
    fs::rename(temp, destination)
}

#[cfg(windows)]
pub(super) fn replace_file(temp: &Path, destination: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let temp = temp
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let destination = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let status = unsafe {
        MoveFileExW(
            temp.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if status == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}
