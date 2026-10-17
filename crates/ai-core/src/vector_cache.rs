//! Bounded, content-addressed parsed vectors. A database write, restore or model
//! switch cannot reuse stale values: the model and exact vector bytes form the key.
use crate::*;
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex, OnceLock},
};
#[derive(Default)]
struct Cache {
    items: HashMap<[u8; 32], Arc<Vec<f64>>>,
    order: VecDeque<[u8; 32]>,
    bytes: usize,
}
const BUDGET: usize = 16 * 1024 * 1024;
pub(crate) fn parsed(model: &str, raw: &str) -> Result<Arc<Vec<f64>>> {
    static CACHE: OnceLock<Mutex<Cache>> = OnceLock::new();
    let mut digest = Sha256::new();
    digest.update(model.as_bytes());
    digest.update([0]);
    digest.update(raw.as_bytes());
    let key: [u8; 32] = digest.finalize().into();
    let mut cache = CACHE
        .get_or_init(Default::default)
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    if let Some(value) = cache.items.get(&key) {
        return Ok(value.clone());
    }
    let value: Arc<Vec<f64>> = Arc::new(serde_json::from_str(raw)?);
    let bytes = value.capacity() * std::mem::size_of::<f64>() + 128;
    if bytes <= BUDGET {
        while cache.bytes + bytes > BUDGET {
            let Some(old) = cache.order.pop_front() else {
                break;
            };
            if let Some(value) = cache.items.remove(&old) {
                cache.bytes -= value.capacity() * 8 + 128;
            }
        }
        cache.bytes += bytes;
        cache.order.push_back(key);
        cache.items.insert(key, value.clone());
    }
    Ok(value)
}
#[test]
fn reuse_requires_identical_model_and_vector() {
    let first = parsed("fixture", "[1,0]").unwrap();
    assert!(Arc::ptr_eq(&first, &parsed("fixture", "[1,0]").unwrap()));
    assert!(!Arc::ptr_eq(&first, &parsed("new-model", "[1,0]").unwrap()));
    assert_eq!(&**parsed("fixture", "[0,1]").unwrap(), &[0., 1.]);
    assert!(parsed("fixture", "broken").is_err());
}
