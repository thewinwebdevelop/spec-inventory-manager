// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'member_row.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const MemberRowStatusEnum _$memberRowStatusEnum_active =
    const MemberRowStatusEnum._('active');
const MemberRowStatusEnum _$memberRowStatusEnum_invited =
    const MemberRowStatusEnum._('invited');
const MemberRowStatusEnum _$memberRowStatusEnum_revoked =
    const MemberRowStatusEnum._('revoked');

MemberRowStatusEnum _$memberRowStatusEnumValueOf(String name) {
  switch (name) {
    case 'active':
      return _$memberRowStatusEnum_active;
    case 'invited':
      return _$memberRowStatusEnum_invited;
    case 'revoked':
      return _$memberRowStatusEnum_revoked;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<MemberRowStatusEnum> _$memberRowStatusEnumValues =
    BuiltSet<MemberRowStatusEnum>(const <MemberRowStatusEnum>[
  _$memberRowStatusEnum_active,
  _$memberRowStatusEnum_invited,
  _$memberRowStatusEnum_revoked,
]);

Serializer<MemberRowStatusEnum> _$memberRowStatusEnumSerializer =
    _$MemberRowStatusEnumSerializer();

class _$MemberRowStatusEnumSerializer
    implements PrimitiveSerializer<MemberRowStatusEnum> {
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
  final Iterable<Type> types = const <Type>[MemberRowStatusEnum];
  @override
  final String wireName = 'MemberRowStatusEnum';

  @override
  Object serialize(Serializers serializers, MemberRowStatusEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  MemberRowStatusEnum deserialize(Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      MemberRowStatusEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$MemberRow extends MemberRow {
  @override
  final String userId;
  @override
  final String email;
  @override
  final String roleId;
  @override
  final String roleName;
  @override
  final String? roleKey;
  @override
  final MemberRowStatusEnum status;
  @override
  final DateTime? activatedAt;
  @override
  final DateTime? revokedAt;
  @override
  final DateTime createdAt;
  @override
  final bool isMe;
  @override
  final bool isOwner;

  factory _$MemberRow([void Function(MemberRowBuilder)? updates]) =>
      (MemberRowBuilder()..update(updates))._build();

  _$MemberRow._(
      {required this.userId,
      required this.email,
      required this.roleId,
      required this.roleName,
      this.roleKey,
      required this.status,
      this.activatedAt,
      this.revokedAt,
      required this.createdAt,
      required this.isMe,
      required this.isOwner})
      : super._();
  @override
  MemberRow rebuild(void Function(MemberRowBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  MemberRowBuilder toBuilder() => MemberRowBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is MemberRow &&
        userId == other.userId &&
        email == other.email &&
        roleId == other.roleId &&
        roleName == other.roleName &&
        roleKey == other.roleKey &&
        status == other.status &&
        activatedAt == other.activatedAt &&
        revokedAt == other.revokedAt &&
        createdAt == other.createdAt &&
        isMe == other.isMe &&
        isOwner == other.isOwner;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, userId.hashCode);
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, roleId.hashCode);
    _$hash = $jc(_$hash, roleName.hashCode);
    _$hash = $jc(_$hash, roleKey.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, activatedAt.hashCode);
    _$hash = $jc(_$hash, revokedAt.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, isMe.hashCode);
    _$hash = $jc(_$hash, isOwner.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'MemberRow')
          ..add('userId', userId)
          ..add('email', email)
          ..add('roleId', roleId)
          ..add('roleName', roleName)
          ..add('roleKey', roleKey)
          ..add('status', status)
          ..add('activatedAt', activatedAt)
          ..add('revokedAt', revokedAt)
          ..add('createdAt', createdAt)
          ..add('isMe', isMe)
          ..add('isOwner', isOwner))
        .toString();
  }
}

class MemberRowBuilder implements Builder<MemberRow, MemberRowBuilder> {
  _$MemberRow? _$v;

  String? _userId;
  String? get userId => _$this._userId;
  set userId(String? userId) => _$this._userId = userId;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  String? _roleId;
  String? get roleId => _$this._roleId;
  set roleId(String? roleId) => _$this._roleId = roleId;

  String? _roleName;
  String? get roleName => _$this._roleName;
  set roleName(String? roleName) => _$this._roleName = roleName;

  String? _roleKey;
  String? get roleKey => _$this._roleKey;
  set roleKey(String? roleKey) => _$this._roleKey = roleKey;

  MemberRowStatusEnum? _status;
  MemberRowStatusEnum? get status => _$this._status;
  set status(MemberRowStatusEnum? status) => _$this._status = status;

  DateTime? _activatedAt;
  DateTime? get activatedAt => _$this._activatedAt;
  set activatedAt(DateTime? activatedAt) => _$this._activatedAt = activatedAt;

  DateTime? _revokedAt;
  DateTime? get revokedAt => _$this._revokedAt;
  set revokedAt(DateTime? revokedAt) => _$this._revokedAt = revokedAt;

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  bool? _isMe;
  bool? get isMe => _$this._isMe;
  set isMe(bool? isMe) => _$this._isMe = isMe;

  bool? _isOwner;
  bool? get isOwner => _$this._isOwner;
  set isOwner(bool? isOwner) => _$this._isOwner = isOwner;

  MemberRowBuilder() {
    MemberRow._defaults(this);
  }

  MemberRowBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _userId = $v.userId;
      _email = $v.email;
      _roleId = $v.roleId;
      _roleName = $v.roleName;
      _roleKey = $v.roleKey;
      _status = $v.status;
      _activatedAt = $v.activatedAt;
      _revokedAt = $v.revokedAt;
      _createdAt = $v.createdAt;
      _isMe = $v.isMe;
      _isOwner = $v.isOwner;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(MemberRow other) {
    _$v = other as _$MemberRow;
  }

  @override
  void update(void Function(MemberRowBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  MemberRow build() => _build();

  _$MemberRow _build() {
    final _$result = _$v ??
        _$MemberRow._(
          userId: BuiltValueNullFieldError.checkNotNull(
              userId, r'MemberRow', 'userId'),
          email: BuiltValueNullFieldError.checkNotNull(
              email, r'MemberRow', 'email'),
          roleId: BuiltValueNullFieldError.checkNotNull(
              roleId, r'MemberRow', 'roleId'),
          roleName: BuiltValueNullFieldError.checkNotNull(
              roleName, r'MemberRow', 'roleName'),
          roleKey: roleKey,
          status: BuiltValueNullFieldError.checkNotNull(
              status, r'MemberRow', 'status'),
          activatedAt: activatedAt,
          revokedAt: revokedAt,
          createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt, r'MemberRow', 'createdAt'),
          isMe:
              BuiltValueNullFieldError.checkNotNull(isMe, r'MemberRow', 'isMe'),
          isOwner: BuiltValueNullFieldError.checkNotNull(
              isOwner, r'MemberRow', 'isOwner'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
