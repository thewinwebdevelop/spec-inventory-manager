// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'entitlement_summary.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$EntitlementSummary extends EntitlementSummary {
  @override
  final String planKey;
  @override
  final String? tierLabel;

  factory _$EntitlementSummary(
          [void Function(EntitlementSummaryBuilder)? updates]) =>
      (EntitlementSummaryBuilder()..update(updates))._build();

  _$EntitlementSummary._({required this.planKey, this.tierLabel}) : super._();
  @override
  EntitlementSummary rebuild(
          void Function(EntitlementSummaryBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  EntitlementSummaryBuilder toBuilder() =>
      EntitlementSummaryBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is EntitlementSummary &&
        planKey == other.planKey &&
        tierLabel == other.tierLabel;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, planKey.hashCode);
    _$hash = $jc(_$hash, tierLabel.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'EntitlementSummary')
          ..add('planKey', planKey)
          ..add('tierLabel', tierLabel))
        .toString();
  }
}

class EntitlementSummaryBuilder
    implements Builder<EntitlementSummary, EntitlementSummaryBuilder> {
  _$EntitlementSummary? _$v;

  String? _planKey;
  String? get planKey => _$this._planKey;
  set planKey(String? planKey) => _$this._planKey = planKey;

  String? _tierLabel;
  String? get tierLabel => _$this._tierLabel;
  set tierLabel(String? tierLabel) => _$this._tierLabel = tierLabel;

  EntitlementSummaryBuilder() {
    EntitlementSummary._defaults(this);
  }

  EntitlementSummaryBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _planKey = $v.planKey;
      _tierLabel = $v.tierLabel;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(EntitlementSummary other) {
    _$v = other as _$EntitlementSummary;
  }

  @override
  void update(void Function(EntitlementSummaryBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  EntitlementSummary build() => _build();

  _$EntitlementSummary _build() {
    final _$result = _$v ??
        _$EntitlementSummary._(
          planKey: BuiltValueNullFieldError.checkNotNull(
              planKey, r'EntitlementSummary', 'planKey'),
          tierLabel: tierLabel,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
