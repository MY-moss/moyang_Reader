#[cfg(windows)]
use super::export_pdf_file_windows;
use super::{
    access_path_key, add_indexed_file_with_limit, authorize_stored_path_inner, clean_tag,
    collect_open_paths, create_markdown_file_inner, create_workspace_folder_inner,
    create_workspace_note_inner, decode_ipc_path, decode_text, delete_workspace_entry_inner,
    duplicate_workspace_entry_inner, extract_markdown_links, extract_tags, extract_title,
    extract_wiki_links, has_pdf_header, index_workspace_inner, is_supported_document_path,
    is_supported_text_path, is_write_allowed_for_new_path, list_workspace_files_inner,
    path_exists_inner, persistent_search_index_path, prune_search_entries, read_text_file_inner,
    refresh_workspace_inner, rename_workspace_entry_inner, search_workspace_inner,
    search_workspace_inner_with_cache, search_workspace_inner_with_cache_and_persistence,
    should_skip_directory, sorted_workspace_directories, source_search_tokens, touch_indexed_file,
    write_bytes_file_inner, write_text_file_inner, AccessRegistry, CachedSearchIndex,
    CachedSearchText, OpenPath, OpenPathKind, WorkspaceFile, WorkspaceSearchCache,
    MAX_READ_FILE_BYTES, MAX_SEARCH_CACHE_BYTES, MAX_SEARCH_CACHE_ENTRIES,
    MAX_SEARCH_INDEX_TOKENS_PER_FILE, MAX_SEARCH_INDEX_TOKEN_CHARS, TEMP_FILE_COUNTER,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};

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
fn recognizes_pdf_file_signature() {
    assert!(has_pdf_header(b"%PDF-1.7\n"));
    assert!(!has_pdf_header(b"PDF-1.7\n"));
    assert!(!has_pdf_header(b"%PDF"));
}

#[cfg(windows)]
#[test]
fn exports_pdf_file_with_the_windows_edge_renderer() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-pdf-test-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let output = root.join("export.pdf");
    fs::create_dir_all(&root).expect("create PDF export test directory");

    export_pdf_file_windows(
            output.clone(),
            "<!doctype html><html><head><meta charset=\"utf-8\"><style>body{font-family:Arial}</style></head><body><h1>PDF smoke</h1><p>Windows export.</p></body></html>",
        )
        .expect("Windows Edge should create a PDF file");

    let bytes = fs::read(&output).expect("read generated PDF");
    assert!(bytes.len() > 100);
    assert!(has_pdf_header(&bytes));
    assert!(bytes.windows(5).any(|window| window == b"%%EOF"));

    fs::remove_dir_all(root).expect("remove PDF export test directory");
}

#[test]
fn tokenizes_ascii_words_and_cjk_bigrams() {
    let tokens =
        source_search_tokens("Alpha alpha 42 中文搜索 文档").expect("tokenize search source");

    assert!(tokens.contains("alpha"));
    assert!(tokens.contains("42"));
    assert!(tokens.contains("中文"));
    assert!(tokens.contains("文搜"));
    assert!(tokens.contains("搜索"));
    assert!(tokens.contains("文档"));
    assert!(!tokens.contains("al"));
}

#[test]
fn bounds_search_token_length_before_indexing() {
    let source = "x".repeat(MAX_SEARCH_INDEX_TOKEN_CHARS + 1);

    assert!(source_search_tokens(&source).is_none());
}

#[test]
fn collects_existing_workspaces_and_supported_documents() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-open-paths-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let workspace = root.join("vault");
    let note = workspace.join("note.md");
    let unsupported = workspace.join("note.doc");
    fs::create_dir_all(&workspace).expect("create open paths workspace");
    fs::write(&note, "note").expect("write open paths note");
    fs::write(&unsupported, "unsupported").expect("write unsupported open path");

    let paths = collect_open_paths(vec![
        workspace.to_string_lossy().into_owned(),
        note.to_string_lossy().into_owned(),
        unsupported.to_string_lossy().into_owned(),
        root.join("missing.md").to_string_lossy().into_owned(),
    ]);

    assert_eq!(paths.len(), 2);
    assert!(paths.iter().any(
        |path| path.path == workspace.to_string_lossy() && path.kind == OpenPathKind::Workspace
    ));
    assert!(paths
        .iter()
        .any(|path| path.path == note.to_string_lossy() && path.kind == OpenPathKind::Document));

    fs::remove_dir_all(root).expect("remove open paths workspace");
}

#[test]
fn serializes_open_path_kind_for_the_frontend_bridge() {
    let paths = vec![OpenPath {
        path: "C:\\Notes\\vault".to_string(),
        kind: OpenPathKind::Workspace,
    }];
    let value = serde_json::to_value(paths).expect("serialize open paths");

    assert_eq!(value[0]["path"], "C:\\Notes\\vault");
    assert_eq!(value[0]["kind"], "workspace");
}

#[test]
fn access_registry_keeps_document_reads_wider_than_writes() {
    let root = std::env::temp_dir().join(format!("moyang-reader-access-{}", std::process::id()));
    let vault = root.join("vault");
    let note = vault.join("note.md");
    let attachment = vault.join("image.png");
    let sibling = vault.join("other.md");
    let outside = root.join("outside.md");
    fs::create_dir_all(&vault).expect("create access test directory");
    fs::write(&note, "note").expect("write access test note");
    fs::write(&attachment, [0_u8, 1, 2]).expect("write access test attachment");

    let access = AccessRegistry::default();
    access
        .register_document_path(&note)
        .expect("register selected document");

    assert!(access.is_read_allowed(&note));
    assert!(access.is_read_allowed(&attachment));
    assert!(access.is_read_allowed(&sibling));
    assert!(access.is_write_allowed(&note));
    assert!(!access.is_write_allowed(&sibling));
    assert!(!access.is_read_allowed(&outside));
    assert!(!access.is_write_allowed(&outside));
    assert!(!access.is_workspace_allowed(&vault));

    access
        .register_workspace_path(&vault)
        .expect("register selected directory");
    assert!(access.is_write_allowed(&sibling));
    assert!(access.is_workspace_allowed(&vault));

    fs::remove_dir_all(root).expect("remove access test directory");
}

