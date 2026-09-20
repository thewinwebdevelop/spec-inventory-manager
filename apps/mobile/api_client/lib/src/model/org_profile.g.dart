// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'org_profile.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OrgProfile extends OrgProfile {
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
  final TaxProfileView? taxProfile;
  @override
  final bool taxProfileComplete;
  @override
  final EntitlementSummary? entitlement;
  @override
  final OrgMyMembership myMembership;
  @override
  final OrgCounts counts;

  factory _$OrgProfile([void Function(OrgProfileBuilder)? updates]) =>
      (OrgProfileBuilder()..update(updates))._build();

  _$OrgProfile._(
      {required this.id,
      required this.name,
      this.logo,
      required this.timezone,
      required this.currency,
      this.taxProfile,
      required this.taxProfileComplete,
      this.entitlement,
      required this.myMembership,
      required this.counts})
      : super._();
  @override
  OrgProfile rebuild(void Function(OrgProfileBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OrgProfileBuilder toBuilder() => OrgProfileBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OrgProfile &&
        id == other.id &&
        name == other.name &&
        logo == other.logo &&
        timezone == other.timezone &&
        currency == other.currency &&
        taxProfile == other.taxProfile &&
        taxProfileComplete == other.taxProfileComplete &&
        entitlement == other.entitlement &&
        myMembership == other.myMembership &&
        counts == other.counts;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, logo.hashCode);
    _$hash = $jc(_$hash, timezone.hashCode);
    _$hash = $jc(_$hash, currency.hashCode);
    _$hash = $jc(_$hash, taxProfile.hashCode);
    _$hash = $jc(_$hash, taxProfileComplete.hashCode);
    _$hash = $jc(_$hash, entitlement.hashCode);
    _$hash = $jc(_$hash, myMembership.hashCode);
    _$hash = $jc(_$hash, counts.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OrgProfile')
          ..add('id', id)
          ..add('name', name)
          ..add('logo', logo)
          ..add('timezone', timezone)
          ..add('currency', currency)
          ..add('taxProfile', taxProfile)
          ..add('taxProfileComplete', taxProfileComplete)
          ..add('entitlement', entitlement)
          ..add('myMembership', myMembership)
          ..add('counts', counts))
        .toString();
  }
}

class OrgProfileBuilder implements Builder<OrgProfile, OrgProfileBuilder> {
  _$OrgProfile? _$v;

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

  TaxProfileViewBuilder? _taxProfile;
  TaxProfileViewBuilder get taxProfile =>
      _$this._taxProfile ??= TaxProfileViewBuilder();
  set taxProfile(TaxProfileViewBuilder? taxProfile) =>
      _$this._taxProfile = taxProfile;

  bool? _taxProfileComplete;
  bool? get taxProfileComplete => _$this._taxProfileComplete;
  set taxProfileComplete(bool? taxProfileComplete) =>
      _$this._taxProfileComplete = taxProfileComplete;

  EntitlementSummaryBuilder? _entitlement;
  EntitlementSummaryBuilder get entitlement =>
      _$this._entitlement ??= EntitlementSummaryBuilder();
  set entitlement(EntitlementSummaryBuilder? entitlement) =>
      _$this._entitlement = entitlement;

  OrgMyMembershipBuilder? _myMembership;
  OrgMyMembershipBuilder get myMembership =>
      _$this._myMembership ??= OrgMyMembershipBuilder();
  set myMembership(OrgMyMembershipBuilder? myMembership) =>
      _$this._myMembership = myMembership;

  OrgCountsBuilder? _counts;
  OrgCountsBuilder get counts => _$this._counts ??= OrgCountsBuilder();
  set counts(OrgCountsBuilder? counts) => _$this._counts = counts;

  OrgProfileBuilder() {
    OrgProfile._defaults(this);
  }

  OrgProfileBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _name = $v.name;
      _logo = $v.logo;
      _timezone = $v.timezone;
      _currency = $v.currency;
      _taxProfile = $v.taxProfile?.toBuilder();
      _taxProfileComplete = $v.taxProfileComplete;
      _entitlement = $v.entitlement?.toBuilder();
      _myMembership = $v.myMembership.toBuilder();
      _counts = $v.counts.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OrgProfile other) {
    _$v = other as _$OrgProfile;
  }

  @override
  void update(void Function(OrgProfileBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OrgProfile build() => _build();

  _$OrgProfile _build() {
    _$OrgProfile _$result;
    try {
      _$result = _$v ??
          _$OrgProfile._(
            id: BuiltValueNullFieldError.checkNotNull(id, r'OrgProfile', 'id'),
            name: BuiltValueNullFieldError.checkNotNull(
                name, r'OrgProfile', 'name'),
            logo: logo,
            timezone: BuiltValueNullFieldError.checkNotNull(
                timezone, r'OrgProfile', 'timezone'),
            currency: BuiltValueNullFieldError.checkNotNull(
                currency, r'OrgProfile', 'currency'),
            taxProfile: _taxProfile?.build(),
            taxProfileComplete: BuiltValueNullFieldError.checkNotNull(
                taxProfileComplete, r'OrgProfile', 'taxProfileComplete'),
            entitlement: _entitlement?.build(),
            myMembership: myMembership.build(),
            counts: counts.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'taxProfile';
        _taxProfile?.build();

        _$failedField = 'entitlement';
        _entitlement?.build();
        _$failedField = 'myMembership';
        myMembership.build();
        _$failedField = 'counts';
        counts.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'OrgProfile', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
