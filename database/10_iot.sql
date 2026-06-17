-- ============================================================
-- PetChat (灵犀宠语) / 10. IoT 设备 / IoT Devices
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   设备 / 用户-设备绑定 / 设备同步记录
--
-- 依赖:
--   01_enums.sql       (t_sync_status, t_status)
--   02_rbac_users.sql  (t_user)
--
-- 被本文件引用的脚本 (下游):
--   11_agent.sql       -> (设备生产相关, 暂未引用)
--
-- 设计原则 (IoT Principles):
--   1. 设备 SN 全局唯一, 一个设备只能绑一个用户一次 (t_user_device 复合 PK)
--   2. 设备类型白名单: camera / feeder / tracker / scale / litter_box / water_fountain
--   3. 同步记录 append-only, 失败重试通过 f_retry_count
--   4. 弱引用 f_production_id / f_order_id (生产批次/订单), 不加 FK
-- ============================================================


-- ============================================================
-- 10.1 设备 / Device
-- ============================================================
CREATE TABLE public.t_device (
    f_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_device_type      VARCHAR(32)  NOT NULL,
    f_sn               VARCHAR(64)  NOT NULL,
    f_device_name      VARCHAR(128) NOT NULL,
    f_device_model     VARCHAR(64)  NOT NULL DEFAULT '',
    f_firmware_version VARCHAR(32)  NOT NULL DEFAULT '',
    f_production_id    BIGINT,
    f_order_id         BIGINT,
    f_meta_info        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    f_status_user      INTEGER      NOT NULL DEFAULT 1,
    f_created_at       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_device_stat FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_device_sn UNIQUE (f_sn),
    CONSTRAINT ck_t_device_type CHECK (f_device_type IN ('camera','feeder','tracker','scale','litter_box','water_fountain'))
);
COMMENT ON TABLE  public.t_device IS 'IoT 设备主表 (每个设备一个 SN)';
COMMENT ON COLUMN public.t_device.f_id               IS '主键 | 引用方: t_user_device.f_device_id, t_device_sync.f_device_id (本文件)';
COMMENT ON COLUMN public.t_device.f_device_type      IS '设备类型 (白名单): camera / feeder / tracker / scale / litter_box / water_fountain';
COMMENT ON COLUMN public.t_device.f_sn               IS '设备 SN (Serial Number) | UNIQUE';
COMMENT ON COLUMN public.t_device.f_device_name      IS '设备名 (出厂默认)';
COMMENT ON COLUMN public.t_device.f_device_model     IS '设备型号';
COMMENT ON COLUMN public.t_device.f_firmware_version IS '固件版本';
COMMENT ON COLUMN public.t_device.f_production_id    IS '弱引用: 生产批次 ID (in t_inventory_lot, 09_ecommerce.sql)';
COMMENT ON COLUMN public.t_device.f_order_id         IS '弱引用: 首次购买订单 ID (in t_order, 09_ecommerce.sql)';
COMMENT ON COLUMN public.t_device.f_meta_info        IS '扩展元数据';
COMMENT ON COLUMN public.t_device.f_status_user      IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_device.f_created_at       IS '入库时间 (UTC)';


