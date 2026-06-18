-- ============================================================
-- PetChat Seed Data
-- Run after all DDL and RLS policies are applied
-- ============================================================

-- Languages
INSERT INTO public.t_lang (f_code, f_name, f_order) VALUES
  ('zh-CN', '简体中文', 1),
  ('en-US', 'English', 2),
  ('ja-JP', '日本語', 3)
ON CONFLICT (f_code) DO NOTHING;

-- Pet Types
INSERT INTO public.t_pet_type (f_id, f_name, f_order) VALUES
  (1, '{"zh-CN":"狗","en-US":"Dog","ja-JP":"犬"}', 1),
  (2, '{"zh-CN":"猫","en-US":"Cat","ja-JP":"猫"}', 2),
  (3, '{"zh-CN":"兔","en-US":"Rabbit","ja-JP":"ウサギ"}', 3),
  (4, '{"zh-CN":"鸟","en-US":"Bird","ja-JP":"鳥"}', 4),
  (5, '{"zh-CN":"鱼","en-US":"Fish","ja-JP":"魚"}', 5),
  (6, '{"zh-CN":"仓鼠","en-US":"Hamster","ja-JP":"ハムスター"}', 6),
  (7, '{"zh-CN":"其他","en-US":"Other","ja-JP":"その他"}', 7)
ON CONFLICT (f_id) DO NOTHING;

-- Report Types
INSERT INTO public.t_report_type (f_id, f_code, f_name) VALUES
  (1, 'emotion', '{"zh-CN":"情绪解读","en-US":"Emotion Reading","ja-JP":"感情解读"}'),
  (2, 'health', '{"zh-CN":"健康监测","en-US":"Health Check","ja-JP":"健康チェック"}'),
  (3, 'human_pet_risk', '{"zh-CN":"人宠风险评估","en-US":"Human-Pet Risk","ja-JP":"人寵リスク"}'),
  (4, 'personality', '{"zh-CN":"性格分析","en-US":"Personality","ja-JP":"性格分析"}')
ON CONFLICT (f_id) DO NOTHING;

-- Status
INSERT INTO public.t_status (f_id, f_code, f_name) VALUES
  (-1, 'not_set', '{"zh-CN":"未设置","en-US":"Not Set"}'),
  (1, 'active', '{"zh-CN":"正常","en-US":"Active"}'),
  (2, 'disabled', '{"zh-CN":"已禁用","en-US":"Disabled"}'),
  (3, 'deleted', '{"zh-CN":"已删除","en-US":"Deleted"}'),
  (4, 'archived', '{"zh-CN":"已归档","en-US":"Archived"}'),
  (5, 'pending', '{"zh-CN":"待审核","en-US":"Pending"}')
ON CONFLICT (f_id) DO NOTHING;

-- Risk Levels
INSERT INTO public.t_risk_level (f_id, f_name) VALUES
  (1, '{"zh-CN":"低风险","en-US":"Low Risk"}'),
  (2, '{"zh-CN":"中风险","en-US":"Medium Risk"}'),
  (3, '{"zh-CN":"高风险","en-US":"High Risk"}')
ON CONFLICT (f_id) DO NOTHING;

-- Health Levels
INSERT INTO public.t_health_level (f_id, f_name) VALUES
  (1, '{"zh-CN":"健康良好","en-US":"Healthy"}'),
  (2, '{"zh-CN":"亚健康","en-US":"Sub-healthy"}'),
  (3, '{"zh-CN":"需要关注","en-US":"Needs Attention"}'),
  (4, '{"zh-CN":"建议就医","en-US":"See Vet"}')
ON CONFLICT (f_id) DO NOTHING;

-- Feature Quotas (default free tier)
INSERT INTO public.t_feature_quota (f_ver, f_code, f_name, f_quota_limit, f_quota_period) VALUES
  (100, 'emotion_report', '{"zh-CN":"情绪解读","en-US":"Emotion Report"}', 3, 1),
  (100, 'health_report', '{"zh-CN":"健康监测","en-US":"Health Report"}', 3, 1),
  (100, 'risk_report', '{"zh-CN":"风险评估","en-US":"Risk Report"}', 1, 1),
  (100, 'chat', '{"zh-CN":"AI聊天","en-US":"AI Chat"}', -1, 1),
  (100, 'personality_report', '{"zh-CN":"性格分析","en-US":"Personality"}', 1, 1)
ON CONFLICT (f_ver, f_code) DO NOTHING;

-- AI Prompts (seed versions)
INSERT INTO public.t_prompt (f_code, f_lang, f_ver, f_content, f_is_active) VALUES
  ('emotion_analyze', 'zh-CN', 100, '请分析宠物的情绪状态...', true),
  ('health_assess', 'zh-CN', 100, '请进行健康评估...', true),
  ('chat_persona', 'zh-CN', 100, '你是一只可爱的宠物...', true)
ON CONFLICT (f_code, f_lang, f_ver) DO NOTHING;

-- Anonymous sentinel user (for unregistered visitors)
INSERT INTO public.t_user (f_public_id, f_nick_name, f_is_anonymous)
VALUES ('00000000-0000-0000-0000-000000000000', '访客', true)
ON CONFLICT DO NOTHING;
