import test from 'node:test';
import assert from 'node:assert/strict';
import { mapSupabaseUserToDynamoUser } from '../services/supabase-migration.service.mjs';

test('maps Supabase users into DynamoDB-friendly auth records', () => {
  const source = {
    id: 'supabase-user-1',
    email: 'demo@example.com',
    user_metadata: {
      full_name: 'Demo User',
      username: 'demo_user',
      avatar_url: 'https://cdn.example.com/avatar.png',
      google_id: 'google-123',
    },
    created_at: '2024-01-01T00:00:00.000Z',
    identities: [{ provider: 'google', id: 'google-123' }],
  };

  const mapped = mapSupabaseUserToDynamoUser(source);
  assert.equal(mapped.email, 'demo@example.com');
  assert.equal(mapped.name, 'Demo User');
  assert.equal(mapped.username, 'demo_user');
  assert.equal(mapped.googleAccountId, 'google-123');
  assert.equal(mapped.authProvider, 'google');
  assert.equal(mapped.requiresPasswordReset, false);
});
