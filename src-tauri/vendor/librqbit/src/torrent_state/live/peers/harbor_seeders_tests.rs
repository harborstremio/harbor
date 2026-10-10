use super::*;
use librqbit_core::hash_id::Id20;
use tokio::sync::mpsc::unbounded_channel;

fn peers() -> PeerStates {
    PeerStates {
        session_stats: Default::default(),
        live_outgoing_peers: Default::default(),
        stats: Default::default(),
        states: Default::default(),
    }
}

fn connect(peers: &PeerStates, port: u16) -> PeerHandle {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let (tx, _rx) = unbounded_channel();
    let peer = Peer::new_live_for_incoming_connection(addr, Id20::new([0; 20]), tx, peers);
    peers.states.insert(addr, peer);
    addr
}

fn bits(bytes: &[u8]) -> BF {
    BF::from_boxed_slice(bytes.to_vec().into_boxed_slice())
}

#[test]
fn harbor_seeders_unknown_partial_full_and_padding() {
    let peers = peers();
    let addr = connect(&peers, 6001);
    assert_eq!(peers.stats().live, 1);
    assert_eq!(peers.stats().seeders, 0);
    peers.update_bitfield(addr, bits(&[0xff, 0x80]), 10);
    assert_eq!(peers.stats().seeders, 0);
    peers.update_bitfield(addr, bits(&[0xff, 0xc0]), 10);
    assert_eq!(peers.stats().seeders, 1);
    assert_eq!(
        AggregatePeerStats::from(&peers.session_stats.peers).seeders,
        1
    );
    // Repeated bitfields and unused padding bits cannot inflate the count.
    peers.update_bitfield(addr, bits(&[0xff, 0xff]), 10);
    assert_eq!(peers.stats().seeders, 1);
    peers.update_bitfield(addr, bits(&[0x7f, 0xff]), 10);
    assert_eq!(peers.stats().seeders, 0);
}

#[test]
fn harbor_seeders_have_is_incremental_and_duplicate_safe() {
    let peers = peers();
    let addr = connect(&peers, 6002);
    peers.update_bitfield(addr, bits(&[0xff, 0x00]), 10);
    peers.with_live_mut(addr, "test_have", |live| {
        assert!(live.confirm_piece(8, 10));
        assert!(live.confirm_piece(8, 10));
        assert!(!live.confirm_piece(10, 10));
        assert!(!live.confirm_piece(usize::MAX, 10));
    });
    assert_eq!(peers.stats().seeders, 0);
    peers.with_live_mut(addr, "test_have", |live| {
        assert!(live.confirm_piece(9, 10));
        assert!(live.confirm_piece(9, 10));
    });
    assert_eq!(peers.stats().seeders, 1);
    let serialized = serde_json::to_value(peers.stats()).unwrap();
    assert_eq!(serialized["seeders"], 1);
}

#[test]
fn harbor_seeders_disconnect_reconnect_and_removal() {
    let peers = peers();
    let addr = connect(&peers, 6003);
    peers.update_bitfield(addr, bits(&[0xff]), 8);
    peers.with_peer_mut(addr, "test_disconnect", |peer| {
        peer.set_state(PeerState::Dead, &peers);
    });
    assert_eq!((peers.stats().live, peers.stats().seeders), (0, 0));
    let (tx, _rx) = unbounded_channel();
    peers.with_peer_mut(addr, "test_reconnect", |peer| {
        peer.set_state(
            PeerState::Live(LivePeerState::new(Id20::new([0; 20]), tx, true)),
            &peers,
        );
    });
    assert_eq!((peers.stats().live, peers.stats().seeders), (1, 0));
    peers.update_bitfield(addr, bits(&[0xff]), 8);
    peers.drop_peer(addr);
    assert_eq!((peers.stats().live, peers.stats().seeders), (0, 0));
    assert_eq!(
        AggregatePeerStats::from(&peers.session_stats.peers).seeders,
        0
    );
}

#[test]
fn harbor_seeders_short_empty_and_zero_piece_fields_are_not_seeds() {
    let peers = peers();
    let addr = connect(&peers, 6004);
    peers.update_bitfield(addr, BF::default(), 10);
    assert_eq!(peers.stats().seeders, 0);
    peers.update_bitfield(addr, bits(&[0xff]), 10);
    assert_eq!(peers.stats().seeders, 0);
    peers.update_bitfield(addr, BF::default(), 0);
    assert_eq!(peers.stats().seeders, 0);
}
