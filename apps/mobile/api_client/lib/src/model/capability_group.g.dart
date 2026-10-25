// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'capability_group.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CapabilityGroup extends CapabilityGroup {
  @override
  final String key;
  @override
  final String labelTh;

  factory _$CapabilityGroup([void Function(CapabilityGroupBuilder)? updates]) =>
      (CapabilityGroupBuilder()..update(updates))._build();

  _$CapabilityGroup._({required this.key, required this.labelTh}) : super._();
  @override
  CapabilityGroup rebuild(void Function(CapabilityGroupBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  CapabilityGroupBuilder toBuilder() => CapabilityGroupBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CapabilityGroup &&
        key == other.key &&
        labelTh == other.labelTh;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, key.hashCode);
    _$hash = $jc(_$hash, labelTh.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CapabilityGroup')
          ..add('key', key)
          ..add('labelTh', labelTh))
        .toString();
  }
}

class CapabilityGroupBuilder
    implements Builder<CapabilityGroup, CapabilityGroupBuilder> {
  _$CapabilityGroup? _$v;

  String? _key;
  String? get key => _$this._key;
  set key(String? key) => _$this._key = key;

  String? _labelTh;
  String? get labelTh => _$this._labelTh;
  set labelTh(String? labelTh) => _$this._labelTh = labelTh;

  CapabilityGroupBuilder() {
    CapabilityGroup._defaults(this);
  }

  CapabilityGroupBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _key = $v.key;
      _labelTh = $v.labelTh;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CapabilityGroup other) {
    _$v = other as _$CapabilityGroup;
  }

  @override
  void update(void Function(CapabilityGroupBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CapabilityGroup build() => _build();

  _$CapabilityGroup _build() {
    final _$result = _$v ??
        _$CapabilityGroup._(
          key: BuiltValueNullFieldError.checkNotNull(
              key, r'CapabilityGroup', 'key'),
          labelTh: BuiltValueNullFieldError.checkNotNull(
              labelTh, r'CapabilityGroup', 'labelTh'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
