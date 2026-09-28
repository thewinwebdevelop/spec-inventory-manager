// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'role_write_verdict.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$RoleWriteVerdict extends RoleWriteVerdict {
  @override
  final bool allowed;
  @override
  final String? reason;

  factory _$RoleWriteVerdict(
          [void Function(RoleWriteVerdictBuilder)? updates]) =>
      (RoleWriteVerdictBuilder()..update(updates))._build();

  _$RoleWriteVerdict._({required this.allowed, this.reason}) : super._();
  @override
  RoleWriteVerdict rebuild(void Function(RoleWriteVerdictBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  RoleWriteVerdictBuilder toBuilder() =>
      RoleWriteVerdictBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RoleWriteVerdict &&
        allowed == other.allowed &&
        reason == other.reason;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, allowed.hashCode);
    _$hash = $jc(_$hash, reason.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'RoleWriteVerdict')
          ..add('allowed', allowed)
          ..add('reason', reason))
        .toString();
  }
}

class RoleWriteVerdictBuilder
    implements Builder<RoleWriteVerdict, RoleWriteVerdictBuilder> {
  _$RoleWriteVerdict? _$v;

  bool? _allowed;
  bool? get allowed => _$this._allowed;
  set allowed(bool? allowed) => _$this._allowed = allowed;

  String? _reason;
  String? get reason => _$this._reason;
  set reason(String? reason) => _$this._reason = reason;

  RoleWriteVerdictBuilder() {
    RoleWriteVerdict._defaults(this);
  }

  RoleWriteVerdictBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _allowed = $v.allowed;
      _reason = $v.reason;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RoleWriteVerdict other) {
    _$v = other as _$RoleWriteVerdict;
  }

  @override
  void update(void Function(RoleWriteVerdictBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RoleWriteVerdict build() => _build();

  _$RoleWriteVerdict _build() {
    final _$result = _$v ??
        _$RoleWriteVerdict._(
          allowed: BuiltValueNullFieldError.checkNotNull(
              allowed, r'RoleWriteVerdict', 'allowed'),
          reason: reason,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
