// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invitation_accept_result.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$InvitationAcceptResult extends InvitationAcceptResult {
  @override
  final InvitationAcceptResultOrganization organization;
  @override
  final AcceptedMembership membership;

  factory _$InvitationAcceptResult(
          [void Function(InvitationAcceptResultBuilder)? updates]) =>
      (InvitationAcceptResultBuilder()..update(updates))._build();

  _$InvitationAcceptResult._(
      {required this.organization, required this.membership})
      : super._();
  @override
  InvitationAcceptResult rebuild(
          void Function(InvitationAcceptResultBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  InvitationAcceptResultBuilder toBuilder() =>
      InvitationAcceptResultBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is InvitationAcceptResult &&
        organization == other.organization &&
        membership == other.membership;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, organization.hashCode);
    _$hash = $jc(_$hash, membership.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'InvitationAcceptResult')
          ..add('organization', organization)
          ..add('membership', membership))
        .toString();
  }
}

class InvitationAcceptResultBuilder
    implements Builder<InvitationAcceptResult, InvitationAcceptResultBuilder> {
  _$InvitationAcceptResult? _$v;

  InvitationAcceptResultOrganizationBuilder? _organization;
  InvitationAcceptResultOrganizationBuilder get organization =>
      _$this._organization ??= InvitationAcceptResultOrganizationBuilder();
  set organization(InvitationAcceptResultOrganizationBuilder? organization) =>
      _$this._organization = organization;

  AcceptedMembershipBuilder? _membership;
  AcceptedMembershipBuilder get membership =>
      _$this._membership ??= AcceptedMembershipBuilder();
  set membership(AcceptedMembershipBuilder? membership) =>
      _$this._membership = membership;

  InvitationAcceptResultBuilder() {
    InvitationAcceptResult._defaults(this);
  }

  InvitationAcceptResultBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _organization = $v.organization.toBuilder();
      _membership = $v.membership.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(InvitationAcceptResult other) {
    _$v = other as _$InvitationAcceptResult;
  }

  @override
  void update(void Function(InvitationAcceptResultBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  InvitationAcceptResult build() => _build();

  _$InvitationAcceptResult _build() {
    _$InvitationAcceptResult _$result;
    try {
      _$result = _$v ??
          _$InvitationAcceptResult._(
            organization: organization.build(),
            membership: membership.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'organization';
        organization.build();
        _$failedField = 'membership';
        membership.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'InvitationAcceptResult', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
