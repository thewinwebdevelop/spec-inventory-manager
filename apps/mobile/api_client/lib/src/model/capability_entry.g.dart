// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'capability_entry.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CapabilityEntry extends CapabilityEntry {
  @override
  final String key;
  @override
  final String labelTh;
  @override
  final String descriptionTh;
  @override
  final String? group;
  @override
  final String status;
  @override
  final BuiltList<String> implies;
  @override
  final bool selectable;

  factory _$CapabilityEntry([void Function(CapabilityEntryBuilder)? updates]) =>
      (CapabilityEntryBuilder()..update(updates))._build();

  _$CapabilityEntry._(
      {required this.key,
      required this.labelTh,
      required this.descriptionTh,
      this.group,
      required this.status,
      required this.implies,
      required this.selectable})
      : super._();
  @override
  CapabilityEntry rebuild(void Function(CapabilityEntryBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  CapabilityEntryBuilder toBuilder() => CapabilityEntryBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CapabilityEntry &&
        key == other.key &&
        labelTh == other.labelTh &&
        descriptionTh == other.descriptionTh &&
        group == other.group &&
        status == other.status &&
        implies == other.implies &&
        selectable == other.selectable;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, key.hashCode);
    _$hash = $jc(_$hash, labelTh.hashCode);
    _$hash = $jc(_$hash, descriptionTh.hashCode);
    _$hash = $jc(_$hash, group.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, implies.hashCode);
    _$hash = $jc(_$hash, selectable.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CapabilityEntry')
          ..add('key', key)
          ..add('labelTh', labelTh)
          ..add('descriptionTh', descriptionTh)
          ..add('group', group)
          ..add('status', status)
          ..add('implies', implies)
          ..add('selectable', selectable))
        .toString();
  }
}

class CapabilityEntryBuilder
    implements Builder<CapabilityEntry, CapabilityEntryBuilder> {
  _$CapabilityEntry? _$v;

  String? _key;
  String? get key => _$this._key;
  set key(String? key) => _$this._key = key;

  String? _labelTh;
  String? get labelTh => _$this._labelTh;
  set labelTh(String? labelTh) => _$this._labelTh = labelTh;

  String? _descriptionTh;
  String? get descriptionTh => _$this._descriptionTh;
  set descriptionTh(String? descriptionTh) =>
      _$this._descriptionTh = descriptionTh;

  String? _group;
  String? get group => _$this._group;
  set group(String? group) => _$this._group = group;

  String? _status;
  String? get status => _$this._status;
  set status(String? status) => _$this._status = status;

  ListBuilder<String>? _implies;
  ListBuilder<String> get implies => _$this._implies ??= ListBuilder<String>();
  set implies(ListBuilder<String>? implies) => _$this._implies = implies;

  bool? _selectable;
  bool? get selectable => _$this._selectable;
  set selectable(bool? selectable) => _$this._selectable = selectable;

  CapabilityEntryBuilder() {
    CapabilityEntry._defaults(this);
  }

  CapabilityEntryBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _key = $v.key;
      _labelTh = $v.labelTh;
      _descriptionTh = $v.descriptionTh;
      _group = $v.group;
      _status = $v.status;
      _implies = $v.implies.toBuilder();
      _selectable = $v.selectable;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CapabilityEntry other) {
    _$v = other as _$CapabilityEntry;
  }

  @override
  void update(void Function(CapabilityEntryBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CapabilityEntry build() => _build();

  _$CapabilityEntry _build() {
    _$CapabilityEntry _$result;
    try {
      _$result = _$v ??
          _$CapabilityEntry._(
            key: BuiltValueNullFieldError.checkNotNull(
                key, r'CapabilityEntry', 'key'),
            labelTh: BuiltValueNullFieldError.checkNotNull(
                labelTh, r'CapabilityEntry', 'labelTh'),
            descriptionTh: BuiltValueNullFieldError.checkNotNull(
                descriptionTh, r'CapabilityEntry', 'descriptionTh'),
            group: group,
            status: BuiltValueNullFieldError.checkNotNull(
                status, r'CapabilityEntry', 'status'),
            implies: implies.build(),
            selectable: BuiltValueNullFieldError.checkNotNull(
                selectable, r'CapabilityEntry', 'selectable'),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'implies';
        implies.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'CapabilityEntry', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
