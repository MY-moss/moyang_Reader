mod dispatch;
mod hooks;
mod runtime;
pub use runtime::runtime as local_model_runtime;
pub use runtime::{local_model, maintain_semantic};
mod connections;
pub use connections::{configure_client, ClientPaths};
mod extension_connections;
pub use extension_connections::configure_external_client;
mod cancellation;
pub use cancellation::cancel_search;
mod exchange;
mod lifecycle;
mod migration;
mod source;
mod source_inventory;
pub use source_inventory::*;
pub use lifecycle::*;
pub use source::{fetch_web_source, install_embedding_model, local_model_status};
mod context_pack;
mod health;
mod search;
pub use health::*;
mod semantic;
mod store;
mod types;
pub use dispatch::dispatch;
pub use store::{view_record, Store};
pub use types::*;

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
mod source_inventory_tests;
#[cfg(test)]
mod history_tests;
#[cfg(test)]
mod lifecycle_tests;
#[cfg(test)]
mod tests;
