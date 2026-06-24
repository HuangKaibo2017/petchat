import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createLogger } = require('../../src/utils/logger.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');

const log = createLogger('test_connection');

config({ path: resolve(PROJECT_ROOT, '.env.test') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_PASSWORD = process.env.SUPABASE_PASSWORD;

log.info('========== Database Connection Test Start ==========');
log.info(`SUPABASE_URL: ${SUPABASE_URL ? 'configured' : 'NOT SET'}`);
log.info(`SUPABASE_PUBLISHABLE_KEY: ${SUPABASE_PUBLISHABLE_KEY ? 'configured' : 'NOT SET'}`);
log.info(`SUPABASE_PASSWORD: ${SUPABASE_PASSWORD ? 'configured' : 'NOT SET'}`);

// 从 SUPABASE_PASSWORD 拼出完整的 Postgres connectionString.
// host/user/port 在 Supabase 项目里固定, host 在 pooler URL, 端口 6543 (pgbouncer 事务池).
// password 用 encodeURIComponent 防御一次 URL 保留字符 (# $ * + 等).
const SUPABASE_DIRECT = SUPABASE_PASSWORD
  ? `postgresql://postgres.dlvgbwyvxjdggxpddpod:${encodeURIComponent(SUPABASE_PASSWORD)}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`
  : null;

function parsePetTypeFromSql() {
  const sqlPath = resolve(PROJECT_ROOT, '..', 'database', 'init', 'db_init.sql');
  const content = readFileSync(sqlPath, 'utf-8');

  const petTypeMatch = content.match(
    /INSERT INTO public\.t_pet_type[\s\S]*?VALUES\s*([\s\S]*?);/
  );
  if (!petTypeMatch) {
    throw new Error('Could not find t_pet_type INSERT in db_init.sql');
  }

  const valuesBlock = petTypeMatch[1];
  const rowPattern = /\(\s*(-?\d+)\s*,\s*\d+\s*,\s*('(?:[^'\\]|\\.)*?')\s*,/g;

  const rows = [];
  let match;
  while ((match = rowPattern.exec(valuesBlock)) !== null) {
    const f_id = parseInt(match[1], 10);
    const f_name_str = match[2].slice(1, -1);
    const f_name = JSON.parse(f_name_str);
    rows.push({ f_id, f_name });
  }

  return rows;
}

const expectedPetTypes = parsePetTypeFromSql();
let supabase = null;
let pgPool = null;

describe('Supabase Connection Tests', () => {
  beforeAll(() => {
    if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
      log.info('Creating Supabase client');
      supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    } else {
      log.warn('Supabase client NOT created — SUPABASE_URL/KEY missing');
    }
  });

  describe('2.1 SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY — query t_pet_type', () => {
    it('should connect to Supabase and fetch t_pet_type', async () => {
      if (!supabase) {
        throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set in backend/.env.test');
      }

      log.info('Querying t_pet_type from Supabase');

      const { data, error } = await supabase
        .from('t_pet_type')
        .select('f_id, f_name')
        .order('f_id', { ascending: true });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      log.info(`Fetched ${data.length} rows from t_pet_type, expected ${expectedPetTypes.length}`);

      expect(data.length).toBe(expectedPetTypes.length);

      for (let i = 0; i < expectedPetTypes.length; i++) {
        expect(data[i].f_id).toBe(expectedPetTypes[i].f_id);
        expect(data[i].f_name).toEqual(expectedPetTypes[i].f_name);
      }

      log.info('t_pet_type validation PASSED');
    });
  });

  describe('2.2 SUPABASE_DIRECT — create/insert/query/delete t_temp_', () => {
    const now = new Date();
    const hhmmss = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');
    const tableName = `t_temp_${hhmmss}`;

    beforeAll(() => {
      if (SUPABASE_DIRECT) {
        log.info(`Creating pg pool for direct connection`);
        pgPool = new pg.Pool({
          connectionString: SUPABASE_DIRECT,
        });
      } else {
        log.warn('pg pool NOT created — SUPABASE_DIRECT missing');
      }
    });

    afterAll(async () => {
      if (pgPool) {
        log.info(`Cleanup: dropping table ${tableName} if exists`);
        try {
          await pgPool.query(`DROP TABLE IF EXISTS public.${tableName}`);
        } catch {
          // ignore cleanup errors
        }
        await pgPool.end();
        log.info('pg pool closed');
      }
    });

    it('should create table, insert data, query and verify, then drop', async () => {
      if (!pgPool) {
        throw new Error('SUPABASE_DIRECT must be set in backend/.env.test');
      }

      log.info(`Creating table public.${tableName}`);
      await pgPool.query(
        `CREATE TABLE public.${tableName} (f_id integer NOT NULL DEFAULT -1)`
      );

      log.info('Inserting test rows (f_id=1, f_id=2)');
      await pgPool.query(
        `INSERT INTO public.${tableName} (f_id) VALUES (1), (2)`
      );

      log.info('Querying inserted rows');
      const { rows } = await pgPool.query(
        `SELECT f_id FROM public.${tableName} ORDER BY f_id`
      );

      log.info(`Got ${rows.length} rows: ${JSON.stringify(rows)}`);
      expect(rows.length).toBe(2);
      expect(rows[0].f_id).toBe(1);
      expect(rows[1].f_id).toBe(2);

      log.info(`Dropping table ${tableName}`);
      await pgPool.query(`DROP TABLE public.${tableName}`);

      let dropVerified = false;
      try {
        await pgPool.query(`SELECT 1 FROM public.${tableName} LIMIT 1`);
      } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
          dropVerified = true;
        }
      }
      expect(dropVerified).toBe(true);
      log.info('Table drop verified — test PASSED');
    });
  });
});
