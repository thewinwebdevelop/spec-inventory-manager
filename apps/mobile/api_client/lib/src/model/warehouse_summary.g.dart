// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'warehouse_summary.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$WarehouseSummary extends WarehouseSummary {
  @override
  final String id;
  @override
  final String name;

  factory _$WarehouseSummary(
          [void Function(WarehouseSummaryBuilder)? updates]) =>
      (WarehouseSummaryBuilder()..update(updates))._build();

  _$WarehouseSummary._({required this.id, required this.name}) : super._();
  @override
  WarehouseSummary rebuild(void Function(WarehouseSummaryBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  WarehouseSummaryBuilder toBuilder() =>
      WarehouseSummaryBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WarehouseSummary && id == other.id && name == other.name;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'WarehouseSummary')
          ..add('id', id)
          ..add('name', name))
        .toString();
  }
}

class WarehouseSummaryBuilder
    implements Builder<WarehouseSummary, WarehouseSummaryBuilder> {
  _$WarehouseSummary? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  WarehouseSummaryBuilder() {
    WarehouseSummary._defaults(this);
  }

  WarehouseSummaryBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _name = $v.name;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(WarehouseSummary other) {
    _$v = other as _$WarehouseSummary;
  }

  @override
  void update(void Function(WarehouseSummaryBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  WarehouseSummary build() => _build();

  _$WarehouseSummary _build() {
    final _$result = _$v ??
        _$WarehouseSummary._(
          id: BuiltValueNullFieldError.checkNotNull(
              id, r'WarehouseSummary', 'id'),
          name: BuiltValueNullFieldError.checkNotNull(
              name, r'WarehouseSummary', 'name'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
