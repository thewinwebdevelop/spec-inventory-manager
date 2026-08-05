// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tax_profile_request.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const TaxProfileRequestEntityTypeEnum
    _$taxProfileRequestEntityTypeEnum_personal =
    const TaxProfileRequestEntityTypeEnum._('personal');
const TaxProfileRequestEntityTypeEnum
    _$taxProfileRequestEntityTypeEnum_company =
    const TaxProfileRequestEntityTypeEnum._('company');

TaxProfileRequestEntityTypeEnum _$taxProfileRequestEntityTypeEnumValueOf(
    String name) {
  switch (name) {
    case 'personal':
      return _$taxProfileRequestEntityTypeEnum_personal;
    case 'company':
      return _$taxProfileRequestEntityTypeEnum_company;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<TaxProfileRequestEntityTypeEnum>
    _$taxProfileRequestEntityTypeEnumValues = BuiltSet<
        TaxProfileRequestEntityTypeEnum>(const <TaxProfileRequestEntityTypeEnum>[
  _$taxProfileRequestEntityTypeEnum_personal,
  _$taxProfileRequestEntityTypeEnum_company,
]);

Serializer<TaxProfileRequestEntityTypeEnum>
    _$taxProfileRequestEntityTypeEnumSerializer =
    _$TaxProfileRequestEntityTypeEnumSerializer();

class _$TaxProfileRequestEntityTypeEnumSerializer
    implements PrimitiveSerializer<TaxProfileRequestEntityTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'personal': 'personal',
    'company': 'company',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'personal': 'personal',
    'company': 'company',
  };

  @override
  final Iterable<Type> types = const <Type>[TaxProfileRequestEntityTypeEnum];
  @override
  final String wireName = 'TaxProfileRequestEntityTypeEnum';

  @override
  Object serialize(
          Serializers serializers, TaxProfileRequestEntityTypeEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  TaxProfileRequestEntityTypeEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      TaxProfileRequestEntityTypeEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$TaxProfileRequest extends TaxProfileRequest {
  @override
  final TaxProfileRequestEntityTypeEnum? entityType;
  @override
  final String? taxId;
  @override
  final bool? vatRegistered;
  @override
  final String? branchCode;

  factory _$TaxProfileRequest(
          [void Function(TaxProfileRequestBuilder)? updates]) =>
      (TaxProfileRequestBuilder()..update(updates))._build();

  _$TaxProfileRequest._(
      {this.entityType, this.taxId, this.vatRegistered, this.branchCode})
      : super._();
  @override
  TaxProfileRequest rebuild(void Function(TaxProfileRequestBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  TaxProfileRequestBuilder toBuilder() =>
      TaxProfileRequestBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TaxProfileRequest &&
        entityType == other.entityType &&
        taxId == other.taxId &&
        vatRegistered == other.vatRegistered &&
        branchCode == other.branchCode;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, entityType.hashCode);
    _$hash = $jc(_$hash, taxId.hashCode);
    _$hash = $jc(_$hash, vatRegistered.hashCode);
    _$hash = $jc(_$hash, branchCode.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TaxProfileRequest')
          ..add('entityType', entityType)
          ..add('taxId', taxId)
          ..add('vatRegistered', vatRegistered)
          ..add('branchCode', branchCode))
        .toString();
  }
}

class TaxProfileRequestBuilder
    implements Builder<TaxProfileRequest, TaxProfileRequestBuilder> {
  _$TaxProfileRequest? _$v;

  TaxProfileRequestEntityTypeEnum? _entityType;
  TaxProfileRequestEntityTypeEnum? get entityType => _$this._entityType;
  set entityType(TaxProfileRequestEntityTypeEnum? entityType) =>
      _$this._entityType = entityType;

  String? _taxId;
  String? get taxId => _$this._taxId;
  set taxId(String? taxId) => _$this._taxId = taxId;

  bool? _vatRegistered;
  bool? get vatRegistered => _$this._vatRegistered;
  set vatRegistered(bool? vatRegistered) =>
      _$this._vatRegistered = vatRegistered;

  String? _branchCode;
  String? get branchCode => _$this._branchCode;
  set branchCode(String? branchCode) => _$this._branchCode = branchCode;

  TaxProfileRequestBuilder() {
    TaxProfileRequest._defaults(this);
  }

  TaxProfileRequestBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _entityType = $v.entityType;
      _taxId = $v.taxId;
      _vatRegistered = $v.vatRegistered;
      _branchCode = $v.branchCode;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TaxProfileRequest other) {
    _$v = other as _$TaxProfileRequest;
  }

  @override
  void update(void Function(TaxProfileRequestBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TaxProfileRequest build() => _build();

  _$TaxProfileRequest _build() {
    final _$result = _$v ??
        _$TaxProfileRequest._(
          entityType: entityType,
          taxId: taxId,
          vatRegistered: vatRegistered,
          branchCode: branchCode,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
