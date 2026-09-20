// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'organization_summary.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OrganizationSummary extends OrganizationSummary {
  @override
  final String id;
  @override
  final String name;
  @override
  final String? logo;

  factory _$OrganizationSummary(
          [void Function(OrganizationSummaryBuilder)? updates]) =>
      (OrganizationSummaryBuilder()..update(updates))._build();

  _$OrganizationSummary._({required this.id, required this.name, this.logo})
      : super._();
  @override
  OrganizationSummary rebuild(
          void Function(OrganizationSummaryBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OrganizationSummaryBuilder toBuilder() =>
      OrganizationSummaryBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OrganizationSummary &&
        id == other.id &&
        name == other.name &&
        logo == other.logo;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, logo.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OrganizationSummary')
          ..add('id', id)
          ..add('name', name)
          ..add('logo', logo))
        .toString();
  }
}

class OrganizationSummaryBuilder
    implements Builder<OrganizationSummary, OrganizationSummaryBuilder> {
  _$OrganizationSummary? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _logo;
  String? get logo => _$this._logo;
  set logo(String? logo) => _$this._logo = logo;

  OrganizationSummaryBuilder() {
    OrganizationSummary._defaults(this);
  }

  OrganizationSummaryBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _name = $v.name;
      _logo = $v.logo;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OrganizationSummary other) {
    _$v = other as _$OrganizationSummary;
  }

  @override
  void update(void Function(OrganizationSummaryBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OrganizationSummary build() => _build();

  _$OrganizationSummary _build() {
    final _$result = _$v ??
        _$OrganizationSummary._(
          id: BuiltValueNullFieldError.checkNotNull(
              id, r'OrganizationSummary', 'id'),
          name: BuiltValueNullFieldError.checkNotNull(
              name, r'OrganizationSummary', 'name'),
          logo: logo,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
