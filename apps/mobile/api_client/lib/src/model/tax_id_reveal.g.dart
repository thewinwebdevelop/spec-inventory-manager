// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tax_id_reveal.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const TaxIdRevealEntityTypeEnum _$taxIdRevealEntityTypeEnum_personal =
    const TaxIdRevealEntityTypeEnum._('personal');
const TaxIdRevealEntityTypeEnum _$taxIdRevealEntityTypeEnum_company =
    const TaxIdRevealEntityTypeEnum._('company');

TaxIdRevealEntityTypeEnum _$taxIdRevealEntityTypeEnumValueOf(String name) {
  switch (name) {
    case 'personal':
      return _$taxIdRevealEntityTypeEnum_personal;
    case 'company':
      return _$taxIdRevealEntityTypeEnum_company;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<TaxIdRevealEntityTypeEnum> _$taxIdRevealEntityTypeEnumValues =
    BuiltSet<TaxIdRevealEntityTypeEnum>(const <TaxIdRevealEntityTypeEnum>[
  _$taxIdRevealEntityTypeEnum_personal,
  _$taxIdRevealEntityTypeEnum_company,
]);

Serializer<TaxIdRevealEntityTypeEnum> _$taxIdRevealEntityTypeEnumSerializer =
    _$TaxIdRevealEntityTypeEnumSerializer();

class _$TaxIdRevealEntityTypeEnumSerializer
    implements PrimitiveSerializer<TaxIdRevealEntityTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'personal': 'personal',
    'company': 'company',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'personal': 'personal',
    'company': 'company',
  };

  @override
  final Iterable<Type> types = const <Type>[TaxIdRevealEntityTypeEnum];
  @override
  final String wireName = 'TaxIdRevealEntityTypeEnum';

  @override
  Object serialize(Serializers serializers, TaxIdRevealEntityTypeEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  TaxIdRevealEntityTypeEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      TaxIdRevealEntityTypeEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$TaxIdReveal extends TaxIdReveal {
  @override
  final String taxId;
  @override
  final TaxIdRevealEntityTypeEnum? entityType;
  @override
  final DateTime revealedAt;

  factory _$TaxIdReveal([void Function(TaxIdRevealBuilder)? updates]) =>
      (TaxIdRevealBuilder()..update(updates))._build();

  _$TaxIdReveal._(
      {required this.taxId, this.entityType, required this.revealedAt})
      : super._();
  @override
  TaxIdReveal rebuild(void Function(TaxIdRevealBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  TaxIdRevealBuilder toBuilder() => TaxIdRevealBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TaxIdReveal &&
        taxId == other.taxId &&
        entityType == other.entityType &&
        revealedAt == other.revealedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, taxId.hashCode);
    _$hash = $jc(_$hash, entityType.hashCode);
    _$hash = $jc(_$hash, revealedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TaxIdReveal')
          ..add('taxId', taxId)
          ..add('entityType', entityType)
          ..add('revealedAt', revealedAt))
        .toString();
  }
}

class TaxIdRevealBuilder implements Builder<TaxIdReveal, TaxIdRevealBuilder> {
  _$TaxIdReveal? _$v;

  String? _taxId;
  String? get taxId => _$this._taxId;
  set taxId(String? taxId) => _$this._taxId = taxId;

  TaxIdRevealEntityTypeEnum? _entityType;
  TaxIdRevealEntityTypeEnum? get entityType => _$this._entityType;
  set entityType(TaxIdRevealEntityTypeEnum? entityType) =>
      _$this._entityType = entityType;

  DateTime? _revealedAt;
  DateTime? get revealedAt => _$this._revealedAt;
  set revealedAt(DateTime? revealedAt) => _$this._revealedAt = revealedAt;

  TaxIdRevealBuilder() {
    TaxIdReveal._defaults(this);
  }

  TaxIdRevealBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _taxId = $v.taxId;
      _entityType = $v.entityType;
      _revealedAt = $v.revealedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TaxIdReveal other) {
    _$v = other as _$TaxIdReveal;
  }

  @override
  void update(void Function(TaxIdRevealBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TaxIdReveal build() => _build();

  _$TaxIdReveal _build() {
    final _$result = _$v ??
        _$TaxIdReveal._(
          taxId: BuiltValueNullFieldError.checkNotNull(
              taxId, r'TaxIdReveal', 'taxId'),
          entityType: entityType,
          revealedAt: BuiltValueNullFieldError.checkNotNull(
              revealedAt, r'TaxIdReveal', 'revealedAt'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