-- ============================================================
-- 10.2 用户-设备绑定 / User Device  (复合 PK)
-- ============================================================
CREATE TABLE public.t_user_device (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY,
    f_user_id     BIGINT  NOT NULL,
    f_device_id   BIGINT  NOT NULL,
    f_bind_alias  VARCHAR(64) NOT NULL DEFAULT '',
    f_is_primary  BOOLEAN NOT NULL DEFAULT false,
    f_bound_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_unbound_at  TIMESTAMPTZ,
    f_status_user INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (f_user_id, f_device_id),
    CONSTRAINT fk_t_ud_user   FOREIGN KEY (f_user_id)     REFERENCES public.t_user(f_id)    ON DELETE NO ACTION,
    CONSTRAINT fk_t_ud_device FOREIGN KEY (f_device_id)   REFERENCES public.t_device(f_id)  ON DELETE NO ACTION,
    CONSTRAINT fk_t_ud_stat   FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_ud_time   CHECK (f_unbound_at IS NULL OR f_unbound_at >= f_bound_at)
);
COMMENT ON TABLE  public.t_user_device IS '用户-设备绑定 (复合 PK (user, device))';
COMMENT ON COLUMN public.t_user_device.f_id          IS '主键占位 (BIGSERIAL, 实际用复合 PK)';
COMMENT ON COLUMN public.t_user_device.f_user_id     IS 'FK -> public.t_user(f_id) | 复合 PK 第一部分 | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_user_device.f_device_id   IS 'FK -> public.t_device(f_id) | 复合 PK 第二部分 | defined in 10_iot.sql';
COMMENT ON COLUMN public.t_user_device.f_bind_alias  IS '用户自定义昵称 (空 = 用 t_device.f_device_name)';
COMMENT ON COLUMN public.t_user_device.f_is_primary  IS '是否主设备 (同一类型只能有一个主设备)';
COMMENT ON COLUMN public.t_user_device.f_bound_at    IS '绑定时间 (UTC)';
COMMENT ON COLUMN public.t_user_device.f_unbound_at  IS '解绑时间 (可空) | 约束: >= f_bound_at';
COMMENT ON COLUMN public.t_user_device.f_status_user IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';


-- ============================================================
-- 10.3 设备同步记录 / Device Sync
-- ============================================================
CREATE TABLE public.t_device_sync (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_device_id   BIGINT  NOT NULL,
    f_sync_type   VARCHAR(32) NOT NULL,
    f_status_sync INTEGER NOT NULL DEFAULT -1,
    f_synced_at   TIMESTAMPTZ,
    f_retry_count INTEGER NOT NULL DEFAULT 0,
    f_error_msg   TEXT NOT NULL DEFAULT '',
    f_meta_info   JSONB  NOT NULL DEFAULT '{}'::jsonb,
    f_status_user INTEGER NOT NULL DEFAULT 1,
    f_created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_sync_device FOREIGN KEY (f_device_id)   REFERENCES public.t_device(f_id)      ON DELETE NO ACTION,
    CONSTRAINT fk_t_sync_status FOREIGN KEY (f_status_sync) REFERENCES public.t_sync_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_sync_user   FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id)       ON DELETE NO ACTION,
    CONSTRAINT ck_t_sync_retry  CHECK (f_retry_count >= 0)
);
COMMENT ON TABLE  public.t_device_sync IS '设备同步记录 (append-only)';
COMMENT ON COLUMN public.t_device_sync.f_id          IS '主键';
COMMENT ON COLUMN public.t_device_sync.f_device_id   IS 'FK -> public.t_device(f_id) | defined in 10_iot.sql';
COMMENT ON COLUMN public.t_device_sync.f_sync_type   IS '同步类型, e.g. config / firmware / data';
COMMENT ON COLUMN public.t_device_sync.f_status_sync IS 'FK -> public.t_sync_status(f_id) | defined in 01_enums.sql | pending / syncing / success / failed';
COMMENT ON COLUMN public.t_device_sync.f_synced_at   IS '实际同步完成时间 (可空)';
COMMENT ON COLUMN public.t_device_sync.f_retry_count IS '重试次数 (>= 0)';
COMMENT ON COLUMN public.t_device_sync.f_error_msg   IS '失败时的错误信息';
COMMENT ON COLUMN public.t_device_sync.f_meta_info   IS '扩展元数据 (请求/响应快照)';
COMMENT ON COLUMN public.t_device_sync.f_status_user IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_device_sync.f_created_at  IS '创建时间 (UTC)';
CREATE INDEX idx_t_device_sync_device ON public.t_device_sync(f_device_id, f_created_at DESC);
