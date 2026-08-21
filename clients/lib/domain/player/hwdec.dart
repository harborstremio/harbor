/// The mpv `hwdec` property value for the `mpvHwdec` setting.
///
/// media_kit renders through libmpv's **texture / render API**, so hardware
/// decoding must use **copy-back** methods (`mediacodec-copy` on Android,
/// `videotoolbox-copy` on iOS/macOS) — a *direct* decoder (`mediacodec`,
/// `videotoolbox`) writes to a platform Surface the texture renderer can't
/// display, which shows up as **black video with working audio**. So both the
/// default (`auto`) and the explicit `on` resolve to `auto-copy-safe`: enable
/// safe hardware decoding (with automatic software fallback) that always renders.
/// Leaving it unset previously fell through to libmpv's `hwdec=no` — a **software
/// decode** that is far too slow for 4K/HEVC on a phone or tablet.
String? hwdecMpvValue(String mode) => switch (mode) {
  'off' => 'no',
  // 'on' and 'auto' both enable render-safe hardware decoding.
  _ => 'auto-copy-safe',
};
