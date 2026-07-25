// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_reset_request.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminResetRequest extends AdminResetRequest {
  @override
  final String newPassword;

  factory _$AdminResetRequest(
          [void Function(AdminResetRequestBuilder)? updates]) =>
      (AdminResetRequestBuilder()..update(updates))._build();

  _$AdminResetRequest._({required this.newPassword}) : super._();
  @override
  AdminResetRequest rebuild(void Function(AdminResetRequestBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  AdminResetRequestBuilder toBuilder() =>
      AdminResetRequestBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminResetRequest && newPassword == other.newPassword;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, newPassword.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AdminResetRequest')
          ..add('newPassword', newPassword))
        .toString();
  }
}

class AdminResetRequestBuilder
    implements Builder<AdminResetRequest, AdminResetRequestBuilder> {
  _$AdminResetRequest? _$v;

  String? _newPassword;
  String? get newPassword => _$this._newPassword;
  set newPassword(String? newPassword) => _$this._newPassword = newPassword;

  AdminResetRequestBuilder() {
    AdminResetRequest._defaults(this);
  }

  AdminResetRequestBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _newPassword = $v.newPassword;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminResetRequest other) {
    _$v = other as _$AdminResetRequest;
  }

  @override
  void update(void Function(AdminResetRequestBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminResetRequest build() => _build();

  _$AdminResetRequest _build() {
    final _$result = _$v ??
        _$AdminResetRequest._(
          newPassword: BuiltValueNullFieldError.checkNotNull(
              newPassword, r'AdminResetRequest', 'newPassword'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
