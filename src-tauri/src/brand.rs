//! Product name shown to people by native code: window titles, tray items,
//! OS media and power integrations, and error messages.
//!
//! Internal identifiers (bundle ids, storage keys, user agents, virtual audio
//! device names, event names) keep their existing values on purpose; changing
//! them would orphan existing installs and devices.

/// Expands to the product name as a string literal, for `concat!` in constants.
#[macro_export]
macro_rules! product_name {
    () => {
        "JL Media Vision"
    };
}

pub const PRODUCT_NAME: &str = product_name!();

/// The embedded player window's title. Native code finds its own player window by this
/// prefix, so it is kept distinct from the app window's title.
pub const PLAYER_WINDOW_TITLE: &str = concat!(product_name!(), " Player");
