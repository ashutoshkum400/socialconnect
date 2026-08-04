import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function parseImportedUsersCsvContent(csvContent) {
  const rows = csvContent.split(/\r?\n/).filter(Boolean);
  if (!rows.length) return [];

  const header = parseCsvLine(rows[0]);
  const idIndex = header.indexOf('id');
  const valueIndex = header.indexOf('value');

  if (idIndex === -1 || valueIndex === -1) {
    throw new Error('Imported CSV must contain id and value columns');
  }

  return rows.slice(1).map((row) => {
    const columns = parseCsvLine(row);
    const rawValue = columns[valueIndex] || '';
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};
    return {
      id: columns[idIndex] || parsedValue.id || null,
      ...parsedValue,
    };
  }).filter(Boolean);
}

export function mapImportedUserToAppUser(user) {
  const base = { ...user };
  const password = base.password ?? null;
  const normalized = {
    id: base.id || base.userId || `imported_${Math.random().toString(36).slice(2, 8)}`,
    username: base.username || base.email?.split('@')[0] || `user_${Math.random().toString(36).slice(2, 8)}`,
    email: (base.email || '').toLowerCase(),
    password,
    role: base.role || 'user',
    name: base.name || base.username || 'Imported User',
    bio: base.bio || '',
    avatar: base.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(base.name || base.username || 'User')}&background=random&size=128`,
    coverPhoto: base.coverPhoto || `https://picsum.photos/seed/${base.id || 'imported'}/800/300`,
    photos: Array.isArray(base.photos) ? base.photos : [],
    friends: Array.isArray(base.friends) ? base.friends : [],
    followers: Array.isArray(base.followers) ? base.followers : [],
    following: Array.isArray(base.following) ? base.following : [],
    connections: Array.isArray(base.connections) ? base.connections : [],
    relationships: Array.isArray(base.relationships) ? base.relationships : [],
    blocked: Boolean(base.blocked),
    joinedAt: base.joinedAt || new Date().toISOString(),
    lastSeen: base.lastSeen || new Date().toISOString(),
    location: base.location || '',
    birthDate: base.birthDate || '',
    gender: base.gender || '',
    interests: Array.isArray(base.interests) ? base.interests : [],
    lookingFor: base.lookingFor || null,
    relationshipStatus: base.relationshipStatus || null,
    googleId: base.googleId || null,
    authProvider: base.googleId ? 'google' : (base.authProvider || null),
    chatTheme: base.chatTheme || 'default',
    chatThemeCustom: base.chatThemeCustom || null,
  };

  if (base.googleId) {
    normalized.password = null;
  }

  return normalized;
}

export function importUsersFromCsvFile(csvFilePath) {
  const absolutePath = path.isAbsolute(csvFilePath) ? csvFilePath : path.join(__dirname, '..', csvFilePath);
  const csvContent = fs.readFileSync(absolutePath, 'utf8');
  const parsed = parseImportedUsersCsvContent(csvContent);
  return parsed.map(mapImportedUserToAppUser);
}

export function mapImportedUserToDynamoUser(user) {
  const appUser = mapImportedUserToAppUser(user);
  const email = (appUser.email || '').toLowerCase();
  return {
    PK: `USER#${appUser.id}`,
    SK: 'PROFILE',
    type: 'user',
    id: appUser.id,
    name: appUser.name,
    username: appUser.username,
    email,
    password: appUser.password,
    role: appUser.role || 'user',
    privacy: 'public',
    createdAt: appUser.joinedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    GSI1PK: 'USER',
    GSI1SK: `EMAIL#${email}`,
    ...appUser,
  };
}

export async function seedImportedUsersIntoDynamo(dynamoService, csvFilePath) {
  const importedUsers = importUsersFromCsvFile(csvFilePath);
  const records = importedUsers.map(mapImportedUserToDynamoUser);

  for (const record of records) {
    await dynamoService.put(record);
  }

  return records;
}
