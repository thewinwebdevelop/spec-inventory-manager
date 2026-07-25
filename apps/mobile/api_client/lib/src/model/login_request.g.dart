// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'login_request.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const LoginRequestTokenTransportEnum _$loginRequestTokenTransportEnum_cookie =
    const LoginRequestTokenTransportEnum._('cookie');
const LoginRequestTokenTransportEnum _$loginRequestTokenTransportEnum_body =
    const LoginRequestTokenTransportEnum._('body');

LoginRequestTokenTransportEnum _$loginRequestTokenTransportEnumValueOf(
    String name) {
  switch (name) {
    case 'cookie':
      return _$loginRequestTokenTransportEnum_cookie;
    case 'body':
      return _$loginRequestTokenTransportEnum_body;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<LoginRequestTokenTransportEnum>
    _$loginRequestTokenTransportEnumValues = BuiltSet<
        LoginRequestTokenTransportEnum>(const <LoginRequestTokenTransportEnum>[
  _$loginRequestTokenTransportEnum_cookie,
  _$loginRequestTokenTransportEnum_body,
]);

Serializer<LoginRequestTokenTransportEnum>
    _$loginRequestTokenTransportEnumSerializer =
    _$LoginRequestTokenTransportEnumSerializer();

class _$LoginRequestTokenTransportEnumSerializer
    implements PrimitiveSerializer<LoginRequestTokenTransportEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'cookie': 'cookie',
    'body': 'body',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'cookie': 'cookie',
    'body': 'body',
  };

  @override
  final Iterable<Type> types = const <Type>[LoginRequestTokenTransportEnum];
  @override
  final String wireName = 'LoginRequestTokenTransportEnum';

  @override
  Object serialize(
          Serializers serializers, LoginRequestTokenTransportEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  LoginRequestTokenTransportEnum deserialize(
          Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      LoginRequestTokenTransportEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$LoginRequest extends LoginRequest {
  @override
  final String email;
  @override
  final String password;
  @override
  final String? deviceId;
  @override
  final LoginRequestTokenTransportEnum? tokenTransport;

  factory _$LoginRequest([void Function(LoginRequestBuilder)? updates]) =>
      (LoginRequestBuilder()..update(updates))._build();

  _$LoginRequest._(
      {required this.email,
      required this.password,
      this.deviceId,
      this.tokenTransport})
      : super._();
  @override
  LoginRequest rebuild(void Function(LoginRequestBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  LoginRequestBuilder toBuilder() => LoginRequestBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LoginRequest &&
        email == other.email &&
        password == other.password &&
        deviceId == other.deviceId &&
        tokenTransport == other.tokenTransport;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, password.hashCode);
    _$hash = $jc(_$hash, deviceId.hashCode);
    _$hash = $jc(_$hash, tokenTransport.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'LoginRequest')
          ..add('email', email)
          ..add('password', password)
          ..add('deviceId', deviceId)
          ..add('tokenTransport', tokenTransport))
        .toString();
  }
}

class LoginRequestBuilder
    implements Builder<LoginRequest, LoginRequestBuilder> {
  _$LoginRequest? _$v;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  String? _password;
  String? get password => _$this._password;
  set password(String? password) => _$this._password = password;

  String? _deviceId;
  String? get deviceId => _$this._deviceId;
  set deviceId(String? deviceId) => _$this._deviceId = deviceId;

  LoginRequestTokenTransportEnum? _tokenTransport;
  LoginRequestTokenTransportEnum? get tokenTransport => _$this._tokenTransport;
  set tokenTransport(LoginRequestTokenTransportEnum? tokenTransport) =>
      _$this._tokenTransport = tokenTransport;

  LoginRequestBuilder() {
    LoginRequest._defaults(this);
  }

  LoginRequestBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _email = $v.email;
      _password = $v.password;
      _deviceId = $v.deviceId;
      _tokenTransport = $v.tokenTransport;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LoginRequest other) {
    _$v = other as _$LoginRequest;
  }

  @override
  void update(void Function(LoginRequestBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  LoginRequest build() => _build();

  _$LoginRequest _build() {
    final _$result = _$v ??
        _$LoginRequest._(
          email: BuiltValueNullFieldError.checkNotNull(
              email, r'LoginRequest', 'email'),
          password: BuiltValueNullFieldError.checkNotNull(
              password, r'LoginRequest', 'password'),
          deviceId: deviceId,
          tokenTransport: tokenTransport,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
