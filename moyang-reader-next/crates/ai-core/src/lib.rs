mod dispatch;
mod hooks;
mod runtime;
pub use runtime::{local_model, maintain_semantic};
mod connections;
pub use connections::{configure_client, ClientPaths};
mod cancellation;
pub use cancellation::cancel_search;
mod exchange;
mod lifecycle;
mod migration;
mod source;
pub use lifecycle::*;
pub use source::{fetch_web_source, install_embedding_model, local_model_status};
mod search;
mod semantic;
mod store;
mod types;
pub use dispatch::dispatch;
pub use store::Store;
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
mod lifecycle_tests;
#[cfg(test)]
mod tests;
