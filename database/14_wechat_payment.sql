-- ============================================================
-- 14_wechat_payment.sql
-- 微信支付流水 / WeChat Pay Transaction
-- ============================================================

ALTER TABLE public.t_user
    ADD COLUMN IF NOT EXISTS f_wx_openid VARCHAR(128) NOT NULL DEFAULT '';

ALTER TABLE public.t_user
    ADD COLUMN IF NOT EXISTS f_wx_unionid VARCHAR(128) NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS uk_t_user_wx_openid
    ON public.t_user(f_wx_openid) WHERE f_wx_openid <> '';

CREATE TABLE IF NOT EXISTS public.t_payment_transaction (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_order_id        BIGINT NOT NULL,
    f_order_no        VARCHAR(64) NOT NULL,
    f_provider        VARCHAR(32) NOT NULL DEFAULT 'wechat',
    f_out_trade_no    VARCHAR(64) NOT NULL,
    f_transaction_id  VARCHAR(64) NOT NULL DEFAULT '',
    f_prepay_id       VARCHAR(128) NOT NULL DEFAULT '',
    f_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
    f_currency        VARCHAR(8) NOT NULL DEFAULT 'CNY',
    f_status          VARCHAR(32) NOT NULL DEFAULT 'created',
    f_raw_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_raw_notify      JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_paid_at         TIMESTAMPTZ,
    f_created_at      BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    f_updated_at      BIGINT NOT NULL DEFAULT (to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')::bigint),
    CONSTRAINT fk_t_payment_tx_order FOREIGN KEY (f_order_id)
        REFERENCES public.t_order(f_id) ON DELETE CASCADE,
    CONSTRAINT uk_t_payment_tx_out_trade_no UNIQUE (f_provider, f_out_trade_no),
    CONSTRAINT ck_t_payment_tx_amount CHECK (f_amount >= 0),
    CONSTRAINT ck_t_payment_tx_payload CHECK (jsonb_typeof(f_raw_payload) = 'object'),
    CONSTRAINT ck_t_payment_tx_notify CHECK (jsonb_typeof(f_raw_notify) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_t_payment_tx_order_id
    ON public.t_payment_transaction(f_order_id);

CREATE INDEX IF NOT EXISTS idx_t_payment_tx_transaction_id
    ON public.t_payment_transaction(f_transaction_id)
    WHERE f_transaction_id <> '';

COMMENT ON TABLE public.t_payment_transaction IS '支付流水表, 保存微信支付 JSAPI 下单、回调与对账所需信息';
COMMENT ON COLUMN public.t_payment_transaction.f_order_id IS 'FK -> public.t_order(f_id)';
COMMENT ON COLUMN public.t_payment_transaction.f_provider IS '支付渠道, e.g. wechat';
COMMENT ON COLUMN public.t_payment_transaction.f_out_trade_no IS '商户订单号, 对应微信支付 out_trade_no';
COMMENT ON COLUMN public.t_payment_transaction.f_transaction_id IS '微信支付订单号 transaction_id';
COMMENT ON COLUMN public.t_payment_transaction.f_prepay_id IS 'JSAPI 下单返回的 prepay_id';
COMMENT ON COLUMN public.t_payment_transaction.f_raw_payload IS '发起支付时的业务载荷快照';
COMMENT ON COLUMN public.t_payment_transaction.f_raw_notify IS '微信支付通知解密后的原始内容';
