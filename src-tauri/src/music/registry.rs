use super::connector::{ConnectorHealth, ConnectorHealthInfo, MusicConnector};
use super::matching::{
    candidate_score, connector_priority, requested_candidate, settle_search_results, source_key,
    source_name,
};
use super::rows::merge_typed_results;
use super::{
    MusicCatalogRow, MusicConnection, MusicSearchResults, MusicSourceCandidate, MusicTrack,
};
use futures_util::future::join_all;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock};
use std::time::Duration;

const UPLOADS_PER_SOURCE: usize = 3;

pub struct ConnectorRegistry {
    connectors: RwLock<HashMap<String, Arc<dyn MusicConnector>>>,
}

impl ConnectorRegistry {
    pub fn new() -> Self {
        Self {
            connectors: RwLock::new(HashMap::new()),
        }
    }

    pub fn register(&self, connector: Box<dyn MusicConnector>) -> Result<(), String> {
        let id = connector.id().trim();
        if id.is_empty()
            || !id.chars().all(|character| {
                character.is_ascii_lowercase()
                    || character.is_ascii_digit()
                    || character == '-'
                    || character == '_'
            })
        {
            return Err("Music connector id is invalid".to_string());
        }
        self.connectors
            .write()
            .map_err(|_| "Music connector registry is unavailable".to_string())?
            .insert(id.to_string(), Arc::from(connector));
        Ok(())
    }

    pub fn get(&self, id: &str) -> Option<Arc<dyn MusicConnector>> {
        self.connectors.read().ok()?.get(id).cloned()
    }

    pub async fn search(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
        connector_id: Option<&str>,
    ) -> Result<Vec<MusicTrack>, String> {
        if let Some(connector_id) = connector_id {
            let connector = self
                .get(connector_id)
                .ok_or_else(|| format!("Unknown music connector: {connector_id}"))?;
            if !connector.searchable() {
                return Err(format!(
                    "Music connector {connector_id} does not support search"
                ));
            }
            return connector.search(app, query, limit).await;
        }

        let candidates = self.search_fan_out()?;
        let results = join_all(candidates.into_iter().map(|connector| async move {
            let id = connector.id().to_string();
            (id, connector.search(app, query, limit).await)
        }))
        .await;
        settle_search_results(results, limit)
    }

    pub async fn search_typed(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
        connector_id: Option<&str>,
    ) -> Result<MusicSearchResults, String> {
        if let Some(connector_id) = connector_id {
            let connector = self
                .get(connector_id)
                .ok_or_else(|| format!("Unknown music connector: {connector_id}"))?;
            if !connector.searchable() {
                return Err(format!(
                    "Music connector {connector_id} does not support search"
                ));
            }
            return connector.search_typed(app, query, limit).await;
        }

        let candidates = self.search_fan_out()?;
        let results = join_all(candidates.into_iter().map(|connector| async move {
            let id = connector.id().to_string();
            (id, connector.search_typed(app, query, limit).await)
        }))
        .await;
        merge_typed_results(results, limit)
    }

    pub async fn browse_home(
        &self,
        app: &tauri::AppHandle,
        budget: Duration,
        connector_id: Option<&str>,
    ) -> Vec<(String, Result<Vec<MusicCatalogRow>, String>)> {
        let connectors = match connector_id {
            Some(connector_id) => self.get(connector_id).into_iter().collect::<Vec<_>>(),
            None => self
                .all()
                .into_iter()
                .filter(|connector| connector.browsable())
                .collect::<Vec<_>>(),
        };
        join_all(connectors.into_iter().map(|connector| async move {
            let id = connector.id().to_string();
            let rows = match tokio::time::timeout(budget, connector.browse_home(app)).await {
                Ok(rows) => rows,
                Err(_) => Err(format!("Music connector {id} timed out")),
            };
            (id, rows)
        }))
        .await
    }

    pub async fn candidates(
        &self,
        app: &tauri::AppHandle,
        track: &MusicTrack,
    ) -> Vec<MusicSourceCandidate> {
        let original_id = track.connector_id.as_deref().unwrap_or_else(|| {
            if track.playback_url.is_some() {
                "direct"
            } else {
                "youtube"
            }
        });
        let original_connector = self.get(original_id);
        let mut candidates = vec![requested_candidate(
            track,
            original_id,
            original_connector
                .as_ref()
                .map(|connector| connector.name().to_string())
                .unwrap_or_else(|| source_name(original_id)),
        )];
        let mut seen = HashSet::from([source_key(track)]);
        let query = format!("{} {}", track.artist.trim(), track.title.trim());
        let (reachable, unreachable): (Vec<_>, Vec<_>) = self
            .all()
            .into_iter()
            .filter(|connector| {
                connector.id() != original_id && connector.searchable() && connector.playable()
            })
            .partition(|connector| connector.health() != ConnectorHealth::Offline);
        let mut alternatives = self.matched_sources(app, track, &query, reachable, &mut seen).await;
        if alternatives.is_empty() && !unreachable.is_empty() {
            alternatives = self
                .matched_sources(app, track, &query, unreachable, &mut seen)
                .await;
        }
        alternatives.sort_by_key(|candidate| connector_priority(&candidate.connector_id));
        candidates.extend(alternatives);
        candidates
    }

