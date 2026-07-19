/// A typed success/failure result. Used across the domain so failures are
/// explicit and never swallowed — there are no silent catches or fake defaults.
sealed class Result<T> {
  const Result();

  R when<R>({
    required R Function(T value) ok,
    required R Function(Failure failure) err,
  }) {
    final self = this;
    return switch (self) {
      Ok<T>() => ok(self.value),
      Err<T>() => err(self.failure),
    };
  }

  T? get valueOrNull => this is Ok<T> ? (this as Ok<T>).value : null;
  Failure? get failureOrNull =>
      this is Err<T> ? (this as Err<T>).failure : null;
  bool get isOk => this is Ok<T>;
  bool get isErr => this is Err<T>;
}

final class Ok<T> extends Result<T> {
  const Ok(this.value);
  final T value;
}

final class Err<T> extends Result<T> {
  const Err(this.failure);
  final Failure failure;
}

/// A domain failure with a human-readable message, an optional machine [code]
/// (e.g. the Stremio error code), and the originating [cause].
class Failure {
  const Failure(this.message, {this.code, this.cause});

  final String message;
  final int? code;
  final Object? cause;

  @override
  String toString() => 'Failure($message${code != null ? ', code $code' : ''})';
}
