-- ============================================================
-- PetChat (更懂它) / 9. 电商与库存 / E-commerce & Inventory
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-17
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   商品域 (分类 / SPU / SKU / 库存)
--   交易域 (购物车 / 订单 / 物流)
--
-- 依赖:
--   01_enums.sql       (t_inventory_status, t_inventory_serial_status, t_payment_status,
--                       t_shipping_status, t_status, t_lang)
--   02_rbac_users.sql  (t_user)
--
-- 被本文件引用的脚本: 无
--
-- 设计原则 (E-commerce Principles):
--   1. 商品分类用树结构, 根节点 f_id = -1 (哨兵), 顶级分类 f_parent_id = -1
--   2. SPU = Standard Product Unit (产品级), SKU = Stock Keeping Unit (售卖级, 唯一)
--   3. SPU i18n 走独立子表 t_product_spu_i18n, (spu_id, lang) 唯一
--   4. 库存按 (sku, lot, warehouse) 唯一, 用预留数量 f_reserved_quantity 配合订单
--   5. 订单/订单项是强生命周期父子 (CASCADE), 商品删除不影响历史订单 (NO ACTION)
--   6. 物流: 订单和发货是 1:1~N, 独立 t_shipment 表
--   7. CHECK: f_final_amount = f_total_amount - f_discount_amount (数据库层守恒)
-- ============================================================


