// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ok_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const OkResponseOkEnum _$okResponseOkEnum_true_ =
    const OkResponseOkEnum._('true_');

OkResponseOkEnum _$okResponseOkEnumValueOf(String name) {
  switch (name) {
    case 'true_':
      return _$okResponseOkEnum_true_;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<OkResponseOkEnum> _$okResponseOkEnumValues =
    BuiltSet<OkResponseOkEnum>(const <OkResponseOkEnum>[
  _$okResponseOkEnum_true_,
]);

Serializer<OkResponseOkEnum> _$okResponseOkEnumSerializer =
    _$OkResponseOkEnumSerializer();

class _$OkResponseOkEnumSerializer
    implements PrimitiveSerializer<OkResponseOkEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'true_': 'true',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'true': 'true_',
  };

  @override
  final Iterable<Type> types = const <Type>[OkResponseOkEnum];
  @override
  final String wireName = 'OkResponseOkEnum';

  @override
  Object serialize(Serializers serializers, OkResponseOkEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  OkResponseOkEnum deserialize(Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      OkResponseOkEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$OkResponse extends OkResponse {
  @override
  final OkResponseOkEnum ok;

  factory _$OkResponse([void Function(OkResponseBuilder)? updates]) =>
      (OkResponseBuilder()..update(updates))._build();

  _$OkResponse._({required this.ok}) : super._();
  @override
  OkResponse rebuild(void Function(OkResponseBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  OkResponseBuilder toBuilder() => OkResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OkResponse && ok == other.ok;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, ok.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OkResponse')..add('ok', ok))
        .toString();
  }
}

class OkResponseBuilder implements Builder<OkResponse, OkResponseBuilder> {
  _$OkResponse? _$v;

  OkResponseOkEnum? _ok;
  OkResponseOkEnum? get ok => _$this._ok;
  set ok(OkResponseOkEnum? ok) => _$this._ok = ok;

  OkResponseBuilder() {
    OkResponse._defaults(this);
  }

  OkResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _ok = $v.ok;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OkResponse other) {
    _$v = other as _$OkResponse;
  }

  @override
  void update(void Function(OkResponseBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OkResponse build() => _build();

  _$OkResponse _build() {
    final _$result = _$v ??
        _$OkResponse._(
          ok: BuiltValueNullFieldError.checkNotNull(ok, r'OkResponse', 'ok'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
