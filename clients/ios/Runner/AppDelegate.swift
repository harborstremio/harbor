import AVFoundation
import AVKit
import Flutter
import MediaPlayer
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  private var nowPlaying: NowPlayingBridge?
  private var playerLandscapeLocked = false
  private var quickActionChannel: FlutterMethodChannel?
  private var pendingQuickAction: String?

  /// The app-level orientation gate: landscape while the player holds the lock,
  /// free rotation otherwise. Consulted on iPhone always, and on iPad only
  /// because `UIRequiresFullScreen` (Info.plist) makes the scene non-resizable —
  /// a multitasking-capable iPad app ignores app-forced orientation entirely.
  override func application(
    _ application: UIApplication,
    supportedInterfaceOrientationsFor window: UIWindow?
  ) -> UIInterfaceOrientationMask {
    return playerLandscapeLocked ? .landscape : .all
  }

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    // Reports whether this is a TV (tvOS) device so the app can gate sender-only
    // features (Chromecast / Picture-in-Picture) off — a TV is a receiver.
    if let registrar = self.registrar(forPlugin: "HarborPlatform") {
      let channel = FlutterMethodChannel(
        name: "harbor/platform",
        binaryMessenger: registrar.messenger()
      )
      channel.setMethodCallHandler { call, result in
        if call.method == "isTv" {
          result(UIDevice.current.userInterfaceIdiom == .tv)
        } else {
          result(FlutterMethodNotImplemented)
        }
      }
    }

    // Lets the player lock the whole app to landscape while it is open and
    // restore the device's orientation on exit — the reliable cross-iPhone/iPad
    // rotation path (iPad relies on `UIRequiresFullScreen` in Info.plist).
    if let registrar = self.registrar(forPlugin: "HarborOrientation") {
      let channel = FlutterMethodChannel(
        name: "harbor/orientation",
        binaryMessenger: registrar.messenger()
      )
      channel.setMethodCallHandler { [weak self] call, result in
        guard let self = self else {
          result(nil)
          return
        }
        switch call.method {
        case "lockLandscape":
          self.playerLandscapeLocked = true
          self.applyOrientation(.landscape)
          result(nil)
        case "unlock":
          self.playerLandscapeLocked = false
          // Deterministically restore portrait — the handheld browsing
          // orientation. Requesting `.all` is a no-op (the current landscape is
          // still valid), and following `UIDevice.current.orientation` is
          // unreliable: it is `.unknown` on the Simulator (no accelerometer), so
          // a sensor-based restore never fires there. Forcing `.portrait` snaps
          // back on both the Simulator and a device; the interface is free to
          // rotate again afterwards since `supportedInterfaceOrientationsFor`
          // now returns `.all`.
          self.applyOrientation(.portrait)
          result(nil)
        default:
          result(FlutterMethodNotImplemented)
        }
      }
    }

    // The system AirPlay route picker, embedded in the player chrome as a Flutter
    // platform view. video_player's AVPlayer keeps allowsExternalPlayback = true,
    // so picking a route hands off video (AirPlay 1 & 2) automatically.
    if let registrar = self.registrar(forPlugin: "HarborAirPlayRoutePicker") {
      registrar.register(
        AirPlayRoutePickerFactory(),
        withId: "harbor/airplay_route_picker"
      )
    }

    // Streams the AirPlay output state (active + device name) to Dart so the
    // chrome can show an "AirPlaying to …" indicator when a route is engaged.
    if let registrar = self.registrar(forPlugin: "HarborAirPlayState") {
      let channel = FlutterEventChannel(
        name: "harbor/airplay_state",
        binaryMessenger: registrar.messenger()
      )
      channel.setStreamHandler(AirPlayStateStreamHandler())
    }

    // The OS media session (lock screen / Control Center now-playing + remote
    // transport commands), driven from the player over a method channel.
    if let registrar = self.registrar(forPlugin: "HarborNowPlaying") {
      let channel = FlutterMethodChannel(
        name: "harbor/now_playing",
        binaryMessenger: registrar.messenger()
      )
      nowPlaying = NowPlayingBridge(channel: channel)
    }

    // Home-Screen quick actions (long-press the app icon) + Siri-discoverable
    // shortcuts. A cold-launch shortcut is stashed for Dart to query once the
    // engine is up; warm taps invoke `handle` directly. Both carry the same
    // `harbor://` URLs the shared DeepLinkService routes.
    if let registrar = self.registrar(forPlugin: "HarborQuickAction") {
      let channel = FlutterMethodChannel(
        name: "harbor/quick_action",
        binaryMessenger: registrar.messenger()
      )
      quickActionChannel = channel
      channel.setMethodCallHandler { [weak self] call, result in
        if call.method == "getInitialQuickAction" {
          result(self?.consumePendingQuickAction())
        } else {
          result(FlutterMethodNotImplemented)
        }
      }
    }

    var launchedFromShortcut = false
    if let shortcut = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem {
      pendingQuickAction = quickActionUrl(from: shortcut)
      launchedFromShortcut = true
    }

    let launched = super.application(
      application,
      didFinishLaunchingWithOptions: launchOptions
    )
    // Returning false when a shortcut launched the app prevents iOS from also
    // calling `performActionFor` for that same shortcut (it's already stashed).
    return launchedFromShortcut ? false : launched
  }

  /// A warm-launch quick-action tap (app already running/suspended).
  override func application(
    _ application: UIApplication,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    if let url = quickActionUrl(from: shortcutItem) {
      quickActionChannel?.invokeMethod("handle", arguments: url)
      completionHandler(true)
    } else {
      completionHandler(false)
    }
  }

  /// The `harbor://` route a shortcut carries in its user info.
  private func quickActionUrl(from item: UIApplicationShortcutItem) -> String? {
    return item.userInfo?["url"] as? String
  }

  /// Returns the pending cold-launch quick action once, then clears it.
  private func consumePendingQuickAction() -> String? {
    let url = pendingQuickAction
    pendingQuickAction = nil
    return url
  }

  /// Nudges iOS to re-evaluate and rotate to [mask] immediately. The requested
  /// mask must be a subset of the current supported orientations, so callers set
  /// `playerLandscapeLocked` first. On iOS 16+ the supported set is marked dirty
  /// before the geometry request so the request validates against the fresh set;
  /// rejections are logged (via the error-handling overload) instead of being
  /// dropped silently. On iOS 15 there is no forced-orientation API, so the best
  /// available is a re-query against the (now-updated) supported set — while the
  /// lock holds that resolves to landscape; once released the interface is free
  /// to follow the device again.
  private func applyOrientation(_ mask: UIInterfaceOrientationMask) {
    DispatchQueue.main.async {
      if #available(iOS 16.0, *) {
        self.window?.rootViewController?
          .setNeedsUpdateOfSupportedInterfaceOrientations()
        for scene in UIApplication.shared.connectedScenes {
          guard let windowScene = scene as? UIWindowScene else { continue }
          windowScene.requestGeometryUpdate(
            .iOS(interfaceOrientations: mask)
          ) { error in
            NSLog(
              "harbor/orientation: geometry update to mask %lu failed: %@",
              mask.rawValue, error.localizedDescription)
          }
        }
      } else {
        UIViewController.attemptRotationToDeviceOrientation()
      }
    }
  }
}

