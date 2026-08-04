import test from 'node:test';
import assert from 'node:assert/strict';
import { parseImportedUsersCsvContent, mapImportedUserToAppUser } from '../services/user-import.service.mjs';

test('parses exported CSV rows into app-ready user records', () => {
  const csv = [
    'id,value,updated_at',
    'u1,"{""id"":""u1"",""email"":""user@example.com"",""name"":""Test User"",""password"":""$2b$10$abc"",""role"":""user"",""username"":""testuser"",""blocked"":false,""friends"":[],""followers"":[],""following"":[],""connections"":[]}","2026-01-01T00:00:00.000Z"',
    'u2,"{""id"":""u2"",""email"":""google@example.com"",""name"":""Google User"",""password"":null,""googleId"":""12345"",""role"":""user"",""username"":""googleuser""}","2026-01-02T00:00:00.000Z"',
  ].join('\n');

  const parsed = parseImportedUsersCsvContent(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].email, 'user@example.com');
  assert.equal(parsed[0].name, 'Test User');

  const mapped = mapImportedUserToAppUser(parsed[1]);
  assert.equal(mapped.username, 'googleuser');
  assert.equal(mapped.password, null);
  assert.equal(mapped.authProvider, 'google');
  assert.deepEqual(mapped.friends, []);
});
