const path = require('path')
const BACKEND_DIR = path.join(__dirname, '..', 'backend')
global.WebSocket = require(path.join(BACKEND_DIR, 'node_modules', 'ws'))
require(path.join(BACKEND_DIR, 'node_modules', 'dotenv')).config({ path: path.join(BACKEND_DIR, '.env') })
const { createClient } = require(path.join(BACKEND_DIR, 'node_modules', '@supabase', 'supabase-js'))

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  })

  console.log('Fixing exec_sql function...')
  const fixSQL = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE r record;
BEGIN
  FOR r IN EXECUTE sql LOOP
    RETURN NEXT to_json(r);
  END LOOP;
  RETURN;
END;
$$;
  `.trim()

  const { error: dropErr } = await supabase.rpc('exec_sql', { sql: 'DROP FUNCTION IF EXISTS public.exec_sql(text)' })
  if (dropErr) {
    if (dropErr.message.includes('does not return tuples')) {
      console.log('  (DROP via RPC expected failure, trying alternative)')
    } else {
      console.log('  drop warning:', dropErr.message.slice(0, 100))
    }
  }

  // Try creating via rpc  
  const { error: createErr } = await supabase.rpc('exec_sql', { sql: fixSQL })
  if (createErr) {
    if (createErr.message.includes('does not return tuples')) {
      console.log('  DDL via RPC fails, need migration approach')
    } else {
      console.log('  create error:', createErr.message.slice(0, 100))
    }
  }

  // Test
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1 AS ok' })
  if (error) {
    console.log('Function still broken:', error.message.slice(0, 150))
  } else {
    console.log('SUCCESS:', JSON.stringify(data))
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
