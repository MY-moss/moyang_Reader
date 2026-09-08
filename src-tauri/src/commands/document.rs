use std::path::Path;

pub(super) const IMAGE_EXTENSIONS: [&str; 7] = ["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"];

const MARKDOWN_EXTENSIONS: [&str; 4] = ["md", "markdown", "mdown", "mkd"];
const TEXT_EXTENSIONS: [&str; 3] = ["txt", "text", "log"];
const DOCX_EXTENSIONS: [&str; 1] = ["docx"];
const PDF_EXTENSIONS: [&str; 1] = ["pdf"];

pub(super) fn document_kind(path: &Path) -> Option<&'static str> {
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())?;

    if MARKDOWN_EXTENSIONS.contains(&extension.as_str()) {
        return Some("markdown");
    }
    if TEXT_EXTENSIONS.contains(&extension.as_str()) {
        return Some("text");
    }
    if DOCX_EXTENSIONS.contains(&extension.as_str()) {
        return Some("docx");
    }
    if PDF_EXTENSIONS.contains(&extension.as_str()) {
        return Some("pdf");
    }
    if IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Some("image");
    }
    None
}

pub(super) fn is_supported_text_path(path: &Path) -> bool {
    matches!(document_kind(path), Some("markdown" | "text"))
}

pub(super) fn is_supported_document_path(path: &Path) -> bool {
    document_kind(path).is_some()
}