#[test]
fn allows_new_files_below_an_authorized_workspace() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-new-file-access-{}",
        std::process::id()
    ));
    let vault = root.join("vault");
    let asset = vault.join("assets").join("clip.png");
    fs::create_dir_all(&vault).expect("create new file access workspace");

    let access = AccessRegistry::default();
    access
        .register_workspace_path(&vault)
        .expect("register new file access workspace");

    assert!(is_write_allowed_for_new_path(&access, &asset));
    assert!(!is_write_allowed_for_new_path(
        &access,
        &root.join("outside").join("clip.png")
    ));

    fs::remove_dir_all(root).expect("remove new file access workspace");
}

#[test]
fn allows_writes_to_an_explicitly_authorized_new_file() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-explicit-new-file-access-{}",
        std::process::id()
    ));
    let export_dir = root.join("exports");
    let target = export_dir.join("reading-library.html");
    fs::create_dir_all(&export_dir).expect("create explicit new file access directory");

    let access = AccessRegistry::default();
    access
        .register_path(&target)
        .expect("register explicitly selected save path");

    assert!(is_write_allowed_for_new_path(&access, &target));
    assert!(!is_write_allowed_for_new_path(
        &access,
        &export_dir.join("unselected.html")
    ));

    fs::remove_dir_all(root).expect("remove explicit new file access directory");
}

#[test]
fn creates_parent_directories_for_binary_asset_writes() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-binary-parent-{}",
        std::process::id()
    ));
    let path = root.join("assets").join("clip.png");

    write_bytes_file_inner(path.clone(), &[0, 1, 2, 3], false).expect("write binary asset");
    assert_eq!(fs::read(path).expect("read binary asset"), vec![0, 1, 2, 3]);

    fs::remove_dir_all(root).expect("remove binary parent workspace");
}

#[test]
fn authorizes_existing_stored_documents_and_workspaces_only() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-stored-path-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let workspace = root.join("vault");
    let note = workspace.join("note.md");
    let unsupported = workspace.join("note.doc");
    fs::create_dir_all(&workspace).expect("create stored path workspace");
    fs::write(&note, "note").expect("write stored path note");
    fs::write(&unsupported, "unsupported").expect("write unsupported document");

    let access = AccessRegistry::default();
    let authorized_note = authorize_stored_path_inner(note.clone(), false, &access)
        .expect("authorize stored document");
    assert_eq!(
        fs::canonicalize(&authorized_note).expect("canonicalize authorized document"),
        fs::canonicalize(&note).expect("canonicalize expected document")
    );
    assert!(access.is_read_allowed(&note));
    assert!(access.is_write_allowed(&note));
    assert!(authorize_stored_path_inner(unsupported, false, &access).is_err());
    assert!(authorize_stored_path_inner(root.join("missing.md"), false, &access).is_err());

    let authorized_workspace = authorize_stored_path_inner(workspace.clone(), true, &access)
        .expect("authorize stored workspace");
    assert_eq!(
        fs::canonicalize(&authorized_workspace).expect("canonicalize authorized workspace"),
        fs::canonicalize(&workspace).expect("canonicalize expected workspace")
    );
    assert!(access.is_workspace_allowed(&workspace));
    assert!(authorize_stored_path_inner(note, true, &access).is_err());

    fs::remove_dir_all(root).expect("remove stored path workspace");
}

#[test]
fn replaces_existing_file_and_cleans_backup_after_success() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-atomic-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.load(Ordering::Relaxed)
    ));
    fs::create_dir_all(&root).expect("create atomic test directory");
    let path = root.join("note.md");
    fs::write(&path, "old").expect("write original file");

    write_text_file_inner(path.clone(), "new".to_string()).expect("replace file");

    assert_eq!(
        fs::read_to_string(&path).expect("read replaced file"),
        "new"
    );
    assert!(!root.join(".note.md.moyang.bak").exists());
    fs::remove_dir_all(root).expect("remove atomic test directory");
}

