// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invitation_preview.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const InvitationPreviewStatusEnum _$invitationPreviewStatusEnum_pending =
    const InvitationPreviewStatusEnum._('pending');
const InvitationPreviewStatusEnum _$invitationPreviewStatusEnum_accepted =
    const InvitationPreviewStatusEnum._('accepted');
const InvitationPreviewStatusEnum _$invitationPreviewStatusEnum_cancelled =
    const InvitationPreviewStatusEnum._('cancelled');
const InvitationPreviewStatusEnum _$invitationPreviewStatusEnum_expired =
    const InvitationPreviewStatusEnum._('expired');

InvitationPreviewStatusEnum _$invitationPreviewStatusEnumValueOf(String name) {
  switch (name) {
    case 'pending':
      return _$invitationPreviewStatusEnum_pending;
    case 'accepted':
      return _$invitationPreviewStatusEnum_accepted;
    case 'cancelled':
      return _$invitationPreviewStatusEnum_cancelled;
    case 'expired':
      return _$invitationPreviewStatusEnum_expired;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<InvitationPreviewStatusEnum>
    _$invitationPreviewStatusEnumValues =
    BuiltSet<InvitationPreviewStatusEnum>(const <InvitationPreviewStatusEnum>[
  _$invitationPreviewStatusEnum_pending,
  _$invitationPreviewStatusEnum_accepted,
  _$invitationPreviewStatusEnum_cancelled,
  _$invitationPreviewStatusEnum_expired,
]);

Serializer<InvitationPreviewStatusEnum>
    _$invitationPreviewStatusEnumSerializer =
    _$InvitationPreviewStatusEnumSerializer();

class _$InvitationPreviewStatusEnumSerializer
    implements PrimitiveSerializer<InvitationPreviewStatusEnum> {
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
  final Iterable<Type> types = const <Type>[InvitationPreviewStatusEnum];
  @override
  final String wireName = 'InvitationPreviewStatusEnum';

  @override
  Object serialize(Serializers serializers, InvitationPreviewStatusEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  InvitationPreviewStatusEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      InvitationPreviewStatusEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$InvitationPreview extends InvitationPreview {
  @override
  final String organizationName;
  @override
  final String roleName;
  @override
  final String? roleKey;
  @override
  final String emailMasked;
  @override
  final DateTime expiresAt;
  @override
  final InvitationPreviewStatusEnum status;

  factory _$InvitationPreview(
          [void Function(InvitationPreviewBuilder)? updates]) =>
      (InvitationPreviewBuilder()..update(updates))._build();

  _$InvitationPreview._(
      {required this.organizationName,
      required this.roleName,
      this.roleKey,
      required this.emailMasked,
      required this.expiresAt,
      required this.status})
      : super._();
  @override
  InvitationPreview rebuild(void Function(InvitationPreviewBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  InvitationPreviewBuilder toBuilder() =>
      InvitationPreviewBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is InvitationPreview &&
        organizationName == other.organizationName &&
        roleName == other.roleName &&
        roleKey == other.roleKey &&
        emailMasked == other.emailMasked &&
        expiresAt == other.expiresAt &&
        status == other.status;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, organizationName.hashCode);
    _$hash = $jc(_$hash, roleName.hashCode);
    _$hash = $jc(_$hash, roleKey.hashCode);
    _$hash = $jc(_$hash, emailMasked.hashCode);
    _$hash = $jc(_$hash, expiresAt.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'InvitationPreview')
          ..add('organizationName', organizationName)
          ..add('roleName', roleName)
          ..add('roleKey', roleKey)
          ..add('emailMasked', emailMasked)
          ..add('expiresAt', expiresAt)
          ..add('status', status))
        .toString();
  }
}

class InvitationPreviewBuilder
    implements Builder<InvitationPreview, InvitationPreviewBuilder> {
  _$InvitationPreview? _$v;

  String? _organizationName;
  String? get organizationName => _$this._organizationName;
  set organizationName(String? organizationName) =>
      _$this._organizationName = organizationName;

  String? _roleName;
  String? get roleName => _$this._roleName;
  set roleName(String? roleName) => _$this._roleName = roleName;

  String? _roleKey;
  String? get roleKey => _$this._roleKey;
  set roleKey(String? roleKey) => _$this._roleKey = roleKey;

  String? _emailMasked;
  String? get emailMasked => _$this._emailMasked;
  set emailMasked(String? emailMasked) => _$this._emailMasked = emailMasked;

  DateTime? _expiresAt;
  DateTime? get expiresAt => _$this._expiresAt;
  set expiresAt(DateTime? expiresAt) => _$this._expiresAt = expiresAt;

  InvitationPreviewStatusEnum? _status;
  InvitationPreviewStatusEnum? get status => _$this._status;
  set status(InvitationPreviewStatusEnum? status) => _$this._status = status;

  InvitationPreviewBuilder() {
    InvitationPreview._defaults(this);
  }

  InvitationPreviewBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _organizationName = $v.organizationName;
      _roleName = $v.roleName;
      _roleKey = $v.roleKey;
      _emailMasked = $v.emailMasked;
      _expiresAt = $v.expiresAt;
      _status = $v.status;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(InvitationPreview other) {
    _$v = other as _$InvitationPreview;
  }

  @override
  void update(void Function(InvitationPreviewBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  InvitationPreview build() => _build();

  _$InvitationPreview _build() {
    final _$result = _$v ??
        _$InvitationPreview._(
          organizationName: BuiltValueNullFieldError.checkNotNull(
              organizationName, r'InvitationPreview', 'organizationName'),
          roleName: BuiltValueNullFieldError.checkNotNull(
              roleName, r'InvitationPreview', 'roleName'),
          roleKey: roleKey,
          emailMasked: BuiltValueNullFieldError.checkNotNull(
              emailMasked, r'InvitationPreview', 'emailMasked'),
          expiresAt: BuiltValueNullFieldError.checkNotNull(
              expiresAt, r'InvitationPreview', 'expiresAt'),
          status: BuiltValueNullFieldError.checkNotNull(
              status, r'InvitationPreview', 'status'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
