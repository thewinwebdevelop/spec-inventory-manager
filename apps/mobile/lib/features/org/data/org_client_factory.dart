import 'package:dio/dio.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart' as wire;

import '../domain/repositories/org_repository.dart';
import 'org_repository_impl.dart';

/// ★ T-002-M5 — where the org feature's real repositories are built.
///
/// It lives in `features/org/data/` for the same reason `auth_client_factory`
/// lives in `features/auth/data/`: boundary gate rule 3 — the generated client
/// is touchable only from a feature's `data/` layer and `core/api/`. The
/// composition root (`app/bootstrap.dart`) calls these and never sees a `wire.`
/// type, which is what keeps the generated names out of the rest of the app.
///
/// Both take a `Dio` rather than building one. Which client an org call goes
/// through is a decision `core/api/api_providers.dart` owns — org-agnostic for
/// the shop list, org-scoped (with `X-Organization-Id`) for everything else —
/// and a factory that built its own would quietly take that decision back.
OrgDirectory createOrgDirectory(Dio baseDio) {
  return OrgDirectoryImpl(wire.OrganizationsApi(baseDio, wire.standardSerializers));
}

OrgScoped createOrgScoped({required Dio orgDio, required String orgId}) {
  return OrgScopedImpl(
    members: wire.MembersApi(orgDio, wire.standardSerializers),
    organizations: wire.OrganizationsApi(orgDio, wire.standardSerializers),
    invitations: wire.InvitationsApi(orgDio, wire.standardSerializers),
    orgId: orgId,
  );
}