-- ============================================================
-- 9.A.1 产品分类 (树, JSONB i18n) / Product Category
-- ============================================================
CREATE TABLE public.t_product_category (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_parent_id   BIGINT,
    f_level       INTEGER NOT NULL DEFAULT 0,
    f_code        VARCHAR(64) NOT NULL,
    f_name        JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_description JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_icon_url    VARCHAR(512) NOT NULL DEFAULT '',
    f_order       INTEGER NOT NULL DEFAULT 0,
    f_is_active   BOOLEAN NOT NULL DEFAULT true,
    f_status_user INTEGER NOT NULL DEFAULT 1,
    f_meta_info   JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_pc_parent FOREIGN KEY (f_parent_id)
        REFERENCES public.t_product_category(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_pc_status FOREIGN KEY (f_status_user)
        REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_pc_code UNIQUE (f_code),
    CONSTRAINT ck_t_pc_level  CHECK (f_level >= 0),
    CONSTRAINT ck_t_pc_name   CHECK (jsonb_typeof(f_name) = 'object'),
    CONSTRAINT ck_t_pc_desc   CHECK (jsonb_typeof(f_description) = 'object')
);
COMMENT ON TABLE  public.t_product_category IS '产品分类树, 根节点 f_id=-1 (哨兵)';
COMMENT ON COLUMN public.t_product_category.f_id          IS '主键; 哨兵: -1 = 根 (内置初始化, 不允许业务写入)';
COMMENT ON COLUMN public.t_product_category.f_parent_id   IS '父分类; 顶级为 -1 | FK 自引用 (本表) | defined in 09_ecommerce.sql';
COMMENT ON COLUMN public.t_product_category.f_level       IS '层级深度 (0=根, 1=一级, ...)';
COMMENT ON COLUMN public.t_product_category.f_code        IS '业务代码, e.g. food / toy / medical | UNIQUE';
COMMENT ON COLUMN public.t_product_category.f_name        IS '多语言分类名 | 引用方: t_product_spu.f_category_id (反查分类)';
COMMENT ON COLUMN public.t_product_category.f_description IS '多语言分类描述';
COMMENT ON COLUMN public.t_product_category.f_icon_url    IS '分类图标 URL';
COMMENT ON COLUMN public.t_product_category.f_order       IS '排序权重';
COMMENT ON COLUMN public.t_product_category.f_is_active   IS '启用开关';
COMMENT ON COLUMN public.t_product_category.f_status_user IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_product_category.f_meta_info   IS '扩展元数据';
COMMENT ON COLUMN public.t_product_category.f_created_at  IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_product_category.f_updated_at  IS '更新时间 (UTC)';
CREATE INDEX idx_t_product_category_parent ON public.t_product_category(f_parent_id);
CREATE INDEX idx_t_product_category_active ON public.t_product_category(f_is_active) WHERE f_is_active = true;


-- ============================================================
-- 9.A.2 产品 SPU (主商品) / Product SPU
-- ============================================================
CREATE TABLE public.t_product_spu (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_category_id BIGINT NOT NULL,
    f_brand       VARCHAR(64) NOT NULL DEFAULT '',
    f_status_inventory INTEGER NOT NULL DEFAULT -1,
    f_status_user      INTEGER NOT NULL DEFAULT 1,
    f_meta_info   JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_spu_category  FOREIGN KEY (f_category_id)
        REFERENCES public.t_product_category(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_spu_inv_stat  FOREIGN KEY (f_status_inventory)
        REFERENCES public.t_inventory_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_spu_user_stat FOREIGN KEY (f_status_user)
        REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_spu_brand CHECK (length(f_brand) <= 64)
);
COMMENT ON TABLE  public.t_product_spu IS 'SPU = Standard Product Unit (产品级, 包含一个或多个 SKU)';
COMMENT ON COLUMN public.t_product_spu.f_id               IS '主键 | 引用方: t_product_spu_i18n.f_spu_id, t_product_sku.f_spu_id (本文件, CASCADE)';
COMMENT ON COLUMN public.t_product_spu.f_category_id      IS 'FK -> public.t_product_category(f_id) | defined in 09_ecommerce.sql';
COMMENT ON COLUMN public.t_product_spu.f_brand            IS '品牌名 (<= 64 字符)';
COMMENT ON COLUMN public.t_product_spu.f_status_inventory IS 'FK -> public.t_inventory_status(f_id) | defined in 01_enums.sql | 汇总库存状态';
COMMENT ON COLUMN public.t_product_spu.f_status_user      IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_product_spu.f_meta_info        IS '扩展元数据';
COMMENT ON COLUMN public.t_product_spu.f_created_at       IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_product_spu.f_updated_at       IS '更新时间 (UTC)';


-- ============================================================
-- 9.A.3 SPU 多语言 (i18n) / Product SPU I18n
-- ============================================================
CREATE TABLE public.t_product_spu_i18n (
    f_spu_id      BIGINT NOT NULL,
    f_lang        VARCHAR(8) NOT NULL,
    f_name        VARCHAR(256) NOT NULL,
    f_description TEXT NOT NULL DEFAULT '',
    f_meta_info   JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (f_spu_id, f_lang),
    CONSTRAINT fk_t_spu_i18n_spu  FOREIGN KEY (f_spu_id) REFERENCES public.t_product_spu(f_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_spu_i18n_lang FOREIGN KEY (f_lang)   REFERENCES public.t_lang(f_code)   ON DELETE NO ACTION,
    CONSTRAINT ck_t_spu_i18n_name CHECK (length(f_name) BETWEEN 1 AND 256)
);
COMMENT ON TABLE  public.t_product_spu_i18n IS 'SPU 多语言名称/描述';
COMMENT ON COLUMN public.t_product_spu_i18n.f_spu_id      IS 'FK -> public.t_product_spu(f_id) | 复合 PK 第一部分 | defined in 09_ecommerce.sql | ON DELETE CASCADE';
COMMENT ON COLUMN public.t_product_spu_i18n.f_lang        IS 'FK -> public.t_lang(f_code) | 复合 PK 第二部分 | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_product_spu_i18n.f_name        IS 'SPU 多语言名称';
COMMENT ON COLUMN public.t_product_spu_i18n.f_description IS 'SPU 多语言描述';
COMMENT ON COLUMN public.t_product_spu_i18n.f_meta_info   IS '扩展元数据';


-- ============================================================
-- 9.A.4 产品 SKU / Product SKU
-- ============================================================
CREATE TABLE public.t_product_sku (
    f_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_spu_id           BIGINT NOT NULL,
    f_sku_code         VARCHAR(64) NOT NULL,
    f_price            NUMERIC(12,2) NOT NULL,
    f_currency         VARCHAR(8) NOT NULL DEFAULT 'CNY',
    f_cost_price       NUMERIC(12,2),
    f_weight           NUMERIC(8,2),
    f_status_inventory INTEGER NOT NULL DEFAULT -1,
    f_status_user      INTEGER NOT NULL DEFAULT 1,
    f_meta_info        JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_sku_spu    FOREIGN KEY (f_spu_id) REFERENCES public.t_product_spu(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_sku_inv    FOREIGN KEY (f_status_inventory) REFERENCES public.t_inventory_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_sku_stat   FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_sku_code   UNIQUE (f_sku_code),
    CONSTRAINT ck_t_sku_price  CHECK (f_price >= 0),
    CONSTRAINT ck_t_sku_cost   CHECK (f_cost_price IS NULL OR f_cost_price >= 0)
);
COMMENT ON TABLE  public.t_product_sku IS 'SKU = Stock Keeping Unit (售卖级, 唯一编码)';
COMMENT ON COLUMN public.t_product_sku.f_id               IS '主键 | 引用方: t_inventory_balance.f_sku_id, t_inventory_movement.f_sku_id, t_inventory_serial.f_sku_id, t_cart.f_sku_id, t_order_item.f_sku_id (本文件)';
COMMENT ON COLUMN public.t_product_sku.f_spu_id           IS 'FK -> public.t_product_spu(f_id) | defined in 09_ecommerce.sql';
COMMENT ON COLUMN public.t_product_sku.f_sku_code         IS 'SKU 业务编码, e.g. SKU-20260617-001 | UNIQUE';
COMMENT ON COLUMN public.t_product_sku.f_price            IS '售价 (>= 0)';
COMMENT ON COLUMN public.t_product_sku.f_currency         IS '货币, 默认 CNY';
COMMENT ON COLUMN public.t_product_sku.f_cost_price       IS '成本价 (可空)';
COMMENT ON COLUMN public.t_product_sku.f_weight           IS '重量 (kg, 用于运费计算)';
COMMENT ON COLUMN public.t_product_sku.f_status_inventory IS 'FK -> public.t_inventory_status(f_id) | defined in 01_enums.sql | 库存状态';
COMMENT ON COLUMN public.t_product_sku.f_status_user      IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_product_sku.f_meta_info        IS '扩展元数据';
COMMENT ON COLUMN public.t_product_sku.f_created_at       IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_product_sku.f_updated_at       IS '更新时间 (UTC)';


-- ============================================================
-- 9.A.5 库存批次 / Inventory Lot
-- ============================================================
CREATE TABLE public.t_inventory_lot (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_lot_code        VARCHAR(64) NOT NULL,
    f_supplier        VARCHAR(128) NOT NULL DEFAULT '',
    f_production_date DATE,
    f_expiry_date     DATE,
    f_cost_price      NUMERIC(12,2),
    f_meta_info       JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_status_user     INTEGER NOT NULL DEFAULT 1,
    f_created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_lot_status FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_lot_code UNIQUE (f_lot_code),
    CONSTRAINT ck_t_lot_dates CHECK (f_expiry_date IS NULL OR f_production_date IS NULL OR f_expiry_date >= f_production_date)
);
COMMENT ON TABLE  public.t_inventory_lot IS '库存批次 (同一供应商/生产日期的入库批次)';
COMMENT ON COLUMN public.t_inventory_lot.f_id              IS '主键 | 引用方: t_inventory_balance.f_lot_id, t_inventory_movement.f_lot_id, t_inventory_serial.f_lot_id (本文件)';
COMMENT ON COLUMN public.t_inventory_lot.f_lot_code        IS '批次编码 | UNIQUE';
COMMENT ON COLUMN public.t_inventory_lot.f_supplier        IS '供应商';
COMMENT ON COLUMN public.t_inventory_lot.f_production_date IS '生产日期';
COMMENT ON COLUMN public.t_inventory_lot.f_expiry_date     IS '过期日期 | 约束: >= f_production_date';
COMMENT ON COLUMN public.t_inventory_lot.f_cost_price      IS '批次成本价';
COMMENT ON COLUMN public.t_inventory_lot.f_meta_info       IS '扩展元数据';
COMMENT ON COLUMN public.t_inventory_lot.f_status_user     IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_inventory_lot.f_created_at      IS '入库时间 (UTC)';


-- ============================================================
-- 9.A.6 库存余额 (按 SKU + 仓库 + 批次 唯一) / Inventory Balance
-- ============================================================
CREATE TABLE public.t_inventory_balance (
    f_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_sku_id            BIGINT NOT NULL,
    f_lot_id            BIGINT,
    f_warehouse_id      INTEGER NOT NULL DEFAULT 1,
    f_quantity          INTEGER NOT NULL DEFAULT 0,
    f_reserved_quantity INTEGER NOT NULL DEFAULT 0,
    f_status_inventory  INTEGER NOT NULL DEFAULT -1,
    f_status_user       INTEGER NOT NULL DEFAULT 1,
    f_updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_ib_sku FOREIGN KEY (f_sku_id)
        REFERENCES public.t_product_sku(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_ib_lot FOREIGN KEY (f_lot_id)
        REFERENCES public.t_inventory_lot(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_ib_inv FOREIGN KEY (f_status_inventory)
        REFERENCES public.t_inventory_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_ib_st  FOREIGN KEY (f_status_user)
        REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_ib_sku_lot_wh UNIQUE (f_sku_id, f_lot_id, f_warehouse_id),
    CONSTRAINT ck_t_ib_qty CHECK (f_quantity >= 0),
    CONSTRAINT ck_t_ib_rsv CHECK (f_reserved_quantity >= 0 AND f_reserved_quantity <= f_quantity)
);
COMMENT ON TABLE  public.t_inventory_balance IS '库存余额, (sku, lot, warehouse) 唯一';
COMMENT ON COLUMN public.t_inventory_balance.f_id                IS '主键';
COMMENT ON COLUMN public.t_inventory_balance.f_sku_id            IS 'FK -> public.t_product_sku(f_id) | defined in 09_ecommerce.sql';
COMMENT ON COLUMN public.t_inventory_balance.f_lot_id            IS 'FK -> public.t_inventory_lot(f_id) | defined in 09_ecommerce.sql | 可空 (无批次)';
COMMENT ON COLUMN public.t_inventory_balance.f_warehouse_id      IS '仓库 ID (1=主仓, 后续扩展)';
COMMENT ON COLUMN public.t_inventory_balance.f_quantity          IS '当前库存数量 (>= 0)';
COMMENT ON COLUMN public.t_inventory_balance.f_reserved_quantity IS '已预留数量 (订单未支付) | 约束: 0 <= reserved <= quantity';
COMMENT ON COLUMN public.t_inventory_balance.f_status_inventory  IS 'FK -> public.t_inventory_status(f_id) | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_inventory_balance.f_status_user       IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_inventory_balance.f_updated_at        IS '更新时间 (UTC)';


-- ============================================================
-- 9.A.7 库存流水 / Inventory Movement
-- ============================================================
CREATE TABLE public.t_inventory_movement (
    f_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_sku_id          BIGINT NOT NULL,
    f_lot_id          BIGINT,
    f_movement_type   VARCHAR(16) NOT NULL,
    f_quantity        INTEGER NOT NULL,
    f_reference_type  VARCHAR(32) NOT NULL DEFAULT '',
    f_reference_id    BIGINT,
    f_reason          VARCHAR(256) NOT NULL DEFAULT '',
    f_operator_id     BIGINT,
    f_meta_info       JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_status_user     INTEGER NOT NULL DEFAULT 1,
    f_created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_im_sku FOREIGN KEY (f_sku_id)
        REFERENCES public.t_product_sku(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_im_lot FOREIGN KEY (f_lot_id)
        REFERENCES public.t_inventory_lot(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_im_op  FOREIGN KEY (f_operator_id)
        REFERENCES public.t_user(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_im_st  FOREIGN KEY (f_status_user)
        REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_im_type CHECK (f_movement_type IN ('in','out','adjust','transfer','return'))
);
COMMENT ON TABLE  public.t_inventory_movement IS '库存流水 (append-only 审计)';
COMMENT ON COLUMN public.t_inventory_movement.f_id             IS '主键';
COMMENT ON COLUMN public.t_inventory_movement.f_sku_id         IS 'FK -> public.t_product_sku(f_id) | defined in 09_ecommerce.sql';
COMMENT ON COLUMN public.t_inventory_movement.f_lot_id         IS 'FK -> public.t_inventory_lot(f_id) | defined in 09_ecommerce.sql | 可空';
COMMENT ON COLUMN public.t_inventory_movement.f_movement_type  IS '流水类型 (白名单): in=入库 / out=出库 / adjust=调整 / transfer=调拨 / return=退货';
COMMENT ON COLUMN public.t_inventory_movement.f_quantity       IS '本次变动数量 (正负由 f_movement_type 决定)';
COMMENT ON COLUMN public.t_inventory_movement.f_reference_type IS '关联业务类型, e.g. order / purchase / return';
COMMENT ON COLUMN public.t_inventory_movement.f_reference_id   IS '关联业务 ID (弱引用)';
COMMENT ON COLUMN public.t_inventory_movement.f_reason         IS '变动原因 (文本)';
COMMENT ON COLUMN public.t_inventory_movement.f_operator_id    IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | 操作人';
COMMENT ON COLUMN public.t_inventory_movement.f_meta_info      IS '扩展元数据';
COMMENT ON COLUMN public.t_inventory_movement.f_status_user    IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_inventory_movement.f_created_at     IS '流水时间 (UTC)';


-- ============================================================
-- 9.A.8 库存序列号 (单品追踪) / Inventory Serial
-- ============================================================
CREATE TABLE public.t_inventory_serial (
    f_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_sku_id        BIGINT NOT NULL,
    f_lot_id        BIGINT,
    f_serial_number VARCHAR(128) NOT NULL,
    f_status_serial INTEGER NOT NULL DEFAULT -1,
    f_meta_info     JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_status_user   INTEGER NOT NULL DEFAULT 1,
    f_created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_is_sku FOREIGN KEY (f_sku_id) REFERENCES public.t_product_sku(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_is_lot FOREIGN KEY (f_lot_id) REFERENCES public.t_inventory_lot(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_is_st  FOREIGN KEY (f_status_serial) REFERENCES public.t_inventory_serial_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_is_usr FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_is_sn UNIQUE (f_serial_number)
);
COMMENT ON TABLE  public.t_inventory_serial IS '库存单品序列号 (用于高价值/医疗/电子设备)';
COMMENT ON COLUMN public.t_inventory_serial.f_id            IS '主键';
COMMENT ON COLUMN public.t_inventory_serial.f_sku_id        IS 'FK -> public.t_product_sku(f_id) | defined in 09_ecommerce.sql';
COMMENT ON COLUMN public.t_inventory_serial.f_lot_id        IS 'FK -> public.t_inventory_lot(f_id) | defined in 09_ecommerce.sql | 可空';
COMMENT ON COLUMN public.t_inventory_serial.f_serial_number IS '单品序列号 | UNIQUE';
COMMENT ON COLUMN public.t_inventory_serial.f_status_serial IS 'FK -> public.t_inventory_serial_status(f_id) | defined in 01_enums.sql | in_stock / sold / returned / damaged';
COMMENT ON COLUMN public.t_inventory_serial.f_meta_info     IS '扩展元数据';
COMMENT ON COLUMN public.t_inventory_serial.f_status_user   IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_inventory_serial.f_created_at    IS '入库时间 (UTC)';


-- ============================================================
-- 9.B.1 购物车 / Cart
-- ============================================================
CREATE TABLE public.t_cart (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id     BIGINT NOT NULL,
    f_sku_id      BIGINT NOT NULL,
    f_quantity    INTEGER NOT NULL DEFAULT 1,
    f_unit_price  NUMERIC(12,2) NOT NULL,
    f_meta_info   JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_status_user INTEGER NOT NULL DEFAULT 1,
    f_created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_cart_user FOREIGN KEY (f_user_id)
        REFERENCES public.t_user(f_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_cart_sku  FOREIGN KEY (f_sku_id)
        REFERENCES public.t_product_sku(f_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_cart_stat FOREIGN KEY (f_status_user)
        REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_cart_qty  CHECK (f_quantity > 0),
    CONSTRAINT ck_t_cart_price CHECK (f_unit_price >= 0),
    CONSTRAINT uk_t_cart_user_sku UNIQUE (f_user_id, f_sku_id)
);
COMMENT ON TABLE  public.t_cart IS '购物车 (一个用户对同一 SKU 只有一条记录)';
COMMENT ON COLUMN public.t_cart.f_id          IS '主键';
COMMENT ON COLUMN public.t_cart.f_user_id     IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql | ON DELETE CASCADE (删用户清空车)';
COMMENT ON COLUMN public.t_cart.f_sku_id      IS 'FK -> public.t_product_sku(f_id) | defined in 09_ecommerce.sql | ON DELETE CASCADE';
COMMENT ON COLUMN public.t_cart.f_quantity    IS '数量 (> 0) | UNIQUE: (f_user_id, f_sku_id)';
COMMENT ON COLUMN public.t_cart.f_unit_price  IS '加入购物车时的单价快照 (>= 0) | 下单时按当前实际价格';
COMMENT ON COLUMN public.t_cart.f_meta_info   IS '扩展元数据';
COMMENT ON COLUMN public.t_cart.f_status_user IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_cart.f_created_at  IS '加入时间 (UTC)';
COMMENT ON COLUMN public.t_cart.f_updated_at  IS '更新时间 (UTC)';


-- ============================================================
-- 9.B.2 订单 / Order
-- ============================================================
CREATE TABLE public.t_order (
    f_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_user_id          BIGINT NOT NULL,
    f_order_no         VARCHAR(64) NOT NULL,
    f_total_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    f_discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    f_final_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    f_currency         VARCHAR(8) NOT NULL DEFAULT 'CNY',
    f_payment_method   VARCHAR(32) NOT NULL DEFAULT '',
    f_status_payment   INTEGER NOT NULL DEFAULT -1,
    f_payment_time     TIMESTAMPTZ,
    f_status_shipping  INTEGER NOT NULL DEFAULT -1,
    f_status_user      INTEGER NOT NULL DEFAULT 1,
    f_receiver_name    VARCHAR(64) NOT NULL,
    f_receiver_phone   VARCHAR(32) NOT NULL,
    f_receiver_address VARCHAR(512) NOT NULL,
    f_meta_info        JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_order_user     FOREIGN KEY (f_user_id)
        REFERENCES public.t_user(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_order_pay_stat FOREIGN KEY (f_status_payment)
        REFERENCES public.t_payment_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_order_ship_st  FOREIGN KEY (f_status_shipping)
        REFERENCES public.t_shipping_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_order_user_st  FOREIGN KEY (f_status_user)
        REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT uk_t_order_no UNIQUE (f_order_no),
    CONSTRAINT ck_t_order_total  CHECK (f_total_amount >= 0),
    CONSTRAINT ck_t_order_disc   CHECK (f_discount_amount >= 0),
    CONSTRAINT ck_t_order_final  CHECK (f_final_amount >= 0),
    CONSTRAINT ck_t_order_amount CHECK (f_final_amount = f_total_amount - f_discount_amount),
    CONSTRAINT ck_t_order_recv_n CHECK (length(f_receiver_name) BETWEEN 1 AND 64),
    CONSTRAINT ck_t_order_recv_p CHECK (f_receiver_phone ~ '^[0-9+\-\s()]{5,32}$'),
    CONSTRAINT ck_t_order_recv_a CHECK (length(f_receiver_address) BETWEEN 1 AND 512)
);
COMMENT ON TABLE  public.t_order IS '订单主表; f_status_payment / f_status_shipping 引用对应业务状态枚举';
COMMENT ON COLUMN public.t_order.f_id               IS '主键 | 引用方: t_order_item.f_order_id, t_shipment.f_order_id (本文件, CASCADE)';
COMMENT ON COLUMN public.t_order.f_user_id          IS 'FK -> public.t_user(f_id) | defined in 02_rbac_users.sql';
COMMENT ON COLUMN public.t_order.f_order_no         IS '订单号 (对外展示) | UNIQUE';
COMMENT ON COLUMN public.t_order.f_total_amount     IS '订单总金额 (= SUM(t_order_item.f_total_price), >= 0)';
COMMENT ON COLUMN public.t_order.f_discount_amount  IS '优惠金额 (>= 0)';
COMMENT ON COLUMN public.t_order.f_final_amount     IS '应付金额 | 守恒: f_final_amount = f_total_amount - f_discount_amount';
COMMENT ON COLUMN public.t_order.f_currency         IS '货币, 默认 CNY';
COMMENT ON COLUMN public.t_order.f_payment_method   IS '支付方式, e.g. wechat / alipay / card';
COMMENT ON COLUMN public.t_order.f_status_payment   IS 'FK -> public.t_payment_status(f_id) | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_order.f_payment_time     IS '支付完成时间 (可空)';
COMMENT ON COLUMN public.t_order.f_status_shipping  IS 'FK -> public.t_shipping_status(f_id) | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_order.f_status_user      IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_order.f_receiver_name    IS '收货人姓名';
COMMENT ON COLUMN public.t_order.f_receiver_phone   IS '收货人电话';
COMMENT ON COLUMN public.t_order.f_receiver_address IS '收货地址';
COMMENT ON COLUMN public.t_order.f_meta_info        IS '扩展元数据';
COMMENT ON COLUMN public.t_order.f_created_at       IS '下单时间 (UTC)';
COMMENT ON COLUMN public.t_order.f_updated_at       IS '更新时间 (UTC)';
CREATE INDEX idx_t_order_user_created ON public.t_order(f_user_id, f_created_at DESC);
CREATE INDEX idx_t_order_pay_status   ON public.t_order(f_status_payment, f_created_at DESC);
CREATE INDEX idx_t_order_ship_status  ON public.t_order(f_status_shipping, f_created_at DESC);


-- ============================================================
-- 9.B.3 订单项 (强生命周期子表, ON DELETE CASCADE)
-- ============================================================
CREATE TABLE public.t_order_item (
    f_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_order_id    BIGINT NOT NULL,
    f_sku_id      BIGINT NOT NULL,
    f_product_name VARCHAR(256) NOT NULL,
    f_quantity    INTEGER NOT NULL,
    f_unit_price  NUMERIC(12,2) NOT NULL,
    f_total_price NUMERIC(12,2) NOT NULL,
    f_discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    f_final_price NUMERIC(12,2) NOT NULL,
    f_meta_info   JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_status_user INTEGER NOT NULL DEFAULT 1,
    f_created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_oi_order  FOREIGN KEY (f_order_id) REFERENCES public.t_order(f_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_oi_sku    FOREIGN KEY (f_sku_id)   REFERENCES public.t_product_sku(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_oi_stat   FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_oi_qty    CHECK (f_quantity > 0),
    CONSTRAINT ck_t_oi_price  CHECK (f_unit_price >= 0 AND f_total_price >= 0 AND f_final_price >= 0),
    CONSTRAINT ck_t_oi_amount CHECK (f_final_price = f_total_price - f_discount_amount)
);
COMMENT ON TABLE  public.t_order_item IS '订单项 (强子表, 订单删除时级联清理)';
COMMENT ON COLUMN public.t_order_item.f_id              IS '主键';
COMMENT ON COLUMN public.t_order_item.f_order_id        IS 'FK -> public.t_order(f_id) | defined in 09_ecommerce.sql | ON DELETE CASCADE';
COMMENT ON COLUMN public.t_order_item.f_sku_id          IS 'FK -> public.t_product_sku(f_id) | defined in 09_ecommerce.sql | 保留原商品引用, 商品删除不影响历史订单';
COMMENT ON COLUMN public.t_order_item.f_product_name    IS '下单时商品名称快照 (冗余, 防止商品改名)';
COMMENT ON COLUMN public.t_order_item.f_quantity        IS '购买数量 (> 0)';
COMMENT ON COLUMN public.t_order_item.f_unit_price      IS '下单时单价快照 (>= 0)';
COMMENT ON COLUMN public.t_order_item.f_total_price     IS '总金额 = unit_price * quantity (>= 0)';
COMMENT ON COLUMN public.t_order_item.f_discount_amount IS '优惠金额 (>= 0, 默认 0)';
COMMENT ON COLUMN public.t_order_item.f_final_price     IS '应付金额 | 守恒: f_final_price = f_total_price - f_discount_amount';
COMMENT ON COLUMN public.t_order_item.f_meta_info       IS '扩展元数据';
COMMENT ON COLUMN public.t_order_item.f_status_user     IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_order_item.f_created_at      IS '创建时间 (UTC)';
CREATE INDEX idx_t_order_item_order ON public.t_order_item(f_order_id);
CREATE INDEX idx_t_order_item_sku   ON public.t_order_item(f_sku_id);


-- ============================================================
-- 9.B.4 物流 / Shipment
-- ============================================================
CREATE TABLE public.t_shipment (
    f_id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    f_order_id            BIGINT NOT NULL,
    f_tracking_number     VARCHAR(64) NOT NULL DEFAULT '',
    f_carrier             VARCHAR(64) NOT NULL DEFAULT '',
    f_status_shipment     INTEGER NOT NULL DEFAULT -1,
    f_estimated_delivery  TIMESTAMPTZ,
    f_actual_delivery     TIMESTAMPTZ,
    f_meta_info           JSONB NOT NULL DEFAULT '{}'::jsonb,
    f_status_user         INTEGER NOT NULL DEFAULT 1,
    f_created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    f_updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_t_ship_order FOREIGN KEY (f_order_id) REFERENCES public.t_order(f_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_ship_stat  FOREIGN KEY (f_status_shipment) REFERENCES public.t_shipping_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT fk_t_ship_usr   FOREIGN KEY (f_status_user) REFERENCES public.t_status(f_id) ON DELETE NO ACTION,
    CONSTRAINT ck_t_ship_time  CHECK (f_actual_delivery IS NULL OR f_estimated_delivery IS NULL OR f_actual_delivery >= f_estimated_delivery - INTERVAL '30 days')
);
COMMENT ON TABLE  public.t_shipment IS '物流 (订单的强子表, 1:1~N)';
COMMENT ON COLUMN public.t_shipment.f_id                 IS '主键';
COMMENT ON COLUMN public.t_shipment.f_order_id           IS 'FK -> public.t_order(f_id) | defined in 09_ecommerce.sql | ON DELETE CASCADE';
COMMENT ON COLUMN public.t_shipment.f_tracking_number    IS '快递单号 (空 = 未发货)';
COMMENT ON COLUMN public.t_shipment.f_carrier            IS '物流商, e.g. 顺丰 / 中通 / 京东';
COMMENT ON COLUMN public.t_shipment.f_status_shipment    IS 'FK -> public.t_shipping_status(f_id) | defined in 01_enums.sql';
COMMENT ON COLUMN public.t_shipment.f_estimated_delivery IS '预计送达时间';
COMMENT ON COLUMN public.t_shipment.f_actual_delivery    IS '实际送达时间 | 约束: >= estimated - 30 days (允许误差)';
COMMENT ON COLUMN public.t_shipment.f_meta_info          IS '扩展元数据 (物流轨迹 JSON)';
COMMENT ON COLUMN public.t_shipment.f_status_user        IS 'FK -> public.t_status(f_id) | defined in 01_enums.sql | 软删';
COMMENT ON COLUMN public.t_shipment.f_created_at         IS '创建时间 (UTC)';
COMMENT ON COLUMN public.t_shipment.f_updated_at         IS '更新时间 (UTC)';

-- 跨表效率索引 (高频查询, 不在表内 CREATE INDEX 中)
CREATE INDEX IF NOT EXISTS idx_t_product_spu_brand         ON public.t_product_spu(f_brand);
CREATE INDEX IF NOT EXISTS idx_t_product_sku_spu           ON public.t_product_sku(f_spu_id);
CREATE INDEX IF NOT EXISTS idx_t_inventory_lot_supplier    ON public.t_inventory_lot(f_supplier);
CREATE INDEX IF NOT EXISTS idx_t_inventory_balance_sku     ON public.t_inventory_balance(f_sku_id);
CREATE INDEX IF NOT EXISTS idx_t_inventory_movement_created ON public.t_inventory_movement(f_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_t_inventory_serial_sku      ON public.t_inventory_serial(f_sku_id);
CREATE INDEX IF NOT EXISTS idx_t_cart_user_active          ON public.t_cart(f_user_id) WHERE f_status_user = 1;
CREATE INDEX IF NOT EXISTS idx_t_shipment_order            ON public.t_shipment(f_order_id);
CREATE INDEX IF NOT EXISTS idx_t_shipment_tracking         ON public.t_shipment(f_tracking_number) WHERE f_tracking_number <> '';
