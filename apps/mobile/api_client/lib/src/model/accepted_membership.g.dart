// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'accepted_membership.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AcceptedMembershipStatusEnum _$acceptedMembershipStatusEnum_active =
    const AcceptedMembershipStatusEnum._('active');

AcceptedMembershipStatusEnum _$acceptedMembershipStatusEnumValueOf(
    String name) {
  switch (name) {
    case 'active':
      return _$acceptedMembershipStatusEnum_active;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AcceptedMembershipStatusEnum>
    _$acceptedMembershipStatusEnumValues =
    BuiltSet<AcceptedMembershipStatusEnum>(const <AcceptedMembershipStatusEnum>[
  _$acceptedMembershipStatusEnum_active,
]);

Serializer<AcceptedMembershipStatusEnum>
    _$acceptedMembershipStatusEnumSerializer =
    _$AcceptedMembershipStatusEnumSerializer();

class _$AcceptedMembershipStatusEnumSerializer
    implements PrimitiveSerializer<AcceptedMembershipStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'active': 'active',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'active': 'active',
  };

  @override
  final Iterable<Type> types = const <Type>[AcceptedMembershipStatusEnum];
  @override
  final String wireName = 'AcceptedMembershipStatusEnum';

  @override
  Object serialize(Serializers serializers, AcceptedMembershipStatusEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  AcceptedMembershipStatusEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      AcceptedMembershipStatusEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$AcceptedMembership extends AcceptedMembership {
  @override
  final String roleId;
  @override
  final String roleName;
  @override
  final String? roleKey;
  @override
  final AcceptedMembershipStatusEnum status;

  factory _$AcceptedMembership(
          [void Function(AcceptedMembershipBuilder)? updates]) =>
      (AcceptedMembershipBuilder()..update(updates))._build();

  _$AcceptedMembership._(
      {required this.roleId,
      required this.roleName,
      this.roleKey,
      required this.status})
      : super._();
  @override
  AcceptedMembership rebuild(
          void Function(AcceptedMembershipBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  AcceptedMembershipBuilder toBuilder() =>
      AcceptedMembershipBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AcceptedMembership &&
        roleId == other.roleId &&
        roleName == other.roleName &&
        roleKey == other.roleKey &&
        status == other.status;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, roleId.hashCode);
    _$hash = $jc(_$hash, roleName.hashCode);
    _$hash = $jc(_$hash, roleKey.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AcceptedMembership')
          ..add('roleId', roleId)
          ..add('roleName', roleName)
          ..add('roleKey', roleKey)
          ..add('status', status))
        .toString();
  }
}

class AcceptedMembershipBuilder
    implements Builder<AcceptedMembership, AcceptedMembershipBuilder> {
  _$AcceptedMembership? _$v;

  String? _roleId;
  String? get roleId => _$this._roleId;
  set roleId(String? roleId) => _$this._roleId = roleId;

  String? _roleName;
  String? get roleName => _$this._roleName;
  set roleName(String? roleName) => _$this._roleName = roleName;

  String? _roleKey;
  String? get roleKey => _$this._roleKey;
  set roleKey(String? roleKey) => _$this._roleKey = roleKey;

  AcceptedMembershipStatusEnum? _status;
  AcceptedMembershipStatusEnum? get status => _$this._status;
  set status(AcceptedMembershipStatusEnum? status) => _$this._status = status;

  AcceptedMembershipBuilder() {
    AcceptedMembership._defaults(this);
  }

  AcceptedMembershipBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _roleId = $v.roleId;
      _roleName = $v.roleName;
      _roleKey = $v.roleKey;
      _status = $v.status;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AcceptedMembership other) {
    _$v = other as _$AcceptedMembership;
  }

  @override
  void update(void Function(AcceptedMembershipBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AcceptedMembership build() => _build();

  _$AcceptedMembership _build() {
    final _$result = _$v ??
        _$AcceptedMembership._(
          roleId: BuiltValueNullFieldError.checkNotNull(
              roleId, r'AcceptedMembership', 'roleId'),
          roleName: BuiltValueNullFieldError.checkNotNull(
              roleName, r'AcceptedMembership', 'roleName'),
          roleKey: roleKey,
          status: BuiltValueNullFieldError.checkNotNull(
              status, r'AcceptedMembership', 'status'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
