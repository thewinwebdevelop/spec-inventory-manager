// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'role_detail_viewer.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$RoleDetailViewer extends RoleDetailViewer {
  @override
  final RoleWriteVerdict canEdit;
  @override
  final RoleWriteVerdict canDelete;
  @override
  final RoleWriteVerdict canClone;

  factory _$RoleDetailViewer(
          [void Function(RoleDetailViewerBuilder)? updates]) =>
      (RoleDetailViewerBuilder()..update(updates))._build();

  _$RoleDetailViewer._(
      {required this.canEdit, required this.canDelete, required this.canClone})
      : super._();
  @override
  RoleDetailViewer rebuild(void Function(RoleDetailViewerBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  RoleDetailViewerBuilder toBuilder() =>
      RoleDetailViewerBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RoleDetailViewer &&
        canEdit == other.canEdit &&
        canDelete == other.canDelete &&
        canClone == other.canClone;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, canEdit.hashCode);
    _$hash = $jc(_$hash, canDelete.hashCode);
    _$hash = $jc(_$hash, canClone.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'RoleDetailViewer')
          ..add('canEdit', canEdit)
          ..add('canDelete', canDelete)
          ..add('canClone', canClone))
        .toString();
  }
}

class RoleDetailViewerBuilder
    implements Builder<RoleDetailViewer, RoleDetailViewerBuilder> {
  _$RoleDetailViewer? _$v;

  RoleWriteVerdictBuilder? _canEdit;
  RoleWriteVerdictBuilder get canEdit =>
      _$this._canEdit ??= RoleWriteVerdictBuilder();
  set canEdit(RoleWriteVerdictBuilder? canEdit) => _$this._canEdit = canEdit;

  RoleWriteVerdictBuilder? _canDelete;
  RoleWriteVerdictBuilder get canDelete =>
      _$this._canDelete ??= RoleWriteVerdictBuilder();
  set canDelete(RoleWriteVerdictBuilder? canDelete) =>
      _$this._canDelete = canDelete;

  RoleWriteVerdictBuilder? _canClone;
  RoleWriteVerdictBuilder get canClone =>
      _$this._canClone ??= RoleWriteVerdictBuilder();
  set canClone(RoleWriteVerdictBuilder? canClone) =>
      _$this._canClone = canClone;

  RoleDetailViewerBuilder() {
    RoleDetailViewer._defaults(this);
  }

  RoleDetailViewerBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _canEdit = $v.canEdit.toBuilder();
      _canDelete = $v.canDelete.toBuilder();
      _canClone = $v.canClone.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RoleDetailViewer other) {
    _$v = other as _$RoleDetailViewer;
  }

  @override
  void update(void Function(RoleDetailViewerBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RoleDetailViewer build() => _build();

  _$RoleDetailViewer _build() {
    _$RoleDetailViewer _$result;
    try {
      _$result = _$v ??
          _$RoleDetailViewer._(
            canEdit: canEdit.build(),
            canDelete: canDelete.build(),
            canClone: canClone.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'canEdit';
        canEdit.build();
        _$failedField = 'canDelete';
        canDelete.build();
        _$failedField = 'canClone';
        canClone.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'RoleDetailViewer', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
