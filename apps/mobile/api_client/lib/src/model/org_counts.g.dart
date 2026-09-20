// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'org_counts.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OrgCounts extends OrgCounts {
  @override
  final int activeMembers;
  @override
  final int pendingInvitations;

  factory _$OrgCounts([void Function(OrgCountsBuilder)? updates]) =>
      (OrgCountsBuilder()..update(updates))._build();

  _$OrgCounts._({required this.activeMembers, required this.pendingInvitations})
      : super._();
  @override
  OrgCounts rebuild(void Function(OrgCountsBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OrgCountsBuilder toBuilder() => OrgCountsBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OrgCounts &&
        activeMembers == other.activeMembers &&
        pendingInvitations == other.pendingInvitations;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, activeMembers.hashCode);
    _$hash = $jc(_$hash, pendingInvitations.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OrgCounts')
          ..add('activeMembers', activeMembers)
          ..add('pendingInvitations', pendingInvitations))
        .toString();
  }
}

class OrgCountsBuilder implements Builder<OrgCounts, OrgCountsBuilder> {
  _$OrgCounts? _$v;

  int? _activeMembers;
  int? get activeMembers => _$this._activeMembers;
  set activeMembers(int? activeMembers) =>
      _$this._activeMembers = activeMembers;

  int? _pendingInvitations;
  int? get pendingInvitations => _$this._pendingInvitations;
  set pendingInvitations(int? pendingInvitations) =>
      _$this._pendingInvitations = pendingInvitations;

  OrgCountsBuilder() {
    OrgCounts._defaults(this);
  }

  OrgCountsBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _activeMembers = $v.activeMembers;
      _pendingInvitations = $v.pendingInvitations;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OrgCounts other) {
    _$v = other as _$OrgCounts;
  }

  @override
  void update(void Function(OrgCountsBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OrgCounts build() => _build();

  _$OrgCounts _build() {
    final _$result = _$v ??
        _$OrgCounts._(
          activeMembers: BuiltValueNullFieldError.checkNotNull(
              activeMembers, r'OrgCounts', 'activeMembers'),
          pendingInvitations: BuiltValueNullFieldError.checkNotNull(
              pendingInvitations, r'OrgCounts', 'pendingInvitations'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
