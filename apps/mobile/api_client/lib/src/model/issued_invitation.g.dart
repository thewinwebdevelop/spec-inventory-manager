// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'issued_invitation.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$IssuedInvitation extends IssuedInvitation {
  @override
  final Invitation invitation;
  @override
  final String token;
  @override
  final String inviteUrl;

  factory _$IssuedInvitation(
          [void Function(IssuedInvitationBuilder)? updates]) =>
      (IssuedInvitationBuilder()..update(updates))._build();

  _$IssuedInvitation._(
      {required this.invitation, required this.token, required this.inviteUrl})
      : super._();
  @override
  IssuedInvitation rebuild(void Function(IssuedInvitationBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  IssuedInvitationBuilder toBuilder() =>
      IssuedInvitationBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is IssuedInvitation &&
        invitation == other.invitation &&
        token == other.token &&
        inviteUrl == other.inviteUrl;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, invitation.hashCode);
    _$hash = $jc(_$hash, token.hashCode);
    _$hash = $jc(_$hash, inviteUrl.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'IssuedInvitation')
          ..add('invitation', invitation)
          ..add('token', token)
          ..add('inviteUrl', inviteUrl))
        .toString();
  }
}

class IssuedInvitationBuilder
    implements Builder<IssuedInvitation, IssuedInvitationBuilder> {
  _$IssuedInvitation? _$v;

  InvitationBuilder? _invitation;
  InvitationBuilder get invitation =>
      _$this._invitation ??= InvitationBuilder();
  set invitation(InvitationBuilder? invitation) =>
      _$this._invitation = invitation;

  String? _token;
  String? get token => _$this._token;
  set token(String? token) => _$this._token = token;

  String? _inviteUrl;
  String? get inviteUrl => _$this._inviteUrl;
  set inviteUrl(String? inviteUrl) => _$this._inviteUrl = inviteUrl;

  IssuedInvitationBuilder() {
    IssuedInvitation._defaults(this);
  }

  IssuedInvitationBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _invitation = $v.invitation.toBuilder();
      _token = $v.token;
      _inviteUrl = $v.inviteUrl;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(IssuedInvitation other) {
    _$v = other as _$IssuedInvitation;
  }

  @override
  void update(void Function(IssuedInvitationBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  IssuedInvitation build() => _build();

  _$IssuedInvitation _build() {
    _$IssuedInvitation _$result;
    try {
      _$result = _$v ??
          _$IssuedInvitation._(
            invitation: invitation.build(),
            token: BuiltValueNullFieldError.checkNotNull(
                token, r'IssuedInvitation', 'token'),
            inviteUrl: BuiltValueNullFieldError.checkNotNull(
                inviteUrl, r'IssuedInvitation', 'inviteUrl'),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'invitation';
        invitation.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'IssuedInvitation', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