#[test]
fn decodes_unicode_paths_for_raw_binary_ipc() {
    assert_eq!(
        decode_ipc_path("C%3A%5CNotes%5C%E4%BD%A0%E5%A5%BD.docx").expect("decode encoded path"),
        PathBuf::from("C:\\Notes\\你好.docx")
    );
    assert!(decode_ipc_path("%FF").is_err());
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
fn rejects_binary_bytes_from_a_markdown_named_file() {
    let path = std::env::temp_dir().join(format!(
        "moyang-reader-binary-md-{}-{}.md",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::write(&path, [0_u8, 1, 2, 3]).expect("write binary markdown fixture");

    let error = read_text_file_inner(path.clone()).expect_err("reject binary markdown fixture");
    assert!(error.contains("疑似二进制"));
    fs::remove_file(path).expect("remove binary markdown fixture");
}

#[test]
fn extracts_titles_from_frontmatter_atx_and_setext_headings() {
    let file = WorkspaceFile {
        path: "C:/Notes/fallback.md".to_string(),
        name: "fallback.md".to_string(),
        relative_path: "fallback.md".to_string(),
        size: 0,
        kind: "markdown".to_string(),
    };
    assert_eq!(
        extract_title("## Second-level title", &file),
        "Second-level title"
    );
    assert_eq!(extract_title("Setext title\n===\n", &file), "Setext title");
    assert_eq!(
        extract_title("---\ntitle: \"Frontmatter title\"\n---\n# Heading", &file),
        "Frontmatter title"
    );
    assert_eq!(extract_title("body only", &file), "fallback");
}

#[test]
fn rejects_text_files_over_the_read_limit() {
    let path = std::env::temp_dir().join(format!("moyang-reader-large-{}", std::process::id()));
    let file = fs::File::create(&path).expect("create sparse file");
    file.set_len(MAX_READ_FILE_BYTES + 1)
        .expect("grow sparse file");
    let error = read_text_file_inner(path.clone()).expect_err("reject large file");
    assert!(error.contains("100 MB"));
    fs::remove_file(path).expect("remove sparse file");
}

#[test]
fn skips_generated_and_hidden_directories() {
    assert!(should_skip_directory(Path::new("vault/.git")));
    assert!(should_skip_directory(Path::new("vault/node_modules")));
    assert!(!should_skip_directory(Path::new("vault/Notes")));
}

#[test]
fn lists_and_searches_markdown_files_without_generated_directories() {
    let root = std::env::temp_dir().join(format!("moyang-reader-test-{}", std::process::id()));
    let notes = root.join("notes");
    let generated = root.join("node_modules");
    fs::create_dir_all(&notes).expect("create notes directory");
    fs::create_dir_all(&generated).expect("create generated directory");
    fs::write(root.join("README.md"), "入口文档").expect("write root document");
    fs::write(notes.join("Second.MARKDOWN"), "包含needle的内容").expect("write nested document");
    fs::write(notes.join("plain.txt"), "needle in text").expect("write text document");
    fs::write(notes.join("Guide.docx"), [0_u8, 1, 2]).expect("write docx document");
    fs::write(notes.join("Guide.pdf"), [3_u8, 4, 5]).expect("write pdf document");
    fs::write(notes.join("Cover.png"), [6_u8, 7, 8]).expect("write image attachment");
    fs::write(
            notes.join("Linked.md"),
            "# Linked note\n\ntags: [front]\n\n#topic\n\n[[README]] #inline\n\n[Second](Second.MARKDOWN#Heading) [Guide](docs/Guide(2026).md) ![cover](Cover.png) [web](https://example.com)",
        )
        .expect("write linked document");
    fs::write(generated.join("ignored.md"), "needle").expect("write ignored document");

    let root_string = root.to_string_lossy().into_owned();
    let files = list_workspace_files_inner(PathBuf::from(root_string.clone()))
        .expect("list workspace files");
    assert_eq!(files.len(), 7);
    assert!(files
        .iter()
        .any(|file| file.relative_path == "notes/Second.MARKDOWN"));
    assert!(files.iter().any(|file| file.kind == "docx"));
    assert!(files.iter().any(|file| file.kind == "pdf"));
    assert!(files.iter().any(|file| file.kind == "image"));
    let index = index_workspace_inner(PathBuf::from(root_string.clone())).expect("index workspace");
    let linked = index
        .iter()
        .find(|entry| entry.file.name == "Linked.md")
        .expect("find linked document");
    assert_eq!(linked.title, "Linked note");
    assert_eq!(
        linked.links,
        vec!["README", "Second.MARKDOWN#Heading", "docs/Guide(2026).md"]
    );
    assert!(linked.tags.iter().any(|tag| tag == "front"));
    assert!(linked.tags.iter().any(|tag| tag == "topic"));
    assert!(!linked.tags.iter().any(|tag| tag == "inline"));
    assert!(path_exists_inner(&root.join("README.md")));
    assert!(path_exists_inner(&root));
    assert!(!path_exists_inner(&root.join("missing.md")));

    let created = create_markdown_file_inner(
        root_string.clone(),
        notes.join("Linked.md").to_string_lossy().into_owned(),
        "Created Note#Section".to_string(),
    )
    .expect("create markdown file");
    assert_eq!(
        fs::canonicalize(&created).expect("canonicalize created note"),
        fs::canonicalize(notes.join("Created Note.md")).expect("canonicalize expected note")
    );
    assert_eq!(
        fs::read_to_string(&created).expect("read created note"),
        "# Created Note\n\n"
    );
    assert!(create_markdown_file_inner(
        root_string.clone(),
        notes.join("Linked.md").to_string_lossy().into_owned(),
        "../outside".to_string(),
    )
    .is_err());
    assert!(create_markdown_file_inner(
        root_string.clone(),
        notes.join("Linked.md").to_string_lossy().into_owned(),
        "Created Note".to_string(),
    )
    .is_err());

    let results = search_workspace_inner(PathBuf::from(root_string), "needle".to_string())
        .expect("search workspace");
    assert_eq!(results.len(), 2);
    assert!(results
        .iter()
        .any(|result| result.file.name == "Second.MARKDOWN"));
    assert!(results.iter().any(|result| result.file.name == "plain.txt"));

    fs::remove_dir_all(root).expect("remove test workspace");
}

#[test]
fn reuses_search_text_cache_and_invalidates_changed_scopes() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-search-cache-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&root).expect("create search cache workspace");
    let note = root.join("note.txt");
    fs::write(&note, "first needle").expect("write search cache note");

    let cache = WorkspaceSearchCache::default();
    cache.enable_event_driven_root(&root);
    let first = search_workspace_inner_with_cache(root.clone(), "first".to_string(), &cache)
        .expect("search first query");
    assert_eq!(first.len(), 1);
    let cache_key = access_path_key(&note);
    assert_eq!(
        cache
            .entries
            .lock()
            .expect("lock search cache")
            .get(&cache_key)
            .map(|entry| entry.source.as_str()),
        Some("first needle")
    );
    let root_key = access_path_key(&root);
    assert_eq!(
        cache
            .file_lists
            .lock()
            .expect("lock workspace file cache")
            .get(&root_key)
            .map(|entry| entry.files.len()),
        Some(1)
    );

    let cached_query =
        search_workspace_inner_with_cache(root.clone(), "needle".to_string(), &cache)
            .expect("search cached query");
    assert_eq!(cached_query.len(), 1);
    let metadata_checks_after_first_query = cache.metadata_checks.load(Ordering::Relaxed);
    assert_eq!(metadata_checks_after_first_query, 1);
    let directory_stamp_checks_after_first_query =
        cache.directory_stamp_checks.load(Ordering::Relaxed);

    let unchanged_query =
        search_workspace_inner_with_cache(root.clone(), "first".to_string(), &cache)
            .expect("search unchanged index query");
    assert_eq!(unchanged_query.len(), 1);
    assert_eq!(
        cache.metadata_checks.load(Ordering::Relaxed),
        metadata_checks_after_first_query
    );
    assert_eq!(
        cache.directory_stamp_checks.load(Ordering::Relaxed),
        directory_stamp_checks_after_first_query
    );

    let added = root.join("added.md");
    fs::write(&added, "added needle").expect("add search cache note");
    cache.invalidate_scopes(&[root.to_string_lossy().into_owned()]);
    assert!(cache
        .entries
        .lock()
        .expect("lock invalidated search cache")
        .is_empty());
    assert!(cache
        .file_lists
        .lock()
        .expect("lock invalidated workspace file cache")
        .is_empty());

    fs::write(&note, "second needle").expect("update search cache note");
    let updated = search_workspace_inner_with_cache(root.clone(), "second".to_string(), &cache)
        .expect("search updated query");
    assert_eq!(updated.len(), 1);
    assert!(cache.metadata_checks.load(Ordering::Relaxed) > metadata_checks_after_first_query);
    let added_result = search_workspace_inner_with_cache(root.clone(), "added".to_string(), &cache)
        .expect("search newly added note");
    assert_eq!(added_result.len(), 1);

    fs::remove_dir_all(root).expect("remove search cache workspace");
}

#[test]
fn uses_search_index_candidates_without_changing_substring_results() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-search-index-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&root).expect("create search index workspace");
    fs::write(root.join("first.md"), "alpha Needle content").expect("write indexed match");
    fs::write(root.join("second.md"), "unrelated content").expect("write indexed non-match");
    fs::write(root.join("third.md"), "needless content").expect("write substring match");

    let cache = WorkspaceSearchCache::default();
    cache.enable_event_driven_root(&root);
    let indexed = search_workspace_inner_with_cache(root.clone(), "eedl".to_string(), &cache)
        .expect("search indexed substring");
    assert_eq!(
        indexed
            .iter()
            .map(|result| result.file.name.as_str())
            .collect::<Vec<_>>(),
        vec!["first.md", "third.md"]
    );

    cache
        .entries
        .lock()
        .expect("lock search text cache")
        .clear();
    cache.text_reads.store(0, Ordering::Relaxed);
    let repeated_substring =
        search_workspace_inner_with_cache(root.clone(), "eedl".to_string(), &cache)
            .expect("search repeated indexed substring");
    assert_eq!(repeated_substring.len(), 2);
    assert_eq!(cache.text_reads.load(Ordering::Relaxed), 2);

    let exact_candidates = cache
        .content_candidates(&root, "needle")
        .expect("exact ASCII word should use the index");
    assert_eq!(exact_candidates.len(), 2);
    assert!(exact_candidates.contains(&access_path_key(&root.join("first.md"))));
    assert!(exact_candidates.contains(&access_path_key(&root.join("third.md"))));

    let short_query = search_workspace_inner_with_cache(root.clone(), "a".to_string(), &cache)
        .expect("search short query");
    assert!(short_query
        .iter()
        .any(|result| result.file.name == "first.md"));

    fs::remove_dir_all(root).expect("remove search index workspace");
}

