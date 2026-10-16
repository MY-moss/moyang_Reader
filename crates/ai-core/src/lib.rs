mod archive;
#[cfg(test)]
mod archive_tests;
mod dispatch;
mod memory_merge;
mod organizer;
mod resources;
pub mod services;
pub use organizer::{maintain_organization, OrganizationConfig};
mod hooks;
mod model_process;
pub mod models;
mod runtime;
pub use runtime::runtime as local_model_runtime;
pub use runtime::{local_model, maintain_semantic};
mod connections;
pub use connections::{configure_client, ClientPaths};
mod extension_connections;
pub use extension_connections::configure_external_client;
mod cancellation;
pub use cancellation::cancel_search;
mod activity_page;
mod exchange;
mod lifecycle;
pub use activity_page::ActivityPageRequest;
mod migration;
mod source;
mod source_inventory;
pub use lifecycle::*;
pub use source::{fetch_web_source, install_embedding_model, local_model_status};
pub use source_inventory::*;
mod compact;
mod context_pack;
pub use compact::compact_search;
mod patch;
mod recall;
pub use patch::PatchRequest;
pub use recall::RecallRequest;
mod resource_read;
pub use resource_read::ResourceReadRequest;
mod layers;
pub use layers::{ContextLayer, ContextRead, ReadContextRequest};
mod health;
#[cfg(test)]
mod layer_tests;
mod search;
pub use health::*;
mod semantic;
mod store;
mod types;
pub use dispatch::dispatch;
pub use store::{view_record, Store};
pub use types::*;
pub fn build_identity() -> serde_json::Value {
    let package: serde_json::Value =
        serde_json::from_str(include_str!("../../../package.json")).expect("package metadata");
    serde_json::json!({"version":package["version"],"revision":env!("MOYANG_BUILD_REVISION"),"dirty":env!("MOYANG_BUILD_DIRTY")=="true"})
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{0}")]
    Message(String),
    #[error("数据库：{0}")]
    Database(#[from] rusqlite::Error),
    #[error("数据格式：{0}")]
    Json(#[from] serde_json::Error),
    #[error("文件：{0}")]
    Io(#[from] std::io::Error),
}
pub type Result<T> = std::result::Result<T, Error>;
// Keep persisted fingerprints/checkpoint IDs stable across digest crate upgrades.
pub(crate) fn hex(bytes: impl AsRef<[u8]>) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let bytes = bytes.as_ref();
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(DIGITS[(byte >> 4) as usize] as char);
        output.push(DIGITS[(byte & 15) as usize] as char);
    }
    output
}

#[test]
fn sha256_encoding_preserves_existing_identifiers() {
    use sha2::{Digest, Sha256};
    assert_eq!(
        hex(Sha256::digest(b"abc")),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    assert_eq!(hex([0, 1, 15, 16, 255]), "00010f10ff");
}

pub(crate) fn invalid(message: &str) -> Error {
    Error::Message(message.into())
}
pub fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
mod health_tests;
#[cfg(test)]
mod history_tests;
#[cfg(test)]
mod lifecycle_tests;
#[cfg(test)]
mod source_inventory_tests;
#[cfg(test)]
mod tests;
