// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'token_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const TokenResponseTokenTypeEnum _$tokenResponseTokenTypeEnum_bearer =
    const TokenResponseTokenTypeEnum._('bearer');

TokenResponseTokenTypeEnum _$tokenResponseTokenTypeEnumValueOf(String name) {
  switch (name) {
    case 'bearer':
      return _$tokenResponseTokenTypeEnum_bearer;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<TokenResponseTokenTypeEnum> _$tokenResponseTokenTypeEnumValues =
    BuiltSet<TokenResponseTokenTypeEnum>(const <TokenResponseTokenTypeEnum>[
  _$tokenResponseTokenTypeEnum_bearer,
]);

Serializer<TokenResponseTokenTypeEnum> _$tokenResponseTokenTypeEnumSerializer =
    _$TokenResponseTokenTypeEnumSerializer();

class _$TokenResponseTokenTypeEnumSerializer
    implements PrimitiveSerializer<TokenResponseTokenTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'bearer': 'Bearer',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'Bearer': 'bearer',
  };

  @override
  final Iterable<Type> types = const <Type>[TokenResponseTokenTypeEnum];
  @override
  final String wireName = 'TokenResponseTokenTypeEnum';

  @override
  Object serialize(Serializers serializers, TokenResponseTokenTypeEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  TokenResponseTokenTypeEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      TokenResponseTokenTypeEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$TokenResponse extends TokenResponse {
  @override
  final String accessToken;
  @override
  final String? refreshToken;
  @override
  final int expiresIn;
  @override
  final TokenResponseTokenTypeEnum tokenType;

  factory _$TokenResponse([void Function(TokenResponseBuilder)? updates]) =>
      (TokenResponseBuilder()..update(updates))._build();

  _$TokenResponse._(
      {required this.accessToken,
      this.refreshToken,
      required this.expiresIn,
      required this.tokenType})
      : super._();
  @override
  TokenResponse rebuild(void Function(TokenResponseBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  TokenResponseBuilder toBuilder() => TokenResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TokenResponse &&
        accessToken == other.accessToken &&
        refreshToken == other.refreshToken &&
        expiresIn == other.expiresIn &&
        tokenType == other.tokenType;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, accessToken.hashCode);
    _$hash = $jc(_$hash, refreshToken.hashCode);
    _$hash = $jc(_$hash, expiresIn.hashCode);
    _$hash = $jc(_$hash, tokenType.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TokenResponse')
          ..add('accessToken', accessToken)
          ..add('refreshToken', refreshToken)
          ..add('expiresIn', expiresIn)
          ..add('tokenType', tokenType))
        .toString();
  }
}

class TokenResponseBuilder
    implements Builder<TokenResponse, TokenResponseBuilder> {
  _$TokenResponse? _$v;

  String? _accessToken;
  String? get accessToken => _$this._accessToken;
  set accessToken(String? accessToken) => _$this._accessToken = accessToken;

  String? _refreshToken;
  String? get refreshToken => _$this._refreshToken;
  set refreshToken(String? refreshToken) => _$this._refreshToken = refreshToken;

  int? _expiresIn;
  int? get expiresIn => _$this._expiresIn;
  set expiresIn(int? expiresIn) => _$this._expiresIn = expiresIn;

  TokenResponseTokenTypeEnum? _tokenType;
  TokenResponseTokenTypeEnum? get tokenType => _$this._tokenType;
  set tokenType(TokenResponseTokenTypeEnum? tokenType) =>
      _$this._tokenType = tokenType;

  TokenResponseBuilder() {
    TokenResponse._defaults(this);
  }

  TokenResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _accessToken = $v.accessToken;
      _refreshToken = $v.refreshToken;
      _expiresIn = $v.expiresIn;
      _tokenType = $v.tokenType;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TokenResponse other) {
    _$v = other as _$TokenResponse;
  }

  @override
  void update(void Function(TokenResponseBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TokenResponse build() => _build();

  _$TokenResponse _build() {
    final _$result = _$v ??
        _$TokenResponse._(
          accessToken: BuiltValueNullFieldError.checkNotNull(
              accessToken, r'TokenResponse', 'accessToken'),
          refreshToken: refreshToken,
          expiresIn: BuiltValueNullFieldError.checkNotNull(
              expiresIn, r'TokenResponse', 'expiresIn'),
          tokenType: BuiltValueNullFieldError.checkNotNull(
              tokenType, r'TokenResponse', 'tokenType'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
