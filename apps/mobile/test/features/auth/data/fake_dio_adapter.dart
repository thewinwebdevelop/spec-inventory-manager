import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// A canned response for [FakeHttpClientAdapter] to return, keyed by request
/// path + method. Lets [AuthRepositoryImpl] tests exercise the REAL generated
/// `AuthApi` (real path building, real built_value (de)serialization) end to
/// end, with only the actual network I/O faked — no mocking of `AuthApi`
/// itself, so a contract-shape regression in the generated client would
/// still be caught here (unlike a plain `AuthApi` mock).
class FakeResponse {
  FakeResponse({
    required this.statusCode,
    this.jsonBody,
    this.headers = const {},
  });

  final int statusCode;
  final Object? jsonBody;
  final Map<String, List<String>> headers;
}

/// Queue-based fake [HttpClientAdapter] — each call to [fetch] pops the next
/// [FakeResponse] queued via [enqueue], regardless of path (tests queue
/// responses in call order, mirroring how [AuthRepositoryImpl]'s retry-once flow
/// issues calls sequentially).
///
/// [enqueueGated] lets a test hold a response pending (via a [Completer])
/// until it explicitly resolves it — needed to assert TRUE concurrency (e.g.
/// "3 callers all see the refresh in flight before any of them observes a
/// result"), mirroring `apps/web/src/lib/auth-client.silent-refresh.test.ts`'s
/// single-flight test which holds `fetch`'s promise open the same way.
class FakeHttpClientAdapter implements HttpClientAdapter {
  final List<Object> _queue = []; // FakeResponse or _GatedResponse
  final List<RequestOptions> capturedRequests = [];

  void enqueue(FakeResponse response) => _queue.add(response);

  /// Queues a gated slot; returns the [Completer] the test uses to resolve
  /// it later with a real [FakeResponse]. `fetch` will suspend until
  /// [Completer.complete] is called.
  Completer<FakeResponse> enqueueGated() {
    final completer = Completer<FakeResponse>();
    _queue.add(completer);
    return completer;
  }

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    capturedRequests.add(options);
    if (_queue.isEmpty) {
      throw StateError('FakeHttpClientAdapter: no queued response for ${options.method} ${options.path}');
    }
    final queued = _queue.removeAt(0);
    final next = queued is Completer<FakeResponse> ? await queued.future : queued as FakeResponse;
    final body = next.jsonBody == null ? '' : jsonEncode(next.jsonBody);
    return ResponseBody.fromString(
      body,
      next.statusCode,
      headers: {
        'content-type': ['application/json'],
        ...next.headers,
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Dio buildFakeDio(FakeHttpClientAdapter adapter) {
  final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
  dio.httpClientAdapter = adapter;
  return dio;
}
