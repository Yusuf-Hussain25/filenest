import { neon } from '@neondatabase/serverless';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL || !/^postgres(ql)?:\/\//.test(DATABASE_URL)) {
    console.error('DATABASE_URL is missing or invalid. Set a Neon or Postgres connection string in server/.env');
    process.exit(1);
}

// Neon's HTTP driver only talks to Neon. For any other Postgres (e.g. the local one from
// docker-compose.dev.yml) use node-postgres behind the same sql`` / sql.unsafe / sql.transaction API.
const createPgSql = (connectionString) => {
    const pool = new pg.Pool({ connectionString });

    const compile = (strings, values) => {
        let text = '';
        const params = [];
        strings.forEach((str, i) => {
            text += str;
            if (i >= values.length) return;
            const value = values[i];
            if (value?.__unsafe !== undefined) text += value.__unsafe;
            else {
                params.push(value);
                text += `$${params.length}`;
            }
        });
        return { text, params };
    };

    // Lazy like Neon's queries: runs once when awaited, or never if only passed to sql.transaction
    const sql = (strings, ...values) => {
        const query = compile(strings, values);
        let promise;
        const run = () => (promise ??= pool.query(query.text, query.params).then((r) => r.rows));
        return {
            query,
            then: (resolve, reject) => run().then(resolve, reject),
            catch: (reject) => run().catch(reject),
            finally: (done) => run().finally(done),
        };
    };

    sql.unsafe = (raw) => ({ __unsafe: raw });

    // Lets scripts exit cleanly
    sql.end = () => pool.end();

    sql.transaction = async (queries) => {
        const conn = await pool.connect();
        try {
            await conn.query('BEGIN');
            const results = [];
            for (const { query } of queries) results.push((await conn.query(query.text, query.params)).rows);
            await conn.query('COMMIT');
            return results;
        } catch (err) {
            await conn.query('ROLLBACK');
            throw err;
        } finally {
            conn.release();
        }
    };

    return sql;
};

export const sql = DATABASE_URL.includes('neon.tech') ? neon(DATABASE_URL) : createPgSql(DATABASE_URL);

export async function initDB() {
    try {
        await sql.transaction(
            [
            sql`
                CREATE TABLE IF NOT EXISTS users (
                    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name            VARCHAR(255) NOT NULL,
                    email           VARCHAR(255) UNIQUE NOT NULL,
                    password        VARCHAR(255) NOT NULL,
                    storage_used    BIGINT NOT NULL DEFAULT 0,
                    storage_limit   BIGINT NOT NULL DEFAULT 1073741824,
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `,
            sql`
                CREATE TABLE IF NOT EXISTS folders (
                    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name        VARCHAR(255) NOT NULL,
                    parent_id   UUID REFERENCES folders(id) ON DELETE SET NULL DEFAULT NULL,
                    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    path        UUID[] NOT NULL DEFAULT '{}'::uuid[],
                    is_trashed  BOOLEAN NOT NULL DEFAULT FALSE,
                    trashed_at  TIMESTAMPTZ DEFAULT NULL,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `,
            sql`
                CREATE TABLE IF NOT EXISTS files (
                    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name          VARCHAR(255) NOT NULL,
                    original_name VARCHAR(255) NOT NULL,
                    mime_type     VARCHAR(128) NOT NULL,
                    size          BIGINT NOT NULL,
                    s3_key        VARCHAR(512) UNIQUE NOT NULL,
                    folder_id     UUID REFERENCES folders(id) ON DELETE SET NULL DEFAULT NULL,
                    owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    is_trashed    BOOLEAN NOT NULL DEFAULT FALSE,
                    trashed_at    TIMESTAMPTZ DEFAULT NULL,
                    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `,
            sql`
                CREATE TABLE IF NOT EXISTS share_links (
                    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    token         VARCHAR(64) UNIQUE NOT NULL,
                    resource_type VARCHAR(20) NOT NULL,
                    resource_id   UUID NOT NULL,
                    owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    permission    VARCHAR(20) NOT NULL DEFAULT 'download',
                    expires_at    TIMESTAMPTZ DEFAULT NULL,
                    access_count  INT NOT NULL DEFAULT 0,
                    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT unique_resource_owner UNIQUE (resource_id, owner_id)
                )
            `,
            sql`CREATE INDEX IF NOT EXISTS idx_folders_owner_parent  ON folders (owner_id, parent_id, is_trashed)`,
            sql`CREATE INDEX IF NOT EXISTS idx_folders_owner_trashed ON folders (owner_id, is_trashed)`,
            sql`CREATE INDEX IF NOT EXISTS idx_folders_path          ON folders USING GIN (path)`,
            sql`CREATE INDEX IF NOT EXISTS idx_files_owner_folder         ON files (owner_id, folder_id, is_trashed)`,
            sql`CREATE INDEX IF NOT EXISTS idx_files_owner_trashed_date   ON files (owner_id, is_trashed, created_at DESC)`,
            sql`CREATE INDEX IF NOT EXISTS idx_files_owner_trashed_name   ON files (owner_id, is_trashed, name)`,
            sql`CREATE INDEX IF NOT EXISTS idx_shares_owner    ON share_links (owner_id, created_at DESC)`,
            sql`CREATE INDEX IF NOT EXISTS idx_shares_resource ON share_links (resource_id)`,
            // 2.0: starred items and "Recent" (last opened)
            sql`ALTER TABLE files   ADD COLUMN IF NOT EXISTS is_starred     BOOLEAN NOT NULL DEFAULT FALSE`,
            sql`ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_starred     BOOLEAN NOT NULL DEFAULT FALSE`,
            sql`ALTER TABLE files   ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ DEFAULT NULL`,
            sql`CREATE INDEX IF NOT EXISTS idx_files_owner_starred   ON files (owner_id) WHERE is_starred AND NOT is_trashed`,
            sql`CREATE INDEX IF NOT EXISTS idx_folders_owner_starred ON folders (owner_id) WHERE is_starred AND NOT is_trashed`,
            // 2.1: direct-to-storage uploads waiting for the browser to finish the PUT
            sql`
                CREATE TABLE IF NOT EXISTS pending_uploads (
                    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    folder_id   UUID REFERENCES folders(id) ON DELETE SET NULL,
                    name        VARCHAR(255) NOT NULL,
                    mime_type   VARCHAR(128) NOT NULL,
                    size        BIGINT NOT NULL,
                    s3_key      VARCHAR(512) UNIQUE NOT NULL,
                    expires_at  TIMESTAMPTZ NOT NULL,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `,
            sql`CREATE INDEX IF NOT EXISTS idx_pending_owner ON pending_uploads (owner_id, expires_at)`,
        ]
        )

        console.log("Database initialized successfully")
    } catch (error) {
       console.error("Error initializing database:", error.message);
       throw error;
    }
}