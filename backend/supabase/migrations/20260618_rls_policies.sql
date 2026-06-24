-- ============================================================
-- Gengdongta RLS Policies (fixed schema)
-- ============================================================

-- Enable RLS on user-facing tables
ALTER TABLE public.t_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_pet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_pet_photo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_comment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_report_emotion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_report_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_report_human_pet_risk ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_report_personality ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_share_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_interpretation_voice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_user_subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_usage_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_order_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_appointment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_user_device ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_agent_application ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_agent_withdrawal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_agent_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_rescue_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_adoption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_volunteer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_donation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_record_lost_pet ENABLE ROW LEVEL SECURITY;

-- Public reference tables (read-only)
ALTER TABLE public.t_pet_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_pet_breed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_product_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_product_spu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_product_spu_i18n ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_product_sku ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_hospital ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_doctor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_banner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_feature_quota ENABLE ROW LEVEL SECURITY;

-- Helper: get current user f_id from auth.uid()
CREATE OR REPLACE FUNCTION public.current_user_f_id()
RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT f_id FROM public.t_user WHERE f_public_uid = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- User-owned table policies (simplified — just check f_user_id)
-- ============================================================

-- t_user
DROP POLICY IF EXISTS "Users can read own profile" ON public.t_user;
CREATE POLICY "Users can read own profile" ON public.t_user FOR SELECT USING (f_public_uid = auth.uid());
DROP POLICY IF EXISTS "Users can update own profile" ON public.t_user;
CREATE POLICY "Users can update own profile" ON public.t_user FOR UPDATE USING (f_public_uid = auth.uid());

-- t_pet
DROP POLICY IF EXISTS "Users can read own pets" ON public.t_pet;
CREATE POLICY "Users can read own pets" ON public.t_pet FOR SELECT USING (f_user_id = public.current_user_f_id());
DROP POLICY IF EXISTS "Users can insert own pets" ON public.t_pet;
CREATE POLICY "Users can insert own pets" ON public.t_pet FOR INSERT WITH CHECK (f_user_id = public.current_user_f_id());
DROP POLICY IF EXISTS "Users can update own pets" ON public.t_pet;
CREATE POLICY "Users can update own pets" ON public.t_pet FOR UPDATE USING (f_user_id = public.current_user_f_id());
DROP POLICY IF EXISTS "Users can soft-delete own pets" ON public.t_pet;
CREATE POLICY "Users can soft-delete own pets" ON public.t_pet FOR DELETE USING (f_user_id = public.current_user_f_id());

-- t_pet_photo
DROP POLICY IF EXISTS "Users can read own pet photos" ON public.t_pet_photo;
CREATE POLICY "Users can read own pet photos" ON public.t_pet_photo FOR SELECT USING (
  f_pet_id IN (SELECT f_id FROM public.t_pet WHERE f_user_id = public.current_user_f_id())
);
DROP POLICY IF EXISTS "Users can insert pet photos" ON public.t_pet_photo;
CREATE POLICY "Users can insert pet photos" ON public.t_pet_photo FOR INSERT WITH CHECK (
  f_pet_id IN (SELECT f_id FROM public.t_pet WHERE f_user_id = public.current_user_f_id())
);

-- t_chat_history
DROP POLICY IF EXISTS "Users can read own chats" ON public.t_chat_history;
CREATE POLICY "Users can read own chats" ON public.t_chat_history FOR SELECT USING (f_user_id = public.current_user_f_id());
DROP POLICY IF EXISTS "Users can insert chats" ON public.t_chat_history;
CREATE POLICY "Users can insert chats" ON public.t_chat_history FOR INSERT WITH CHECK (f_user_id = public.current_user_f_id());
DROP POLICY IF EXISTS "Users can update own chats" ON public.t_chat_history;
CREATE POLICY "Users can update own chats" ON public.t_chat_history FOR UPDATE USING (f_user_id = public.current_user_f_id());

-- t_comment
DROP POLICY IF EXISTS "Users can read own comments" ON public.t_comment;
CREATE POLICY "Users can read own comments" ON public.t_comment FOR SELECT USING (f_user_id = public.current_user_f_id());
DROP POLICY IF EXISTS "Users can insert comments" ON public.t_comment;
CREATE POLICY "Users can insert comments" ON public.t_comment FOR INSERT WITH CHECK (f_user_id = public.current_user_f_id());

-- t_report_emotion
DROP POLICY IF EXISTS "Users can read own emotion reports" ON public.t_report_emotion;
CREATE POLICY "Users can read own emotion reports" ON public.t_report_emotion FOR SELECT USING (f_user_id = public.current_user_f_id());

-- t_report_health
DROP POLICY IF EXISTS "Users can read own health reports" ON public.t_report_health;
CREATE POLICY "Users can read own health reports" ON public.t_report_health FOR SELECT USING (f_user_id = public.current_user_f_id());