pub(super) fn markdown_extension(extension: Option<&str>) -> bool {
    extension
        .map(|value| MARKDOWN_EXTENSIONS.contains(&value.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

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

fn reject_suspicious_binary_text(text: String) -> Result<String, String> {
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

fn push_unique(values: &mut Vec<String>, value: String) {
    if !value.is_empty()
        && !values
            .iter()
            .any(|existing| existing.eq_ignore_ascii_case(&value))
    {
        values.push(value);
    }
}

pub(super) fn extract_wiki_links(source: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut cursor = 0;

    while let Some(start_offset) = source[cursor..].find("[[") {
        let start = cursor + start_offset;
        let content_start = start + 2;
        let Some(end_offset) = source[content_start..].find("]]") else {
            break;
        };
        let end = content_start + end_offset;
        let is_embed = start > 0 && source.as_bytes().get(start - 1) == Some(&b'!');
        if !is_embed {
            let target = source[content_start..end]
                .split('|')
                .next()
                .unwrap_or_default()
                .trim();
            push_unique(&mut links, target.to_string());
        }
        cursor = end + 2;
    }

    links
}

fn is_external_link(target: &str) -> bool {
    let target = target.trim().to_ascii_lowercase();
    target.starts_with("http://")
        || target.starts_with("https://")
        || target.starts_with("mailto:")
        || target.starts_with("data:")
        || target.starts_with('#')
        || target.starts_with("//")
}

fn markdown_link_end(source: &str, content_start: usize) -> Option<usize> {
    let mut depth = 1;
    let mut escaped = false;
    for (offset, character) in source[content_start..].char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if character == '\\' {
            escaped = true;
            continue;
        }
        if character == '(' {
            depth += 1;
        } else if character == ')' {
            depth -= 1;
            if depth == 0 {
                return Some(content_start + offset);
            }
        }
    }
    None
}

pub(super) fn extract_markdown_links(source: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut cursor = 0;

    while let Some(marker_offset) = source[cursor..].find("](") {
        let marker = cursor + marker_offset;
        let is_image = source[..marker]
            .rfind('[')
            .and_then(|open| {
                open.checked_sub(1)
                    .map(|before| source.as_bytes()[before] == b'!')
            })
            .unwrap_or(false);
        let content_start = marker + 2;
        let Some(end) = markdown_link_end(source, content_start) else {
            break;
        };
        let mut target = source[content_start..end].trim();
        if let Some(stripped) = target.strip_prefix('<') {
            target = stripped.split('>').next().unwrap_or_default().trim();
        } else {
            target = target.split_whitespace().next().unwrap_or_default();
        }

        if !is_image && !target.is_empty() && !is_external_link(target) {
            push_unique(&mut links, target.to_string());
        }
        cursor = end + 1;
    }

    links
}

pub(super) fn extract_links(source: &str) -> Vec<String> {
    let mut links = extract_wiki_links(source);
    for link in extract_markdown_links(source) {
        push_unique(&mut links, link);
    }
    links
}

fn clean_tag(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_matches(|character: char| {
        matches!(
            character,
            ',' | '.'
                | ';'
                | ':'
                | '，'
                | '。'
                | '；'
                | '：'
                | ')'
                | '）'
                | ']'
                | '】'
                | '"'
                | '\''
        )
    });
    let tag = trimmed.trim_start_matches('#').trim();
    if tag.is_empty() || tag.starts_with('#') {
        return None;
    }
    if tag
        .chars()
        .all(|character| character.is_alphanumeric() || matches!(character, '_' | '-' | '/'))
    {
        Some(tag.to_string())
    } else {
        None
    }
}

pub(super) fn extract_tags(source: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let mut in_code_fence = false;

    for line in source.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_code_fence = !in_code_fence;
            continue;
        }
        if in_code_fence {
            continue;
        }

        if let Some(raw_tags) = trimmed.strip_prefix("tags:") {
            let raw_tags = raw_tags
                .trim()
                .trim_start_matches('[')
                .trim_end_matches(']');
            for raw_tag in raw_tags.split(',') {
                if let Some(tag) = clean_tag(raw_tag) {
                    push_unique(&mut tags, tag);
                }
            }
        }

        if trimmed.starts_with('#') && !trimmed.starts_with("# ") && !trimmed.starts_with("#\t") {
            for token in trimmed.split_whitespace() {
                if token.starts_with('#') && !token.starts_with("##") {
                    if let Some(tag) = clean_tag(token) {
                        push_unique(&mut tags, tag);
                    }
                }
            }
        }
    }

    tags
}

fn fallback_title(file_name: &str) -> String {
    file_name
        .rsplit_once('.')
        .map(|(stem, _)| stem.to_string())
        .unwrap_or_else(|| file_name.to_string())
}

fn clean_title(value: &str) -> Option<String> {
    let title = value
        .trim()
        .trim_end_matches('#')
        .trim()
        .trim_matches(|character| matches!(character, '"' | '\''))
        .trim();
    (!title.is_empty()).then(|| title.to_string())
}

fn atx_title(line: &str) -> Option<String> {
    let trimmed = line.trim_start();
    let hash_count = trimmed
        .chars()
        .take_while(|character| *character == '#')
        .count();
    if !(1..=6).contains(&hash_count) {
        return None;
    }

    let rest = trimmed.get(hash_count..)?;
    if !rest
        .as_bytes()
        .first()
        .is_some_and(|character| *character == b' ' || *character == b'\t')
    {
        return None;
    }
    clean_title(rest)
}

fn is_setext_underline(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.len() >= 3
        && (trimmed.chars().all(|character| character == '=')
            || trimmed.chars().all(|character| character == '-'))
}

pub(super) fn extract_title(source: &str, fallback_name: &str) -> String {
    let lines = source.lines().collect::<Vec<_>>();
    if let Some(first) = lines.first().map(|line| line.trim()) {
        if first == "---" || first == "+++" {
            for line in lines.iter().skip(1) {
                let trimmed = line.trim();
                if trimmed == first {
                    break;
                }
                if let Some(value) = trimmed.strip_prefix("title:").and_then(clean_title) {
                    return value;
                }
            }
        }
    }

    for (index, line) in lines.iter().enumerate() {
        if let Some(title) = atx_title(line) {
            return title;
        }
        if index + 1 < lines.len()
            && !line.trim().is_empty()
            && is_setext_underline(lines[index + 1])
        {
            if let Some(title) = clean_title(line) {
                return title;
            }
        }
    }

    fallback_title(fallback_name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn recognizes_supported_document_extensions_case_insensitively() {
        assert!(is_supported_document_path(Path::new("notes/Today.MD")));
        assert!(is_supported_document_path(Path::new(
            "notes/Today.markdown"
        )));
        assert!(is_supported_text_path(Path::new("notes/Today.txt")));
        assert!(is_supported_document_path(Path::new("notes/Guide.DOCX")));
        assert!(is_supported_document_path(Path::new("notes/Guide.PDF")));
        assert!(is_supported_document_path(Path::new("notes/Cover.PNG")));
        assert!(!is_supported_document_path(Path::new("notes/Guide.doc")));
    }

    #[test]
    fn decodes_utf16_and_rejects_incomplete_trailing_bytes() {
        assert_eq!(
            decode_text(&[0xFF, 0xFE, b'A', 0]).expect("decode UTF-16LE"),
            "A"
        );
        assert_eq!(
            decode_text(&[0xFE, 0xFF, 0, b'A']).expect("decode UTF-16BE"),
            "A"
        );
        assert!(decode_text(&[0xFF, 0xFE, b'A']).is_err());
        assert_eq!(
            decode_text("你好".as_bytes()).expect("decode UTF-8"),
            "你好"
        );
        assert_eq!(
            decode_text(&[0xEF, 0xBB, 0xBF, b'B']).expect("decode UTF-8 BOM"),
            "B"
        );
        let (gb18030, _, had_errors) = encoding_rs::GB18030.encode("你好，世界");
        assert!(!had_errors);
        assert_eq!(
            decode_text(gb18030.as_ref()).expect("decode GB18030"),
            "你好，世界"
        );
        assert!(decode_text(&[0, 1, 2, 3]).is_err());
        assert!(decode_text(&[0xFF, 0xD8, 0xFF, 0xE0, 0, 0x01]).is_err());
    }

    #[test]
    fn extracts_wiki_links_without_embeds_or_aliases() {
        assert_eq!(
            extract_wiki_links("[[Target|别名]] ![[Cover.png]] [[target]] [[Second#Section]]"),
            vec!["Target", "Second#Section"]
        );
    }

    #[test]
    fn extracts_nested_markdown_links_and_skips_external_or_image_links() {
        assert_eq!(
            extract_markdown_links(
                "[Second](Second.MARKDOWN#Heading) [Guide](docs/Guide(2026).md) [Space](<folder/with space.md>) [web](https://example.com) ![cover](Cover.png)"
            ),
            vec![
                "Second.MARKDOWN#Heading",
                "docs/Guide(2026).md",
                "folder/with space.md"
            ]
        );
    }

    #[test]
    fn extracts_tags_from_frontmatter_style_lines_and_headings() {
        assert_eq!(
            extract_tags(
                "tags: [front, nested/path]\n\n#topic #second\n\n[[README]] #inline\n\n```md\n#inside-code\n```"
            ),
            vec!["front", "nested/path", "topic", "second"]
        );
    }

    #[test]
    fn ignores_heading_text_and_non_tag_words_in_tag_lines() {
        assert_eq!(
            extract_tags("## 背景\n### 安装步骤\n#tag 说明文字\n##Multi Word\n#topic #second"),
            vec!["tag", "topic", "second"]
        );
    }

    #[test]
    fn cleans_valid_tags_and_rejects_invalid_values() {
        assert_eq!(clean_tag(" #topic, "), Some("topic".to_string()));
        assert_eq!(clean_tag("#nested/path"), Some("nested/path".to_string()));
        assert_eq!(clean_tag("#not.valid"), None);
        assert_eq!(clean_tag("#bad#"), None);
        assert_eq!(clean_tag(""), None);
    }

    #[test]
    fn extracts_titles_from_frontmatter_atx_and_setext_headings() {
        assert_eq!(
            extract_title("## Second-level title", "fallback.md"),
            "Second-level title"
        );
        assert_eq!(
            extract_title("Setext title\n===\n", "fallback.md"),
            "Setext title"
        );
        assert_eq!(
            extract_title(
                "---\ntitle: \"Frontmatter title\"\n---\n# Heading",
                "fallback.md"
            ),
            "Frontmatter title"
        );
        assert_eq!(extract_title("body only", "fallback.md"), "fallback");
    }
}
