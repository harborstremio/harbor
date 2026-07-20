export type User = {
  id: string;
  email: string;
  emailNorm: string;
  serverHash: string;
  authSalt: string;
  kdfIterations: number;
  kdfSalt: string;
  wrappedDataKey: string;
  syncRev: number;
  createdAt: number;
  updatedAt: number;
};

export type NewUser = Omit<User, "syncRev">;

export type Session = {
  tokenHash: string;
  userId: string;
  deviceName: string | null;
  createdAt: number;
  lastUsedAt: number;
};

export type SyncDoc = {
  key: string;
  rev: number;
  ciphertext: string | null;
  updatedAt: number;
  deleted: 0 | 1;
};

export type DocChange = {
  key: string;
  ciphertext: string | null;
  updatedAt: number;
};

export type AuthUpdate = {
  serverHash: string;
  authSalt: string;
  kdfIterations: number;
  kdfSalt: string;
  wrappedDataKey: string;
  updatedAt: number;
};

export interface Store {
  getUserByEmailNorm(emailNorm: string): Promise<User | null>;
  getUserById(userId: string): Promise<User | null>;
  createUser(user: NewUser): Promise<boolean>;
  updateUserAuth(userId: string, update: AuthUpdate): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  createSession(session: Session): Promise<void>;
  getSession(tokenHash: string): Promise<Session | null>;
  touchSession(tokenHash: string, lastUsedAt: number): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteOtherSessions(userId: string, tokenHash: string): Promise<void>;
  getDocsSince(userId: string, since: number): Promise<SyncDoc[]>;
  getDoc(userId: string, key: string): Promise<SyncDoc | null>;
  countDocs(userId: string): Promise<number>;
  applyDocChanges(
    userId: string,
    expectedSyncRev: number,
    changes: DocChange[],
  ): Promise<number | null>;
}

type D1UserRow = {
  id: string;
  email: string;
  email_norm: string;
  server_hash: string;
  auth_salt: string;
  kdf_iterations: number;
  kdf_salt: string;
  wrapped_data_key: string;
  sync_rev: number;
  created_at: number;
  updated_at: number;
};

type D1SessionRow = {
  token_hash: string;
  user_id: string;
  device_name: string | null;
  created_at: number;
  last_used_at: number;
};

type D1DocRow = {
  key: string;
  rev: number;
  ciphertext: string | null;
  updated_at: number;
  deleted: number;
};

