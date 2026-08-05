// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'cancelled_invitation.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const CancelledInvitationStatusEnum _$cancelledInvitationStatusEnum_cancelled =
    const CancelledInvitationStatusEnum._('cancelled');

CancelledInvitationStatusEnum _$cancelledInvitationStatusEnumValueOf(
    String name) {
  switch (name) {
    case 'cancelled':
      return _$cancelledInvitationStatusEnum_cancelled;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<CancelledInvitationStatusEnum>
    _$cancelledInvitationStatusEnumValues = BuiltSet<
        CancelledInvitationStatusEnum>(const <CancelledInvitationStatusEnum>[
  _$cancelledInvitationStatusEnum_cancelled,
]);

Serializer<CancelledInvitationStatusEnum>
    _$cancelledInvitationStatusEnumSerializer =
    _$CancelledInvitationStatusEnumSerializer();

class _$CancelledInvitationStatusEnumSerializer
    implements PrimitiveSerializer<CancelledInvitationStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'cancelled': 'cancelled',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'cancelled': 'cancelled',
  };

  @override
  final Iterable<Type> types = const <Type>[CancelledInvitationStatusEnum];
  @override
  final String wireName = 'CancelledInvitationStatusEnum';

  @override
  Object serialize(
          Serializers serializers, CancelledInvitationStatusEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  CancelledInvitationStatusEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      CancelledInvitationStatusEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$CancelledInvitation extends CancelledInvitation {
  @override
  final String id;
  @override
  final CancelledInvitationStatusEnum status;

  factory _$CancelledInvitation(
          [void Function(CancelledInvitationBuilder)? updates]) =>
      (CancelledInvitationBuilder()..update(updates))._build();

  _$CancelledInvitation._({required this.id, required this.status}) : super._();
  @override
  CancelledInvitation rebuild(
          void Function(CancelledInvitationBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  CancelledInvitationBuilder toBuilder() =>
      CancelledInvitationBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CancelledInvitation &&
        id == other.id &&
        status == other.status;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CancelledInvitation')
          ..add('id', id)
          ..add('status', status))
        .toString();
  }
}

class CancelledInvitationBuilder
    implements Builder<CancelledInvitation, CancelledInvitationBuilder> {
  _$CancelledInvitation? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  CancelledInvitationStatusEnum? _status;
  CancelledInvitationStatusEnum? get status => _$this._status;
  set status(CancelledInvitationStatusEnum? status) => _$this._status = status;

  CancelledInvitationBuilder() {
    CancelledInvitation._defaults(this);
  }

  CancelledInvitationBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _status = $v.status;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CancelledInvitation other) {
    _$v = other as _$CancelledInvitation;
  }

  @override
  void update(void Function(CancelledInvitationBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CancelledInvitation build() => _build();

  _$CancelledInvitation _build() {
    final _$result = _$v ??
        _$CancelledInvitation._(
          id: BuiltValueNullFieldError.checkNotNull(
              id, r'CancelledInvitation', 'id'),
          status: BuiltValueNullFieldError.checkNotNull(
              status, r'CancelledInvitation', 'status'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