#[test]
fn keeps_unreadable_text_files_in_search_fallback() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-search-unreadable-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&root).expect("create unreadable search workspace");
    fs::write(root.join("indexed.md"), "needle in an indexed note")
        .expect("write indexed unreadable fallback note");
    fs::write(root.join("broken.md"), b"\0\0\0\0").expect("write unreadable fallback note");

    let cache = WorkspaceSearchCache::default();
    let results = search_workspace_inner_with_cache(root.clone(), "needle".to_string(), &cache)
        .expect("search with unreadable fallback note");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file.name, "indexed.md");

    let root_key = access_path_key(&root);
    let indexes = cache
        .search_indexes
        .lock()
        .expect("lock unreadable fallback index");
    assert!(indexes
        .get(&root_key)
        .expect("search index should exist")
        .unindexed_files
        .contains(&access_path_key(&root.join("broken.md"))));

    fs::remove_dir_all(root).expect("remove unreadable search workspace");
}

#[test]
fn reuses_event_driven_index_for_5000_document_workspace() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-search-large-workspace-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&root).expect("create large search workspace");
    for index in 0..5_000 {
        let mut source = String::with_capacity(2 * 1024);
        if index == 4_999 {
            source.push_str("needle in the target note\n中文文档阅读器\n");
        } else {
            source.push_str("unrelated document content\n普通阅读文档\n");
        }
        while source.len() < 2 * 1024 {
            source.push_str("mixed English and 中文阅读 content for a realistic note.\n");
        }
        fs::write(root.join(format!("note-{index:04}.md")), source)
            .expect("write large search note");
    }

    let cache = WorkspaceSearchCache::default();
    cache.enable_event_driven_root(&root);
    let first = search_workspace_inner_with_cache(root.clone(), "needle".to_string(), &cache)
        .expect("search large workspace");
    assert_eq!(first.len(), 1);
    assert_eq!(first[0].file.name, "note-4999.md");
    let metadata_checks_after_first_query = cache.metadata_checks.load(Ordering::Relaxed);
    let directory_stamp_checks_after_first_query =
        cache.directory_stamp_checks.load(Ordering::Relaxed);
    assert_eq!(metadata_checks_after_first_query, 5_000);

    cache
        .entries
        .lock()
        .expect("lock large search text cache")
        .clear();
    cache.text_reads.store(0, Ordering::Relaxed);
    let repeated = search_workspace_inner_with_cache(root.clone(), "needle".to_string(), &cache)
        .expect("repeat search large workspace");
    assert_eq!(repeated.len(), 1);
    assert_eq!(cache.text_reads.load(Ordering::Relaxed), 1);
    assert_eq!(
        cache.metadata_checks.load(Ordering::Relaxed),
        metadata_checks_after_first_query
    );
    assert_eq!(
        cache.directory_stamp_checks.load(Ordering::Relaxed),
        directory_stamp_checks_after_first_query
    );

    let mut query_durations = Vec::with_capacity(20);
    for _ in 0..20 {
        let started = Instant::now();
        let repeated =
            search_workspace_inner_with_cache(root.clone(), "needle".to_string(), &cache)
                .expect("measure warm search latency");
        query_durations.push(started.elapsed());
        assert_eq!(repeated.len(), 1);
    }
    query_durations.sort_unstable();
    let p95_index = ((query_durations.len() * 95).saturating_add(99) / 100).saturating_sub(1);
    let p95 = query_durations[p95_index];
    eprintln!("5000-document warm search P95: {} ms", p95.as_millis());
    assert!(
        p95 < Duration::from_millis(100),
        "5000-document warm search P95 exceeded the 100 ms target: {} ms",
        p95.as_millis()
    );

    fs::remove_dir_all(root).expect("remove large search workspace");
}

