// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'capability_catalog.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CapabilityCatalog extends CapabilityCatalog {
  @override
  final BuiltList<CapabilityGroup> groups;
  @override
  final BuiltList<CapabilityEntry> items;

  factory _$CapabilityCatalog(
          [void Function(CapabilityCatalogBuilder)? updates]) =>
      (CapabilityCatalogBuilder()..update(updates))._build();

  _$CapabilityCatalog._({required this.groups, required this.items})
      : super._();
  @override
  CapabilityCatalog rebuild(void Function(CapabilityCatalogBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  CapabilityCatalogBuilder toBuilder() =>
      CapabilityCatalogBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CapabilityCatalog &&
        groups == other.groups &&
        items == other.items;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, groups.hashCode);
    _$hash = $jc(_$hash, items.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CapabilityCatalog')
          ..add('groups', groups)
          ..add('items', items))
        .toString();
  }
}

class CapabilityCatalogBuilder
    implements Builder<CapabilityCatalog, CapabilityCatalogBuilder> {
  _$CapabilityCatalog? _$v;

  ListBuilder<CapabilityGroup>? _groups;
  ListBuilder<CapabilityGroup> get groups =>
      _$this._groups ??= ListBuilder<CapabilityGroup>();
  set groups(ListBuilder<CapabilityGroup>? groups) => _$this._groups = groups;

  ListBuilder<CapabilityEntry>? _items;
  ListBuilder<CapabilityEntry> get items =>
      _$this._items ??= ListBuilder<CapabilityEntry>();
  set items(ListBuilder<CapabilityEntry>? items) => _$this._items = items;

  CapabilityCatalogBuilder() {
    CapabilityCatalog._defaults(this);
  }

  CapabilityCatalogBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _groups = $v.groups.toBuilder();
      _items = $v.items.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CapabilityCatalog other) {
    _$v = other as _$CapabilityCatalog;
  }

  @override
  void update(void Function(CapabilityCatalogBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CapabilityCatalog build() => _build();

  _$CapabilityCatalog _build() {
    _$CapabilityCatalog _$result;
    try {
      _$result = _$v ??
          _$CapabilityCatalog._(
            groups: groups.build(),
            items: items.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'groups';
        groups.build();
        _$failedField = 'items';
        items.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'CapabilityCatalog', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
