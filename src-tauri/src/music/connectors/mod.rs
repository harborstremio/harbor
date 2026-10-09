pub mod catalog;
pub mod jellyfin;
pub mod local;
pub mod plex;
pub mod soundcloud;
pub mod subsonic;
pub mod youtube_music;

use super::registry::ConnectorRegistry;

pub fn register(registry: &ConnectorRegistry) -> Result<(), String> {
    registry.register(Box::new(youtube_music::YouTubeMusicConnector::new()))?;
    registry.register(Box::new(soundcloud::SoundCloudConnector::new()))?;
    registry.register(Box::new(catalog::CatalogConnector::new()))?;
    registry.register(Box::new(local::LocalConnector::new()))?;
    registry.register(Box::new(subsonic::SubsonicConnector::new()))?;
    registry.register(Box::new(jellyfin::JellyfinConnector::new()))?;
    registry.register(Box::new(plex::PlexConnector::new()))
}
