// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_role_request.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CreateRoleRequest extends CreateRoleRequest {
  @override
  final String name;
  @override
  final BuiltList<String> capabilities;

  factory _$CreateRoleRequest(
          [void Function(CreateRoleRequestBuilder)? updates]) =>
      (CreateRoleRequestBuilder()..update(updates))._build();

  _$CreateRoleRequest._({required this.name, required this.capabilities})
      : super._();
  @override
  CreateRoleRequest rebuild(void Function(CreateRoleRequestBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  CreateRoleRequestBuilder toBuilder() =>
      CreateRoleRequestBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateRoleRequest &&
        name == other.name &&
        capabilities == other.capabilities;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, capabilities.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateRoleRequest')
          ..add('name', name)
          ..add('capabilities', capabilities))
        .toString();
  }
}

class CreateRoleRequestBuilder
    implements Builder<CreateRoleRequest, CreateRoleRequestBuilder> {
  _$CreateRoleRequest? _$v;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  ListBuilder<String>? _capabilities;
  ListBuilder<String> get capabilities =>
      _$this._capabilities ??= ListBuilder<String>();
  set capabilities(ListBuilder<String>? capabilities) =>
      _$this._capabilities = capabilities;

  CreateRoleRequestBuilder() {
    CreateRoleRequest._defaults(this);
  }

  CreateRoleRequestBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _name = $v.name;
      _capabilities = $v.capabilities.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateRoleRequest other) {
    _$v = other as _$CreateRoleRequest;
  }

  @override
  void update(void Function(CreateRoleRequestBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateRoleRequest build() => _build();

  _$CreateRoleRequest _build() {
    _$CreateRoleRequest _$result;
    try {
      _$result = _$v ??
          _$CreateRoleRequest._(
            name: BuiltValueNullFieldError.checkNotNull(
                name, r'CreateRoleRequest', 'name'),
            capabilities: capabilities.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'capabilities';
        capabilities.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'CreateRoleRequest', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
