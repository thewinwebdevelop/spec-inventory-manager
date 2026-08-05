// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_organizations_page.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$MyOrganizationsPage extends MyOrganizationsPage {
  @override
  final BuiltList<MyOrganizationItem> items;
  @override
  final String? nextCursor;

  factory _$MyOrganizationsPage(
          [void Function(MyOrganizationsPageBuilder)? updates]) =>
      (MyOrganizationsPageBuilder()..update(updates))._build();

  _$MyOrganizationsPage._({required this.items, this.nextCursor}) : super._();
  @override
  MyOrganizationsPage rebuild(
          void Function(MyOrganizationsPageBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  MyOrganizationsPageBuilder toBuilder() =>
      MyOrganizationsPageBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is MyOrganizationsPage &&
        items == other.items &&
        nextCursor == other.nextCursor;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, items.hashCode);
    _$hash = $jc(_$hash, nextCursor.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'MyOrganizationsPage')
          ..add('items', items)
          ..add('nextCursor', nextCursor))
        .toString();
  }
}

class MyOrganizationsPageBuilder
    implements Builder<MyOrganizationsPage, MyOrganizationsPageBuilder> {
  _$MyOrganizationsPage? _$v;

  ListBuilder<MyOrganizationItem>? _items;
  ListBuilder<MyOrganizationItem> get items =>
      _$this._items ??= ListBuilder<MyOrganizationItem>();
  set items(ListBuilder<MyOrganizationItem>? items) => _$this._items = items;

  String? _nextCursor;
  String? get nextCursor => _$this._nextCursor;
  set nextCursor(String? nextCursor) => _$this._nextCursor = nextCursor;

  MyOrganizationsPageBuilder() {
    MyOrganizationsPage._defaults(this);
  }

  MyOrganizationsPageBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _items = $v.items.toBuilder();
      _nextCursor = $v.nextCursor;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(MyOrganizationsPage other) {
    _$v = other as _$MyOrganizationsPage;
  }

  @override
  void update(void Function(MyOrganizationsPageBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  MyOrganizationsPage build() => _build();

  _$MyOrganizationsPage _build() {
    _$MyOrganizationsPage _$result;
    try {
      _$result = _$v ??
          _$MyOrganizationsPage._(
            items: items.build(),
            nextCursor: nextCursor,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'items';
        items.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'MyOrganizationsPage', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
