import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.mjs';

export function mapSupabaseUserToDynamoUser(user) {
  const metadata = user.user_metadata || {};
  const identity = Array.isArray(user.identities) ? user.identities.find((item) => item.provider === 'google') || user.identities[0] : null;
  const fullName = metadata.full_name || metadata.name || user.full_name || '';
  const username = metadata.username || metadata.user_name || user.username || `user_${user.id?.slice(0, 8) || uuidv4().slice(0, 8)}`;
  const email = user.email?.toLowerCase() || '';
  const isGoogleUser = Boolean(identity?.provider === 'google' || metadata.google_id || metadata.provider === 'google');

  return {
    id: user.id || uuidv4(),
    name: fullName,
    username,
    email,
    avatarUrl: metadata.avatar_url || metadata.avatar || user.avatar_url || '',
    googleAccountId: metadata.google_id || identity?.id || '',
    authProvider: isGoogleUser ? 'google' : 'email-password',
    passwordHash: null,
    requiresPasswordReset: !isGoogleUser,
    createdAt: user.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    role: 'user',
    privacy: 'public',
    provider: isGoogleUser ? 'google' : 'email-password',
  };
}

export function createSupabaseClient() {
  if (!process.env.SUPABASE_URL) {
    throw new Error('Supabase URL is not configured');
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!serviceRoleKey) {
    throw new Error('Supabase service-role or anon key is not configured');
  }

  return createClient(process.env.SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function exportSupabaseUsers() {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    throw error;
  }
  return data?.users || [];
}

export async function migrateSupabaseUsersToDynamo(dynamoService) {
  const users = await exportSupabaseUsers();
  const mapped = users.map(mapSupabaseUserToDynamoUser);

  for (const user of mapped) {
    await dynamoService.put({
      PK: `USER#${user.id}`,
      SK: 'PROFILE',
      type: 'user',
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      googleAccountId: user.googleAccountId,
      authProvider: user.authProvider,
      passwordHash: user.passwordHash,
      requiresPasswordReset: user.requiresPasswordReset,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role,
      privacy: user.privacy,
      provider: user.provider,
      GSI1PK: 'USER',
      GSI1SK: `EMAIL#${user.email.toLowerCase()}`,
      GSI2PK: `USER#${user.id}`,
      GSI2SK: 'PROFILE',
      GSI3PK: 'USER',
      GSI3SK: `USERNAME#${user.username.toLowerCase()}`,
      GSI4PK: 'USER',
      GSI4SK: `PROVIDER#${user.provider}`,
    });
  }

  return mapped;
}

export async function rollbackSupabaseMigration(dynamoService) {
  const users = await exportSupabaseUsers();
  for (const user of users) {
    await dynamoService.delete(`USER#${user.id}`, 'PROFILE');
  }
}