-- t_report_human_pet_risk
DROP POLICY IF EXISTS "Users can read own risk reports" ON public.t_report_human_pet_risk;
CREATE POLICY "Users can read own risk reports" ON public.t_report_human_pet_risk FOR SELECT USING (f_user_id = public.current_user_f_id());

-- t_report_personality
DROP POLICY IF EXISTS "Users can read own personality reports" ON public.t_report_personality;
CREATE POLICY "Users can read own personality reports" ON public.t_report_personality FOR SELECT USING (f_user_id = public.current_user_f_id());

-- t_cart
DROP POLICY IF EXISTS "Users can read own cart" ON public.t_cart;
CREATE POLICY "Users can read own cart" ON public.t_cart FOR SELECT USING (f_user_id = public.current_user_f_id());
DROP POLICY IF EXISTS "Users can insert into cart" ON public.t_cart;
CREATE POLICY "Users can insert into cart" ON public.t_cart FOR INSERT WITH CHECK (f_user_id = public.current_user_f_id());
DROP POLICY IF EXISTS "Users can update own cart" ON public.t_cart;
CREATE POLICY "Users can update own cart" ON public.t_cart FOR UPDATE USING (f_user_id = public.current_user_f_id());
DROP POLICY IF EXISTS "Users can delete from cart" ON public.t_cart;
CREATE POLICY "Users can delete from cart" ON public.t_cart FOR DELETE USING (f_user_id = public.current_user_f_id());

-- t_order
DROP POLICY IF EXISTS "Users can read own orders" ON public.t_order;
CREATE POLICY "Users can read own orders" ON public.t_order FOR SELECT USING (f_user_id = public.current_user_f_id());

-- t_order_item
DROP POLICY IF EXISTS "Users can read own order items" ON public.t_order_item;
CREATE POLICY "Users can read own order items" ON public.t_order_item FOR SELECT USING (
  f_order_id IN (SELECT f_id FROM public.t_order WHERE f_user_id = public.current_user_f_id())
);

-- t_appointment
DROP POLICY IF EXISTS "Users can read own appointments" ON public.t_appointment;
CREATE POLICY "Users can read own appointments" ON public.t_appointment FOR SELECT USING (f_user_id = public.current_user_f_id());
DROP POLICY IF EXISTS "Users can insert appointments" ON public.t_appointment;
CREATE POLICY "Users can insert appointments" ON public.t_appointment FOR INSERT WITH CHECK (f_user_id = public.current_user_f_id());

-- t_share_record
DROP POLICY IF EXISTS "Users can read own or public shares" ON public.t_share_record;
CREATE POLICY "Users can read own or public shares" ON public.t_share_record FOR SELECT USING (f_user_id = public.current_user_f_id() OR true);
DROP POLICY IF EXISTS "Users can insert shares" ON public.t_share_record;
CREATE POLICY "Users can insert shares" ON public.t_share_record FOR INSERT WITH CHECK (f_user_id = public.current_user_f_id());

-- t_user_subscription
DROP POLICY IF EXISTS "Users can read own subscription" ON public.t_user_subscription;
CREATE POLICY "Users can read own subscription" ON public.t_user_subscription FOR SELECT USING (f_user_id = public.current_user_f_id());

-- t_usage_record
DROP POLICY IF EXISTS "Users can read own usage" ON public.t_usage_record;
CREATE POLICY "Users can read own usage" ON public.t_usage_record FOR SELECT USING (f_user_id = public.current_user_f_id());

-- ============================================================
-- Public reference tables
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read pet types" ON public.t_pet_type;
CREATE POLICY "Anyone can read pet types" ON public.t_pet_type FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read pet breeds" ON public.t_pet_breed;
CREATE POLICY "Anyone can read pet breeds" ON public.t_pet_breed FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read product categories" ON public.t_product_category;
CREATE POLICY "Anyone can read product categories" ON public.t_product_category FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read products" ON public.t_product_spu;
CREATE POLICY "Anyone can read products" ON public.t_product_spu FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read product i18n" ON public.t_product_spu_i18n;
CREATE POLICY "Anyone can read product i18n" ON public.t_product_spu_i18n FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read SKUs" ON public.t_product_sku;
CREATE POLICY "Anyone can read SKUs" ON public.t_product_sku FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read hospitals" ON public.t_hospital;
CREATE POLICY "Anyone can read hospitals" ON public.t_hospital FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read doctors" ON public.t_doctor;
CREATE POLICY "Anyone can read doctors" ON public.t_doctor FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read banners" ON public.t_banner;
CREATE POLICY "Anyone can read banners" ON public.t_banner FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read activities" ON public.t_activity;
CREATE POLICY "Anyone can read activities" ON public.t_activity FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read plans" ON public.t_plan;
CREATE POLICY "Anyone can read plans" ON public.t_plan FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read feature quotas" ON public.t_feature_quota;
CREATE POLICY "Anyone can read feature quotas" ON public.t_feature_quota FOR SELECT USING (true);

-- Realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.t_chat_history;
