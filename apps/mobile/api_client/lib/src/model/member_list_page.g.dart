// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'member_list_page.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$MemberListPage extends MemberListPage {
  @override
  final BuiltList<MemberRow> items;
  @override
  final String? nextCursor;
  @override
  final int? total;

  factory _$MemberListPage([void Function(MemberListPageBuilder)? updates]) =>
      (MemberListPageBuilder()..update(updates))._build();

  _$MemberListPage._({required this.items, this.nextCursor, this.total})
      : super._();
  @override
  MemberListPage rebuild(void Function(MemberListPageBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  MemberListPageBuilder toBuilder() => MemberListPageBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is MemberListPage &&
        items == other.items &&
        nextCursor == other.nextCursor &&
        total == other.total;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, items.hashCode);
    _$hash = $jc(_$hash, nextCursor.hashCode);
    _$hash = $jc(_$hash, total.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'MemberListPage')
          ..add('items', items)
          ..add('nextCursor', nextCursor)
          ..add('total', total))
        .toString();
  }
}

class MemberListPageBuilder
    implements Builder<MemberListPage, MemberListPageBuilder> {
  _$MemberListPage? _$v;

  ListBuilder<MemberRow>? _items;
  ListBuilder<MemberRow> get items =>
      _$this._items ??= ListBuilder<MemberRow>();
  set items(ListBuilder<MemberRow>? items) => _$this._items = items;

  String? _nextCursor;
  String? get nextCursor => _$this._nextCursor;
  set nextCursor(String? nextCursor) => _$this._nextCursor = nextCursor;

  int? _total;
  int? get total => _$this._total;
  set total(int? total) => _$this._total = total;

  MemberListPageBuilder() {
    MemberListPage._defaults(this);
  }

  MemberListPageBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _items = $v.items.toBuilder();
      _nextCursor = $v.nextCursor;
      _total = $v.total;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(MemberListPage other) {
    _$v = other as _$MemberListPage;
  }

  @override
  void update(void Function(MemberListPageBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  MemberListPage build() => _build();

  _$MemberListPage _build() {
    _$MemberListPage _$result;
    try {
      _$result = _$v ??
          _$MemberListPage._(
            items: items.build(),
            nextCursor: nextCursor,
            total: total,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'items';
        items.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'MemberListPage', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
