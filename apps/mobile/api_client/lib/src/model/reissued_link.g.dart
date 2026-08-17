// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reissued_link.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$ReissuedLink extends ReissuedLink {
  @override
  final String token;
  @override
  final String inviteUrl;
  @override
  final DateTime expiresAt;
  @override
  final DateTime tokenIssuedAt;
  @override
  final bool rotated;

  factory _$ReissuedLink([void Function(ReissuedLinkBuilder)? updates]) =>
      (ReissuedLinkBuilder()..update(updates))._build();

  _$ReissuedLink._(
      {required this.token,
      required this.inviteUrl,
      required this.expiresAt,
      required this.tokenIssuedAt,
      required this.rotated})
      : super._();
  @override
  ReissuedLink rebuild(void Function(ReissuedLinkBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  ReissuedLinkBuilder toBuilder() => ReissuedLinkBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is ReissuedLink &&
        token == other.token &&
        inviteUrl == other.inviteUrl &&
        expiresAt == other.expiresAt &&
        tokenIssuedAt == other.tokenIssuedAt &&
        rotated == other.rotated;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, token.hashCode);
    _$hash = $jc(_$hash, inviteUrl.hashCode);
    _$hash = $jc(_$hash, expiresAt.hashCode);
    _$hash = $jc(_$hash, tokenIssuedAt.hashCode);
    _$hash = $jc(_$hash, rotated.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'ReissuedLink')
          ..add('token', token)
          ..add('inviteUrl', inviteUrl)
          ..add('expiresAt', expiresAt)
          ..add('tokenIssuedAt', tokenIssuedAt)
          ..add('rotated', rotated))
        .toString();
  }
}

class ReissuedLinkBuilder
    implements Builder<ReissuedLink, ReissuedLinkBuilder> {
  _$ReissuedLink? _$v;

  String? _token;
  String? get token => _$this._token;
  set token(String? token) => _$this._token = token;

  String? _inviteUrl;
  String? get inviteUrl => _$this._inviteUrl;
  set inviteUrl(String? inviteUrl) => _$this._inviteUrl = inviteUrl;

  DateTime? _expiresAt;
  DateTime? get expiresAt => _$this._expiresAt;
  set expiresAt(DateTime? expiresAt) => _$this._expiresAt = expiresAt;

  DateTime? _tokenIssuedAt;
  DateTime? get tokenIssuedAt => _$this._tokenIssuedAt;
  set tokenIssuedAt(DateTime? tokenIssuedAt) =>
      _$this._tokenIssuedAt = tokenIssuedAt;

  bool? _rotated;
  bool? get rotated => _$this._rotated;
  set rotated(bool? rotated) => _$this._rotated = rotated;

  ReissuedLinkBuilder() {
    ReissuedLink._defaults(this);
  }

  ReissuedLinkBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _token = $v.token;
      _inviteUrl = $v.inviteUrl;
      _expiresAt = $v.expiresAt;
      _tokenIssuedAt = $v.tokenIssuedAt;
      _rotated = $v.rotated;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(ReissuedLink other) {
    _$v = other as _$ReissuedLink;
  }

  @override
  void update(void Function(ReissuedLinkBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  ReissuedLink build() => _build();

  _$ReissuedLink _build() {
    final _$result = _$v ??
        _$ReissuedLink._(
          token: BuiltValueNullFieldError.checkNotNull(
              token, r'ReissuedLink', 'token'),
          inviteUrl: BuiltValueNullFieldError.checkNotNull(
              inviteUrl, r'ReissuedLink', 'inviteUrl'),
          expiresAt: BuiltValueNullFieldError.checkNotNull(
              expiresAt, r'ReissuedLink', 'expiresAt'),
          tokenIssuedAt: BuiltValueNullFieldError.checkNotNull(
              tokenIssuedAt, r'ReissuedLink', 'tokenIssuedAt'),
          rotated: BuiltValueNullFieldError.checkNotNull(
              rotated, r'ReissuedLink', 'rotated'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
