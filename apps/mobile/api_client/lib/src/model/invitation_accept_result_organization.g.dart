// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invitation_accept_result_organization.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$InvitationAcceptResultOrganization
    extends InvitationAcceptResultOrganization {
  @override
  final String id;
  @override
  final String name;

  factory _$InvitationAcceptResultOrganization(
          [void Function(InvitationAcceptResultOrganizationBuilder)?
              updates]) =>
      (InvitationAcceptResultOrganizationBuilder()..update(updates))._build();

  _$InvitationAcceptResultOrganization._({required this.id, required this.name})
      : super._();
  @override
  InvitationAcceptResultOrganization rebuild(
          void Function(InvitationAcceptResultOrganizationBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  InvitationAcceptResultOrganizationBuilder toBuilder() =>
      InvitationAcceptResultOrganizationBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is InvitationAcceptResultOrganization &&
        id == other.id &&
        name == other.name;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'InvitationAcceptResultOrganization')
          ..add('id', id)
          ..add('name', name))
        .toString();
  }
}

class InvitationAcceptResultOrganizationBuilder
    implements
        Builder<InvitationAcceptResultOrganization,
            InvitationAcceptResultOrganizationBuilder> {
  _$InvitationAcceptResultOrganization? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  InvitationAcceptResultOrganizationBuilder() {
    InvitationAcceptResultOrganization._defaults(this);
  }

  InvitationAcceptResultOrganizationBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _name = $v.name;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(InvitationAcceptResultOrganization other) {
    _$v = other as _$InvitationAcceptResultOrganization;
  }

  @override
  void update(
      void Function(InvitationAcceptResultOrganizationBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  InvitationAcceptResultOrganization build() => _build();

  _$InvitationAcceptResultOrganization _build() {
    final _$result = _$v ??
        _$InvitationAcceptResultOrganization._(
          id: BuiltValueNullFieldError.checkNotNull(
              id, r'InvitationAcceptResultOrganization', 'id'),
          name: BuiltValueNullFieldError.checkNotNull(
              name, r'InvitationAcceptResultOrganization', 'name'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
