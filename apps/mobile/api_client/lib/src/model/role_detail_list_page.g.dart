// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'role_detail_list_page.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$RoleDetailListPage extends RoleDetailListPage {
  @override
  final BuiltList<RoleDetail> items;
  @override
  final String? nextCursor;
  @override
  final RoleDetailListViewer viewer;

  factory _$RoleDetailListPage(
          [void Function(RoleDetailListPageBuilder)? updates]) =>
      (RoleDetailListPageBuilder()..update(updates))._build();

  _$RoleDetailListPage._(
      {required this.items, this.nextCursor, required this.viewer})
      : super._();
  @override
  RoleDetailListPage rebuild(
          void Function(RoleDetailListPageBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  RoleDetailListPageBuilder toBuilder() =>
      RoleDetailListPageBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RoleDetailListPage &&
        items == other.items &&
        nextCursor == other.nextCursor &&
        viewer == other.viewer;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, items.hashCode);
    _$hash = $jc(_$hash, nextCursor.hashCode);
    _$hash = $jc(_$hash, viewer.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'RoleDetailListPage')
          ..add('items', items)
          ..add('nextCursor', nextCursor)
          ..add('viewer', viewer))
        .toString();
  }
}

class RoleDetailListPageBuilder
    implements Builder<RoleDetailListPage, RoleDetailListPageBuilder> {
  _$RoleDetailListPage? _$v;

  ListBuilder<RoleDetail>? _items;
  ListBuilder<RoleDetail> get items =>
      _$this._items ??= ListBuilder<RoleDetail>();
  set items(ListBuilder<RoleDetail>? items) => _$this._items = items;

  String? _nextCursor;
  String? get nextCursor => _$this._nextCursor;
  set nextCursor(String? nextCursor) => _$this._nextCursor = nextCursor;

  RoleDetailListViewerBuilder? _viewer;
  RoleDetailListViewerBuilder get viewer =>
      _$this._viewer ??= RoleDetailListViewerBuilder();
  set viewer(RoleDetailListViewerBuilder? viewer) => _$this._viewer = viewer;

  RoleDetailListPageBuilder() {
    RoleDetailListPage._defaults(this);
  }

  RoleDetailListPageBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _items = $v.items.toBuilder();
      _nextCursor = $v.nextCursor;
      _viewer = $v.viewer.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RoleDetailListPage other) {
    _$v = other as _$RoleDetailListPage;
  }

  @override
  void update(void Function(RoleDetailListPageBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RoleDetailListPage build() => _build();

  _$RoleDetailListPage _build() {
    _$RoleDetailListPage _$result;
    try {
      _$result = _$v ??
          _$RoleDetailListPage._(
            items: items.build(),
            nextCursor: nextCursor,
            viewer: viewer.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'items';
        items.build();

        _$failedField = 'viewer';
        viewer.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'RoleDetailListPage', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
