/// Seek-step options and sanitizer, from Harbor's `src/lib/seek-step.ts`.
const List<int> kSeekStepOptions = [5, 10, 15, 30, 60, 90];

bool isSeekStepSeconds(Object? value) =>
    value is num && kSeekStepOptions.contains(value.toInt());

int sanitizeSeekStep(Object? value, int fallback) =>
    isSeekStepSeconds(value) ? (value as num).toInt() : fallback;
