// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'created_organization.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CreatedOrganization extends CreatedOrganization {
  @override
  final NewOrganization organization;
  @override
  final NewOrganizationMembership membership;
  @override
  final EntitlementSummary entitlement;
  @override
  final WarehouseSummary defaultWarehouse;

  factory _$CreatedOrganization(
          [void Function(CreatedOrganizationBuilder)? updates]) =>
      (CreatedOrganizationBuilder()..update(updates))._build();

  _$CreatedOrganization._(
      {required this.organization,
      required this.membership,
      required this.entitlement,
      required this.defaultWarehouse})
      : super._();
  @override
  CreatedOrganization rebuild(
          void Function(CreatedOrganizationBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  CreatedOrganizationBuilder toBuilder() =>
      CreatedOrganizationBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreatedOrganization &&
        organization == other.organization &&
        membership == other.membership &&
        entitlement == other.entitlement &&
        defaultWarehouse == other.defaultWarehouse;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, organization.hashCode);
    _$hash = $jc(_$hash, membership.hashCode);
    _$hash = $jc(_$hash, entitlement.hashCode);
    _$hash = $jc(_$hash, defaultWarehouse.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreatedOrganization')
          ..add('organization', organization)
          ..add('membership', membership)
          ..add('entitlement', entitlement)
          ..add('defaultWarehouse', defaultWarehouse))
        .toString();
  }
}

class CreatedOrganizationBuilder
    implements Builder<CreatedOrganization, CreatedOrganizationBuilder> {
  _$CreatedOrganization? _$v;

  NewOrganizationBuilder? _organization;
  NewOrganizationBuilder get organization =>
      _$this._organization ??= NewOrganizationBuilder();
  set organization(NewOrganizationBuilder? organization) =>
      _$this._organization = organization;

  NewOrganizationMembershipBuilder? _membership;
  NewOrganizationMembershipBuilder get membership =>
      _$this._membership ??= NewOrganizationMembershipBuilder();
  set membership(NewOrganizationMembershipBuilder? membership) =>
      _$this._membership = membership;

  EntitlementSummaryBuilder? _entitlement;
  EntitlementSummaryBuilder get entitlement =>
      _$this._entitlement ??= EntitlementSummaryBuilder();
  set entitlement(EntitlementSummaryBuilder? entitlement) =>
      _$this._entitlement = entitlement;

  WarehouseSummaryBuilder? _defaultWarehouse;
  WarehouseSummaryBuilder get defaultWarehouse =>
      _$this._defaultWarehouse ??= WarehouseSummaryBuilder();
  set defaultWarehouse(WarehouseSummaryBuilder? defaultWarehouse) =>
      _$this._defaultWarehouse = defaultWarehouse;

  CreatedOrganizationBuilder() {
    CreatedOrganization._defaults(this);
  }

  CreatedOrganizationBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _organization = $v.organization.toBuilder();
      _membership = $v.membership.toBuilder();
      _entitlement = $v.entitlement.toBuilder();
      _defaultWarehouse = $v.defaultWarehouse.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreatedOrganization other) {
    _$v = other as _$CreatedOrganization;
  }

  @override
  void update(void Function(CreatedOrganizationBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreatedOrganization build() => _build();

  _$CreatedOrganization _build() {
    _$CreatedOrganization _$result;
    try {
      _$result = _$v ??
          _$CreatedOrganization._(
            organization: organization.build(),
            membership: membership.build(),
            entitlement: entitlement.build(),
            defaultWarehouse: defaultWarehouse.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'organization';
        organization.build();
        _$failedField = 'membership';
        membership.build();
        _$failedField = 'entitlement';
        entitlement.build();
        _$failedField = 'defaultWarehouse';
        defaultWarehouse.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'CreatedOrganization', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
