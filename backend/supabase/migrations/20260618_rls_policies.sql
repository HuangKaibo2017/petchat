-- ============================================================
-- Gengdongta RLS Policies
-- Applied after all DDL to enable row-level security
-- ============================================================

-- Enable RLS on all user-facing tables
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

-- Public reference tables (read-only for all authenticated users)
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

-- ============================================================
-- Helper function: get current user's f_id from auth.uid()
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_f_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT f_id FROM public.t_user WHERE f_public_id = auth.uid()::text LIMIT 1;
$$;

-- ============================================================
-- t_user: users can only read/update their own row
-- ============================================================
CREATE POLICY "Users can read own profile"
  ON public.t_user FOR SELECT
  USING (f_public_id = auth.uid()::text);

CREATE POLICY "Users can update own profile"
  ON public.t_user FOR UPDATE
  USING (f_public_id = auth.uid()::text);

-- ============================================================
-- t_pet: users CRUD own pets
-- ============================================================
CREATE POLICY "Users can read own pets"
  ON public.t_pet FOR SELECT
  USING (f_user_id = public.current_user_f_id() AND f_status_user = 1);

CREATE POLICY "Users can insert own pets"
  ON public.t_pet FOR INSERT
  WITH CHECK (f_user_id = public.current_user_f_id());

CREATE POLICY "Users can update own pets"
  ON public.t_pet FOR UPDATE
  USING (f_user_id = public.current_user_f_id());

CREATE POLICY "Users can soft-delete own pets"
  ON public.t_pet FOR DELETE
  USING (f_user_id = public.current_user_f_id());

-- ============================================================
-- t_pet_photo
-- ============================================================
CREATE POLICY "Users can read own pet photos"
  ON public.t_pet_photo FOR SELECT
  USING (
    f_status_user = 1
    AND f_pet_id IN (
      SELECT f_id FROM public.t_pet WHERE f_user_id = public.current_user_f_id()
    )
  );

CREATE POLICY "Users can insert pet photos"
  ON public.t_pet_photo FOR INSERT
  WITH CHECK (
    f_pet_id IN (
      SELECT f_id FROM public.t_pet WHERE f_user_id = public.current_user_f_id()
    )
  );

-- ============================================================
-- t_chat_history
-- ============================================================
CREATE POLICY "Users can read own chats"
  ON public.t_chat_history FOR SELECT
  USING (f_user_id = public.current_user_f_id() AND f_status_user = 1);

CREATE POLICY "Users can insert chats"
  ON public.t_chat_history FOR INSERT
  WITH CHECK (f_user_id = public.current_user_f_id());

CREATE POLICY "Users can update own chats"
  ON public.t_chat_history FOR UPDATE
  USING (f_user_id = public.current_user_f_id());

-- ============================================================
-- t_comment
-- ============================================================
CREATE POLICY "Anyone can read comments"
  ON public.t_comment FOR SELECT
  USING (f_status_user = 1);

CREATE POLICY "Users can insert comments"
  ON public.t_comment FOR INSERT
  WITH CHECK (f_user_id = public.current_user_f_id());

-- ============================================================
-- AI Reports (read own, service_role writes via Edge Function)
-- ============================================================
CREATE POLICY "Users can read own emotion reports"
  ON public.t_report_emotion FOR SELECT
  USING (f_user_id = public.current_user_f_id() AND f_status_user = 1);

CREATE POLICY "Users can read own health reports"
  ON public.t_report_health FOR SELECT
  USING (f_user_id = public.current_user_f_id() AND f_status_user = 1);

CREATE POLICY "Users can read own risk reports"
  ON public.t_report_human_pet_risk FOR SELECT
  USING (f_user_id = public.current_user_f_id() AND f_status_user = 1);

CREATE POLICY "Users can read own personality reports"
  ON public.t_report_personality FOR SELECT
  USING (f_user_id = public.current_user_f_id() AND f_status_user = 1);