#[test]
fn searches_cjk_queries_with_bigram_candidates() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-search-cjk-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&root).expect("create CJK search workspace");
    fs::write(root.join("reader.md"), "本地文档阅读器").expect("write CJK match");
    fs::write(root.join("other.md"), "本地工具").expect("write CJK non-match");

    let cache = WorkspaceSearchCache::default();
    let results = search_workspace_inner_with_cache(root.clone(), "文档".to_string(), &cache)
        .expect("search CJK query");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file.name, "reader.md");
    let candidates = cache
        .content_candidates(&root, "文档")
        .expect("CJK query should use the index");
    assert_eq!(candidates.len(), 1);

    fs::remove_dir_all(root).expect("remove CJK search workspace");
}

#[test]
fn falls_back_only_for_files_that_exceed_index_token_limits() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-search-fallback-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&root).expect("create search fallback workspace");
    fs::write(root.join("indexed.md"), "needle in an indexed note")
        .expect("write indexed fallback note");
    fs::write(
        root.join("unindexed.md"),
        format!("{} needle", "x".repeat(MAX_SEARCH_INDEX_TOKEN_CHARS + 1)),
    )
    .expect("write unindexed fallback note");
    let cache_directory = std::env::temp_dir().join(format!(
        "moyang-reader-search-fallback-cache-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));

    let cache = WorkspaceSearchCache::default();
    let results = search_workspace_inner_with_cache_and_persistence(
        root.clone(),
        "needle".to_string(),
        &cache,
        Some(&cache_directory),
    )
    .expect("search fallback query");
    let names = results
        .into_iter()
        .map(|result| result.file.name)
        .collect::<Vec<_>>();

    assert_eq!(names, vec!["indexed.md", "unindexed.md"]);
    let root_key = access_path_key(&root);
    let indexes = cache
        .search_indexes
        .lock()
        .expect("lock fallback search index");
    let index = indexes.get(&root_key).expect("search index should exist");
    assert_eq!(index.unindexed_files.len(), 1);
    assert!(index
        .unindexed_files
        .contains(&access_path_key(&root.join("unindexed.md"))));

    let persisted_cache = WorkspaceSearchCache::default();
    let persisted_results = search_workspace_inner_with_cache_and_persistence(
        root.clone(),
        "needle".to_string(),
        &persisted_cache,
        Some(&cache_directory),
    )
    .expect("search persisted fallback query");
    assert_eq!(persisted_results.len(), 2);
    assert_eq!(
        persisted_cache
            .search_indexes
            .lock()
            .expect("lock persisted fallback index")
            .get(&root_key)
            .map(|index| index.unindexed_files.len()),
        Some(1)
    );

    fs::remove_dir_all(root).expect("remove search fallback workspace");
    fs::remove_dir_all(cache_directory).expect("remove search fallback cache");
}

#[test]
fn keeps_high_token_count_documents_in_fallback_without_disabling_index() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-search-long-document-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&root).expect("create long document workspace");
    let long_source = (0..=MAX_SEARCH_INDEX_TOKENS_PER_FILE)
        .map(|index| format!("token-{index}"))
        .collect::<Vec<_>>()
        .join(" ");
    fs::write(root.join("long.md"), format!("needle {long_source}")).expect("write long document");
    fs::write(root.join("short.md"), "needle in a short document").expect("write short document");

    let cache = WorkspaceSearchCache::default();
    let results = search_workspace_inner_with_cache(root.clone(), "needle".to_string(), &cache)
        .expect("search long document workspace");
    let names = results
        .into_iter()
        .map(|result| result.file.name)
        .collect::<Vec<_>>();
    assert_eq!(names, vec!["long.md", "short.md"]);

    let index = cache
        .search_indexes
        .lock()
        .expect("lock long document search index")
        .remove(&access_path_key(&root))
        .expect("long document search index should exist");
    assert!(!index.disabled);
    assert!(index
        .unindexed_files
        .contains(&access_path_key(&root.join("long.md"))));
    assert!(!index
        .unindexed_files
        .contains(&access_path_key(&root.join("short.md"))));
    assert!(index
        .postings
        .get("needle")
        .map(|paths| paths.contains(&access_path_key(&root.join("short.md"))))
        .unwrap_or(false));

    fs::remove_dir_all(root).expect("remove long document workspace");
}

