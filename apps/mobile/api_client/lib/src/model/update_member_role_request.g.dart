// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_member_role_request.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$UpdateMemberRoleRequest extends UpdateMemberRoleRequest {
  @override
  final String roleId;

  factory _$UpdateMemberRoleRequest(
          [void Function(UpdateMemberRoleRequestBuilder)? updates]) =>
      (UpdateMemberRoleRequestBuilder()..update(updates))._build();

  _$UpdateMemberRoleRequest._({required this.roleId}) : super._();
  @override
  UpdateMemberRoleRequest rebuild(
          void Function(UpdateMemberRoleRequestBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  UpdateMemberRoleRequestBuilder toBuilder() =>
      UpdateMemberRoleRequestBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is UpdateMemberRoleRequest && roleId == other.roleId;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, roleId.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'UpdateMemberRoleRequest')
          ..add('roleId', roleId))
        .toString();
  }
}

class UpdateMemberRoleRequestBuilder
    implements
        Builder<UpdateMemberRoleRequest, UpdateMemberRoleRequestBuilder> {
  _$UpdateMemberRoleRequest? _$v;

  String? _roleId;
  String? get roleId => _$this._roleId;
  set roleId(String? roleId) => _$this._roleId = roleId;

  UpdateMemberRoleRequestBuilder() {
    UpdateMemberRoleRequest._defaults(this);
  }

  UpdateMemberRoleRequestBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _roleId = $v.roleId;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(UpdateMemberRoleRequest other) {
    _$v = other as _$UpdateMemberRoleRequest;
  }

  @override
  void update(void Function(UpdateMemberRoleRequestBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  UpdateMemberRoleRequest build() => _build();

  _$UpdateMemberRoleRequest _build() {
    final _$result = _$v ??
        _$UpdateMemberRoleRequest._(
          roleId: BuiltValueNullFieldError.checkNotNull(
              roleId, r'UpdateMemberRoleRequest', 'roleId'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