-- ============================================================
-- t_cart
-- ============================================================
CREATE POLICY "Users can read own cart"
  ON public.t_cart FOR SELECT
  USING (f_user_id = public.current_user_f_id() AND f_status_user = 1);

CREATE POLICY "Users can insert into cart"
  ON public.t_cart FOR INSERT
  WITH CHECK (f_user_id = public.current_user_f_id());

CREATE POLICY "Users can update own cart"
  ON public.t_cart FOR UPDATE
  USING (f_user_id = public.current_user_f_id());

CREATE POLICY "Users can delete from cart"
  ON public.t_cart FOR DELETE
  USING (f_user_id = public.current_user_f_id());

-- ============================================================
-- t_order / t_order_item
-- ============================================================
CREATE POLICY "Users can read own orders"
  ON public.t_order FOR SELECT
  USING (f_user_id = public.current_user_f_id() AND f_status_user = 1);

CREATE POLICY "Users can read own order items"
  ON public.t_order_item FOR SELECT
  USING (
    f_order_id IN (
      SELECT f_id FROM public.t_order WHERE f_user_id = public.current_user_f_id()
    )
  );

-- ============================================================
-- t_appointment
-- ============================================================
CREATE POLICY "Users can read own appointments"
  ON public.t_appointment FOR SELECT
  USING (f_user_id = public.current_user_f_id());

CREATE POLICY "Users can insert appointments"
  ON public.t_appointment FOR INSERT
  WITH CHECK (f_user_id = public.current_user_f_id());

-- ============================================================
-- Public read-only reference tables
-- ============================================================
CREATE POLICY "Anyone can read pet types"
  ON public.t_pet_type FOR SELECT USING (f_is_active = true);

CREATE POLICY "Anyone can read pet breeds"
  ON public.t_pet_breed FOR SELECT USING (f_is_active = true);

CREATE POLICY "Anyone can read product categories"
  ON public.t_product_category FOR SELECT USING (true);

CREATE POLICY "Anyone can read products"
  ON public.t_product_spu FOR SELECT USING (f_status_user = 1);

CREATE POLICY "Anyone can read product i18n"
  ON public.t_product_spu_i18n FOR SELECT USING (true);

CREATE POLICY "Anyone can read SKUs"
  ON public.t_product_sku FOR SELECT USING (true);

CREATE POLICY "Anyone can read hospitals"
  ON public.t_hospital FOR SELECT USING (f_status_user = 1);

CREATE POLICY "Anyone can read doctors"
  ON public.t_doctor FOR SELECT USING (f_status_user = 1);

CREATE POLICY "Anyone can read banners"
  ON public.t_banner FOR SELECT USING (f_is_active = true AND f_status_user = 1);

CREATE POLICY "Anyone can read activities"
  ON public.t_activity FOR SELECT USING (f_is_active = true AND f_status_user = 1);

CREATE POLICY "Anyone can read plans"
  ON public.t_plan FOR SELECT USING (f_is_active = true AND f_status_user = 1);

CREATE POLICY "Anyone can read feature quotas"
  ON public.t_feature_quota FOR SELECT USING (f_is_active = true AND f_status_user = 1);

-- ============================================================
-- t_share_record
-- ============================================================
CREATE POLICY "Users can read own or public shares"
  ON public.t_share_record FOR SELECT
  USING (f_user_id = public.current_user_f_id() OR f_is_public = true);

CREATE POLICY "Users can insert shares"
  ON public.t_share_record FOR INSERT
  WITH CHECK (f_user_id = public.current_user_f_id());

-- ============================================================
-- t_subscription / t_usage_record
-- ============================================================
CREATE POLICY "Users can read own subscription"
  ON public.t_user_subscription FOR SELECT
  USING (f_user_id = public.current_user_f_id());

CREATE POLICY "Users can read own usage"
  ON public.t_usage_record FOR SELECT
  USING (f_user_id = public.current_user_f_id());

-- ============================================================
-- Realtime: enable for chat table
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.t_chat_history;