#[test]
fn evicts_the_least_recently_used_file_before_falling_back() {
    let mut index = CachedSearchIndex::default();
    let first_tokens = ["alpha"].into_iter().map(str::to_string).collect();

    assert!(add_indexed_file_with_limit(
        &mut index,
        "first.md".to_string(),
        1,
        None,
        first_tokens,
        2,
    ));
    assert_eq!(index.posting_count, 1);

    let second_tokens = ["beta"].into_iter().map(str::to_string).collect();
    assert!(add_indexed_file_with_limit(
        &mut index,
        "second.md".to_string(),
        1,
        None,
        second_tokens,
        2,
    ));
    assert_eq!(index.posting_count, 2);

    touch_indexed_file(&mut index, "first.md");

    let third_tokens = ["gamma"].into_iter().map(str::to_string).collect();
    assert!(add_indexed_file_with_limit(
        &mut index,
        "third.md".to_string(),
        1,
        None,
        third_tokens,
        2,
    ));

    assert_eq!(index.posting_count, 2);
    assert_eq!(
        index.files.get("second.md").map(|file| file.tokens.len()),
        Some(0)
    );
    assert!(index.unindexed_files.contains("second.md"));
    assert_eq!(
        index.files.get("third.md").map(|file| file.tokens.len()),
        Some(1)
    );
    assert!(!index.postings.contains_key("beta"));
    assert!(index.postings.contains_key("gamma"));
    assert!(index.postings.contains_key("alpha"));
}

#[test]
fn keeps_indexed_results_consistent_with_a_linear_scan() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-search-consistency-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&root).expect("create consistency search workspace");

    let words = [
        "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "theta",
    ];
    let mut seed = 0x9e37_79b9_u64;
    for index in 0..96 {
        let word_count = 3 + (seed as usize % 6);
        let mut source = String::new();
        for _ in 0..word_count {
            seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
            source.push_str(words[(seed as usize) % words.len()]);
            source.push(' ');
        }
        if index % 7 == 0 {
            source.push_str("中文文档 ");
        }
        if index % 11 == 0 {
            source.push_str("阅读器 ");
        }
        fs::write(root.join(format!("note-{index:03}.md")), source)
            .expect("write consistency search note");
    }

    let queries = [
        "alpha", "beta", "gamma", "delta", "epsilon", "中文", "文档", "阅读", "eedl", "note-001",
    ];
    let cache = WorkspaceSearchCache::default();
    for query in queries {
        let actual = search_workspace_inner_with_cache(root.clone(), query.to_string(), &cache)
            .expect("search consistency query")
            .into_iter()
            .map(|result| result.file.relative_path)
            .collect::<Vec<_>>();
        let normalized_query = query.to_lowercase();
        let expected = list_workspace_files_inner(root.clone())
            .expect("list consistency search files")
            .into_iter()
            .filter(|file| {
                file.name.to_lowercase().contains(&normalized_query)
                    || fs::read_to_string(&file.path)
                        .map(|source| {
                            source
                                .lines()
                                .any(|line| line.to_lowercase().contains(&normalized_query))
                        })
                        .unwrap_or(false)
            })
            .map(|file| file.relative_path)
            .collect::<Vec<_>>();

        assert_eq!(actual, expected, "search result mismatch for {query}");
    }

    fs::remove_dir_all(root).expect("remove consistency search workspace");
}

#[test]
fn persists_search_index_and_rebuilds_when_snapshot_is_corrupt() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-search-index-persist-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let cache_directory = std::env::temp_dir().join(format!(
        "moyang-reader-search-index-cache-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&root).expect("create persistent search workspace");
    fs::write(root.join("note.md"), "persistent needle").expect("write persistent search note");

    let first_cache = WorkspaceSearchCache::default();
    let first = search_workspace_inner_with_cache_and_persistence(
        root.clone(),
        "needle".to_string(),
        &first_cache,
        Some(&cache_directory),
    )
    .expect("search and persist index");
    assert_eq!(first.len(), 1);
    let snapshot_path = persistent_search_index_path(&cache_directory, &root);
    assert!(snapshot_path.is_file());

    let second_cache = WorkspaceSearchCache::default();
    let reused = search_workspace_inner_with_cache_and_persistence(
        root.clone(),
        "needle".to_string(),
        &second_cache,
        Some(&cache_directory),
    )
    .expect("reuse persisted index");
    assert_eq!(reused.len(), 1);
    assert_eq!(
        second_cache
            .search_indexes
            .lock()
            .expect("lock persisted search index")
            .get(&access_path_key(&root))
            .map(|index| index.files.len()),
        Some(1)
    );

    fs::write(&snapshot_path, b"not valid json").expect("corrupt persisted index");
    let rebuilt_cache = WorkspaceSearchCache::default();
    let rebuilt = search_workspace_inner_with_cache_and_persistence(
        root.clone(),
        "needle".to_string(),
        &rebuilt_cache,
        Some(&cache_directory),
    )
    .expect("rebuild corrupt persisted index");
    assert_eq!(rebuilt.len(), 1);

    fs::remove_dir_all(root).expect("remove persistent search workspace");
    fs::remove_dir_all(cache_directory).expect("remove persistent search cache");
}

#[test]
fn refreshes_search_index_when_file_metadata_changes() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-search-index-refresh-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&root).expect("create search index refresh workspace");
    let note = root.join("note.md");
    fs::write(&note, "first needle").expect("write initial indexed note");

    let cache = WorkspaceSearchCache::default();
    assert_eq!(
        search_workspace_inner_with_cache(root.clone(), "first".to_string(), &cache)
            .expect("search initial index")
            .len(),
        1
    );
    std::thread::sleep(std::time::Duration::from_millis(25));
    fs::write(&note, "second needle").expect("write updated indexed note");

    assert!(
        search_workspace_inner_with_cache(root.clone(), "first".to_string(), &cache)
            .expect("search removed indexed term")
            .is_empty()
    );
    assert_eq!(
        search_workspace_inner_with_cache(root.clone(), "second".to_string(), &cache)
            .expect("search updated indexed term")
            .len(),
        1
    );

    fs::remove_dir_all(root).expect("remove search index refresh workspace");
}