    async fn matched_sources(
        &self,
        app: &tauri::AppHandle,
        track: &MusicTrack,
        query: &str,
        connectors: Vec<Arc<dyn MusicConnector>>,
        seen: &mut HashSet<String>,
    ) -> Vec<MusicSourceCandidate> {
        let results = join_all(connectors.into_iter().map(|connector| {
            let query = query.to_string();
            async move {
                let tracks = connector.search(app, &query, 12).await;
                (connector, tracks)
            }
        }))
        .await;

        let mut alternatives = Vec::new();
        for (connector, result) in results {
            let Ok(tracks) = result else {
                continue;
            };
            let mut scored = tracks
                .into_iter()
                .filter_map(|candidate| {
                    candidate_score(track, &candidate).map(|score| (score, candidate))
                })
                .collect::<Vec<_>>();
            scored.sort_by(|left, right| right.0.cmp(&left.0));
            for (_, selected) in scored.into_iter().take(UPLOADS_PER_SOURCE) {
                if !seen.insert(source_key(&selected)) {
                    continue;
                }
                alternatives.push(MusicSourceCandidate {
                    connector_id: connector.id().to_string(),
                    connector_name: connector.name().to_string(),
                    health: connector.health(),
                    track: selected,
                });
            }
        }
        alternatives
    }

    pub fn all(&self) -> Vec<Arc<dyn MusicConnector>> {
        let mut connectors = self
            .connectors
            .read()
            .map(|items| items.values().cloned().collect::<Vec<_>>())
            .unwrap_or_default();
        connectors.sort_by(|left, right| left.id().cmp(right.id()));
        connectors
    }

    pub fn health(&self) -> Vec<ConnectorHealthInfo> {
        self.all()
            .into_iter()
            .map(|connector| connector.health_info())
            .collect()
    }

    pub fn connections(&self) -> Vec<MusicConnection> {
        self.all()
            .into_iter()
            .map(|connector| connector.connection())
            .collect()
    }

    fn search_fan_out(&self) -> Result<Vec<Arc<dyn MusicConnector>>, String> {
        let searchable = self
            .all()
            .into_iter()
            .filter(|connector| connector.searchable())
            .collect::<Vec<_>>();
        let mut candidates = searchable
            .iter()
            .filter(|connector| connector.health() != ConnectorHealth::Offline)
            .cloned()
            .collect::<Vec<_>>();
        if candidates.is_empty() {
            candidates = searchable;
        }
        if candidates.is_empty() {
            return Err("No searchable music connectors are installed".to_string());
        }
        Ok(candidates)
    }
}

#[cfg(test)]
mod tests {
    use super::super::MusicStream;
    use super::*;
    use async_trait::async_trait;

    struct TestConnector;

    #[async_trait]
    impl MusicConnector for TestConnector {
        fn id(&self) -> &str {
            "test"
        }

        fn name(&self) -> &str {
            "Test"
        }

        async fn search(
            &self,
            _app: &tauri::AppHandle,
            _query: &str,
            _limit: usize,
        ) -> Result<Vec<MusicTrack>, String> {
            Ok(Vec::new())
        }

        async fn resolve(
            &self,
            _app: &tauri::AppHandle,
            _track: &MusicTrack,
        ) -> Result<MusicStream, String> {
            Err("not available".to_string())
        }

        fn health(&self) -> ConnectorHealth {
            ConnectorHealth::Healthy
        }
    }

    struct HiddenConnector;

    #[async_trait]
    impl MusicConnector for HiddenConnector {
        fn id(&self) -> &str {
            "hidden"
        }

        fn name(&self) -> &str {
            "Hidden"
        }

        async fn search(
            &self,
            _app: &tauri::AppHandle,
            _query: &str,
            _limit: usize,
        ) -> Result<Vec<MusicTrack>, String> {
            Ok(Vec::new())
        }

        async fn resolve(
            &self,
            _app: &tauri::AppHandle,
            _track: &MusicTrack,
        ) -> Result<MusicStream, String> {
            Err("not available".to_string())
        }

        fn health(&self) -> ConnectorHealth {
            ConnectorHealth::Unknown
        }

        fn searchable(&self) -> bool {
            false
        }
    }

    #[test]
    fn registry_returns_registered_connector_and_health() {
        let registry = ConnectorRegistry::new();
        registry
            .register(Box::new(TestConnector))
            .expect("register connector");

        assert_eq!(registry.get("test").expect("connector").name(), "Test");
        let health = registry.health();
        assert_eq!(health.len(), 1);
        assert_eq!(health[0].health, ConnectorHealth::Healthy);
    }

    #[test]
    fn unconfigured_connectors_stay_out_of_the_search_fan_out() {
        let registry = ConnectorRegistry::new();
        registry
            .register(Box::new(TestConnector))
            .expect("register connector");
        registry
            .register(Box::new(HiddenConnector))
            .expect("register hidden connector");

        let fan_out = registry.search_fan_out().expect("searchable connectors");
        assert_eq!(
            fan_out
                .iter()
                .map(|connector| connector.id().to_string())
                .collect::<Vec<_>>(),
            vec!["test"]
        );
        assert_eq!(registry.connections().len(), 2);
        assert_eq!(registry.connections()[0].status, "disconnected");
    }
}
