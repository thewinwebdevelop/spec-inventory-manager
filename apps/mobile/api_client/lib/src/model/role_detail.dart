//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:omnistock_api_client/src/model/role_usage.dart';
import 'package:built_collection/built_collection.dart';
import 'package:omnistock_api_client/src/model/role_last_edited.dart';
import 'package:omnistock_api_client/src/model/role_detail_viewer.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'role_detail.g.dart';

/// One role in full — the body of the role detail read, each item of the role list page, and the success body of creating or updating a role (api-spec §3). Readable only by a holder of `manage_roles`.  Unlike `RoleRow` (readable by every active member), this DOES publish `capabilities`: the reader can already edit roles, so the list is the thing they are here to see. 
///
/// Properties:
/// * [id] 
/// * [name] - The stored name, already normalised (NFC, trimmed, inner whitespace collapsed). Display rule (AC-1.5): `nameCustomized ? name : (translate key ?? name)`. 
/// * [key] - Stable slug for TRANSLATION ONLY: `owner`, `admin` or `staff` for the system presets, `null` for every role a user created. OPEN SET — on `null` or an unrecognised value fall back to `name`.  ⛔ NEVER a permission input. Whether a role grants ownership is `grantsOwnership`; what it allows is `capabilities`. 
/// * [nameCustomized] - The shop renamed this role (always `true` for a role with `key: null`). When `true`, show `name` as-is instead of translating `key`. 
/// * [isSystem] - The locked Owner role. It can be neither edited, renamed nor deleted. `viewer` already says so per action — use this for labelling only. 
/// * [grantsOwnership] - Derived server-side from `capabilities` (`full_access`), never from `key`. 
/// * [capabilities] - The CANONICAL stored set, sorted by key (api-spec §2): a key implied by another key in the set is not repeated. The Owner role is exactly `[\"full_access\"]`. May contain keys whose catalog `status` is `upcoming`, and — from an older catalog — keys a client does not know: render those generically, never drop them silently. 
/// * [version] - Optimistic-concurrency token. Send it back unchanged in `UpdateRoleRequest.version`. On a version conflict the client MUST re-fetch this role and show the difference — it must never resubmit automatically with the newer version (AC-3.12). 
/// * [usage] 
/// * [lastEdited] - `null` = never edited since the system provisioned it (\"ค่าเริ่มต้นของระบบ\", AC-9.6). 
/// * [viewer] 
/// * [createdAt] 
@BuiltValue()
abstract class RoleDetail implements Built<RoleDetail, RoleDetailBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  /// The stored name, already normalised (NFC, trimmed, inner whitespace collapsed). Display rule (AC-1.5): `nameCustomized ? name : (translate key ?? name)`. 
  @BuiltValueField(wireName: r'name')
  String get name;

  /// Stable slug for TRANSLATION ONLY: `owner`, `admin` or `staff` for the system presets, `null` for every role a user created. OPEN SET — on `null` or an unrecognised value fall back to `name`.  ⛔ NEVER a permission input. Whether a role grants ownership is `grantsOwnership`; what it allows is `capabilities`. 
  @BuiltValueField(wireName: r'key')
  String? get key;

  /// The shop renamed this role (always `true` for a role with `key: null`). When `true`, show `name` as-is instead of translating `key`. 
  @BuiltValueField(wireName: r'nameCustomized')
  bool get nameCustomized;

  /// The locked Owner role. It can be neither edited, renamed nor deleted. `viewer` already says so per action — use this for labelling only. 
  @BuiltValueField(wireName: r'isSystem')
  bool get isSystem;

  /// Derived server-side from `capabilities` (`full_access`), never from `key`. 
  @BuiltValueField(wireName: r'grantsOwnership')
  bool get grantsOwnership;

  /// The CANONICAL stored set, sorted by key (api-spec §2): a key implied by another key in the set is not repeated. The Owner role is exactly `[\"full_access\"]`. May contain keys whose catalog `status` is `upcoming`, and — from an older catalog — keys a client does not know: render those generically, never drop them silently. 
  @BuiltValueField(wireName: r'capabilities')
  BuiltList<String> get capabilities;

  /// Optimistic-concurrency token. Send it back unchanged in `UpdateRoleRequest.version`. On a version conflict the client MUST re-fetch this role and show the difference — it must never resubmit automatically with the newer version (AC-3.12). 
  @BuiltValueField(wireName: r'version')
  int get version;

  @BuiltValueField(wireName: r'usage')
  RoleUsage get usage;

  /// `null` = never edited since the system provisioned it (\"ค่าเริ่มต้นของระบบ\", AC-9.6). 
  @BuiltValueField(wireName: r'lastEdited')
  RoleLastEdited? get lastEdited;

  @BuiltValueField(wireName: r'viewer')
  RoleDetailViewer get viewer;

  @BuiltValueField(wireName: r'createdAt')
  DateTime get createdAt;

  RoleDetail._();

  factory RoleDetail([void updates(RoleDetailBuilder b)]) = _$RoleDetail;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(RoleDetailBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<RoleDetail> get serializer => _$RoleDetailSerializer();
}

class _$RoleDetailSerializer implements PrimitiveSerializer<RoleDetail> {
  @override
  final Iterable<Type> types = const [RoleDetail, _$RoleDetail];

  @override
  final String wireName = r'RoleDetail';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    RoleDetail object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    yield r'key';
    yield object.key == null ? null : serializers.serialize(
      object.key,
      specifiedType: const FullType.nullable(String),
    );
    yield r'nameCustomized';
    yield serializers.serialize(
      object.nameCustomized,
      specifiedType: const FullType(bool),
    );
    yield r'isSystem';
    yield serializers.serialize(
      object.isSystem,
      specifiedType: const FullType(bool),
    );
    yield r'grantsOwnership';
    yield serializers.serialize(
      object.grantsOwnership,
      specifiedType: const FullType(bool),
    );
    yield r'capabilities';
    yield serializers.serialize(
      object.capabilities,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
    yield r'version';
    yield serializers.serialize(
      object.version,
      specifiedType: const FullType(int),
    );
    yield r'usage';
    yield serializers.serialize(
      object.usage,
      specifiedType: const FullType(RoleUsage),
    );
    yield r'lastEdited';
    yield object.lastEdited == null ? null : serializers.serialize(
      object.lastEdited,
      specifiedType: const FullType.nullable(RoleLastEdited),
    );
    yield r'viewer';
    yield serializers.serialize(
      object.viewer,
      specifiedType: const FullType(RoleDetailViewer),
    );
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(DateTime),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    RoleDetail object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required RoleDetailBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'key':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.key = valueDes;
          break;
        case r'nameCustomized':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.nameCustomized = valueDes;
          break;
        case r'isSystem':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isSystem = valueDes;
          break;
        case r'grantsOwnership':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.grantsOwnership = valueDes;
          break;
        case r'capabilities':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.capabilities.replace(valueDes);
          break;
        case r'version':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(int),
          ) as int;
          result.version = valueDes;
          break;
        case r'usage':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(RoleUsage),
          ) as RoleUsage;
          result.usage.replace(valueDes);
          break;
        case r'lastEdited':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(RoleLastEdited),
          ) as RoleLastEdited?;
          if (valueDes == null) continue;
          result.lastEdited.replace(valueDes);
          break;
        case r'viewer':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(RoleDetailViewer),
          ) as RoleDetailViewer;
          result.viewer.replace(valueDes);
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.createdAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  RoleDetail deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = RoleDetailBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}

