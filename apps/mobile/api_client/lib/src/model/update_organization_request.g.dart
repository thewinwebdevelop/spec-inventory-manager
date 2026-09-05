// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_organization_request.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$UpdateOrganizationRequest extends UpdateOrganizationRequest {
  @override
  final String? name;
  @override
  final String? logo;
  @override
  final String? timezone;

  factory _$UpdateOrganizationRequest(
          [void Function(UpdateOrganizationRequestBuilder)? updates]) =>
      (UpdateOrganizationRequestBuilder()..update(updates))._build();

  _$UpdateOrganizationRequest._({this.name, this.logo, this.timezone})
      : super._();
  @override
  UpdateOrganizationRequest rebuild(
          void Function(UpdateOrganizationRequestBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  UpdateOrganizationRequestBuilder toBuilder() =>
      UpdateOrganizationRequestBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is UpdateOrganizationRequest &&
        name == other.name &&
        logo == other.logo &&
        timezone == other.timezone;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, logo.hashCode);
    _$hash = $jc(_$hash, timezone.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'UpdateOrganizationRequest')
          ..add('name', name)
          ..add('logo', logo)
          ..add('timezone', timezone))
        .toString();
  }
}

class UpdateOrganizationRequestBuilder
    implements
        Builder<UpdateOrganizationRequest, UpdateOrganizationRequestBuilder> {
  _$UpdateOrganizationRequest? _$v;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _logo;
  String? get logo => _$this._logo;
  set logo(String? logo) => _$this._logo = logo;

  String? _timezone;
  String? get timezone => _$this._timezone;
  set timezone(String? timezone) => _$this._timezone = timezone;

  UpdateOrganizationRequestBuilder() {
    UpdateOrganizationRequest._defaults(this);
  }

  UpdateOrganizationRequestBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _name = $v.name;
      _logo = $v.logo;
      _timezone = $v.timezone;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(UpdateOrganizationRequest other) {
    _$v = other as _$UpdateOrganizationRequest;
  }

  @override
  void update(void Function(UpdateOrganizationRequestBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  UpdateOrganizationRequest build() => _build();

  _$UpdateOrganizationRequest _build() {
    final _$result = _$v ??
        _$UpdateOrganizationRequest._(
          name: name,
          logo: logo,
          timezone: timezone,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
