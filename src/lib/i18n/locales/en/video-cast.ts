const videoCast: Record<string, string> = {
  "video.cast.protocol": "Separate speaker audio for video currently requires a DLNA receiver.",
  "video.cast.audioRoute": "Speaker audio",
  "video.cast.localPicture": "Video stays on this computer",
  "video.cast.speakerHelp":
    "Adjust volume on the speaker. Network audio may lag behind the picture.",
  "video.cast.return": "Return audio to this computer",
  "video.cast.stopping": "Stopping speaker…",
  "video.cast.noPlayer": "Start a video before choosing a speaker.",
  "video.cast.volume": "Adjust volume on the speaker. Computer volume and boost do not apply.",
  "video.cast.settings": "Return audio to this computer before changing speed or audio tracks.",
  "video.cast.muteFailed":
    "Harbor could not confirm local audio was muted. Speaker playback was stopped.",
  "video.cast.loadFailed": "Couldn’t start audio on this speaker. Try another source.",
  "video.cast.notReady": "The speaker did not confirm playback.",
  "video.cast.retryReturn": "Check the speaker, then retry returning audio to this computer.",
  "video.cast.disconnected":
    "Speaker connection lost. Video is paused; local audio stays guarded until the speaker stops.",
  "video.cast.buffering": "Video is buffering. Both players are paused; press Play when ready.",
  "video.cast.controlFailed":
    "The speaker did not confirm the command. Retry returning audio to this computer.",
  "video.cast.playerChanged": "The local player changed. Stop the speaker before continuing.",
  "video.cast.trackUnavailable":
    "This audio track cannot be mapped to the source. Choose an embedded audio track first.",
  "video.cast.liveUnsupported": "Live video cannot use a separate network speaker yet.",
};
export default videoCast;
