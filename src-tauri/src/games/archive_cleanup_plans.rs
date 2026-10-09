use super::{archive_cleanup::Review, archive_jobs::Archives};
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
type Result<T> = std::result::Result<T, &'static str>;
struct Prepared {
    root: String,
    profile: String,
    created: Instant,
    review: Review,
}
fn plans() -> &'static Mutex<HashMap<String, Prepared>> {
    static VALUE: OnceLock<Mutex<HashMap<String, Prepared>>> = OnceLock::new();
    VALUE.get_or_init(|| Mutex::new(HashMap::new()))
}
pub(super) fn remember(archives: &Archives, profile: &str, mut review: Review) -> Result<Review> {
    if !review.files_verified || !review.blockers.is_empty() {
        return Ok(review);
    }
    let mut held = plans().lock().map_err(|_| "archive_store")?;
    held.retain(|_, v| v.created.elapsed() < Duration::from_secs(900));
    if held.len() >= 16 {
        return Err("archive_busy");
    }
    let token = uuid::Uuid::new_v4().to_string();
    review.token = Some(token.clone());
    held.insert(
        token,
        Prepared {
            root: archives.cleanup_root().to_string_lossy().into_owned(),
            profile: profile.into(),
            created: Instant::now(),
            review: review.clone(),
        },
    );
    Ok(review)
}
pub(super) fn get(archives: &Archives, profile: &str, token: &str) -> Result<Review> {
    let held = plans().lock().map_err(|_| "archive_store")?;
    let value = held
        .get(token)
        .filter(|v| {
            v.profile == profile
                && v.root == archives.cleanup_root().to_string_lossy()
                && v.created.elapsed() < Duration::from_secs(900)
        })
        .ok_or("archive_expired")?;
    Ok(value.review.clone())
}
pub(super) fn discard(profile: &str, token: &str) {
    if let Ok(mut held) = plans().lock() {
        if held.get(token).is_some_and(|v| v.profile == profile) {
            held.remove(token);
        }
    }
}
