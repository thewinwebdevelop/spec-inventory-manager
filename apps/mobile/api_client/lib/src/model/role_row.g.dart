// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'role_row.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$RoleRow extends RoleRow {
  @override
  final String id;
  @override
  final String name;
  @override
  final String? key;
  @override
  final bool? grantsOwnership;
  @override
  final bool isSystem;

  factory _$RoleRow([void Function(RoleRowBuilder)? updates]) =>
      (RoleRowBuilder()..update(updates))._build();

  _$RoleRow._(
      {required this.id,
      required this.name,
      this.key,
      this.grantsOwnership,
      required this.isSystem})
      : super._();
  @override
  RoleRow rebuild(void Function(RoleRowBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  RoleRowBuilder toBuilder() => RoleRowBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RoleRow &&
        id == other.id &&
        name == other.name &&
        key == other.key &&
        grantsOwnership == other.grantsOwnership &&
        isSystem == other.isSystem;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, key.hashCode);
    _$hash = $jc(_$hash, grantsOwnership.hashCode);
    _$hash = $jc(_$hash, isSystem.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'RoleRow')
          ..add('id', id)
          ..add('name', name)
          ..add('key', key)
          ..add('grantsOwnership', grantsOwnership)
          ..add('isSystem', isSystem))
        .toString();
  }
}

class RoleRowBuilder implements Builder<RoleRow, RoleRowBuilder> {
  _$RoleRow? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _key;
  String? get key => _$this._key;
  set key(String? key) => _$this._key = key;

  bool? _grantsOwnership;
  bool? get grantsOwnership => _$this._grantsOwnership;
  set grantsOwnership(bool? grantsOwnership) =>
      _$this._grantsOwnership = grantsOwnership;

  bool? _isSystem;
  bool? get isSystem => _$this._isSystem;
  set isSystem(bool? isSystem) => _$this._isSystem = isSystem;

  RoleRowBuilder() {
    RoleRow._defaults(this);
  }

  RoleRowBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _name = $v.name;
      _key = $v.key;
      _grantsOwnership = $v.grantsOwnership;
      _isSystem = $v.isSystem;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RoleRow other) {
    _$v = other as _$RoleRow;
  }

  @override
  void update(void Function(RoleRowBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RoleRow build() => _build();

  _$RoleRow _build() {
    final _$result = _$v ??
        _$RoleRow._(
          id: BuiltValueNullFieldError.checkNotNull(id, r'RoleRow', 'id'),
          name: BuiltValueNullFieldError.checkNotNull(name, r'RoleRow', 'name'),
          key: key,
          grantsOwnership: grantsOwnership,
          isSystem: BuiltValueNullFieldError.checkNotNull(
              isSystem, r'RoleRow', 'isSystem'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
