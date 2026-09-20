// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'new_organization_membership.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$NewOrganizationMembership extends NewOrganizationMembership {
  @override
  final String userId;
  @override
  final String roleId;
  @override
  final String roleName;
  @override
  final String? roleKey;
  @override
  final String status;

  factory _$NewOrganizationMembership(
          [void Function(NewOrganizationMembershipBuilder)? updates]) =>
      (NewOrganizationMembershipBuilder()..update(updates))._build();

  _$NewOrganizationMembership._(
      {required this.userId,
      required this.roleId,
      required this.roleName,
      this.roleKey,
      required this.status})
      : super._();
  @override
  NewOrganizationMembership rebuild(
          void Function(NewOrganizationMembershipBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  NewOrganizationMembershipBuilder toBuilder() =>
      NewOrganizationMembershipBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is NewOrganizationMembership &&
        userId == other.userId &&
        roleId == other.roleId &&
        roleName == other.roleName &&
        roleKey == other.roleKey &&
        status == other.status;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, userId.hashCode);
    _$hash = $jc(_$hash, roleId.hashCode);
    _$hash = $jc(_$hash, roleName.hashCode);
    _$hash = $jc(_$hash, roleKey.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'NewOrganizationMembership')
          ..add('userId', userId)
          ..add('roleId', roleId)
          ..add('roleName', roleName)
          ..add('roleKey', roleKey)
          ..add('status', status))
        .toString();
  }
}

class NewOrganizationMembershipBuilder
    implements
        Builder<NewOrganizationMembership, NewOrganizationMembershipBuilder> {
  _$NewOrganizationMembership? _$v;

  String? _userId;
  String? get userId => _$this._userId;
  set userId(String? userId) => _$this._userId = userId;

  String? _roleId;
  String? get roleId => _$this._roleId;
  set roleId(String? roleId) => _$this._roleId = roleId;

  String? _roleName;
  String? get roleName => _$this._roleName;
  set roleName(String? roleName) => _$this._roleName = roleName;

  String? _roleKey;
  String? get roleKey => _$this._roleKey;
  set roleKey(String? roleKey) => _$this._roleKey = roleKey;

  String? _status;
  String? get status => _$this._status;
  set status(String? status) => _$this._status = status;

  NewOrganizationMembershipBuilder() {
    NewOrganizationMembership._defaults(this);
  }

  NewOrganizationMembershipBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _userId = $v.userId;
      _roleId = $v.roleId;
      _roleName = $v.roleName;
      _roleKey = $v.roleKey;
      _status = $v.status;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(NewOrganizationMembership other) {
    _$v = other as _$NewOrganizationMembership;
  }

  @override
  void update(void Function(NewOrganizationMembershipBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  NewOrganizationMembership build() => _build();

  _$NewOrganizationMembership _build() {
    final _$result = _$v ??
        _$NewOrganizationMembership._(
          userId: BuiltValueNullFieldError.checkNotNull(
              userId, r'NewOrganizationMembership', 'userId'),
          roleId: BuiltValueNullFieldError.checkNotNull(
              roleId, r'NewOrganizationMembership', 'roleId'),
          roleName: BuiltValueNullFieldError.checkNotNull(
              roleName, r'NewOrganizationMembership', 'roleName'),
          roleKey: roleKey,
          status: BuiltValueNullFieldError.checkNotNull(
              status, r'NewOrganizationMembership', 'status'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
