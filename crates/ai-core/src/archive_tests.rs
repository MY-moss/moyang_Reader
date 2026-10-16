use crate::*;
use serde_json::{json, Value};
use std::{fs::File, io::Write};
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};
#[test]
fn archive_restores_resources_history_checkpoints_and_skips_machine_state() {
    let source = tempfile::tempdir().unwrap();
    let mut s = Store::open(source.path()).unwrap();
    let r=s.save(serde_json::from_value(json!({"kind":"skill","title":"portable-skill","summary":"参考文件","body":"原始步骤","assets":[{"path":"refs/a.txt","encoding":"utf8","content":"相同附件"},{"path":"pic.bin","encoding":"base64","content":"AAECAw=="}]})).unwrap()).unwrap();
    s.patch(
        serde_json::from_value(
            json!({"id":r.id,"expected_revision":1,"fields":{"body":"修改后的步骤"}}),
        )
        .unwrap(),
    )
    .unwrap();
    let checkpoint = s
        .checkpoint(CheckpointRequest {
            client: "test".into(),
            session: "one".into(),
            turn: "one".into(),
            project: String::new(),
            agent: "test".into(),
            request_followup: false,
        })
        .unwrap();
    s.set_setting_value("connection:codex", &json!({"ready":true}))
        .unwrap();
    s.set_setting_value(
        "organization",
        &json!({"enabled":true,"provider":"private-provider","daily_tokens":100}),
    )
    .unwrap();
    let path = source.path().join("中文完整备份.zip");
    s.export_archive(&path).unwrap();
    let target = tempfile::tempdir().unwrap();
    let mut t = Store::open(target.path()).unwrap();
    assert_eq!(t.import_archive(&path).unwrap()["imported"], 1);
    assert_eq!(t.get(&r.id).unwrap().fields.assets[1].content, "AAECAw==");
    assert_eq!(
        t.revision_detail(&r.id, 1).unwrap().record.fields.body,
        "原始步骤"
    );
    assert_eq!(
        t.conn
            .query_row("SELECT COUNT(*) FROM resources", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        2
    );
    assert!(t.setting_value("connection:codex").unwrap().is_null());
    assert!(t.setting_value("organization").unwrap().is_null());
    let found: bool = t
        .conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM checkpoints WHERE id=?)",
            [checkpoint["checkpoint"]["id"].as_str().unwrap()],
            |r| r.get(0),
        )
        .unwrap();
    assert!(found);
    assert_eq!(t.import_archive(&path).unwrap()["skipped"], 1);
    t.restore(RestoreRequest {
        id: r.id.clone(),
        revision: 1,
        expected_revision: 2,
    })
    .unwrap();
    assert_eq!(t.get(&r.id).unwrap().fields.assets[0].content, "相同附件");
}
#[test]
fn corrupt_archive_never_changes_existing_data() {
    let dir = tempfile::tempdir().unwrap();
    let mut s = Store::open(dir.path()).unwrap();
    let r = s
        .save(
            serde_json::from_value(json!({"kind":"memory","title":"保留","body":"现有内容"}))
                .unwrap(),
        )
        .unwrap();
    let good = dir.path().join("good.zip");
    s.export_archive(&good).unwrap();
    let mut input = ZipArchive::new(File::open(good).unwrap()).unwrap();
    let mut manifest: Value =
        serde_json::from_reader(input.by_name("manifest.json").unwrap()).unwrap();
    manifest["sha256"] = json!("damaged");
    let bad = dir.path().join("bad.zip");
    let mut output = ZipWriter::new(File::create(&bad).unwrap());
    output
        .start_file("manifest.json", SimpleFileOptions::default())
        .unwrap();
    output
        .write_all(&serde_json::to_vec(&manifest).unwrap())
        .unwrap();
    output
        .start_file("library.sqlite3", SimpleFileOptions::default())
        .unwrap();
    std::io::copy(&mut input.by_name("library.sqlite3").unwrap(), &mut output).unwrap();
    output.finish().unwrap();
    assert!(s.import_archive(&bad).is_err());
    assert_eq!(s.get(&r.id).unwrap().revision, 1);
    assert_eq!(s.stats().unwrap().memory, 1);
}
