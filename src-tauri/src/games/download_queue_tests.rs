use super::*;
use std::{path::Path, time::Duration};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root =
            PathBuf::from(std::env::var("HARBOR_GAME_TEST_ROOT").expect("data-drive fixture root"))
                .join(format!("download-queue-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        Self(root)
    }
    fn queue(&self) -> Arc<Queue> {
        Queue::load(self.0.clone(), Vec::new(), |_| {}).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let parent = fs::canonicalize(std::env::var("HARBOR_GAME_TEST_ROOT").unwrap()).unwrap();
        let path = fs::canonicalize(&self.0).unwrap();
        assert_eq!(path.parent(), Some(parent.as_path()));
        assert!(path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("download-queue-"));
        fs::remove_dir_all(path).unwrap();
    }
}
fn entry(kind: Kind, profile: &str) -> Entry {
    Entry::new(kind, &uuid::Uuid::new_v4().to_string(), profile)
}
fn register(queue: &Queue, entries: &[Entry]) {
    queue.register(entries).unwrap();
    for entry in entries {
        queue.eligible(entry.kind, &entry.id, true);
    }
}
fn ticket(queue: &Arc<Queue>, entry: &Entry) -> Ticket {
    queue.ticket(entry.kind, &entry.profile, &entry.id).unwrap()
}

#[test]
fn removing_or_reconciling_an_entry_refreshes_every_changed_profile_order() {
    let root = Fixture::new();
    let notifications = Arc::new(Mutex::new(Vec::<String>::new()));
    let captured = notifications.clone();
    let queue = Queue::load(root.0.clone(), Vec::new(), move |profile| {
        captured.lock().unwrap().push(profile.into())
    })
    .unwrap();
    let entries = vec![
        entry(Kind::Direct, "one"),
        entry(Kind::Direct, "two"),
        entry(Kind::Torrent, "two"),
    ];
    register(&queue, &entries);
    queue.forget(entries[0].kind, &entries[0].id).unwrap();
    let mut profiles = std::mem::take(&mut *notifications.lock().unwrap());
    profiles.sort();
    assert_eq!(profiles, vec!["one", "two"]);
    assert_eq!(queue.order(entries[1].kind, &entries[1].id), 1);
    assert_eq!(queue.order(entries[2].kind, &entries[2].id), 2);
    queue.reconcile(Kind::Direct, &[]).unwrap();
    assert_eq!(*notifications.lock().unwrap(), vec!["two"]);
    assert_eq!(queue.order(entries[2].kind, &entries[2].id), 1);
}

