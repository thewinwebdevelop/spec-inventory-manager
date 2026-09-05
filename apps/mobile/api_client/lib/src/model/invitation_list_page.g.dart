// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'invitation_list_page.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$InvitationListPage extends InvitationListPage {
  @override
  final BuiltList<Invitation> items;
  @override
  final String? nextCursor;

  factory _$InvitationListPage(
          [void Function(InvitationListPageBuilder)? updates]) =>
      (InvitationListPageBuilder()..update(updates))._build();

  _$InvitationListPage._({required this.items, this.nextCursor}) : super._();
  @override
  InvitationListPage rebuild(
          void Function(InvitationListPageBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  InvitationListPageBuilder toBuilder() =>
      InvitationListPageBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is InvitationListPage &&
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
    return (newBuiltValueToStringHelper(r'InvitationListPage')
          ..add('items', items)
          ..add('nextCursor', nextCursor))
        .toString();
  }
}

class InvitationListPageBuilder
    implements Builder<InvitationListPage, InvitationListPageBuilder> {
  _$InvitationListPage? _$v;

  ListBuilder<Invitation>? _items;
  ListBuilder<Invitation> get items =>
      _$this._items ??= ListBuilder<Invitation>();
  set items(ListBuilder<Invitation>? items) => _$this._items = items;

  String? _nextCursor;
  String? get nextCursor => _$this._nextCursor;
  set nextCursor(String? nextCursor) => _$this._nextCursor = nextCursor;

  InvitationListPageBuilder() {
    InvitationListPage._defaults(this);
  }

  InvitationListPageBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _items = $v.items.toBuilder();
      _nextCursor = $v.nextCursor;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(InvitationListPage other) {
    _$v = other as _$InvitationListPage;
  }

  @override
  void update(void Function(InvitationListPageBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  InvitationListPage build() => _build();

  _$InvitationListPage _build() {
    _$InvitationListPage _$result;
    try {
      _$result = _$v ??
          _$InvitationListPage._(
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
            r'InvitationListPage', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
