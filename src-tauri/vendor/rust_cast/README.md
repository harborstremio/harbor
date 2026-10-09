[![Docs](https://docs.rs/rust_cast/badge.svg)](https://docs.rs/crate/rust_cast/)
![Build Status](https://github.com/azasypkin/rust-cast/actions/workflows/ci.yml/badge.svg)

# Usage
* [Documentation](https://docs.rs/crate/rust_cast/)
* Try out [Rust Caster](./examples/rust_caster.rs) example to see this crate in action!

# Build

Proto files are taken from [Chromium Open Screen GitHub mirror](https://chromium.googlesource.com/openscreen/+/37a17677e5ded963fc41a3d8dee7a59484e5ec13/cast/common/channel/proto).

By default `cargo build` won't try to generate Rust code from the files located at `protobuf/*`, if you want to do that
use `GENERATE_PROTO` environment variable during build and make sure you have `protoc` binary in `$PATH`:

```bash
$ GENERATE_PROTO=true cargo build
```

# Run example

## Generic features

First, you need to figure out the address of the device to connect to. For example, you can use `avahi` with the following command:
```bash
$ avahi-browse -a --resolve
```

```bash
// Get some info about the Google Cast enabled device (e.g. Chromecast). 
$ cargo run --example rust_caster -- -a 192.168.0.100 -i

Number of apps run: 1
App#0: Default Media Receiver (CC1AD845)
Volume level: 1
Muted: false

// Run specific app on the Chromecast.
$ cargo run --example rust_caster -- -a 192.168.0.100 -r youtube

// Stop specific active app.
$ cargo run --example rust_caster -- -a 192.168.0.100 -s youtube

// Stop currently active app.
$ cargo run --example rust_caster -- -a 192.168.0.100 --stop-current

The following app has been stopped: Default Media Receiver (CC1AD845)
```

## Media features
```bash
// Stream a video.
$ cargo run --example rust_caster -- -a 192.168.0.100 -m http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4

// Stream a video of specific format with buffering.
$ cargo run --example rust_caster -- -a 192.168.0.100 -m http://xxx.webm --media-type video/webm --media-stream-type buffered

// Stream video from YouTube (doesn't work with the latest YouTube app, fix is welcome).
$ cargo run --example rust_caster -- -a 192.168.0.100 -m 7LcUOEP7Brc --media-app youtube

// Display an image.
$ cargo run --example rust_caster -- -a 192.168.0.100 -m https://azasypkin.github.io/style-my-image/images/mozilla.jpg

// Change volume level.
$ cargo run --example rust_caster -- -a 192.168.0.100 --media-volume 0.5

// Mute/unmute media.
$ cargo run --example rust_caster -- -a 192.168.0.100 --media-mute [--media-unmute]

// Pause media.
$ cargo run --example rust_caster -- -a 192.168.0.100 --media-app youtube --media-pause

// Resume/play media.
$ cargo run --example rust_caster -- -a 192.168.0.100 --media-app youtube --media-play

// Seek media.
$ cargo run --example rust_caster -- -a 192.168.0.100 --media-app youtube --media-seek 100
```

For all possible values of `--media-type` see [Supported Media for Google Cast](https://developers.google.com/cast/docs/media).

# DNS TXT Record description

* `md` - Model Name (e.g. "Chromecast");
* `id` - UUID without hyphens of the particular device (e.g. xx12x3x456xx789xx01xx234x56789x0);
* `fn` - Friendly Name of the device (e.g. "Living Room"); 
* `rs` - Unknown (recent share???) (e.g. "Youtube TV");
* `bs` - Uknonwn (e.g. "XX1XXX2X3456");
* `st` - Unknown (e.g. "1");
* `ca` - Unknown (e.g. "1234");
* `ic` - Icon path (e.g. "/setup/icon.png");
* `ve` - Version (e.g. "04").

# Model names

* `Chromecast` - Regular chromecast, supports video/audio;
* `Chromecast Audio` - Chromecast Audio device, supports only audio.

# Useful links and sources of inspiration

* [DIAL Protocol](http://www.dial-multiscreen.org/);
* [An implementation of the Chromecast CASTV2 protocol in JS](https://github.com/thibauts/node-castv2);
* [Chromecast - steps closer to a python native api](http://www.clift.org/fred/chromecast-steps-closer-to-a-python-native-api.html);
