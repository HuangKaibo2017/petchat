const path = require('path')
const BACKEND_DIR = path.join(__dirname, '..', 'backend')

require(path.join(BACKEND_DIR, 'node_modules', 'dotenv')).config({ path: path.join(BACKEND_DIR, '.env') })
const { createClient } = require(path.join(BACKEND_DIR, 'node_modules', '@supabase', 'supabase-js'))

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function main() {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const createFunctionSQL = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY EXECUTE sql;
END;
$$;
  `

  console.log('创建 exec_sql 函数...')

  const { data, error } = await supabase
    .from('t_product_category')
    .select('f_id')
    .limit(1)

  if (error) {
    console.error('连接验证失败:', error.message)
    process.exit(1)
  }
  console.log('✓ Supabase 连接正常')

  const { error: fnErr } = await supabase.rpc('exec_sql', { sql: createFunctionSQL })
  if (fnErr) {
    if (fnErr.message.includes('Could not find')) {
      console.log('函数尚未存在，通过 pg_query 创建...')
      const url = `${supabaseUrl}/rest/v1/`
      const res = await fetch(url + 'rpc/pg_sleep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          Prefer: 'return=minimal',
        },
      }).catch(() => null)

      console.log('尝试方式2：直接用 SQL...')
      const sqlRes = await fetch(`${supabaseUrl}/graphql/v1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ query: '{ __typename }' }),
      })
      console.log('GraphQL:', sqlRes.status)
    }
    console.error('  创建失败:', fnErr.message)
  } else {
    console.log('✓ exec_sql 函数已创建')
  }

  console.log('\n测试函数...')
  const { data: testData, error: testErr } = await supabase
    .rpc('exec_sql', { sql: 'SELECT 1 AS ok' })

  if (testErr) {
    console.error('  测试失败:', testErr.message)
  } else {
    console.log('✓ 测试成功:', JSON.stringify(testData))
  }
}

main().catch(err => {
  console.error('脚本异常:', err.message)
  process.exit(1)
})
