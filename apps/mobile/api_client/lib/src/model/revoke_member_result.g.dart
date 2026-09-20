// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'revoke_member_result.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const RevokeMemberResultStatusEnum _$revokeMemberResultStatusEnum_revoked =
    const RevokeMemberResultStatusEnum._('revoked');

RevokeMemberResultStatusEnum _$revokeMemberResultStatusEnumValueOf(
    String name) {
  switch (name) {
    case 'revoked':
      return _$revokeMemberResultStatusEnum_revoked;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<RevokeMemberResultStatusEnum>
    _$revokeMemberResultStatusEnumValues =
    BuiltSet<RevokeMemberResultStatusEnum>(const <RevokeMemberResultStatusEnum>[
  _$revokeMemberResultStatusEnum_revoked,
]);

Serializer<RevokeMemberResultStatusEnum>
    _$revokeMemberResultStatusEnumSerializer =
    _$RevokeMemberResultStatusEnumSerializer();

class _$RevokeMemberResultStatusEnumSerializer
    implements PrimitiveSerializer<RevokeMemberResultStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'revoked': 'revoked',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'revoked': 'revoked',
  };

  @override
  final Iterable<Type> types = const <Type>[RevokeMemberResultStatusEnum];
  @override
  final String wireName = 'RevokeMemberResultStatusEnum';

  @override
  Object serialize(Serializers serializers, RevokeMemberResultStatusEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  RevokeMemberResultStatusEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      RevokeMemberResultStatusEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$RevokeMemberResult extends RevokeMemberResult {
  @override
  final String userId;
  @override
  final RevokeMemberResultStatusEnum status;
  @override
  final DateTime revokedAt;
  @override
  final int cancelledInvitations;

  factory _$RevokeMemberResult(
          [void Function(RevokeMemberResultBuilder)? updates]) =>
      (RevokeMemberResultBuilder()..update(updates))._build();

  _$RevokeMemberResult._(
      {required this.userId,
      required this.status,
      required this.revokedAt,
      required this.cancelledInvitations})
      : super._();
  @override
  RevokeMemberResult rebuild(
          void Function(RevokeMemberResultBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  RevokeMemberResultBuilder toBuilder() =>
      RevokeMemberResultBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RevokeMemberResult &&
        userId == other.userId &&
        status == other.status &&
        revokedAt == other.revokedAt &&
        cancelledInvitations == other.cancelledInvitations;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, userId.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, revokedAt.hashCode);
    _$hash = $jc(_$hash, cancelledInvitations.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'RevokeMemberResult')
          ..add('userId', userId)
          ..add('status', status)
          ..add('revokedAt', revokedAt)
          ..add('cancelledInvitations', cancelledInvitations))
        .toString();
  }
}

class RevokeMemberResultBuilder
    implements Builder<RevokeMemberResult, RevokeMemberResultBuilder> {
  _$RevokeMemberResult? _$v;

  String? _userId;
  String? get userId => _$this._userId;
  set userId(String? userId) => _$this._userId = userId;

  RevokeMemberResultStatusEnum? _status;
  RevokeMemberResultStatusEnum? get status => _$this._status;
  set status(RevokeMemberResultStatusEnum? status) => _$this._status = status;

  DateTime? _revokedAt;
  DateTime? get revokedAt => _$this._revokedAt;
  set revokedAt(DateTime? revokedAt) => _$this._revokedAt = revokedAt;

  int? _cancelledInvitations;
  int? get cancelledInvitations => _$this._cancelledInvitations;
  set cancelledInvitations(int? cancelledInvitations) =>
      _$this._cancelledInvitations = cancelledInvitations;

  RevokeMemberResultBuilder() {
    RevokeMemberResult._defaults(this);
  }

  RevokeMemberResultBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _userId = $v.userId;
      _status = $v.status;
      _revokedAt = $v.revokedAt;
      _cancelledInvitations = $v.cancelledInvitations;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RevokeMemberResult other) {
    _$v = other as _$RevokeMemberResult;
  }

  @override
  void update(void Function(RevokeMemberResultBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RevokeMemberResult build() => _build();

  _$RevokeMemberResult _build() {
    final _$result = _$v ??
        _$RevokeMemberResult._(
          userId: BuiltValueNullFieldError.checkNotNull(
              userId, r'RevokeMemberResult', 'userId'),
          status: BuiltValueNullFieldError.checkNotNull(
              status, r'RevokeMemberResult', 'status'),
          revokedAt: BuiltValueNullFieldError.checkNotNull(
              revokedAt, r'RevokeMemberResult', 'revokedAt'),
          cancelledInvitations: BuiltValueNullFieldError.checkNotNull(
              cancelledInvitations,
              r'RevokeMemberResult',
              'cancelledInvitations'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
