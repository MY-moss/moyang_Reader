use std::{path::PathBuf, process::Command};
fn main() {
    let root = PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").unwrap()).join("../..");
    let git = |args: &[&str]| {
        Command::new("git")
            .args(args)
            .current_dir(&root)
            .output()
            .ok()
            .filter(|r| r.status.success())
            .map(|r| String::from_utf8_lossy(&r.stdout).trim().to_string())
            .unwrap_or_default()
    };
    let revision = git(&["rev-parse", "HEAD"]);
    let dirty = !git(&["status", "--porcelain", "--untracked-files=no"]).is_empty();
    println!("cargo:rustc-env=MOYANG_BUILD_REVISION={revision}");
    println!("cargo:rustc-env=MOYANG_BUILD_DIRTY={dirty}");
    // Include package version and Git state in a real rebuild, including linked worktrees.
    for path in [
        "package.json",
        "crates/ai-core/src",
        "crates/ai-mcp/src",
        "src-tauri/src",
    ] {
        println!("cargo:rerun-if-changed={}", root.join(path).display());
    }
    for name in ["HEAD", "index"] {
        let path = git(&["rev-parse", "--git-path", name]);
        if !path.is_empty() {
            println!("cargo:rerun-if-changed={}", root.join(path).display());
        }
    }
    let reference = git(&["symbolic-ref", "-q", "HEAD"]);
    if !reference.is_empty() {
        let path = git(&["rev-parse", "--git-path", &reference]);
        println!("cargo:rerun-if-changed={}", root.join(path).display());
    }
}
