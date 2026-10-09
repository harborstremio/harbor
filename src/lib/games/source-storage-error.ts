/** Classify only failed primary writes; a failed optional cache cannot undo a save. */
export function sourceStorageError(error: unknown): Error {
  return Error(error && typeof error === 'object' && 'name' in error && error.name === 'QuotaExceededError' ? 'source_quota' : 'source_storage');
}
