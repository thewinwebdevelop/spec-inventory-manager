// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sessions_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$SessionsResponse extends SessionsResponse {
  @override
  final BuiltList<Session> sessions;

  factory _$SessionsResponse(
          [void Function(SessionsResponseBuilder)? updates]) =>
      (SessionsResponseBuilder()..update(updates))._build();

  _$SessionsResponse._({required this.sessions}) : super._();
  @override
  SessionsResponse rebuild(void Function(SessionsResponseBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  SessionsResponseBuilder toBuilder() =>
      SessionsResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is SessionsResponse && sessions == other.sessions;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, sessions.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'SessionsResponse')
          ..add('sessions', sessions))
        .toString();
  }
}

class SessionsResponseBuilder
    implements Builder<SessionsResponse, SessionsResponseBuilder> {
  _$SessionsResponse? _$v;

  ListBuilder<Session>? _sessions;
  ListBuilder<Session> get sessions =>
      _$this._sessions ??= ListBuilder<Session>();
  set sessions(ListBuilder<Session>? sessions) => _$this._sessions = sessions;

  SessionsResponseBuilder() {
    SessionsResponse._defaults(this);
  }

  SessionsResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _sessions = $v.sessions.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(SessionsResponse other) {
    _$v = other as _$SessionsResponse;
  }

  @override
  void update(void Function(SessionsResponseBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  SessionsResponse build() => _build();

  _$SessionsResponse _build() {
    _$SessionsResponse _$result;
    try {
      _$result = _$v ??
          _$SessionsResponse._(
            sessions: sessions.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'sessions';
        sessions.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'SessionsResponse', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