#[tokio::test]
async fn mixed_engines_share_two_slots_and_reorder_waiting_work_without_interrupting_active() {
    let root = Fixture::new();
    let queue = root.queue();
    let entries = vec![
        entry(Kind::Direct, "one"),
        entry(Kind::Torrent, "one"),
        entry(Kind::Direct, "one"),
        entry(Kind::Torrent, "one"),
    ];
    register(&queue, &entries);
    let mut tickets: Vec<_> = entries.iter().map(|e| Some(ticket(&queue, e))).collect();
    let cancel = CancellationToken::new();
    tickets[0].as_ref().unwrap().acquire(&cancel).await.unwrap();
    tickets[1].as_ref().unwrap().acquire(&cancel).await.unwrap();
    assert!(tokio::time::timeout(
        Duration::from_millis(30),
        tickets[2].as_ref().unwrap().acquire(&cancel)
    )
    .await
    .is_err());
    assert_eq!(
        queue.reorder(Kind::Direct, "one", &entries[0].id, false),
        Err("transfer_state")
    );
    queue
        .reorder(Kind::Torrent, "one", &entries[3].id, true)
        .unwrap();
    drop(tickets[0].take());
    assert!(tokio::time::timeout(
        Duration::from_millis(30),
        tickets[2].as_ref().unwrap().acquire(&cancel)
    )
    .await
    .is_err());
    tickets[3].as_ref().unwrap().acquire(&cancel).await.unwrap();
    assert_eq!(
        queue
            .state
            .lock()
            .unwrap()
            .tickets
            .values()
            .filter(|v| **v)
            .count(),
        2
    );
    drop(tickets[3].take());
    tickets[2].as_ref().unwrap().acquire(&cancel).await.unwrap();
    drop(tickets);
    assert!(queue.state.lock().unwrap().tickets.is_empty());
}
#[tokio::test]
async fn canceled_and_dropped_waiters_release_their_place_without_spending_a_slot() {
    let root = Fixture::new();
    let queue = root.queue();
    let a = entry(Kind::Torrent, "one");
    let b = entry(Kind::Direct, "two");
    register(&queue, &[a.clone(), b.clone()]);
    let waiting = ticket(&queue, &a);
    let next = ticket(&queue, &b);
    let canceled = CancellationToken::new();
    canceled.cancel();
    assert_eq!(waiting.acquire(&canceled).await, Err("transfer_stopped"));
    drop(waiting);
    tokio::time::timeout(
        Duration::from_millis(100),
        next.acquire(&CancellationToken::new()),
    )
    .await
    .unwrap()
    .unwrap();
}
#[test]
fn mixed_order_persists_without_resuming_and_profiles_cannot_reorder_each_other() {
    let root = Fixture::new();
    let queue = root.queue();
    let a = entry(Kind::Direct, "one");
    let b = entry(Kind::Torrent, "two");
    let c = entry(Kind::Torrent, "one");
    register(&queue, &[a.clone(), b.clone(), c.clone()]);
    assert_eq!(
        queue.reorder(c.kind, "two", &c.id, true),
        Err("transfer_unknown")
    );
    queue.reorder(c.kind, "one", &c.id, true).unwrap();
    let loaded = root.queue();
    assert_eq!(loaded.order(c.kind, &c.id), 1);
    assert_eq!(loaded.order(b.kind, &b.id), 2);
    assert_eq!(loaded.order(a.kind, &a.id), 3);
    assert!(loaded.state.lock().unwrap().tickets.is_empty());
    assert!(loaded.state.lock().unwrap().eligible.is_empty());
    let changed = Entry::new(a.kind, &a.id, "different");
    assert_eq!(loaded.register(&[changed]), Err("transfer_store"));
}
#[test]
fn failed_order_write_rolls_back_and_corrupt_store_is_never_silently_reset() {
    let root = Fixture::new();
    let queue = root.queue();
    let a = entry(Kind::Direct, "one");
    let b = entry(Kind::Torrent, "one");
    register(&queue, &[a.clone(), b.clone()]);
    fs::rename(root.0.join("order.json"), root.0.join("saved.json")).unwrap();
    fs::create_dir(root.0.join("order.json")).unwrap();
    assert_eq!(
        queue.reorder(b.kind, "one", &b.id, true),
        Err("transfer_store")
    );
    assert_eq!(queue.order(a.kind, &a.id), 1);
    assert_eq!(queue.forget(a.kind, &a.id), Err("transfer_store"));
    assert_eq!(queue.order(a.kind, &a.id), 1);
    fs::remove_dir(root.0.join("order.json")).unwrap();
    fs::write(root.0.join("order.json"), b"broken").unwrap();
    assert!(Queue::load(root.0.clone(), vec![], |_| {}).is_err());
    assert_eq!(fs::read(root.0.join("order.json")).unwrap(), b"broken");
}
#[test]
fn legacy_migration_preserves_each_engine_order_independently_of_manager_startup() {
    let root = Fixture::new();
    let a = entry(Kind::Direct, "one");
    let b = entry(Kind::Direct, "one");
    let c = entry(Kind::Torrent, "one");
    for (folder, rows) in [
        ("games", vec![(&a, 20), (&b, 10)]),
        ("game-torrents", vec![(&c, 15)]),
    ] {
        fs::create_dir(root.0.join(folder)).unwrap();
        let records: Vec<_> = rows
            .into_iter()
            .map(|(e, at)| serde_json::json!({"id":e.id,"profile":e.profile,"createdAt":at}))
            .collect();
        fs::write(
            root.0.join(folder).join("transfers.json"),
            serde_json::to_vec(&serde_json::json!({"records":records})).unwrap(),
        )
        .unwrap();
    }
    let ordered = legacy(Path::new(&root.0));
    assert_eq!(
        ordered.iter().map(|e| e.id.as_str()).collect::<Vec<_>>(),
        vec![c.id.as_str(), a.id.as_str(), b.id.as_str()]
    );
}

#[test]
fn reconciliation_removes_orphans_only_for_the_loaded_engine_and_keeps_order() {
    let root = Fixture::new();
    let queue = root.queue();
    let a = entry(Kind::Direct, "one");
    let b = entry(Kind::Torrent, "one");
    let removed = entry(Kind::Direct, "one");
    register(&queue, &[a.clone(), b.clone(), removed.clone()]);
    queue.reorder(b.kind, "one", &b.id, true).unwrap();
    queue.reconcile(Kind::Direct, &[a.clone()]).unwrap();
    assert_eq!(queue.order(b.kind, &b.id), 1);
    assert_eq!(queue.order(a.kind, &a.id), 2);
    assert_eq!(queue.order(removed.kind, &removed.id), u64::MAX);
    let loaded = root.queue();
    assert_eq!(loaded.order(b.kind, &b.id), 1);
}
