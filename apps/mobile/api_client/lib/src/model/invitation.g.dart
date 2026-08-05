// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invitation.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const InvitationStatusEnum _$invitationStatusEnum_pending =
    const InvitationStatusEnum._('pending');
const InvitationStatusEnum _$invitationStatusEnum_accepted =
    const InvitationStatusEnum._('accepted');
const InvitationStatusEnum _$invitationStatusEnum_cancelled =
    const InvitationStatusEnum._('cancelled');
const InvitationStatusEnum _$invitationStatusEnum_expired =
    const InvitationStatusEnum._('expired');

InvitationStatusEnum _$invitationStatusEnumValueOf(String name) {
  switch (name) {
    case 'pending':
      return _$invitationStatusEnum_pending;
    case 'accepted':
      return _$invitationStatusEnum_accepted;
    case 'cancelled':
      return _$invitationStatusEnum_cancelled;
    case 'expired':
      return _$invitationStatusEnum_expired;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<InvitationStatusEnum> _$invitationStatusEnumValues =
    BuiltSet<InvitationStatusEnum>(const <InvitationStatusEnum>[
  _$invitationStatusEnum_pending,
  _$invitationStatusEnum_accepted,
  _$invitationStatusEnum_cancelled,
  _$invitationStatusEnum_expired,
]);

Serializer<InvitationStatusEnum> _$invitationStatusEnumSerializer =
    _$InvitationStatusEnumSerializer();

class _$InvitationStatusEnumSerializer
    implements PrimitiveSerializer<InvitationStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'pending': 'pending',
    'accepted': 'accepted',
    'cancelled': 'cancelled',
    'expired': 'expired',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'pending': 'pending',
    'accepted': 'accepted',
    'cancelled': 'cancelled',
    'expired': 'expired',
  };

  @override
  final Iterable<Type> types = const <Type>[InvitationStatusEnum];
  @override
  final String wireName = 'InvitationStatusEnum';

  @override
  Object serialize(Serializers serializers, InvitationStatusEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  InvitationStatusEnum deserialize(Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      InvitationStatusEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$Invitation extends Invitation {
  @override
  final String id;
  @override
  final String email;
  @override
  final String roleId;
  @override
  final String roleName;
  @override
  final String? roleKey;
  @override
  final InvitationStatusEnum status;
  @override
  final DateTime expiresAt;
  @override
  final DateTime tokenIssuedAt;
  @override
  final String invitedByUserId;
  @override
  final DateTime createdAt;
  @override
  final DateTime? acceptedAt;
  @override
  final String? acceptedByUserId;
  @override
  final bool? acceptedUserCreatedAfterInvite;

  factory _$Invitation([void Function(InvitationBuilder)? updates]) =>
      (InvitationBuilder()..update(updates))._build();

  _$Invitation._(
      {required this.id,
      required this.email,
      required this.roleId,
      required this.roleName,
      this.roleKey,
      required this.status,
      required this.expiresAt,
      required this.tokenIssuedAt,
      required this.invitedByUserId,
      required this.createdAt,
      this.acceptedAt,
      this.acceptedByUserId,
      this.acceptedUserCreatedAfterInvite})
      : super._();
  @override
  Invitation rebuild(void Function(InvitationBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  InvitationBuilder toBuilder() => InvitationBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is Invitation &&
        id == other.id &&
        email == other.email &&
        roleId == other.roleId &&
        roleName == other.roleName &&
        roleKey == other.roleKey &&
        status == other.status &&
        expiresAt == other.expiresAt &&
        tokenIssuedAt == other.tokenIssuedAt &&
        invitedByUserId == other.invitedByUserId &&
        createdAt == other.createdAt &&
        acceptedAt == other.acceptedAt &&
        acceptedByUserId == other.acceptedByUserId &&
        acceptedUserCreatedAfterInvite == other.acceptedUserCreatedAfterInvite;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, roleId.hashCode);
    _$hash = $jc(_$hash, roleName.hashCode);
    _$hash = $jc(_$hash, roleKey.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, expiresAt.hashCode);
    _$hash = $jc(_$hash, tokenIssuedAt.hashCode);
    _$hash = $jc(_$hash, invitedByUserId.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, acceptedAt.hashCode);
    _$hash = $jc(_$hash, acceptedByUserId.hashCode);
    _$hash = $jc(_$hash, acceptedUserCreatedAfterInvite.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'Invitation')
          ..add('id', id)
          ..add('email', email)
          ..add('roleId', roleId)
          ..add('roleName', roleName)
          ..add('roleKey', roleKey)
          ..add('status', status)
          ..add('expiresAt', expiresAt)
          ..add('tokenIssuedAt', tokenIssuedAt)
          ..add('invitedByUserId', invitedByUserId)
          ..add('createdAt', createdAt)
          ..add('acceptedAt', acceptedAt)
          ..add('acceptedByUserId', acceptedByUserId)
          ..add(
              'acceptedUserCreatedAfterInvite', acceptedUserCreatedAfterInvite))
        .toString();
  }
}

class InvitationBuilder implements Builder<Invitation, InvitationBuilder> {
  _$Invitation? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

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

  InvitationStatusEnum? _status;
  InvitationStatusEnum? get status => _$this._status;
  set status(InvitationStatusEnum? status) => _$this._status = status;

  DateTime? _expiresAt;
  DateTime? get expiresAt => _$this._expiresAt;
  set expiresAt(DateTime? expiresAt) => _$this._expiresAt = expiresAt;

  DateTime? _tokenIssuedAt;
  DateTime? get tokenIssuedAt => _$this._tokenIssuedAt;
  set tokenIssuedAt(DateTime? tokenIssuedAt) =>
      _$this._tokenIssuedAt = tokenIssuedAt;

  String? _invitedByUserId;
  String? get invitedByUserId => _$this._invitedByUserId;
  set invitedByUserId(String? invitedByUserId) =>
      _$this._invitedByUserId = invitedByUserId;

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  DateTime? _acceptedAt;
  DateTime? get acceptedAt => _$this._acceptedAt;
  set acceptedAt(DateTime? acceptedAt) => _$this._acceptedAt = acceptedAt;

  String? _acceptedByUserId;
  String? get acceptedByUserId => _$this._acceptedByUserId;
  set acceptedByUserId(String? acceptedByUserId) =>
      _$this._acceptedByUserId = acceptedByUserId;

  bool? _acceptedUserCreatedAfterInvite;
  bool? get acceptedUserCreatedAfterInvite =>
      _$this._acceptedUserCreatedAfterInvite;
  set acceptedUserCreatedAfterInvite(bool? acceptedUserCreatedAfterInvite) =>
      _$this._acceptedUserCreatedAfterInvite = acceptedUserCreatedAfterInvite;

  InvitationBuilder() {
    Invitation._defaults(this);
  }

  InvitationBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _email = $v.email;
      _roleId = $v.roleId;
      _roleName = $v.roleName;
      _roleKey = $v.roleKey;
      _status = $v.status;
      _expiresAt = $v.expiresAt;
      _tokenIssuedAt = $v.tokenIssuedAt;
      _invitedByUserId = $v.invitedByUserId;
      _createdAt = $v.createdAt;
      _acceptedAt = $v.acceptedAt;
      _acceptedByUserId = $v.acceptedByUserId;
      _acceptedUserCreatedAfterInvite = $v.acceptedUserCreatedAfterInvite;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(Invitation other) {
    _$v = other as _$Invitation;
  }

  @override
  void update(void Function(InvitationBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  Invitation build() => _build();

  _$Invitation _build() {
    final _$result = _$v ??
        _$Invitation._(
          id: BuiltValueNullFieldError.checkNotNull(id, r'Invitation', 'id'),
          email: BuiltValueNullFieldError.checkNotNull(
              email, r'Invitation', 'email'),
          roleId: BuiltValueNullFieldError.checkNotNull(
              roleId, r'Invitation', 'roleId'),
          roleName: BuiltValueNullFieldError.checkNotNull(
              roleName, r'Invitation', 'roleName'),
          roleKey: roleKey,
          status: BuiltValueNullFieldError.checkNotNull(
              status, r'Invitation', 'status'),
          expiresAt: BuiltValueNullFieldError.checkNotNull(
              expiresAt, r'Invitation', 'expiresAt'),
          tokenIssuedAt: BuiltValueNullFieldError.checkNotNull(
              tokenIssuedAt, r'Invitation', 'tokenIssuedAt'),
          invitedByUserId: BuiltValueNullFieldError.checkNotNull(
              invitedByUserId, r'Invitation', 'invitedByUserId'),
          createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt, r'Invitation', 'createdAt'),
          acceptedAt: acceptedAt,
          acceptedByUserId: acceptedByUserId,
          acceptedUserCreatedAfterInvite: acceptedUserCreatedAfterInvite,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
