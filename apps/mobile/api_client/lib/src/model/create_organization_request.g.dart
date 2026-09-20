// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_organization_request.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CreateOrganizationRequest extends CreateOrganizationRequest {
  @override
  final String name;
  @override
  final String? timezone;

  factory _$CreateOrganizationRequest(
          [void Function(CreateOrganizationRequestBuilder)? updates]) =>
      (CreateOrganizationRequestBuilder()..update(updates))._build();

  _$CreateOrganizationRequest._({required this.name, this.timezone})
      : super._();
  @override
  CreateOrganizationRequest rebuild(
          void Function(CreateOrganizationRequestBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  CreateOrganizationRequestBuilder toBuilder() =>
      CreateOrganizationRequestBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateOrganizationRequest &&
        name == other.name &&
        timezone == other.timezone;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, timezone.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateOrganizationRequest')
          ..add('name', name)
          ..add('timezone', timezone))
        .toString();
  }
}

class CreateOrganizationRequestBuilder
    implements
        Builder<CreateOrganizationRequest, CreateOrganizationRequestBuilder> {
  _$CreateOrganizationRequest? _$v;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _timezone;
  String? get timezone => _$this._timezone;
  set timezone(String? timezone) => _$this._timezone = timezone;

  CreateOrganizationRequestBuilder() {
    CreateOrganizationRequest._defaults(this);
  }

  CreateOrganizationRequestBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _name = $v.name;
      _timezone = $v.timezone;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateOrganizationRequest other) {
    _$v = other as _$CreateOrganizationRequest;
  }

  @override
  void update(void Function(CreateOrganizationRequestBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateOrganizationRequest build() => _build();

  _$CreateOrganizationRequest _build() {
    final _$result = _$v ??
        _$CreateOrganizationRequest._(
          name: BuiltValueNullFieldError.checkNotNull(
              name, r'CreateOrganizationRequest', 'name'),
          timezone: timezone,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
