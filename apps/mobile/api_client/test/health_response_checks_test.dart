import 'package:test/test.dart';
import 'package:omnistock_api_client/omnistock_api_client.dart';

// tests for HealthResponseChecks
void main() {
  final instance = HealthResponseChecksBuilder();
  // TODO add properties to the builder and call build()

  group(HealthResponseChecks, () {
    // Postgres reachability via PrismaService's `SELECT 1`.
    // String db
    test('to test the property `db`', () async {
      // TODO
    });

    // Redis/BullMQ reachability via the ioredis connection's PING + a BullMQ queue call. 
    // String redis
    test('to test the property `redis`', () async {
      // TODO
    });

  });
}