function userFromRow(row: D1UserRow): User {
  return {
    id: row.id,
    email: row.email,
    emailNorm: row.email_norm,
    serverHash: row.server_hash,
    authSalt: row.auth_salt,
    kdfIterations: row.kdf_iterations,
    kdfSalt: row.kdf_salt,
    wrappedDataKey: row.wrapped_data_key,
    syncRev: row.sync_rev,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sessionFromRow(row: D1SessionRow): Session {
  return {
    tokenHash: row.token_hash,
    userId: row.user_id,
    deviceName: row.device_name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

function docFromRow(row: D1DocRow): SyncDoc {
  return {
    key: row.key,
    rev: row.rev,
    ciphertext: row.ciphertext,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1 ? 1 : 0,
  };
}

export class D1Store implements Store {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getUserByEmailNorm(emailNorm: string): Promise<User | null> {
    const row = await this.db
      .prepare("SELECT * FROM users WHERE email_norm = ?")
      .bind(emailNorm)
      .first<D1UserRow>();
    return row === null ? null : userFromRow(row);
  }

  async getUserById(userId: string): Promise<User | null> {
    const row = await this.db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(userId)
      .first<D1UserRow>();
    return row === null ? null : userFromRow(row);
  }

  async createUser(user: NewUser): Promise<boolean> {
    try {
      await this.db
        .prepare(
          "INSERT INTO users (id, email, email_norm, server_hash, auth_salt, kdf_iterations, kdf_salt, wrapped_data_key, recovery_wrapped_key, sync_rev, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?)",
        )
        .bind(
          user.id,
          user.email,
          user.emailNorm,
          user.serverHash,
          user.authSalt,
          user.kdfIterations,
          user.kdfSalt,
          user.wrappedDataKey,
          user.createdAt,
          user.updatedAt,
        )
        .run();
      return true;
    } catch {
      return false;
    }
  }

  async updateUserAuth(userId: string, update: AuthUpdate): Promise<void> {
    await this.db
      .prepare(
        "UPDATE users SET server_hash = ?, auth_salt = ?, kdf_iterations = ?, kdf_salt = ?, wrapped_data_key = ?, updated_at = ? WHERE id = ?",
      )
      .bind(
        update.serverHash,
        update.authSalt,
        update.kdfIterations,
        update.kdfSalt,
        update.wrappedDataKey,
        update.updatedAt,
        userId,
      )
      .run();
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare("DELETE FROM docs WHERE user_id = ?").bind(userId),
      this.db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
      this.db.prepare("DELETE FROM users WHERE id = ?").bind(userId),
    ]);
  }

  async createSession(session: Session): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO sessions (token_hash, user_id, device_name, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        session.tokenHash,
        session.userId,
        session.deviceName,
        session.createdAt,
        session.lastUsedAt,
      )
      .run();
  }

  async getSession(tokenHash: string): Promise<Session | null> {
    const row = await this.db
      .prepare("SELECT * FROM sessions WHERE token_hash = ?")
      .bind(tokenHash)
      .first<D1SessionRow>();
    return row === null ? null : sessionFromRow(row);
  }

  async touchSession(tokenHash: string, lastUsedAt: number): Promise<void> {
    await this.db
      .prepare("UPDATE sessions SET last_used_at = ? WHERE token_hash = ?")
      .bind(lastUsedAt, tokenHash)
      .run();
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }

  async deleteOtherSessions(userId: string, tokenHash: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?")
      .bind(userId, tokenHash)
      .run();
  }

  async getDocsSince(userId: string, since: number): Promise<SyncDoc[]> {
    const result = await this.db
      .prepare(
        "SELECT key, rev, ciphertext, updated_at, deleted FROM docs WHERE user_id = ? AND rev > ? ORDER BY rev ASC",
      )
      .bind(userId, since)
      .all<D1DocRow>();
    return result.results.map(docFromRow);
  }

  async getDoc(userId: string, key: string): Promise<SyncDoc | null> {
    const row = await this.db
      .prepare(
        "SELECT key, rev, ciphertext, updated_at, deleted FROM docs WHERE user_id = ? AND key = ?",
      )
      .bind(userId, key)
      .first<D1DocRow>();
    return row === null ? null : docFromRow(row);
  }

  async countDocs(userId: string): Promise<number> {
    const row = await this.db
      .prepare("SELECT COUNT(*) AS count FROM docs WHERE user_id = ?")
      .bind(userId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  async applyDocChanges(
    userId: string,
    expectedSyncRev: number,
    changes: DocChange[],
  ): Promise<number | null> {
    const nextRev = expectedSyncRev + changes.length;
    const statements = [
      this.db
        .prepare("UPDATE users SET sync_rev = ?, updated_at = ? WHERE id = ? AND sync_rev = ?")
        .bind(nextRev, Date.now(), userId, expectedSyncRev),
      ...changes.map((change, index) =>
        this.db
          .prepare(
            "INSERT INTO docs (user_id, key, rev, ciphertext, updated_at, deleted) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ? AND sync_rev = ?) ON CONFLICT(user_id, key) DO UPDATE SET rev = excluded.rev, ciphertext = excluded.ciphertext, updated_at = excluded.updated_at, deleted = excluded.deleted",
          )
          .bind(
            userId,
            change.key,
            expectedSyncRev + index + 1,
            change.ciphertext,
            change.updatedAt,
            change.ciphertext === null ? 1 : 0,
            userId,
            nextRev,
          ),
      ),
    ];
    const result = await this.db.batch(statements);
    return result[0].meta.changes === 1 ? nextRev : null;
  }
}

export class MemStore implements Store {
  private users = new Map<string, User>();
  private userIds = new Map<string, string>();
  private sessions = new Map<string, Session>();
  private docs = new Map<string, Map<string, SyncDoc>>();

  async getUserByEmailNorm(emailNorm: string): Promise<User | null> {
    const id = this.userIds.get(emailNorm);
    return id === undefined ? null : (this.users.get(id) ?? null);
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.users.get(userId) ?? null;
  }

  async createUser(user: NewUser): Promise<boolean> {
    if (this.userIds.has(user.emailNorm)) return false;
    const stored = { ...user, syncRev: 0 };
    this.users.set(user.id, stored);
    this.userIds.set(user.emailNorm, user.id);
    return true;
  }

  async updateUserAuth(userId: string, update: AuthUpdate): Promise<void> {
    const user = this.users.get(userId);
    if (user === undefined) return;
    Object.assign(user, update);
  }

  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user !== undefined) this.userIds.delete(user.emailNorm);
    this.users.delete(userId);
    this.docs.delete(userId);
    for (const [tokenHash, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(tokenHash);
    }
  }

  async createSession(session: Session): Promise<void> {
    this.sessions.set(session.tokenHash, { ...session });
  }

  async getSession(tokenHash: string): Promise<Session | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async touchSession(tokenHash: string, lastUsedAt: number): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session !== undefined) session.lastUsedAt = lastUsedAt;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async deleteOtherSessions(userId: string, tokenHash: string): Promise<void> {
    for (const [hash, session] of this.sessions) {
      if (session.userId === userId && hash !== tokenHash) this.sessions.delete(hash);
    }
  }

  async getDocsSince(userId: string, since: number): Promise<SyncDoc[]> {
    return [...(this.docs.get(userId)?.values() ?? [])]
      .filter((doc) => doc.rev > since)
      .sort((left, right) => left.rev - right.rev);
  }

  async getDoc(userId: string, key: string): Promise<SyncDoc | null> {
    return this.docs.get(userId)?.get(key) ?? null;
  }

  async countDocs(userId: string): Promise<number> {
    return this.docs.get(userId)?.size ?? 0;
  }

  async applyDocChanges(
    userId: string,
    expectedSyncRev: number,
    changes: DocChange[],
  ): Promise<number | null> {
    const user = this.users.get(userId);
    if (user === undefined || user.syncRev !== expectedSyncRev) return null;
    const docs = this.docs.get(userId) ?? new Map<string, SyncDoc>();
    for (const [index, change] of changes.entries()) {
      docs.set(change.key, {
        key: change.key,
        rev: expectedSyncRev + index + 1,
        ciphertext: change.ciphertext,
        updatedAt: change.updatedAt,
        deleted: change.ciphertext === null ? 1 : 0,
      });
    }
    this.docs.set(userId, docs);
    user.syncRev += changes.length;
    user.updatedAt = Date.now();
    return user.syncRev;
  }
}
