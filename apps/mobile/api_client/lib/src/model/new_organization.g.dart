// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'new_organization.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$NewOrganization extends NewOrganization {
  @override
  final String id;
  @override
  final String name;
  @override
  final String? logo;
  @override
  final String timezone;
  @override
  final String currency;
  @override
  final bool taxProfileComplete;
  @override
  final DateTime createdAt;

  factory _$NewOrganization([void Function(NewOrganizationBuilder)? updates]) =>
      (NewOrganizationBuilder()..update(updates))._build();

  _$NewOrganization._(
      {required this.id,
      required this.name,
      this.logo,
      required this.timezone,
      required this.currency,
      required this.taxProfileComplete,
      required this.createdAt})
      : super._();
  @override
  NewOrganization rebuild(void Function(NewOrganizationBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  NewOrganizationBuilder toBuilder() => NewOrganizationBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is NewOrganization &&
        id == other.id &&
        name == other.name &&
        logo == other.logo &&
        timezone == other.timezone &&
        currency == other.currency &&
        taxProfileComplete == other.taxProfileComplete &&
        createdAt == other.createdAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, logo.hashCode);
    _$hash = $jc(_$hash, timezone.hashCode);
    _$hash = $jc(_$hash, currency.hashCode);
    _$hash = $jc(_$hash, taxProfileComplete.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'NewOrganization')
          ..add('id', id)
          ..add('name', name)
          ..add('logo', logo)
          ..add('timezone', timezone)
          ..add('currency', currency)
          ..add('taxProfileComplete', taxProfileComplete)
          ..add('createdAt', createdAt))
        .toString();
  }
}

class NewOrganizationBuilder
    implements Builder<NewOrganization, NewOrganizationBuilder> {
  _$NewOrganization? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _logo;
  String? get logo => _$this._logo;
  set logo(String? logo) => _$this._logo = logo;

  String? _timezone;
  String? get timezone => _$this._timezone;
  set timezone(String? timezone) => _$this._timezone = timezone;

  String? _currency;
  String? get currency => _$this._currency;
  set currency(String? currency) => _$this._currency = currency;

  bool? _taxProfileComplete;
  bool? get taxProfileComplete => _$this._taxProfileComplete;
  set taxProfileComplete(bool? taxProfileComplete) =>
      _$this._taxProfileComplete = taxProfileComplete;

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  NewOrganizationBuilder() {
    NewOrganization._defaults(this);
  }

  NewOrganizationBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _name = $v.name;
      _logo = $v.logo;
      _timezone = $v.timezone;
      _currency = $v.currency;
      _taxProfileComplete = $v.taxProfileComplete;
      _createdAt = $v.createdAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(NewOrganization other) {
    _$v = other as _$NewOrganization;
  }

  @override
  void update(void Function(NewOrganizationBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  NewOrganization build() => _build();

  _$NewOrganization _build() {
    final _$result = _$v ??
        _$NewOrganization._(
          id: BuiltValueNullFieldError.checkNotNull(
              id, r'NewOrganization', 'id'),
          name: BuiltValueNullFieldError.checkNotNull(
              name, r'NewOrganization', 'name'),
          logo: logo,
          timezone: BuiltValueNullFieldError.checkNotNull(
              timezone, r'NewOrganization', 'timezone'),
          currency: BuiltValueNullFieldError.checkNotNull(
              currency, r'NewOrganization', 'currency'),
          taxProfileComplete: BuiltValueNullFieldError.checkNotNull(
              taxProfileComplete, r'NewOrganization', 'taxProfileComplete'),
          createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt, r'NewOrganization', 'createdAt'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
