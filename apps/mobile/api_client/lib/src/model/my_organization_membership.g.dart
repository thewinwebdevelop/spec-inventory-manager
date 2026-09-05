// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_organization_membership.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const MyOrganizationMembershipStatusEnum
    _$myOrganizationMembershipStatusEnum_active =
    const MyOrganizationMembershipStatusEnum._('active');
const MyOrganizationMembershipStatusEnum
    _$myOrganizationMembershipStatusEnum_invited =
    const MyOrganizationMembershipStatusEnum._('invited');
const MyOrganizationMembershipStatusEnum
    _$myOrganizationMembershipStatusEnum_revoked =
    const MyOrganizationMembershipStatusEnum._('revoked');

MyOrganizationMembershipStatusEnum _$myOrganizationMembershipStatusEnumValueOf(
    String name) {
  switch (name) {
    case 'active':
      return _$myOrganizationMembershipStatusEnum_active;
    case 'invited':
      return _$myOrganizationMembershipStatusEnum_invited;
    case 'revoked':
      return _$myOrganizationMembershipStatusEnum_revoked;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<MyOrganizationMembershipStatusEnum>
    _$myOrganizationMembershipStatusEnumValues = BuiltSet<
        MyOrganizationMembershipStatusEnum>(const <MyOrganizationMembershipStatusEnum>[
  _$myOrganizationMembershipStatusEnum_active,
  _$myOrganizationMembershipStatusEnum_invited,
  _$myOrganizationMembershipStatusEnum_revoked,
]);

Serializer<MyOrganizationMembershipStatusEnum>
    _$myOrganizationMembershipStatusEnumSerializer =
    _$MyOrganizationMembershipStatusEnumSerializer();

class _$MyOrganizationMembershipStatusEnumSerializer
    implements PrimitiveSerializer<MyOrganizationMembershipStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'active': 'active',
    'invited': 'invited',
    'revoked': 'revoked',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'active': 'active',
    'invited': 'invited',
    'revoked': 'revoked',
  };

  @override
  final Iterable<Type> types = const <Type>[MyOrganizationMembershipStatusEnum];
  @override
  final String wireName = 'MyOrganizationMembershipStatusEnum';

  @override
  Object serialize(
          Serializers serializers, MyOrganizationMembershipStatusEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  MyOrganizationMembershipStatusEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      MyOrganizationMembershipStatusEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$MyOrganizationMembership extends MyOrganizationMembership {
  @override
  final MyOrganizationMembershipStatusEnum status;
  @override
  final String? roleId;
  @override
  final String? roleName;
  @override
  final String? roleKey;
  @override
  final DateTime? revokedAt;

  factory _$MyOrganizationMembership(
          [void Function(MyOrganizationMembershipBuilder)? updates]) =>
      (MyOrganizationMembershipBuilder()..update(updates))._build();

  _$MyOrganizationMembership._(
      {required this.status,
      this.roleId,
      this.roleName,
      this.roleKey,
      this.revokedAt})
      : super._();
  @override
  MyOrganizationMembership rebuild(
          void Function(MyOrganizationMembershipBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  MyOrganizationMembershipBuilder toBuilder() =>
      MyOrganizationMembershipBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is MyOrganizationMembership &&
        status == other.status &&
        roleId == other.roleId &&
        roleName == other.roleName &&
        roleKey == other.roleKey &&
        revokedAt == other.revokedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, roleId.hashCode);
    _$hash = $jc(_$hash, roleName.hashCode);
    _$hash = $jc(_$hash, roleKey.hashCode);
    _$hash = $jc(_$hash, revokedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'MyOrganizationMembership')
          ..add('status', status)
          ..add('roleId', roleId)
          ..add('roleName', roleName)
          ..add('roleKey', roleKey)
          ..add('revokedAt', revokedAt))
        .toString();
  }
}

class MyOrganizationMembershipBuilder
    implements
        Builder<MyOrganizationMembership, MyOrganizationMembershipBuilder> {
  _$MyOrganizationMembership? _$v;

  MyOrganizationMembershipStatusEnum? _status;
  MyOrganizationMembershipStatusEnum? get status => _$this._status;
  set status(MyOrganizationMembershipStatusEnum? status) =>
      _$this._status = status;

  String? _roleId;
  String? get roleId => _$this._roleId;
  set roleId(String? roleId) => _$this._roleId = roleId;

  String? _roleName;
  String? get roleName => _$this._roleName;
  set roleName(String? roleName) => _$this._roleName = roleName;

  String? _roleKey;
  String? get roleKey => _$this._roleKey;
  set roleKey(String? roleKey) => _$this._roleKey = roleKey;

  DateTime? _revokedAt;
  DateTime? get revokedAt => _$this._revokedAt;
  set revokedAt(DateTime? revokedAt) => _$this._revokedAt = revokedAt;

  MyOrganizationMembershipBuilder() {
    MyOrganizationMembership._defaults(this);
  }

  MyOrganizationMembershipBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _status = $v.status;
      _roleId = $v.roleId;
      _roleName = $v.roleName;
      _roleKey = $v.roleKey;
      _revokedAt = $v.revokedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(MyOrganizationMembership other) {
    _$v = other as _$MyOrganizationMembership;
  }

  @override
  void update(void Function(MyOrganizationMembershipBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  MyOrganizationMembership build() => _build();

  _$MyOrganizationMembership _build() {
    final _$result = _$v ??
        _$MyOrganizationMembership._(
          status: BuiltValueNullFieldError.checkNotNull(
              status, r'MyOrganizationMembership', 'status'),
          roleId: roleId,
          roleName: roleName,
          roleKey: roleKey,
          revokedAt: revokedAt,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