#[test]
fn refreshes_file_list_cache_when_a_nested_directory_changes() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-search-cache-watch-fallback-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir_all(&root).expect("create watch fallback workspace");
    fs::write(root.join("initial.md"), "initial needle").expect("write initial note");

    let cache = WorkspaceSearchCache::default();
    let initial = search_workspace_inner_with_cache(root.clone(), "initial".to_string(), &cache)
        .expect("search initial note");
    assert_eq!(initial.len(), 1);

    std::thread::sleep(std::time::Duration::from_millis(25));
    let nested = root.join("nested");
    fs::create_dir_all(&nested).expect("create nested directory");
    fs::write(nested.join("added.md"), "added needle").expect("write added note");

    let added = search_workspace_inner_with_cache(root.clone(), "added".to_string(), &cache)
        .expect("search added note after directory change");
    assert_eq!(added.len(), 1);
    assert_eq!(added[0].file.relative_path, "nested/added.md");

    fs::remove_dir_all(root).expect("remove watch fallback workspace");
}

#[test]
fn bounds_search_cache_entries_and_memory_with_lru_eviction() {
    let cache = WorkspaceSearchCache::default();
    let mut entries = cache.entries.lock().expect("lock search cache");
    for index in 0..MAX_SEARCH_CACHE_ENTRIES {
        entries.insert(
            format!("note-{index}"),
            CachedSearchText {
                size: 1,
                modified: None,
                source: "x".to_string(),
                memory_bytes: 1,
                last_used: index as u64,
            },
        );
    }
    entries.insert(
        "large".to_string(),
        CachedSearchText {
            size: MAX_SEARCH_CACHE_BYTES,
            modified: None,
            source: "large".to_string(),
            memory_bytes: MAX_SEARCH_CACHE_BYTES,
            last_used: MAX_SEARCH_CACHE_ENTRIES as u64,
        },
    );

    prune_search_entries(&mut entries);

    assert_eq!(entries.len(), 1);
    assert!(entries.contains_key("large"));
}

#[test]
fn refreshes_only_changed_workspace_scopes_and_removes_deleted_files() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-refresh-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let notes = root.join("notes");
    fs::create_dir_all(&notes).expect("create notes directory");
    fs::write(root.join("README.md"), "unchanged").expect("write unchanged document");
    let recycled = root.join(".moyang/recycle/1/content");
    fs::create_dir_all(&recycled).unwrap();
    fs::write(recycled.join("hidden.md"), "recycled").unwrap();
    let hidden =
        refresh_workspace_inner(root.clone(), vec![recycled.to_string_lossy().into_owned()])
            .unwrap();
    assert!(hidden.files.is_empty());
    assert!(hidden.folders.is_empty());
    let changed = notes.join("Changed.md");
    fs::write(&changed, "# Before").expect("write changed document");

    let delta = refresh_workspace_inner(root.clone(), vec![notes.to_string_lossy().into_owned()])
        .expect("refresh changed directory");
    assert_eq!(delta.files.len(), 1);
    assert_eq!(delta.index.len(), 1);
    assert_eq!(delta.index[0].title, "Before");
    assert!(!delta.files.iter().any(|file| file.name == "README.md"));
    assert_eq!(delta.folders.len(), 1);
    assert_eq!(delta.folders[0].relative_path, "notes");
    assert_eq!(delta.folder_scope_paths.len(), 1);

    fs::write(&changed, "# After\n\n#topic").expect("update changed document");
    let updated =
        refresh_workspace_inner(root.clone(), vec![changed.to_string_lossy().into_owned()])
            .expect("refresh changed file");
    assert_eq!(updated.index[0].title, "After");
    assert_eq!(updated.index[0].tags, vec!["topic"]);

    fs::remove_file(&changed).expect("remove changed document");
    let removed =
        refresh_workspace_inner(root.clone(), vec![changed.to_string_lossy().into_owned()])
            .expect("refresh deleted file");
    assert_eq!(removed.scope_paths.len(), 1);
    assert!(removed.files.is_empty());
    assert!(removed.index.is_empty());

    fs::remove_dir_all(root).expect("remove refresh workspace");
}

#[test]
fn refreshes_deleted_entries_when_a_watcher_reports_a_child_after_parent_removal() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-refresh-deleted-child-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let removed_directory = root.join("removed");
    let removed_file = removed_directory.join("nested.md");
    fs::create_dir_all(&removed_directory).expect("create removable directory");
    fs::write(&removed_file, "# Removed").expect("write removable document");

    let initial = refresh_workspace_inner(
        root.clone(),
        vec![removed_directory.to_string_lossy().into_owned()],
    )
    .expect("refresh removable directory before deletion");
    assert_eq!(initial.folders.len(), 1);

    fs::remove_dir_all(&removed_directory).expect("remove removable directory");
    let removed = refresh_workspace_inner(
        root.clone(),
        vec![removed_file.to_string_lossy().into_owned()],
    )
    .expect("refresh deleted child after parent removal");

    assert_eq!(removed.scope_paths.len(), 1);
    assert_eq!(removed.folder_scope_paths.len(), 1);
    assert!(removed.files.is_empty());
    assert!(removed.folders.is_empty());

    fs::remove_dir_all(root).expect("remove deleted-child refresh workspace");
}

