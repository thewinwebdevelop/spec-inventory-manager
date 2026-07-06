// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'refresh_request.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$RefreshRequest extends RefreshRequest {
  @override
  final String? refreshToken;
  @override
  final String? deviceId;

  factory _$RefreshRequest([void Function(RefreshRequestBuilder)? updates]) =>
      (RefreshRequestBuilder()..update(updates))._build();

  _$RefreshRequest._({this.refreshToken, this.deviceId}) : super._();
  @override
  RefreshRequest rebuild(void Function(RefreshRequestBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  RefreshRequestBuilder toBuilder() => RefreshRequestBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RefreshRequest &&
        refreshToken == other.refreshToken &&
        deviceId == other.deviceId;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, refreshToken.hashCode);
    _$hash = $jc(_$hash, deviceId.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'RefreshRequest')
          ..add('refreshToken', refreshToken)
          ..add('deviceId', deviceId))
        .toString();
  }
}

class RefreshRequestBuilder
    implements Builder<RefreshRequest, RefreshRequestBuilder> {
  _$RefreshRequest? _$v;

  String? _refreshToken;
  String? get refreshToken => _$this._refreshToken;
  set refreshToken(String? refreshToken) => _$this._refreshToken = refreshToken;

  String? _deviceId;
  String? get deviceId => _$this._deviceId;
  set deviceId(String? deviceId) => _$this._deviceId = deviceId;

  RefreshRequestBuilder() {
    RefreshRequest._defaults(this);
  }

  RefreshRequestBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _refreshToken = $v.refreshToken;
      _deviceId = $v.deviceId;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RefreshRequest other) {
    _$v = other as _$RefreshRequest;
  }

  @override
  void update(void Function(RefreshRequestBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RefreshRequest build() => _build();

  _$RefreshRequest _build() {
    final _$result = _$v ??
        _$RefreshRequest._(
          refreshToken: refreshToken,
          deviceId: deviceId,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
