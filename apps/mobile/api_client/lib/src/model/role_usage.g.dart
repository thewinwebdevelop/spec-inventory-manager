// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'role_usage.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$RoleUsage extends RoleUsage {
  @override
  final int activeMembers;
  @override
  final int pendingInvitations;

  factory _$RoleUsage([void Function(RoleUsageBuilder)? updates]) =>
      (RoleUsageBuilder()..update(updates))._build();

  _$RoleUsage._({required this.activeMembers, required this.pendingInvitations})
      : super._();
  @override
  RoleUsage rebuild(void Function(RoleUsageBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  RoleUsageBuilder toBuilder() => RoleUsageBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RoleUsage &&
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
    return (newBuiltValueToStringHelper(r'RoleUsage')
          ..add('activeMembers', activeMembers)
          ..add('pendingInvitations', pendingInvitations))
        .toString();
  }
}

class RoleUsageBuilder implements Builder<RoleUsage, RoleUsageBuilder> {
  _$RoleUsage? _$v;

  int? _activeMembers;
  int? get activeMembers => _$this._activeMembers;
  set activeMembers(int? activeMembers) =>
      _$this._activeMembers = activeMembers;

  int? _pendingInvitations;
  int? get pendingInvitations => _$this._pendingInvitations;
  set pendingInvitations(int? pendingInvitations) =>
      _$this._pendingInvitations = pendingInvitations;

  RoleUsageBuilder() {
    RoleUsage._defaults(this);
  }

  RoleUsageBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _activeMembers = $v.activeMembers;
      _pendingInvitations = $v.pendingInvitations;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RoleUsage other) {
    _$v = other as _$RoleUsage;
  }

  @override
  void update(void Function(RoleUsageBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RoleUsage build() => _build();

  _$RoleUsage _build() {
    final _$result = _$v ??
        _$RoleUsage._(
          activeMembers: BuiltValueNullFieldError.checkNotNull(
              activeMembers, r'RoleUsage', 'activeMembers'),
          pendingInvitations: BuiltValueNullFieldError.checkNotNull(
              pendingInvitations, r'RoleUsage', 'pendingInvitations'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