/// Factory for the AirPlay route-picker platform view.
class AirPlayRoutePickerFactory: NSObject, FlutterPlatformViewFactory {
  func create(
    withFrame frame: CGRect,
    viewIdentifier viewId: Int64,
    arguments args: Any?
  ) -> FlutterPlatformView {
    return AirPlayRoutePickerPlatformView(frame: frame, args: args)
  }

  func createArgsCodec() -> FlutterMessageCodec & NSObjectProtocol {
    return FlutterStandardMessageCodec.sharedInstance()
  }
}

/// Hosts an `AVRoutePickerView` (the system AirPlay picker) so the player chrome
/// can show it wherever `PlayerCapabilities.airplay` is true. Video devices are
/// prioritized; tint colors come from the Flutter side so it matches the theme.
class AirPlayRoutePickerPlatformView: NSObject, FlutterPlatformView {
  private let picker: AVRoutePickerView

  init(frame: CGRect, args: Any?) {
    picker = AVRoutePickerView(frame: frame)
    super.init()
    picker.prioritizesVideoDevices = true
    picker.backgroundColor = .clear
    picker.activeTintColor = .systemBlue
    picker.tintColor = .white
    if let params = args as? [String: Any] {
      if let tint = AirPlayRoutePickerPlatformView.color(params["tint"]) {
        picker.tintColor = tint
      }
      if let active = AirPlayRoutePickerPlatformView.color(params["activeTint"]) {
        picker.activeTintColor = active
      }
    }
  }

  func view() -> UIView { picker }

  private static func color(_ raw: Any?) -> UIColor? {
    guard let c = raw as? [String: Any],
      let r = c["r"] as? Double,
      let g = c["g"] as? Double,
      let b = c["b"] as? Double
    else { return nil }
    let a = (c["a"] as? Double) ?? 1.0
    return UIColor(
      red: CGFloat(r), green: CGFloat(g), blue: CGFloat(b), alpha: CGFloat(a))
  }
}

