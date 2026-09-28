// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'role_last_edited_by.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$RoleLastEditedBy extends RoleLastEditedBy {
  @override
  final String kind;
  @override
  final String? roleName;
  @override
  final String? roleKey;
  @override
  final bool? roleNameCustomized;

  factory _$RoleLastEditedBy(
          [void Function(RoleLastEditedByBuilder)? updates]) =>
      (RoleLastEditedByBuilder()..update(updates))._build();

  _$RoleLastEditedBy._(
      {required this.kind,
      this.roleName,
      this.roleKey,
      this.roleNameCustomized})
      : super._();
  @override
  RoleLastEditedBy rebuild(void Function(RoleLastEditedByBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  RoleLastEditedByBuilder toBuilder() =>
      RoleLastEditedByBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RoleLastEditedBy &&
        kind == other.kind &&
        roleName == other.roleName &&
        roleKey == other.roleKey &&
        roleNameCustomized == other.roleNameCustomized;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, kind.hashCode);
    _$hash = $jc(_$hash, roleName.hashCode);
    _$hash = $jc(_$hash, roleKey.hashCode);
    _$hash = $jc(_$hash, roleNameCustomized.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'RoleLastEditedBy')
          ..add('kind', kind)
          ..add('roleName', roleName)
          ..add('roleKey', roleKey)
          ..add('roleNameCustomized', roleNameCustomized))
        .toString();
  }
}

class RoleLastEditedByBuilder
    implements Builder<RoleLastEditedBy, RoleLastEditedByBuilder> {
  _$RoleLastEditedBy? _$v;

  String? _kind;
  String? get kind => _$this._kind;
  set kind(String? kind) => _$this._kind = kind;

  String? _roleName;
  String? get roleName => _$this._roleName;
  set roleName(String? roleName) => _$this._roleName = roleName;

  String? _roleKey;
  String? get roleKey => _$this._roleKey;
  set roleKey(String? roleKey) => _$this._roleKey = roleKey;

  bool? _roleNameCustomized;
  bool? get roleNameCustomized => _$this._roleNameCustomized;
  set roleNameCustomized(bool? roleNameCustomized) =>
      _$this._roleNameCustomized = roleNameCustomized;

  RoleLastEditedByBuilder() {
    RoleLastEditedBy._defaults(this);
  }

  RoleLastEditedByBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _kind = $v.kind;
      _roleName = $v.roleName;
      _roleKey = $v.roleKey;
      _roleNameCustomized = $v.roleNameCustomized;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RoleLastEditedBy other) {
    _$v = other as _$RoleLastEditedBy;
  }

  @override
  void update(void Function(RoleLastEditedByBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RoleLastEditedBy build() => _build();

  _$RoleLastEditedBy _build() {
    final _$result = _$v ??
        _$RoleLastEditedBy._(
          kind: BuiltValueNullFieldError.checkNotNull(
              kind, r'RoleLastEditedBy', 'kind'),
          roleName: roleName,
          roleKey: roleKey,
          roleNameCustomized: roleNameCustomized,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
