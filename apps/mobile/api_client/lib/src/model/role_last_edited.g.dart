// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'role_last_edited.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$RoleLastEdited extends RoleLastEdited {
  @override
  final DateTime at;
  @override
  final RoleLastEditedBy by;

  factory _$RoleLastEdited([void Function(RoleLastEditedBuilder)? updates]) =>
      (RoleLastEditedBuilder()..update(updates))._build();

  _$RoleLastEdited._({required this.at, required this.by}) : super._();
  @override
  RoleLastEdited rebuild(void Function(RoleLastEditedBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  RoleLastEditedBuilder toBuilder() => RoleLastEditedBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RoleLastEdited && at == other.at && by == other.by;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, at.hashCode);
    _$hash = $jc(_$hash, by.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'RoleLastEdited')
          ..add('at', at)
          ..add('by', by))
        .toString();
  }
}

class RoleLastEditedBuilder
    implements Builder<RoleLastEdited, RoleLastEditedBuilder> {
  _$RoleLastEdited? _$v;

  DateTime? _at;
  DateTime? get at => _$this._at;
  set at(DateTime? at) => _$this._at = at;

  RoleLastEditedByBuilder? _by;
  RoleLastEditedByBuilder get by => _$this._by ??= RoleLastEditedByBuilder();
  set by(RoleLastEditedByBuilder? by) => _$this._by = by;

  RoleLastEditedBuilder() {
    RoleLastEdited._defaults(this);
  }

  RoleLastEditedBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _at = $v.at;
      _by = $v.by.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RoleLastEdited other) {
    _$v = other as _$RoleLastEdited;
  }

  @override
  void update(void Function(RoleLastEditedBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RoleLastEdited build() => _build();

  _$RoleLastEdited _build() {
    _$RoleLastEdited _$result;
    try {
      _$result = _$v ??
          _$RoleLastEdited._(
            at: BuiltValueNullFieldError.checkNotNull(
                at, r'RoleLastEdited', 'at'),
            by: by.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'by';
        by.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'RoleLastEdited', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
