use crate::*;
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
fn registry() -> &'static Mutex<HashMap<String, Instant>> {
    static REQUESTS: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
    REQUESTS.get_or_init(|| Mutex::new(HashMap::new()))
}
pub fn cancel_search(id: &str) {
    if let Ok(mut entries) = registry().lock() {
        entries.retain(|_, time| time.elapsed() < Duration::from_secs(300));
        if entries.len() >= 256 {
            if let Some(old) = entries
                .iter()
                .min_by_key(|(_, v)| **v)
                .map(|(k, _)| k.clone())
            {
                entries.remove(&old);
            }
        }
        entries.insert(id.into(), Instant::now());
    }
}
pub(crate) fn check_cancelled(id: Option<&str>) -> Result<()> {
    if id.is_some_and(|id| {
        registry()
            .lock()
            .is_ok_and(|entries| entries.contains_key(id))
    }) {
        Err(invalid("查询已取消。"))
    } else {
        Ok(())
    }
}
