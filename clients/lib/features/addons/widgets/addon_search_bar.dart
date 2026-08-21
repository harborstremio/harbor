import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme_controller.dart';
import '../../../design/focus/tv_text_field.dart';

/// The addons search box, ported 1:1 from `SearchBar` — a rounded pill with a
/// leading search icon over a controlled text field.
class AddonSearchBar extends ConsumerStatefulWidget {
  const AddonSearchBar({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final String value;
  final ValueChanged<String> onChanged;

  @override
  ConsumerState<AddonSearchBar> createState() => _AddonSearchBarState();
}

class _AddonSearchBarState extends ConsumerState<AddonSearchBar> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.value,
  );

  @override
  void didUpdateWidget(AddonSearchBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Keep the field in sync when the parent drives the value (e.g. clears it).
    if (widget.value != _controller.text) {
      _controller.value = TextEditingValue(
        text: widget.value,
        selection: TextSelection.collapsed(offset: widget.value.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(tokensProvider);
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: t.elevated.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.edgeSoft),
      ),
      child: Row(
        children: [
          const SizedBox(width: 14),
          Icon(Icons.search, size: 14, color: t.inkSubtle),
          const SizedBox(width: 8),
          Expanded(
            child: TvTextField(
              controller: _controller,
              onChanged: widget.onChanged,
              cursorColor: t.accent,
              style: TextStyle(fontSize: 13, color: t.ink),
              decoration: InputDecoration(
                isCollapsed: true,
                border: InputBorder.none,
                hintText: 'Search addons',
                hintStyle: TextStyle(fontSize: 13, color: t.inkSubtle),
              ),
            ),
          ),
          const SizedBox(width: 16),
        ],
      ),
    );
  }
}
