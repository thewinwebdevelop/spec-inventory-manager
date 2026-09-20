// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_organization_item.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$MyOrganizationItem extends MyOrganizationItem {
  @override
  final OrganizationSummary organization;
  @override
  final MyOrganizationMembership membership;
  @override
  final EntitlementSummary? entitlement;

  factory _$MyOrganizationItem(
          [void Function(MyOrganizationItemBuilder)? updates]) =>
      (MyOrganizationItemBuilder()..update(updates))._build();

  _$MyOrganizationItem._(
      {required this.organization, required this.membership, this.entitlement})
      : super._();
  @override
  MyOrganizationItem rebuild(
          void Function(MyOrganizationItemBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  MyOrganizationItemBuilder toBuilder() =>
      MyOrganizationItemBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is MyOrganizationItem &&
        organization == other.organization &&
        membership == other.membership &&
        entitlement == other.entitlement;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, organization.hashCode);
    _$hash = $jc(_$hash, membership.hashCode);
    _$hash = $jc(_$hash, entitlement.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'MyOrganizationItem')
          ..add('organization', organization)
          ..add('membership', membership)
          ..add('entitlement', entitlement))
        .toString();
  }
}

class MyOrganizationItemBuilder
    implements Builder<MyOrganizationItem, MyOrganizationItemBuilder> {
  _$MyOrganizationItem? _$v;

  OrganizationSummaryBuilder? _organization;
  OrganizationSummaryBuilder get organization =>
      _$this._organization ??= OrganizationSummaryBuilder();
  set organization(OrganizationSummaryBuilder? organization) =>
      _$this._organization = organization;

  MyOrganizationMembershipBuilder? _membership;
  MyOrganizationMembershipBuilder get membership =>
      _$this._membership ??= MyOrganizationMembershipBuilder();
  set membership(MyOrganizationMembershipBuilder? membership) =>
      _$this._membership = membership;

  EntitlementSummaryBuilder? _entitlement;
  EntitlementSummaryBuilder get entitlement =>
      _$this._entitlement ??= EntitlementSummaryBuilder();
  set entitlement(EntitlementSummaryBuilder? entitlement) =>
      _$this._entitlement = entitlement;

  MyOrganizationItemBuilder() {
    MyOrganizationItem._defaults(this);
  }

  MyOrganizationItemBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _organization = $v.organization.toBuilder();
      _membership = $v.membership.toBuilder();
      _entitlement = $v.entitlement?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(MyOrganizationItem other) {
    _$v = other as _$MyOrganizationItem;
  }

  @override
  void update(void Function(MyOrganizationItemBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  MyOrganizationItem build() => _build();

  _$MyOrganizationItem _build() {
    _$MyOrganizationItem _$result;
    try {
      _$result = _$v ??
          _$MyOrganizationItem._(
            organization: organization.build(),
            membership: membership.build(),
            entitlement: _entitlement?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'organization';
        organization.build();
        _$failedField = 'membership';
        membership.build();
        _$failedField = 'entitlement';
        _entitlement?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'MyOrganizationItem', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