#[test]
fn creates_workspace_entries_without_path_traversal_or_placeholder_files() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-create-entry-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let projects = root.join("Projects");
    fs::create_dir_all(&projects).expect("create projects directory");
    let root_string = root.to_string_lossy().into_owned();

    let created_folder = create_workspace_folder_inner(
        root_string.clone(),
        "Projects".to_string(),
        "Archive".to_string(),
    )
    .expect("create nested workspace folder");
    assert_eq!(
        fs::canonicalize(&created_folder).expect("canonicalize created folder"),
        fs::canonicalize(projects.join("Archive")).expect("canonicalize expected folder")
    );

    let created_note = create_workspace_note_inner(
        root_string.clone(),
        "Projects/Archive".to_string(),
        "Plan".to_string(),
    )
    .expect("create nested workspace note");
    assert_eq!(
        fs::read_to_string(&created_note).expect("read created workspace note"),
        "# Plan\n\n"
    );
    assert_eq!(
        sorted_workspace_directories(&root)
            .expect("list workspace directories")
            .len(),
        2
    );
    assert!(create_workspace_folder_inner(
        root_string.clone(),
        "Projects".to_string(),
        "../Outside".to_string(),
    )
    .is_err());
    assert!(
        create_workspace_note_inner(root_string, "Projects".to_string(), "CON".to_string())
            .is_err()
    );

    fs::remove_dir_all(root).expect("remove create entry workspace");
}

#[test]
fn renames_and_deletes_workspace_entries_without_leaving_workspace() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-manage-entry-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let archive = root.join("Archive");
    let note = root.join("Today.md");
    fs::create_dir_all(&archive).expect("create management workspace");
    fs::write(&note, "# Today").expect("write management note");
    fs::write(archive.join("Nested.md"), "# Nested").expect("write nested management note");
    let root_string = root.to_string_lossy().into_owned();

    let renamed_note = rename_workspace_entry_inner(
        root_string.clone(),
        "Today.md".to_string(),
        "Reading".to_string(),
    )
    .expect("rename workspace note while preserving extension");
    assert!(renamed_note.ends_with("Reading.md"));
    assert!(Path::new(&renamed_note).is_file());
    assert!(!note.exists());

    let renamed_archive = rename_workspace_entry_inner(
        root_string.clone(),
        "Archive".to_string(),
        "Saved".to_string(),
    )
    .expect("rename workspace folder");
    assert!(Path::new(&renamed_archive).is_dir());
    assert!(Path::new(&renamed_archive).join("Nested.md").is_file());

    assert!(rename_workspace_entry_inner(
        root_string.clone(),
        "../outside".to_string(),
        "Nope".to_string(),
    )
    .is_err());
    assert!(delete_workspace_entry_inner(root_string.clone(), "".to_string()).is_err());

    delete_workspace_entry_inner(root_string.clone(), "Reading.md".to_string())
        .expect("delete workspace note");
    assert!(!Path::new(&renamed_note).exists());
    delete_workspace_entry_inner(root_string, "Saved".to_string())
        .expect("delete workspace folder recursively");
    assert!(!Path::new(&renamed_archive).exists());

    fs::remove_dir_all(root).expect("remove management workspace");
}

#[test]
fn duplicates_workspace_files_and_folders_inside_the_workspace() {
    let root = std::env::temp_dir().join(format!(
        "moyang-reader-duplicate-entry-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let source_folder = root.join("Projects");
    let source_file = source_folder.join("Plan.md");
    fs::create_dir_all(&source_folder).expect("create duplicate workspace");
    fs::write(&source_file, "# Plan\n\ncontent").expect("write duplicate source");
    let root_string = root.to_string_lossy().into_owned();

    let copied_file = duplicate_workspace_entry_inner(
        root_string.clone(),
        "Projects/Plan.md".to_string(),
        "Plan copy".to_string(),
    )
    .expect("duplicate workspace file");
    assert!(copied_file.ends_with("Plan copy.md"));
    assert_eq!(
        fs::read_to_string(&copied_file).expect("read copied file"),
        "# Plan\n\ncontent"
    );

    let copied_folder = duplicate_workspace_entry_inner(
        root_string.clone(),
        "Projects".to_string(),
        "Projects copy".to_string(),
    )
    .expect("duplicate workspace folder");
    assert!(Path::new(&copied_folder).join("Plan.md").is_file());
    assert!(duplicate_workspace_entry_inner(
        root_string.clone(),
        "Projects/Plan.md".to_string(),
        "../outside".to_string(),
    )
    .is_err());
    assert!(duplicate_workspace_entry_inner(
        root_string,
        "Projects/Plan.md".to_string(),
        "Plan".to_string(),
    )
    .is_err());

    fs::remove_dir_all(root).expect("remove duplicate workspace");
}

#[test]
fn coalesces_overlapping_workspace_change_scopes_before_scanning() {
    let root = std::env::temp_dir().join(format!(
        "moyang-scopes-{}-{}",
        std::process::id(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let notes = root.join("notes");
    fs::create_dir_all(&notes).unwrap();
    let a = notes.join("a.md");
    let b = notes.join("b.md");
    fs::write(&a, "# A").unwrap();
    fs::write(&b, "# B").unwrap();
    let paths = vec![
        a.to_string_lossy().into_owned(),
        notes.to_string_lossy().into_owned(),
        b.to_string_lossy().into_owned(),
    ];
    let delta = refresh_workspace_inner(root.clone(), paths).unwrap();
    assert_eq!(delta.scope_paths.len(), 1);
    assert_eq!(delta.folder_scope_paths.len(), 1);
    assert_eq!(delta.files.len(), 2);
    assert_eq!(delta.folders.len(), 1);
    fs::remove_dir_all(root).unwrap();
}

#[cfg(windows)]
#[test]
fn treats_windows_namespace_prefixes_as_the_same_access_identity() {
    assert_eq!(
        access_path_key(Path::new(r"\\?\C:\Vault\note.md")),
        access_path_key(Path::new(r"c:\vault\note.md"))
    );
    assert_eq!(
        access_path_key(Path::new(r"\\?\UNC\server\share\note.md")),
        access_path_key(Path::new(r"\\server\share\note.md"))
    );
}
