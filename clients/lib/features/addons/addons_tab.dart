/// The three addons-page tabs, ported from the web `Tab` union.
enum AddonsTab { discover, browse, installed }

AddonsTab? _pendingAddonsTab;

/// Requests that the addons page open on [tab] the next time it mounts — the
/// cross-view / deep-link mailbox, ported 1:1 from `requestAddonsTab`.
void requestAddonsTab(AddonsTab tab) => _pendingAddonsTab = tab;

/// Reads and clears the pending tab request, ported 1:1 from `consumeAddonsTab`.
AddonsTab? consumeAddonsTab() {
  final v = _pendingAddonsTab;
  _pendingAddonsTab = null;
  return v;
}
