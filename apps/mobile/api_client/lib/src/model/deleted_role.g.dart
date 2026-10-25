// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'deleted_role.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$DeletedRole extends DeletedRole {
  @override
  final String id;
  @override
  final DateTime deletedAt;

  factory _$DeletedRole([void Function(DeletedRoleBuilder)? updates]) =>
      (DeletedRoleBuilder()..update(updates))._build();

  _$DeletedRole._({required this.id, required this.deletedAt}) : super._();
  @override
  DeletedRole rebuild(void Function(DeletedRoleBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  DeletedRoleBuilder toBuilder() => DeletedRoleBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is DeletedRole &&
        id == other.id &&
        deletedAt == other.deletedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, deletedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'DeletedRole')
          ..add('id', id)
          ..add('deletedAt', deletedAt))
        .toString();
  }
}

class DeletedRoleBuilder implements Builder<DeletedRole, DeletedRoleBuilder> {
  _$DeletedRole? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  DateTime? _deletedAt;
  DateTime? get deletedAt => _$this._deletedAt;
  set deletedAt(DateTime? deletedAt) => _$this._deletedAt = deletedAt;

  DeletedRoleBuilder() {
    DeletedRole._defaults(this);
  }

  DeletedRoleBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _deletedAt = $v.deletedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(DeletedRole other) {
    _$v = other as _$DeletedRole;
  }

  @override
  void update(void Function(DeletedRoleBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  DeletedRole build() => _build();

  _$DeletedRole _build() {
    final _$result = _$v ??
        _$DeletedRole._(
          id: BuiltValueNullFieldError.checkNotNull(id, r'DeletedRole', 'id'),
          deletedAt: BuiltValueNullFieldError.checkNotNull(
              deletedAt, r'DeletedRole', 'deletedAt'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
