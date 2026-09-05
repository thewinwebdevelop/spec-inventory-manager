// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tax_profile_view.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const TaxProfileViewEntityTypeEnum _$taxProfileViewEntityTypeEnum_personal =
    const TaxProfileViewEntityTypeEnum._('personal');
const TaxProfileViewEntityTypeEnum _$taxProfileViewEntityTypeEnum_company =
    const TaxProfileViewEntityTypeEnum._('company');

TaxProfileViewEntityTypeEnum _$taxProfileViewEntityTypeEnumValueOf(
    String name) {
  switch (name) {
    case 'personal':
      return _$taxProfileViewEntityTypeEnum_personal;
    case 'company':
      return _$taxProfileViewEntityTypeEnum_company;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<TaxProfileViewEntityTypeEnum>
    _$taxProfileViewEntityTypeEnumValues =
    BuiltSet<TaxProfileViewEntityTypeEnum>(const <TaxProfileViewEntityTypeEnum>[
  _$taxProfileViewEntityTypeEnum_personal,
  _$taxProfileViewEntityTypeEnum_company,
]);

Serializer<TaxProfileViewEntityTypeEnum>
    _$taxProfileViewEntityTypeEnumSerializer =
    _$TaxProfileViewEntityTypeEnumSerializer();

class _$TaxProfileViewEntityTypeEnumSerializer
    implements PrimitiveSerializer<TaxProfileViewEntityTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'personal': 'personal',
    'company': 'company',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'personal': 'personal',
    'company': 'company',
  };

  @override
  final Iterable<Type> types = const <Type>[TaxProfileViewEntityTypeEnum];
  @override
  final String wireName = 'TaxProfileViewEntityTypeEnum';

  @override
  Object serialize(Serializers serializers, TaxProfileViewEntityTypeEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  TaxProfileViewEntityTypeEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      TaxProfileViewEntityTypeEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$TaxProfileView extends TaxProfileView {
  @override
  final TaxProfileViewEntityTypeEnum? entityType;
  @override
  final String? taxIdMasked;
  @override
  final bool? vatRegistered;
  @override
  final String? branchCode;

  factory _$TaxProfileView([void Function(TaxProfileViewBuilder)? updates]) =>
      (TaxProfileViewBuilder()..update(updates))._build();

  _$TaxProfileView._(
      {this.entityType, this.taxIdMasked, this.vatRegistered, this.branchCode})
      : super._();
  @override
  TaxProfileView rebuild(void Function(TaxProfileViewBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  TaxProfileViewBuilder toBuilder() => TaxProfileViewBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TaxProfileView &&
        entityType == other.entityType &&
        taxIdMasked == other.taxIdMasked &&
        vatRegistered == other.vatRegistered &&
        branchCode == other.branchCode;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, entityType.hashCode);
    _$hash = $jc(_$hash, taxIdMasked.hashCode);
    _$hash = $jc(_$hash, vatRegistered.hashCode);
    _$hash = $jc(_$hash, branchCode.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TaxProfileView')
          ..add('entityType', entityType)
          ..add('taxIdMasked', taxIdMasked)
          ..add('vatRegistered', vatRegistered)
          ..add('branchCode', branchCode))
        .toString();
  }
}

class TaxProfileViewBuilder
    implements Builder<TaxProfileView, TaxProfileViewBuilder> {
  _$TaxProfileView? _$v;

  TaxProfileViewEntityTypeEnum? _entityType;
  TaxProfileViewEntityTypeEnum? get entityType => _$this._entityType;
  set entityType(TaxProfileViewEntityTypeEnum? entityType) =>
      _$this._entityType = entityType;

  String? _taxIdMasked;
  String? get taxIdMasked => _$this._taxIdMasked;
  set taxIdMasked(String? taxIdMasked) => _$this._taxIdMasked = taxIdMasked;

  bool? _vatRegistered;
  bool? get vatRegistered => _$this._vatRegistered;
  set vatRegistered(bool? vatRegistered) =>
      _$this._vatRegistered = vatRegistered;

  String? _branchCode;
  String? get branchCode => _$this._branchCode;
  set branchCode(String? branchCode) => _$this._branchCode = branchCode;

  TaxProfileViewBuilder() {
    TaxProfileView._defaults(this);
  }

  TaxProfileViewBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _entityType = $v.entityType;
      _taxIdMasked = $v.taxIdMasked;
      _vatRegistered = $v.vatRegistered;
      _branchCode = $v.branchCode;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TaxProfileView other) {
    _$v = other as _$TaxProfileView;
  }

  @override
  void update(void Function(TaxProfileViewBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TaxProfileView build() => _build();

  _$TaxProfileView _build() {
    final _$result = _$v ??
        _$TaxProfileView._(
          entityType: entityType,
          taxIdMasked: taxIdMasked,
          vatRegistered: vatRegistered,
          branchCode: branchCode,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