/// Streams `{active, name}` whenever the audio route changes — `active` is true
/// when the current route has an AirPlay output (video AirPlay routes its audio
/// through the same session), `name` is that device's name. Lets the player
/// chrome reflect the live AirPlay connection.
class AirPlayStateStreamHandler: NSObject, FlutterStreamHandler {
  private var sink: FlutterEventSink?

  func onListen(
    withArguments arguments: Any?,
    eventSink events: @escaping FlutterEventSink
  ) -> FlutterError? {
    sink = events
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(routeChanged),
      name: AVAudioSession.routeChangeNotification,
      object: nil
    )
    emit()
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    NotificationCenter.default.removeObserver(self)
    sink = nil
    return nil
  }

  @objc private func routeChanged(_ note: Notification) {
    emit()
  }

  private func emit() {
    guard let sink = sink else { return }
    let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
    let air = outputs.first { $0.portType == .airPlay }
    let payload: [String: Any] = ["active": air != nil, "name": air?.portName ?? ""]
    DispatchQueue.main.async { sink(payload) }
  }
}

/// Drives `MPNowPlayingInfoCenter` from the player and relays
/// `MPRemoteCommandCenter` transport events (lock screen / Control Center /
/// headset) back to Dart as `{type, position?}` messages.
class NowPlayingBridge: NSObject {
  private let channel: FlutterMethodChannel
  private var commandsConfigured = false

  init(channel: FlutterMethodChannel) {
    self.channel = channel
    super.init()
    channel.setMethodCallHandler { [weak self] call, result in
      self?.handle(call, result)
    }
  }

  private func handle(_ call: FlutterMethodCall, _ result: FlutterResult) {
    switch call.method {
    case "update":
      update(call.arguments as? [String: Any])
      result(nil)
    case "clear":
      clear()
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func update(_ args: [String: Any]?) {
    guard let args = args else { return }
    configureCommandsIfNeeded()
    try? AVAudioSession.sharedInstance().setCategory(.playback)
    try? AVAudioSession.sharedInstance().setActive(true)
    UIApplication.shared.beginReceivingRemoteControlEvents()

    var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
    info[MPMediaItemPropertyTitle] = args["title"] as? String ?? ""
    if let subtitle = args["subtitle"] as? String {
      info[MPMediaItemPropertyArtist] = subtitle
    }
    if let duration = args["durationSec"] as? Double, duration > 0 {
      info[MPMediaItemPropertyPlaybackDuration] = duration
    }
    if let position = args["positionSec"] as? Double {
      info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = position
    }
    let playing = args["playing"] as? Bool ?? true
    info[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info

    if let urlString = args["artworkUrl"] as? String, let url = URL(string: urlString) {
      loadArtwork(url)
    }
  }

  private func loadArtwork(_ url: URL) {
    URLSession.shared.dataTask(with: url) { data, _, _ in
      guard let data = data, let image = UIImage(data: data) else { return }
      let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
      DispatchQueue.main.async {
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPMediaItemPropertyArtwork] = artwork
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
      }
    }.resume()
  }

  private func clear() {
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    UIApplication.shared.endReceivingRemoteControlEvents()
  }

  private func configureCommandsIfNeeded() {
    guard !commandsConfigured else { return }
    commandsConfigured = true
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.addTarget { [weak self] _ in self?.send("play") ?? .success }
    center.pauseCommand.addTarget { [weak self] _ in self?.send("pause") ?? .success }
    center.togglePlayPauseCommand.addTarget { [weak self] _ in
      self?.send("toggle") ?? .success
    }
    center.skipForwardCommand.preferredIntervals = [10]
    center.skipForwardCommand.addTarget { [weak self] _ in
      self?.send("seekForward") ?? .success
    }
    center.skipBackwardCommand.preferredIntervals = [10]
    center.skipBackwardCommand.addTarget { [weak self] _ in
      self?.send("seekBackward") ?? .success
    }
    center.nextTrackCommand.addTarget { [weak self] _ in self?.send("next") ?? .success }
    center.previousTrackCommand.addTarget { [weak self] _ in
      self?.send("previous") ?? .success
    }
    center.changePlaybackPositionCommand.addTarget { [weak self] event in
      if let event = event as? MPChangePlaybackPositionCommandEvent {
        return self?.send("seekTo", position: event.positionTime) ?? .success
      }
      return .commandFailed
    }
  }

  private func send(_ type: String, position: Double? = nil)
    -> MPRemoteCommandHandlerStatus
  {
    var payload: [String: Any] = ["type": type]
    if let position = position { payload["position"] = position }
    DispatchQueue.main.async { self.channel.invokeMethod("command", arguments: payload) }
    return .success
  }
}
