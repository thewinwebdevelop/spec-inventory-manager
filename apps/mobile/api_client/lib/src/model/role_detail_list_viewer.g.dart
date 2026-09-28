// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'role_detail_list_viewer.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$RoleDetailListViewer extends RoleDetailListViewer {
  @override
  final RoleWriteVerdict canCreate;
  @override
  final int limit;

  factory _$RoleDetailListViewer(
          [void Function(RoleDetailListViewerBuilder)? updates]) =>
      (RoleDetailListViewerBuilder()..update(updates))._build();

  _$RoleDetailListViewer._({required this.canCreate, required this.limit})
      : super._();
  @override
  RoleDetailListViewer rebuild(
          void Function(RoleDetailListViewerBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  RoleDetailListViewerBuilder toBuilder() =>
      RoleDetailListViewerBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RoleDetailListViewer &&
        canCreate == other.canCreate &&
        limit == other.limit;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, canCreate.hashCode);
    _$hash = $jc(_$hash, limit.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'RoleDetailListViewer')
          ..add('canCreate', canCreate)
          ..add('limit', limit))
        .toString();
  }
}

class RoleDetailListViewerBuilder
    implements Builder<RoleDetailListViewer, RoleDetailListViewerBuilder> {
  _$RoleDetailListViewer? _$v;

  RoleWriteVerdictBuilder? _canCreate;
  RoleWriteVerdictBuilder get canCreate =>
      _$this._canCreate ??= RoleWriteVerdictBuilder();
  set canCreate(RoleWriteVerdictBuilder? canCreate) =>
      _$this._canCreate = canCreate;

  int? _limit;
  int? get limit => _$this._limit;
  set limit(int? limit) => _$this._limit = limit;

  RoleDetailListViewerBuilder() {
    RoleDetailListViewer._defaults(this);
  }

  RoleDetailListViewerBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _canCreate = $v.canCreate.toBuilder();
      _limit = $v.limit;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RoleDetailListViewer other) {
    _$v = other as _$RoleDetailListViewer;
  }

  @override
  void update(void Function(RoleDetailListViewerBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RoleDetailListViewer build() => _build();

  _$RoleDetailListViewer _build() {
    _$RoleDetailListViewer _$result;
    try {
      _$result = _$v ??
          _$RoleDetailListViewer._(
            canCreate: canCreate.build(),
            limit: BuiltValueNullFieldError.checkNotNull(
                limit, r'RoleDetailListViewer', 'limit'),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'canCreate';
        canCreate.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'RoleDetailListViewer', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
