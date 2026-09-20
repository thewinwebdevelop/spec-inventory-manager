// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'org_my_membership.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OrgMyMembership extends OrgMyMembership {
  @override
  final String roleId;
  @override
  final String roleName;
  @override
  final String? roleKey;
  @override
  final BuiltList<String> capabilities;
  @override
  final String status;

  factory _$OrgMyMembership([void Function(OrgMyMembershipBuilder)? updates]) =>
      (OrgMyMembershipBuilder()..update(updates))._build();

  _$OrgMyMembership._(
      {required this.roleId,
      required this.roleName,
      this.roleKey,
      required this.capabilities,
      required this.status})
      : super._();
  @override
  OrgMyMembership rebuild(void Function(OrgMyMembershipBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OrgMyMembershipBuilder toBuilder() => OrgMyMembershipBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OrgMyMembership &&
        roleId == other.roleId &&
        roleName == other.roleName &&
        roleKey == other.roleKey &&
        capabilities == other.capabilities &&
        status == other.status;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, roleId.hashCode);
    _$hash = $jc(_$hash, roleName.hashCode);
    _$hash = $jc(_$hash, roleKey.hashCode);
    _$hash = $jc(_$hash, capabilities.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OrgMyMembership')
          ..add('roleId', roleId)
          ..add('roleName', roleName)
          ..add('roleKey', roleKey)
          ..add('capabilities', capabilities)
          ..add('status', status))
        .toString();
  }
}

class OrgMyMembershipBuilder
    implements Builder<OrgMyMembership, OrgMyMembershipBuilder> {
  _$OrgMyMembership? _$v;

  String? _roleId;
  String? get roleId => _$this._roleId;
  set roleId(String? roleId) => _$this._roleId = roleId;

  String? _roleName;
  String? get roleName => _$this._roleName;
  set roleName(String? roleName) => _$this._roleName = roleName;

  String? _roleKey;
  String? get roleKey => _$this._roleKey;
  set roleKey(String? roleKey) => _$this._roleKey = roleKey;

  ListBuilder<String>? _capabilities;
  ListBuilder<String> get capabilities =>
      _$this._capabilities ??= ListBuilder<String>();
  set capabilities(ListBuilder<String>? capabilities) =>
      _$this._capabilities = capabilities;

  String? _status;
  String? get status => _$this._status;
  set status(String? status) => _$this._status = status;

  OrgMyMembershipBuilder() {
    OrgMyMembership._defaults(this);
  }

  OrgMyMembershipBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _roleId = $v.roleId;
      _roleName = $v.roleName;
      _roleKey = $v.roleKey;
      _capabilities = $v.capabilities.toBuilder();
      _status = $v.status;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OrgMyMembership other) {
    _$v = other as _$OrgMyMembership;
  }

  @override
  void update(void Function(OrgMyMembershipBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OrgMyMembership build() => _build();

  _$OrgMyMembership _build() {
    _$OrgMyMembership _$result;
    try {
      _$result = _$v ??
          _$OrgMyMembership._(
            roleId: BuiltValueNullFieldError.checkNotNull(
                roleId, r'OrgMyMembership', 'roleId'),
            roleName: BuiltValueNullFieldError.checkNotNull(
                roleName, r'OrgMyMembership', 'roleName'),
            roleKey: roleKey,
            capabilities: capabilities.build(),
            status: BuiltValueNullFieldError.checkNotNull(
                status, r'OrgMyMembership', 'status'),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'capabilities';
        capabilities.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'OrgMyMembership', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
