import 'package:flutter/material.dart';

import 'api_sorted_list.dart';
import 'rising_list.dart';

/// The three browse modes, ported from the web `BROWSE_MODES`.
enum BrowseMode { top, rising, newest }

/// The Browse tab body — dispatches the rising mode to [RisingList] and the
/// top-rated / just-added modes to the paginated [ApiSortedList]. Ported from
/// `CommunityBrowseList` / `browse-pane.tsx`.
class BrowsePane extends StatelessWidget {
  const BrowsePane({
    super.key,
    required this.mode,
    required this.category,
    required this.search,
    required this.allowAdult,
    required this.installedIds,
    required this.onOpen,
    this.onChange,
  });

  final BrowseMode mode;
  final String? category;
  final String? search;
  final bool allowAdult;
  final Set<String> installedIds;
  final void Function(String manifestId) onOpen;
  final VoidCallback? onChange;

  @override
  Widget build(BuildContext context) {
    if (mode == BrowseMode.rising) {
      return RisingList(
        category: category,
        search: search,
        allowAdult: allowAdult,
        installedIds: installedIds,
        onOpen: onOpen,
        onChange: onChange,
      );
    }
    return ApiSortedList(
      mode: mode == BrowseMode.top ? BrowseSortMode.top : BrowseSortMode.newest,
      category: category,
      search: search,
      allowAdult: allowAdult,
      installedIds: installedIds,
      onOpen: onOpen,
      onChange: onChange,
    );
  }
}
