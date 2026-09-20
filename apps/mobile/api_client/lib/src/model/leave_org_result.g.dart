// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'leave_org_result.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const LeaveOrgResultStatusEnum _$leaveOrgResultStatusEnum_revoked =
    const LeaveOrgResultStatusEnum._('revoked');

LeaveOrgResultStatusEnum _$leaveOrgResultStatusEnumValueOf(String name) {
  switch (name) {
    case 'revoked':
      return _$leaveOrgResultStatusEnum_revoked;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<LeaveOrgResultStatusEnum> _$leaveOrgResultStatusEnumValues =
    BuiltSet<LeaveOrgResultStatusEnum>(const <LeaveOrgResultStatusEnum>[
  _$leaveOrgResultStatusEnum_revoked,
]);

Serializer<LeaveOrgResultStatusEnum> _$leaveOrgResultStatusEnumSerializer =
    _$LeaveOrgResultStatusEnumSerializer();

class _$LeaveOrgResultStatusEnumSerializer
    implements PrimitiveSerializer<LeaveOrgResultStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'revoked': 'revoked',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'revoked': 'revoked',
  };

  @override
  final Iterable<Type> types = const <Type>[LeaveOrgResultStatusEnum];
  @override
  final String wireName = 'LeaveOrgResultStatusEnum';

  @override
  Object serialize(Serializers serializers, LeaveOrgResultStatusEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  LeaveOrgResultStatusEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      LeaveOrgResultStatusEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$LeaveOrgResult extends LeaveOrgResult {
  @override
  final String organizationId;
  @override
  final LeaveOrgResultStatusEnum status;
  @override
  final DateTime revokedAt;
  @override
  final int cancelledInvitations;

  factory _$LeaveOrgResult([void Function(LeaveOrgResultBuilder)? updates]) =>
      (LeaveOrgResultBuilder()..update(updates))._build();

  _$LeaveOrgResult._(
      {required this.organizationId,
      required this.status,
      required this.revokedAt,
      required this.cancelledInvitations})
      : super._();
  @override
  LeaveOrgResult rebuild(void Function(LeaveOrgResultBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  LeaveOrgResultBuilder toBuilder() => LeaveOrgResultBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LeaveOrgResult &&
        organizationId == other.organizationId &&
        status == other.status &&
        revokedAt == other.revokedAt &&
        cancelledInvitations == other.cancelledInvitations;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, organizationId.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, revokedAt.hashCode);
    _$hash = $jc(_$hash, cancelledInvitations.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'LeaveOrgResult')
          ..add('organizationId', organizationId)
          ..add('status', status)
          ..add('revokedAt', revokedAt)
          ..add('cancelledInvitations', cancelledInvitations))
        .toString();
  }
}

class LeaveOrgResultBuilder
    implements Builder<LeaveOrgResult, LeaveOrgResultBuilder> {
  _$LeaveOrgResult? _$v;

  String? _organizationId;
  String? get organizationId => _$this._organizationId;
  set organizationId(String? organizationId) =>
      _$this._organizationId = organizationId;

  LeaveOrgResultStatusEnum? _status;
  LeaveOrgResultStatusEnum? get status => _$this._status;
  set status(LeaveOrgResultStatusEnum? status) => _$this._status = status;

  DateTime? _revokedAt;
  DateTime? get revokedAt => _$this._revokedAt;
  set revokedAt(DateTime? revokedAt) => _$this._revokedAt = revokedAt;

  int? _cancelledInvitations;
  int? get cancelledInvitations => _$this._cancelledInvitations;
  set cancelledInvitations(int? cancelledInvitations) =>
      _$this._cancelledInvitations = cancelledInvitations;

  LeaveOrgResultBuilder() {
    LeaveOrgResult._defaults(this);
  }

  LeaveOrgResultBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _organizationId = $v.organizationId;
      _status = $v.status;
      _revokedAt = $v.revokedAt;
      _cancelledInvitations = $v.cancelledInvitations;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LeaveOrgResult other) {
    _$v = other as _$LeaveOrgResult;
  }

  @override
  void update(void Function(LeaveOrgResultBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  LeaveOrgResult build() => _build();

  _$LeaveOrgResult _build() {
    final _$result = _$v ??
        _$LeaveOrgResult._(
          organizationId: BuiltValueNullFieldError.checkNotNull(
              organizationId, r'LeaveOrgResult', 'organizationId'),
          status: BuiltValueNullFieldError.checkNotNull(
              status, r'LeaveOrgResult', 'status'),
          revokedAt: BuiltValueNullFieldError.checkNotNull(
              revokedAt, r'LeaveOrgResult', 'revokedAt'),
          cancelledInvitations: BuiltValueNullFieldError.checkNotNull(
              cancelledInvitations, r'LeaveOrgResult', 'cancelledInvitations'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
