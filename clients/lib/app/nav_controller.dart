import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/nav/frame.dart';

/// The frame-stack navigator (`docs/10`): `setView` replaces the stack for tab
/// views and pushes for settings; `open*`/`push` push (de-duping the same target
/// on top); back/forward move browser-style; the stack is capped at
/// [stackMax] keeping the root frame.
class NavController extends Notifier<NavState> {
  static const int stackMax = 30;

  @override
  NavState build() =>
      const NavState(stack: [Frame(FrameKind.home)], forwardStack: []);

  /// Switch a top-level tab (replace the stack), or push `settings`.
  void setView(FrameKind kind, [Map<String, dynamic> args = const {}]) {
    if (kTabViewKinds.contains(kind)) {
      state = NavState(stack: [Frame(kind, args)], forwardStack: const []);
    } else {
      push(Frame(kind, args));
    }
  }

  /// Push a frame; no-op if the same target is already on top.
  void push(Frame frame) {
    if (state.stack.last.frameKey() == frame.frameKey()) return;
    var stack = [...state.stack, frame];
    if (stack.length > stackMax) {
      // Cap while always keeping the root frame.
      stack = [stack.first, ...stack.sublist(stack.length - (stackMax - 1))];
    }
    state = NavState(stack: stack, forwardStack: const []);
  }

  void back() {
    if (!state.canGoBack) return;
    final popped = state.stack.last;
    state = NavState(
      stack: state.stack.sublist(0, state.stack.length - 1),
      forwardStack: [popped, ...state.forwardStack],
    );
  }

  /// Leaves the player: pops the trailing player frame(s) and lands on the
  /// source list. Ported from web `exitPlayer` — Back from the player returns to
  /// the stream picker. When the frame beneath is an instant-play (`autoPlay`)
  /// picker, its `autoPlay` is cleared so it renders the list instead of firing
  /// the connecting splash and relaunching the player. A plain `back()` here
  /// would pop the player only for the auto-play picker underneath to re-fire on
  /// its fresh mount, trapping the viewer on the player. For a player with no
  /// picker beneath (vod / live / downloads) this is a single pop, like `back`.
  void exitPlayer() {
    final stack = [...state.stack];
    final popped = <Frame>[];
    while (stack.length > 1 && stack.last.kind == FrameKind.player) {
      popped.insert(0, stack.removeLast());
    }
    if (popped.isEmpty) return;
    final top = stack.last;
    if (top.kind == FrameKind.picker && top.args['autoPlay'] == true) {
      stack[stack.length - 1] = Frame(FrameKind.picker, {
        ...top.args,
        'autoPlay': false,
      });
    }
    state = NavState(
      stack: stack,
      forwardStack: [...popped, ...state.forwardStack],
    );
  }

  void forward() {
    if (!state.canGoForward) return;
    final next = state.forwardStack.first;
    state = NavState(
      stack: [...state.stack, next],
      forwardStack: state.forwardStack.sublist(1),
    );
  }
}

final navControllerProvider = NotifierProvider<NavController, NavState>(
  NavController.new,
);

final activeFrameProvider = Provider<Frame>(
  (ref) => ref.watch(navControllerProvider).active,
);
