use std::sync::atomic::AtomicU32;

use serde::Serialize;

use crate::torrent_state::{
    live::peer::PeerState,
    utils::{atomic_dec, atomic_inc},
};

#[derive(Debug, Default, Serialize)]
pub(crate) struct AggregatePeerStatsAtomic {
    pub queued: AtomicU32,
    pub connecting: AtomicU32,
    pub live: AtomicU32,
    pub seeders: AtomicU32,
    pub seen: AtomicU32,
    pub dead: AtomicU32,
    pub not_needed: AtomicU32,
    pub steals: AtomicU32,
}

impl AggregatePeerStatsAtomic {
    pub fn counter(&self, state: &PeerState) -> &AtomicU32 {
        match state {
            PeerState::Connecting(_) => &self.connecting,
            PeerState::Live(_) => &self.live,
            PeerState::Queued => &self.queued,
            PeerState::Dead => &self.dead,
            PeerState::NotNeeded => &self.not_needed,
        }
    }

    pub fn inc(&self, state: &PeerState) {
        atomic_inc(self.counter(state));
        self.update_seeder(
            false,
            matches!(state, PeerState::Live(live) if live.is_seeder),
        );
    }

    pub fn dec(&self, state: &PeerState) {
        atomic_dec(self.counter(state));
        self.update_seeder(
            matches!(state, PeerState::Live(live) if live.is_seeder),
            false,
        );
    }

    pub fn update_seeder(&self, was: bool, is: bool) {
        match (was, is) {
            (false, true) => {
                atomic_inc(&self.seeders);
            }
            (true, false) => {
                atomic_dec(&self.seeders);
            }
            _ => (),
        }
    }

    pub fn incdec(&self, old: &PeerState, new: &PeerState) {
        self.dec(old);
        self.inc(new);
    }

    pub fn inc_steals(&self) {
        atomic_inc(&self.steals);
    }
}
