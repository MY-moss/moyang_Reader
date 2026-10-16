use super::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkPatch {
    pub path: String,
    pub before: String,
    pub after: String,
}

pub(super) fn rename_with_links(
    root: String,
    entry: String,
    name: String,
    patches: Vec<LinkPatch>,
) -> Result<String, String> {
    let canonical_root = entries::canonical_workspace_root(&root)?;
    let original = entries::resolve_workspace_entry(&canonical_root, &entry)?;
    // Verify every expected version before changing any path or content.
    let mut checked = Vec::new();
    for patch in &patches {
        let path = fs::canonicalize(&patch.path).map_err(|e| e.to_string())?;
        if !path.starts_with(&canonical_root)
            || !entries::markdown_extension(path.extension().and_then(|v| v.to_str()))
        {
            return Err("只能维护当前阅读库中的 Markdown 链接".into());
        }
        if files::read_text_file_inner(path.clone())? != patch.before {
            return Err(format!(
                "{} 在准备重命名时发生变化，原文件未改动，请重试。",
                patch.path
            ));
        }
        checked.push(path);
    }
    let operations = canonical_root.join(".moyang").join("operations");
    fs::create_dir_all(&operations).map_err(|e| e.to_string())?;
    if !fs::canonicalize(&operations)
        .map_err(|e| e.to_string())?
        .starts_with(&canonical_root)
    {
        return Err("操作恢复目录不在阅读库内".into());
    }
    let journal = operations.join(format!(
        "rename-{}-{}.json",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    files::write_text_file_inner(
        journal.clone(),
        serde_json::json!({"original":display_path(&original),"name":name,"patches":patches})
            .to_string(),
    )?;
    let renamed = match entries::rename_workspace_entry_inner(root, entry, name) {
        Ok(path) => path,
        Err(error) => {
            let _ = fs::remove_file(journal);
            return Err(error);
        }
    };
    let destination = PathBuf::from(&renamed);
    let mut written: Vec<(PathBuf, usize)> = Vec::new();
    let result = (|| {
        for (index, old_path) in checked.iter().enumerate() {
            let path = old_path
                .strip_prefix(&original)
                .map(|suffix| destination.join(suffix))
                .unwrap_or_else(|_| old_path.clone());
            if files::read_text_file_inner(path.clone())? != patches[index].before {
                return Err(format!("{} 在重命名期间发生变化", patches[index].path));
            }
            files::write_text_file_inner(path.clone(), patches[index].after.clone())?;
            written.push((path, index));
        }
        Ok(())
    })();
    if let Err(error) = result {
        let mut incomplete = false;
        for (path, index) in written.into_iter().rev() {
            if files::read_text_file_inner(path.clone()).ok().as_deref()
                == Some(patches[index].after.as_str())
            {
                if files::write_text_file_inner(path, patches[index].before.clone()).is_err() {
                    incomplete = true;
                }
            } else {
                incomplete = true;
            }
        }
        let same_entry = access_path_key(&original) == access_path_key(&destination);
        if (!same_entry && original.exists()) || fs::rename(&destination, &original).is_err() {
            incomplete = true;
        }
        if !incomplete {
            let _ = fs::remove_file(journal);
            return Err(format!("{error}；本次重命名已撤销。"));
        }
        return Err(format!(
            "{error}；部分内容同时被外部修改，恢复副本保存在 {}。请刷新阅读库后核对。",
            display_path(&journal)
        ));
    }
    let _ = fs::remove_file(journal);
    Ok(renamed)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_content_when_changing_only_filename_case() {
        let root = std::env::temp_dir().join(format!(
            "moyang-case-{}-{}",
            std::process::id(),
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("old.md"), "body").unwrap();
        let next = rename_with_links(
            display_path(&root),
            "old.md".into(),
            "OLD.md".into(),
            Vec::new(),
        )
        .unwrap();
        assert_eq!(fs::read_to_string(next).unwrap(), "body");
        assert!(fs::read_dir(&root)
            .unwrap()
            .any(|item| item.unwrap().file_name() == "OLD.md"));
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn rejects_changed_link_source_before_renaming() {
        let root = std::env::temp_dir().join(format!(
            "moyang-rename-{}",
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("a.md"), "new external").unwrap();
        fs::write(root.join("b.md"), "target").unwrap();
        let patch = LinkPatch {
            path: display_path(&root.join("a.md")),
            before: "old".into(),
            after: "replacement".into(),
        };
        assert!(rename_with_links(
            display_path(&root),
            "b.md".into(),
            "c.md".into(),
            vec![patch]
        )
        .is_err());
        assert!(root.join("b.md").exists());
        assert!(!root.join("c.md").exists());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn renames_folder_and_rewrites_internal_and_external_sources() {
        let root = std::env::temp_dir().join(format!(
            "moyang-rename-ok-{}",
            TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(root.join("old")).unwrap();
        fs::write(root.join("old/a.md"), "before").unwrap();
        fs::write(root.join("index.md"), "link").unwrap();
        let patches = vec![
            LinkPatch {
                path: display_path(&root.join("old/a.md")),
                before: "before".into(),
                after: "after".into(),
            },
            LinkPatch {
                path: display_path(&root.join("index.md")),
                before: "link".into(),
                after: "new link".into(),
            },
        ];
        rename_with_links(display_path(&root), "old".into(), "new".into(), patches).unwrap();
        assert_eq!(fs::read_to_string(root.join("new/a.md")).unwrap(), "after");
        assert_eq!(
            fs::read_to_string(root.join("index.md")).unwrap(),
            "new link"
        );
        fs::remove_dir_all(root).unwrap();
    }
}
