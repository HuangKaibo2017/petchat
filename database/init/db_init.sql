-- ============================================================
-- PetChat (更懂它) / 初始数据 / Database Initial Data
-- ============================================================
-- Version: 4.0.0
-- Created: 2026-06-20
-- Last Updated: 2026-06-21
-- Target: PostgreSQL 15+ / Supabase Cloud
--
-- 本文件用途:
--   集中所有 enum 初始数据 (预设值) + AB 平台 enum 初始数据
--   必须先执行 _run_all.sql (或对应 DDL 文件), 加载完所有表结构后再执行本文件
--
-- 加载顺序 (按表加载顺序):
--   1. 01_enums.sql  -> t_lang / t_pet_type / t_pet_breed / t_gender / t_photo_type
--                       / t_report_type / t_risk_level / t_health_level / t_status
--                       / t_plan_type / t_payment_status / t_shipping_status
--                       / t_sync_status / t_inventory_status / t_inventory_serial_status
--                       / t_adoption_type / t_volunteer_type / t_share_type
--                       / t_share_channel / t_activity_type / t_subscription_type
--                       / t_banner_type / t_usage_type / t_personality_tag
--   2. 50_ab.sql     -> t_ab_domain / t_ab_status / t_ab_event
--
-- 部署示例:
--   psql -d petchat -f database/_run_all.sql
--   psql -d petchat -f database/init/db_init.sql
-- ============================================================


-- ============================================================
-- 1. 基础枚举层初始数据 (from 01_enums.sql)
-- ============================================================

-- ============================================================
-- 1.1 t_lang / 系统支持的语言 (i18n 源头)
-- ============================================================
-- 约定: 简体中文 / 繁体中文 / 英语 / 日语 / 韩语 + 主要欧洲语言 + 东南亚语言
INSERT INTO public.t_lang (f_code, f_name, f_desc, f_order) VALUES
    ('zh-CN', '简体中文',     'Simplified Chinese',  10),
    ('zh-TW', '繁體中文',     'Traditional Chinese', 20),
    ('en-US', 'English (US)', 'American English',    30),
    ('en-GB', 'English (UK)', 'British English',     40),
    ('ja-JP', '日本語',       'Japanese',            50),
    ('ko-KR', '한국어',       'Korean',              60),
    ('fr-FR', 'Français',     'French (France)',     70),
    ('de-DE', 'Deutsch',      'German',              80),
    ('es-ES', 'Español',      'Spanish (Spain)',     90),
    ('pt-BR', 'Português',    'Portuguese (Brazil)', 100),
    ('ru-RU', 'Русский',      'Russian',             110),
    ('it-IT', 'Italiano',     'Italian',             120),
    ('ar-SA', 'العربية',      'Arabic',              130),
    ('th-TH', 'ไทย',          'Thai',                140),
    ('vi-VN', 'Tiếng Việt',   'Vietnamese',          150),
    ('id-ID', 'Bahasa Indonesia', 'Indonesian',      160),
    ('ms-MY', 'Bahasa Melayu', 'Malay',              170),
    ('tr-TR', 'Türkçe',       'Turkish',             180);


-- ============================================================
-- 1.2 t_pet_type / 宠物类型
-- ============================================================
INSERT INTO public.t_pet_type (f_id, f_ver, f_name, f_desc, f_order) VALUES
    (-1, 100, '{"zh-CN":"未设置","en-US":"Not Set"}',
        '{"zh-CN":"占位符","en-US":"Sentinel placeholder"}', 0),
    ( 1, 100, '{"zh-CN":"犬","en-US":"Dog","ja-JP":"犬"}',
        '{"zh-CN":"家犬 / 狗","en-US":"Domestic dog"}', 10),
    ( 2, 100, '{"zh-CN":"猫","en-US":"Cat","ja-JP":"猫"}',
        '{"zh-CN":"家猫","en-US":"Domestic cat"}', 20),
    ( 3, 100, '{"zh-CN":"兔","en-US":"Rabbit"}',
        '{"zh-CN":"家兔","en-US":"Domestic rabbit"}', 30),
    ( 4, 100, '{"zh-CN":"仓鼠","en-US":"Hamster"}',
        '{"zh-CN":"仓鼠","en-US":"Hamster / 小型啮齿动物"}', 40),
    ( 5, 100, '{"zh-CN":"鸟","en-US":"Bird"}',
        '{"zh-CN":"宠物鸟 (鹦鹉/文鸟/...)","en-US":"Pet bird"}', 50),
    ( 6, 100, '{"zh-CN":"鱼","en-US":"Fish"}',
        '{"zh-CN":"观赏鱼","en-US":"Aquarium fish"}', 60),
    ( 7, 100, '{"zh-CN":"龟","en-US":"Turtle"}',
        '{"zh-CN":"龟 / 鳖","en-US":"Turtle / Tortoise"}', 70),
    ( 8, 100, '{"zh-CN":"蜥蜴","en-US":"Lizard"}',
        '{"zh-CN":"爬行类 - 蜥蜴","en-US":"Lizard / Reptile"}', 80),
    ( 9, 100, '{"zh-CN":"蛇","en-US":"Snake"}',
        '{"zh-CN":"爬行类 - 蛇","en-US":"Snake"}', 90),
    (10, 100, '{"zh-CN":"荷兰猪","en-US":"Guinea Pig"}',
        '{"zh-CN":"豚鼠 / 天竺鼠","en-US":"Guinea pig"}', 100),
    (11, 100, '{"zh-CN":"刺猬","en-US":"Hedgehog"}',
        '{"zh-CN":"非洲迷你刺猬","en-US":"African pygmy hedgehog"}', 110),
    (12, 100, '{"zh-CN":"雪貂","en-US":"Ferret"}',
        '{"zh-CN":"雪貂","en-US":"Ferret"}', 120),
    (13, 100, '{"zh-CN":"龙猫","en-US":"Chinchilla"}',
        '{"zh-CN":"毛丝鼠 / 龙猫","en-US":"Chinchilla"}', 130),
    (14, 100, '{"zh-CN":"马","en-US":"Horse"}',
        '{"zh-CN":"马 / 矮马","en-US":"Horse / Pony"}', 140),
    (99, 100, '{"zh-CN":"其他","en-US":"Other"}',
        '{"zh-CN":"其他宠物类型","en-US":"Other pet type"}', 990);


-- ============================================================
-- 1.3 t_pet_breed / 宠物品种 (猫 + 狗)
-- ============================================================
-- f_pet_type_id: 1=犬, 2=猫
INSERT INTO public.t_pet_breed (f_id, f_pet_type_id, f_ver, f_name, f_desc, f_order) VALUES
    -- 哨兵
    (-1, -1, 100, '{"zh-CN":"未设置","en-US":"Not Set"}', '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    -- ===== 犬 (f_pet_type_id=1) =====
    ( 1, 1, 100, '{"zh-CN":"金毛寻回犬","en-US":"Golden Retriever"}',
        '{"zh-CN":"大型犬","en-US":"Large-sized, friendly"}', 10),
    ( 2, 1, 100, '{"zh-CN":"拉布拉多","en-US":"Labrador Retriever"}',
        '{"zh-CN":"大型犬","en-US":"Large-sized, gentle"}', 20),
    ( 3, 1, 100, '{"zh-CN":"柴犬","en-US":"Shiba Inu"}',
        '{"zh-CN":"日本小型犬","en-US":"Japanese small-sized"}', 30),
    ( 4, 1, 100, '{"zh-CN":"西伯利亚雪橇犬","en-US":"Siberian Husky"}',
        '{"zh-CN":"哈士奇","en-US":"Husky"}', 40),
    ( 5, 1, 100, '{"zh-CN":"彭布罗克威尔士柯基","en-US":"Pembroke Welsh Corgi"}',
        '{"zh-CN":"柯基","en-US":"Corgi"}', 50),
    ( 6, 1, 100, '{"zh-CN":"边境牧羊犬","en-US":"Border Collie"}',
        '{"zh-CN":"边牧","en-US":"Border Collie"}', 60),
    ( 7, 1, 100, '{"zh-CN":"萨摩耶","en-US":"Samoyed"}',
        '{"zh-CN":"微笑天使","en-US":"Smiling angel"}', 70),
    ( 8, 1, 100, '{"zh-CN":"贵宾犬","en-US":"Poodle"}',
        '{"zh-CN":"泰迪 / 贵妇","en-US":"Toy / Miniature / Standard"}', 80),
    ( 9, 1, 100, '{"zh-CN":"博美犬","en-US":"Pomeranian"}',
        '{"zh-CN":"小球","en-US":"Pom"}', 90),
    (10, 1, 100, '{"zh-CN":"法国斗牛犬","en-US":"French Bulldog"}',
        '{"zh-CN":"法斗","en-US":"Frenchie"}', 100),
    (11, 1, 100, '{"zh-CN":"巴哥犬","en-US":"Pug"}',
        '{"zh-CN":"哈巴狗","en-US":"Pug"}', 110),
    (12, 1, 100, '{"zh-CN":"比熊犬","en-US":"Bichon Frise"}',
        '{"zh-CN":"棉花糖","en-US":"Bichon"}', 120),
    (13, 1, 100, '{"zh-CN":"约克夏㹴","en-US":"Yorkshire Terrier"}',
        '{"zh-CN":"约克夏","en-US":"Yorkie"}', 130),
    (14, 1, 100, '{"zh-CN":"腊肠犬","en-US":"Dachshund"}',
        '{"zh-CN":"腊肠 / 短腿","en-US":"Dachshund / Sausage dog"}', 140),
    (15, 1, 100, '{"zh-CN":"德国牧羊犬","en-US":"German Shepherd"}',
        '{"zh-CN":"德牧 / 黑背","en-US":"GSD / Alsatian"}', 150),
    (16, 1, 100, '{"zh-CN":"比格犬","en-US":"Beagle"}',
        '{"zh-CN":"米格鲁","en-US":"Beagle"}', 160),
    (17, 1, 100, '{"zh-CN":"罗威纳犬","en-US":"Rottweiler"}',
        '{"zh-CN":"罗威纳","en-US":"Rottweiler"}', 170),
    (18, 1, 100, '{"zh-CN":"杜宾犬","en-US":"Doberman"}',
        '{"zh-CN":"杜宾","en-US":"Doberman Pinscher"}', 180),
    (19, 1, 100, '{"zh-CN":"斑点狗","en-US":"Dalmatian"}',
        '{"zh-CN":"达尔马提亚","en-US":"Dalmatian"}', 190),
    (20, 1, 100, '{"zh-CN":"阿拉斯加雪橇犬","en-US":"Alaskan Malamute"}',
        '{"zh-CN":"阿拉斯加","en-US":"Alaskan Malamute"}', 200),
    (21, 1, 100, '{"zh-CN":"大丹犬","en-US":"Great Dane"}',
        '{"zh-CN":"大丹","en-US":"Great Dane"}', 210),
    (22, 1, 100, '{"zh-CN":"圣伯纳犬","en-US":"Saint Bernard"}',
        '{"zh-CN":"圣伯纳","en-US":"Saint Bernard"}', 220),
    (23, 1, 100, '{"zh-CN":"中华田园犬","en-US":"Chinese Rural Dog"}',
        '{"zh-CN":"土狗 / 柴狗","en-US":"Mixed-breed village dog"}', 230),
    (24, 1, 100, '{"zh-CN":"吉娃娃","en-US":"Chihuahua"}',
        '{"zh-CN":"奇瓦瓦","en-US":"Chihuahua"}', 240),
    (25, 1, 100, '{"zh-CN":"马尔济斯","en-US":"Maltese"}',
        '{"zh-CN":"玛尔济斯","en-US":"Maltese"}', 250),
    (26, 1, 100, '{"zh-CN":"雪纳瑞","en-US":"Schnauzer"}',
        '{"zh-CN":"雪纳瑞","en-US":"Schnauzer"}', 260),
    (99, 1, 100, '{"zh-CN":"其他犬种","en-US":"Other Dog Breed"}',
        '{"zh-CN":"未列举犬种","en-US":"Other dog breed"}', 990),
    -- ===== 猫 (f_pet_type_id=2) =====
    (101, 2, 100, '{"zh-CN":"英国短毛猫","en-US":"British Shorthair"}',
        '{"zh-CN":"英短","en-US":"British Shorthair"}', 1010),
    (102, 2, 100, '{"zh-CN":"美国短毛猫","en-US":"American Shorthair"}',
        '{"zh-CN":"美短","en-US":"American Shorthair"}', 1020),
    (103, 2, 100, '{"zh-CN":"布偶猫","en-US":"Ragdoll"}',
        '{"zh-CN":"仙女猫","en-US":"Ragdoll"}', 1030),
    (104, 2, 100, '{"zh-CN":"暹罗猫","en-US":"Siamese"}',
        '{"zh-CN":"泰国猫","en-US":"Siamese"}', 1040),
    (105, 2, 100, '{"zh-CN":"波斯猫","en-US":"Persian"}',
        '{"zh-CN":"波斯","en-US":"Persian"}', 1050),
    (106, 2, 100, '{"zh-CN":"加菲猫","en-US":"Exotic Shorthair"}',
        '{"zh-CN":"异国短毛猫","en-US":"Exotic Shorthair"}', 1060),
    (107, 2, 100, '{"zh-CN":"苏格兰折耳","en-US":"Scottish Fold"}',
        '{"zh-CN":"折耳","en-US":"Scottish Fold"}', 1070),
    (108, 2, 100, '{"zh-CN":"缅因猫","en-US":"Maine Coon"}',
        '{"zh-CN":"大型长毛猫","en-US":"Maine Coon"}', 1080),
    (109, 2, 100, '{"zh-CN":"斯芬克斯猫","en-US":"Sphynx"}',
        '{"zh-CN":"无毛猫","en-US":"Hairless cat"}', 1090),
    (110, 2, 100, '{"zh-CN":"阿比西尼亚猫","en-US":"Abyssinian"}',
        '{"zh-CN":"阿比","en-US":"Abyssinian"}', 1100),
    (111, 2, 100, '{"zh-CN":"孟买猫","en-US":"Bombay"}',
        '{"zh-CN":"小黑豹","en-US":"Bombay"}', 1110),
    (112, 2, 100, '{"zh-CN":"孟加拉豹猫","en-US":"Bengal"}',
        '{"zh-CN":"豹猫","en-US":"Bengal"}', 1120),
    (113, 2, 100, '{"zh-CN":"俄罗斯蓝猫","en-US":"Russian Blue"}',
        '{"zh-CN":"俄蓝","en-US":"Russian Blue"}', 1130),
    (114, 2, 100, '{"zh-CN":"土耳其安哥拉猫","en-US":"Turkish Angora"}',
        '{"zh-CN":"安哥拉","en-US":"Turkish Angora"}', 1140),
    (115, 2, 100, '{"zh-CN":"挪威森林猫","en-US":"Norwegian Forest Cat"}',
        '{"zh-CN":"挪威森林","en-US":"Norwegian Forest"}', 1150),
    (116, 2, 100, '{"zh-CN":"西伯利亚森林猫","en-US":"Siberian"}',
        '{"zh-CN":"西伯利亚","en-US":"Siberian"}', 1160),
    (117, 2, 100, '{"zh-CN":"伯曼猫","en-US":"Birman"}',
        '{"zh-CN":"缅甸圣猫","en-US":"Birman"}', 1170),
    (118, 2, 100, '{"zh-CN":"新加坡猫","en-US":"Singapura"}',
        '{"zh-CN":"新加坡猫","en-US":"Singapura"}', 1180),
    (119, 2, 100, '{"zh-CN":"德文卷毛猫","en-US":"Devon Rex"}',
        '{"zh-CN":"德文","en-US":"Devon Rex"}', 1190),
    (120, 2, 100, '{"zh-CN":"柯尼斯卷毛猫","en-US":"Cornish Rex"}',
        '{"zh-CN":"柯尼斯","en-US":"Cornish Rex"}', 1200),
    (121, 2, 100, '{"zh-CN":"中华田园猫","en-US":"Chinese Li Hua"}',
        '{"zh-CN":"土猫 / 狸花猫","en-US":"Chinese village cat"}', 1210),
    (199, 2, 100, '{"zh-CN":"其他猫种","en-US":"Other Cat Breed"}',
        '{"zh-CN":"未列举猫种","en-US":"Other cat breed"}', 1990),
    (999, -1, 100, '{"zh-CN":"混血/不明","en-US":"Mixed/Unknown"}',
        '{"zh-CN":"混血/品种不明","en-US":"Mixed breed or unknown"}', 9990);


-- ============================================================
-- 1.4 t_gender / 性别 (考虑国际化场景)
-- ============================================================
-- 包含: 男 / 女 / 未知 / 中性(绝育) / 跨性别 / 非二元 / 其他 / 不愿透露
INSERT INTO public.t_gender (f_id, f_ver, f_name, f_desc, f_order) VALUES
    (-1, 100, '{"zh-CN":"未知","en-US":"Unknown"}',
        '{"zh-CN":"未指定","en-US":"Not specified"}', 0),
    ( 1, 100, '{"zh-CN":"公","en-US":"Male"}',
        '{"zh-CN":"雄性 (未绝育)","en-US":"Male (intact)"}', 10),
    ( 2, 100, '{"zh-CN":"母","en-US":"Female"}',
        '{"zh-CN":"雌性 (未绝育)","en-US":"Female (intact)"}', 20),
    ( 3, 100, '{"zh-CN":"公 (已绝育)","en-US":"Neutered Male"}',
        '{"zh-CN":"已去势","en-US":"Neutered / castrated"}', 30),
    ( 4, 100, '{"zh-CN":"母 (已绝育)","en-US":"Spayed Female"}',
        '{"zh-CN":"已绝育","en-US":"Spayed"}', 40),
    ( 5, 100, '{"zh-CN":"中性","en-US":"Neutral"}',
        '{"zh-CN":"性别中性 (绝育后)","en-US":"Gender neutral (post-neuter)"}', 50),
    ( 6, 100, '{"zh-CN":"跨性别","en-US":"Transgender"}',
        '{"zh-CN":"跨性别 (国际通用术语)","en-US":"Transgender"}', 60),
    ( 7, 100, '{"zh-CN":"非二元","en-US":"Non-binary"}',
        '{"zh-CN":"非二元性别","en-US":"Non-binary / Genderqueer"}', 70),
    ( 8, 100, '{"zh-CN":"其他","en-US":"Other"}',
        '{"zh-CN":"其他性别认同","en-US":"Other gender identity"}', 80),
    ( 9, 100, '{"zh-CN":"不愿透露","en-US":"Prefer not to say"}',
        '{"zh-CN":"用户拒绝透露","en-US":"User declined to disclose"}', 90);


-- ============================================================
-- 1.5 t_photo_type / 照片类型 (按拍摄部位 / 角度)
-- ============================================================
INSERT INTO public.t_photo_type (f_id, f_ver, f_name, f_desc, f_order) VALUES
    (-1, 100, '{"zh-CN":"未设置","en-US":"Not Set"}',
        '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    -- 用途大类
    ( 1, 100, '{"zh-CN":"头像","en-US":"Avatar"}',
        '{"zh-CN":"用户/宠物头像","en-US":"Profile avatar"}', 10),
    ( 2, 100, '{"zh-CN":"封面","en-US":"Cover"}',
        '{"zh-CN":"相册/报告封面","en-US":"Album / report cover"}', 20),
    ( 3, 100, '{"zh-CN":"日常照","en-US":"Daily Life"}',
        '{"zh-CN":"日常生活记录","en-US":"Daily snapshot"}', 30),
    ( 4, 100, '{"zh-CN":"证件照","en-US":"ID Photo"}',
        '{"zh-CN":"身份证/护照/检疫证","en-US":"ID / passport / vaccine cert"}', 40),
    -- 拍摄角度
    (10, 100, '{"zh-CN":"全身","en-US":"Full Body"}',
        '{"zh-CN":"全身像","en-US":"Full body shot"}', 100),
    (11, 100, '{"zh-CN":"正面","en-US":"Front View"}',
        '{"zh-CN":"正面视角","en-US":"Front view"}', 110),
    (12, 100, '{"zh-CN":"侧面","en-US":"Side View"}',
        '{"zh-CN":"侧面视角","en-US":"Side / profile view"}', 120),
    (13, 100, '{"zh-CN":"背面","en-US":"Back View"}',
        '{"zh-CN":"背面视角","en-US":"Back view"}', 130),
    (14, 100, '{"zh-CN":"俯视","en-US":"Top View"}',
        '{"zh-CN":"俯视角度","en-US":"Top-down view"}', 140),
    -- 局部特写
    (20, 100, '{"zh-CN":"脸部特写","en-US":"Face Close-up"}',
        '{"zh-CN":"脸部特写 (表情分析)","en-US":"Face close-up"}', 200),
    (21, 100, '{"zh-CN":"眼睛特写","en-US":"Eye Close-up"}',
        '{"zh-CN":"眼睛特写 (健康分析)","en-US":"Eye close-up"}', 210),
    (22, 100, '{"zh-CN":"耳朵特写","en-US":"Ear Close-up"}',
        '{"zh-CN":"耳朵特写","en-US":"Ear close-up"}', 220),
    (23, 100, '{"zh-CN":"鼻部特写","en-US":"Nose Close-up"}',
        '{"zh-CN":"鼻头/口鼻特写","en-US":"Nose close-up"}', 230),
    (24, 100, '{"zh-CN":"嘴部特写","en-US":"Mouth Close-up"}',
        '{"zh-CN":"嘴部/牙齿特写","en-US":"Mouth / teeth close-up"}', 240),
    (25, 100, '{"zh-CN":"爪部特写","en-US":"Paw Close-up"}',
        '{"zh-CN":"爪子/肉垫特写","en-US":"Paw close-up"}', 250),
    (26, 100, '{"zh-CN":"尾巴","en-US":"Tail"}',
        '{"zh-CN":"尾巴 (情绪分析)","en-US":"Tail"}', 260),
    (27, 100, '{"zh-CN":"毛发","en-US":"Coat"}',
        '{"zh-CN":"毛色/毛质特写","en-US":"Coat / fur close-up"}', 270),
    (28, 100, '{"zh-CN":"皮肤","en-US":"Skin"}',
        '{"zh-CN":"皮肤特写 (皮肤病检测)","en-US":"Skin close-up"}', 280),
    -- 场景
    (40, 100, '{"zh-CN":"合照","en-US":"Group Photo"}',
        '{"zh-CN":"多宠合照 / 与主人合照","en-US":"Group / owner-with-pet"}', 400),
    (41, 100, '{"zh-CN":"活动现场","en-US":"Event Photo"}',
        '{"zh-CN":"活动/比赛现场","en-US":"At event / show"}', 410),
    (42, 100, '{"zh-CN":"医院","en-US":"Vet Clinic"}',
        '{"zh-CN":"医院就诊记录","en-US":"At vet clinic"}', 420),
    (99, 100, '{"zh-CN":"其他","en-US":"Other"}',
        '{"zh-CN":"其他类型","en-US":"Other photo type"}', 990);


-- ============================================================
-- 1.6 t_report_type / 报告类型
-- ============================================================
INSERT INTO public.t_report_type (f_id, f_ver, f_name, f_desc, f_order) VALUES
    (-1, 100, '{"zh-CN":"未设置","en-US":"Not Set"}',
        '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, '{"zh-CN":"情绪分析","en-US":"Emotion Analysis"}',
        '{"zh-CN":"宠物情绪/表情分析报告","en-US":"Pet emotion / expression analysis"}', 10),
    ( 2, 100, '{"zh-CN":"健康评估","en-US":"Health Assessment"}',
        '{"zh-CN":"宠物健康综合评估报告","en-US":"Pet health assessment"}', 20),
    ( 3, 100, '{"zh-CN":"人宠风险","en-US":"Human-Pet Risk"}',
        '{"zh-CN":"人宠相处风险评估","en-US":"Human-pet interaction risk"}', 30),
    ( 4, 100, '{"zh-CN":"性格画像","en-US":"Personality Profile"}',
        '{"zh-CN":"宠物性格画像报告","en-US":"Pet personality profile"}', 40),
    ( 5, 100, '{"zh-CN":"行为分析","en-US":"Behavior Analysis"}',
        '{"zh-CN":"行为习惯/异常分析","en-US":"Behavior / anomaly analysis"}', 50),
    ( 6, 100, '{"zh-CN":"饮食建议","en-US":"Diet Recommendation"}',
        '{"zh-CN":"基于体征的饮食建议","en-US":"Diet recommendation"}', 60),
    ( 7, 100, '{"zh-CN":"训练计划","en-US":"Training Plan"}',
        '{"zh-CN":"个性化训练计划","en-US":"Personalized training plan"}', 70),
    (99, 100, '{"zh-CN":"其他报告","en-US":"Other Report"}',
        '{"zh-CN":"未列举报告类型","en-US":"Other report type"}', 990);


-- ============================================================
-- 1.7 t_risk_level / 风险等级
-- ============================================================
INSERT INTO public.t_risk_level (f_id, f_ver, f_name, f_desc, f_order) VALUES
    (-1, 100, '{"zh-CN":"未设置","en-US":"Not Set"}',
        '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, '{"zh-CN":"极低","en-US":"Very Low"}',
        '{"zh-CN":"几乎无风险","en-US":"Negligible risk"}', 10),
    ( 2, 100, '{"zh-CN":"低","en-US":"Low"}',
        '{"zh-CN":"轻度风险","en-US":"Low risk"}', 20),
    ( 3, 100, '{"zh-CN":"中","en-US":"Medium"}',
        '{"zh-CN":"中等风险","en-US":"Moderate risk"}', 30),
    ( 4, 100, '{"zh-CN":"高","en-US":"High"}',
        '{"zh-CN":"高风险","en-US":"High risk"}', 40),
    ( 5, 100, '{"zh-CN":"极高","en-US":"Very High"}',
        '{"zh-CN":"严重风险","en-US":"Severe risk"}', 50),
    ( 6, 100, '{"zh-CN":"紧急","en-US":"Critical"}',
        '{"zh-CN":"需立即处理","en-US":"Immediate action required"}', 60);


-- ============================================================
-- 1.8 t_health_level / 健康等级
-- ============================================================
INSERT INTO public.t_health_level (f_id, f_ver, f_code, f_name, f_desc, f_order) VALUES
    (-1, 100, 'NOT-SET',  '{"zh-CN":"未设置","en-US":"Not Set"}',
        '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, 'excellent','{"zh-CN":"优秀","en-US":"Excellent"}',
        '{"zh-CN":"健康状况极佳","en-US":"Optimal health"}', 10),
    ( 2, 100, 'good',     '{"zh-CN":"良好","en-US":"Good"}',
        '{"zh-CN":"健康状况良好","en-US":"Generally healthy"}', 20),
    ( 3, 100, 'fair',     '{"zh-CN":"一般","en-US":"Fair"}',
        '{"zh-CN":"健康状况一般, 需关注","en-US":"Needs attention"}', 30),
    ( 4, 100, 'poor',     '{"zh-CN":"较差","en-US":"Poor"}',
        '{"zh-CN":"健康状况较差","en-US":"Suboptimal"}', 40),
    ( 5, 100, 'severe',   '{"zh-CN":"严重","en-US":"Severe"}',
        '{"zh-CN":"需立即就医","en-US":"Critical, seek vet care"}', 50);


-- ============================================================
-- 1.9 t_status / 通用状态 (1=pending 10=active 20=archived 30=disabled 40=deleted)
-- ============================================================
INSERT INTO public.t_status (f_id, f_ver, f_name, f_desc, f_order) VALUES
    (-1, 100, '{"zh-CN":"未设置","en-US":"Not Set"}',
        '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, '{"zh-CN":"待处理","en-US":"Pending"}',
        '{"zh-CN":"等待审核/激活","en-US":"Awaiting review / activation"}', 10),
    (10, 100, '{"zh-CN":"激活","en-US":"Active"}',
        '{"zh-CN":"正常使用中","en-US":"Active / in use"}', 100),
    (20, 100, '{"zh-CN":"已归档","en-US":"Archived"}',
        '{"zh-CN":"已归档 (历史记录)","en-US":"Archived (historical)"}', 200),
    (30, 100, '{"zh-CN":"已停用","en-US":"Disabled"}',
        '{"zh-CN":"已停用 (非删除)","en-US":"Disabled (not deleted)"}', 300),
    (40, 100, '{"zh-CN":"已删除","en-US":"Deleted"}',
        '{"zh-CN":"已软删除","en-US":"Soft deleted"}', 400);


-- ============================================================
-- 1.10 t_personality_tag / 个性标签 (可选参考枚举)
-- ============================================================
INSERT INTO public.t_personality_tag (f_id, f_ver, f_name, f_desc, f_order) VALUES
    (-1, 100, '{"zh-CN":"未设置","en-US":"Not Set"}', '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    -- 性格维度
    ( 1, 100, '{"zh-CN":"活泼","en-US":"Lively"}',  '{"zh-CN":"精力旺盛","en-US":"Energetic"}', 10),
    ( 2, 100, '{"zh-CN":"温顺","en-US":"Gentle"}',  '{"zh-CN":"性格温和","en-US":"Mild-mannered"}', 20),
    ( 3, 100, '{"zh-CN":"黏人","en-US":"Clingy"}',  '{"zh-CN":"喜欢亲近人","en-US":"Affectionate"}', 30),
    ( 4, 100, '{"zh-CN":"独立","en-US":"Independent"}', '{"zh-CN":"独处能力强","en-US":"Self-sufficient"}', 40),
    ( 5, 100, '{"zh-CN":"胆大","en-US":"Bold"}',     '{"zh-CN":"不畏陌生环境","en-US":"Fearless"}', 50),
    ( 6, 100, '{"zh-CN":"胆怯","en-US":"Shy"}',      '{"zh-CN":"怕生","en-US":"Timid"}', 60),
    ( 7, 100, '{"zh-CN":"好奇","en-US":"Curious"}',  '{"zh-CN":"探索欲强","en-US":"Inquisitive"}', 70),
    ( 8, 100, '{"zh-CN":"好斗","en-US":"Aggressive"}','{"zh-CN":"具攻击性","en-US":"Territorial"}', 80),
    ( 9, 100, '{"zh-CN":"聪明","en-US":"Intelligent"}','{"zh-CN":"学习能力强","en-US":"Quick learner"}', 90),
    (10, 100, '{"zh-CN":"贪吃","en-US":"Food-motivated"}','{"zh-CN":"对食物敏感","en-US":"Food-driven"}', 100),
    (11, 100, '{"zh-CN":"爱叫","en-US":"Vocal"}',    '{"zh-CN":"喜欢叫","en-US":"Talkative"}', 110),
    (12, 100, '{"zh-CN":"安静","en-US":"Quiet"}',    '{"zh-CN":"较少发声","en-US":"Reserved"}', 120),
    (13, 100, '{"zh-CN":"亲人","en-US":"People-friendly"}','{"zh-CN":"对陌生人友好","en-US":"Outgoing"}', 130),
    (14, 100, '{"zh-CN":"护主","en-US":"Protective"}','{"zh-CN":"对主人保护欲强","en-US":"Loyal guardian"}', 140),
    (99, 100, '{"zh-CN":"其他","en-US":"Other"}',    '{"zh-CN":"自定义标签","en-US":"Custom tag"}', 990);


-- ============================================================
-- 1.11 t_plan_type / 套餐类型
-- ============================================================
INSERT INTO public.t_plan_type (f_id, f_ver, f_name, f_desc, f_order) VALUES
    (-1, 100, '{"zh-CN":"未设置","en-US":"Not Set"}',  '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, '{"zh-CN":"免费版","en-US":"Free"}',
        '{"zh-CN":"免费套餐 (基础功能)","en-US":"Free tier (basic)"}', 10),
    ( 2, 100, '{"zh-CN":"基础版","en-US":"Basic"}',
        '{"zh-CN":"基础订阅","en-US":"Basic subscription"}', 20),
    ( 3, 100, '{"zh-CN":"专业版","en-US":"Pro"}',
        '{"zh-CN":"专业订阅 (高级 AI)","en-US":"Pro subscription"}', 30),
    ( 4, 100, '{"zh-CN":"家庭版","en-US":"Family"}',
        '{"zh-CN":"家庭共享版","en-US":"Family shared"}', 40),
    ( 5, 100, '{"zh-CN":"企业版","en-US":"Enterprise"}',
        '{"zh-CN":"企业定制","en-US":"Enterprise plan"}', 50),
    ( 6, 100, '{"zh-CN":"学生版","en-US":"Student"}',
        '{"zh-CN":"学生优惠","en-US":"Student discount"}', 60),
    ( 7, 100, '{"zh-CN":"试用版","en-US":"Trial"}',
        '{"zh-CN":"试用套餐","en-US":"Trial plan"}', 70),
    ( 8, 100, '{"zh-CN":"礼品版","en-US":"Gift"}',
        '{"zh-CN":"礼品赠送","en-US":"Gift subscription"}', 80),
    ( 9, 100, '{"zh-CN":"限时优惠","en-US":"Promo"}',
        '{"zh-CN":"促销活动","en-US":"Promotional"}', 90);


-- ============================================================
-- 1.12 t_payment_status / 支付状态
-- ============================================================
INSERT INTO public.t_payment_status (f_id, f_ver, f_code, f_name, f_desc, f_order) VALUES
    (-1, 100, 'NOT-SET',  '{"zh-CN":"未设置","en-US":"Not Set"}', '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, 'pending',  '{"zh-CN":"待支付","en-US":"Pending"}',
        '{"zh-CN":"等待用户支付","en-US":"Awaiting payment"}', 10),
    ( 2, 100, 'processing','{"zh-CN":"处理中","en-US":"Processing"}',
        '{"zh-CN":"支付处理中","en-US":"Payment in progress"}', 20),
    (10, 100, 'paid',     '{"zh-CN":"已支付","en-US":"Paid"}',
        '{"zh-CN":"支付成功","en-US":"Payment successful"}', 100),
    (20, 100, 'refunded', '{"zh-CN":"已退款","en-US":"Refunded"}',
        '{"zh-CN":"已全额退款","en-US":"Fully refunded"}', 200),
    (21, 100, 'partial_refund','{"zh-CN":"部分退款","en-US":"Partially Refunded"}',
        '{"zh-CN":"已部分退款","en-US":"Partially refunded"}', 210),
    (30, 100, 'failed',   '{"zh-CN":"支付失败","en-US":"Failed"}',
        '{"zh-CN":"支付失败","en-US":"Payment failed"}', 300),
    (40, 100, 'cancelled','{"zh-CN":"已取消","en-US":"Cancelled"}',
        '{"zh-CN":"已取消支付","en-US":"Payment cancelled"}', 400),
    (50, 100, 'expired',  '{"zh-CN":"已超时","en-US":"Expired"}',
        '{"zh-CN":"支付超时关闭","en-US":"Payment timeout"}', 500);


-- ============================================================
-- 1.13 t_shipping_status / 物流状态
-- ============================================================
INSERT INTO public.t_shipping_status (f_id, f_ver, f_code, f_name, f_desc, f_order) VALUES
    (-1, 100, 'NOT-SET',    '{"zh-CN":"未设置","en-US":"Not Set"}',  '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, 'unshipped',  '{"zh-CN":"待发货","en-US":"Unshipped"}',
        '{"zh-CN":"仓库未发货","en-US":"Awaiting shipment"}', 10),
    ( 2, 100, 'preparing',  '{"zh-CN":"配货中","en-US":"Preparing"}',
        '{"zh-CN":"仓库备货中","en-US":"Picking & packing"}', 20),
    (10, 100, 'shipped',    '{"zh-CN":"已发货","en-US":"Shipped"}',
        '{"zh-CN":"已交付承运商","en-US":"Handed to carrier"}', 100),
    (20, 100, 'in_transit', '{"zh-CN":"运输中","en-US":"In Transit"}',
        '{"zh-CN":"运输途中","en-US":"In transit"}', 200),
    (30, 100, 'out_for_delivery','{"zh-CN":"派送中","en-US":"Out for Delivery"}',
        '{"zh-CN":"快递员派送中","en-US":"Out for delivery"}', 300),
    (40, 100, 'delivered',  '{"zh-CN":"已签收","en-US":"Delivered"}',
        '{"zh-CN":"用户已签收","en-US":"Delivered to recipient"}', 400),
    (50, 100, 'failed',     '{"zh-CN":"派送失败","en-US":"Delivery Failed"}',
        '{"zh-CN":"派送失败","en-US":"Delivery attempt failed"}', 500),
    (60, 100, 'returned',   '{"zh-CN":"已退回","en-US":"Returned"}',
        '{"zh-CN":"已退回发件人","en-US":"Returned to sender"}', 600),
    (70, 100, 'cancelled',  '{"zh-CN":"已取消","en-US":"Cancelled"}',
        '{"zh-CN":"物流已取消","en-US":"Shipment cancelled"}', 700);


-- ============================================================
-- 1.14 t_sync_status / 设备同步状态
-- ============================================================
INSERT INTO public.t_sync_status (f_id, f_ver, f_code, f_name, f_desc, f_order) VALUES
    (-1, 100, 'NOT-SET', '{"zh-CN":"未设置","en-US":"Not Set"}',  '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, 'pending', '{"zh-CN":"待同步","en-US":"Pending"}',
        '{"zh-CN":"等待同步","en-US":"Awaiting sync"}', 10),
    (10, 100, 'syncing', '{"zh-CN":"同步中","en-US":"Syncing"}',
        '{"zh-CN":"正在同步","en-US":"Sync in progress"}', 100),
    (20, 100, 'success', '{"zh-CN":"同步成功","en-US":"Success"}',
        '{"zh-CN":"同步完成","en-US":"Sync completed"}', 200),
    (30, 100, 'failed',  '{"zh-CN":"同步失败","en-US":"Failed"}',
        '{"zh-CN":"同步失败 (可重试)","en-US":"Sync failed (retryable)"}', 300),
    (40, 100, 'skipped', '{"zh-CN":"已跳过","en-US":"Skipped"}',
        '{"zh-CN":"跳过本次同步","en-US":"Sync skipped"}', 400),
    (50, 100, 'cancelled','{"zh-CN":"已取消","en-US":"Cancelled"}',
        '{"zh-CN":"已取消同步","en-US":"Sync cancelled"}', 500);


-- ============================================================
-- 1.15 t_inventory_status / 库存状态
-- ============================================================
INSERT INTO public.t_inventory_status (f_id, f_ver, f_code, f_name, f_desc, f_order) VALUES
    (-1, 100, 'NOT-SET',         '{"zh-CN":"未设置","en-US":"Not Set"}',  '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, 'in_stock',        '{"zh-CN":"现货","en-US":"In Stock"}',
        '{"zh-CN":"库存充足","en-US":"Sufficient stock"}', 10),
    ( 2, 100, 'low_stock',       '{"zh-CN":"低库存","en-US":"Low Stock"}',
        '{"zh-CN":"低于预警值","en-US":"Below threshold"}', 20),
    ( 3, 100, 'out_of_stock',    '{"zh-CN":"缺货","en-US":"Out of Stock"}',
        '{"zh-CN":"暂时缺货","en-US":"Temporarily unavailable"}', 30),
    ( 4, 100, 'preorder',        '{"zh-CN":"预售","en-US":"Pre-order"}',
        '{"zh-CN":"预售中","en-US":"Pre-order available"}', 40),
    ( 5, 100, 'discontinued',    '{"zh-CN":"停产","en-US":"Discontinued"}',
        '{"zh-CN":"已停产","en-US":"No longer produced"}', 50),
    ( 6, 100, 'clearance',       '{"zh-CN":"清仓","en-US":"Clearance"}',
        '{"zh-CN":"清仓处理","en-US":"Final sale"}', 60);


-- ============================================================
-- 1.16 t_inventory_serial_status / 库存单品序列号状态
-- ============================================================
INSERT INTO public.t_inventory_serial_status (f_id, f_ver, f_code, f_name, f_desc, f_order) VALUES
    (-1, 100, 'NOT-SET',  '{"zh-CN":"未设置","en-US":"Not Set"}',     '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, 'in_stock', '{"zh-CN":"在库","en-US":"In Stock"}',
        '{"zh-CN":"序列号在库","en-US":"Serial in inventory"}', 10),
    (10, 100, 'sold',     '{"zh-CN":"已售","en-US":"Sold"}',
        '{"zh-CN":"已售出","en-US":"Sold to customer"}', 100),
    (20, 100, 'returned', '{"zh-CN":"已退","en-US":"Returned"}',
        '{"zh-CN":"已退回","en-US":"Returned by customer"}', 200),
    (30, 100, 'damaged',  '{"zh-CN":"损坏","en-US":"Damaged"}',
        '{"zh-CN":"已损坏","en-US":"Damaged in stock"}', 300),
    (40, 100, 'lost',     '{"zh-CN":"报失","en-US":"Lost"}',
        '{"zh-CN":"报失","en-US":"Reported lost"}', 400),
    (50, 100, 'repairing','{"zh-CN":"维修中","en-US":"Under Repair"}',
        '{"zh-CN":"维修中","en-US":"Under repair"}', 500),
    (60, 100, 'scrapped', '{"zh-CN":"已报废","en-US":"Scrapped"}',
        '{"zh-CN":"已报废","en-US":"Scrapped / written off"}', 600);


-- ============================================================
-- 1.17 t_adoption_type / 领养类型
-- ============================================================
INSERT INTO public.t_adoption_type (f_id, f_ver, f_code, f_name, f_desc, f_order) VALUES
    (-1, 100, 'NOT-SET',  '{"zh-CN":"未设置","en-US":"Not Set"}',     '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, 'give',     '{"zh-CN":"送养","en-US":"Give Away"}',
        '{"zh-CN":"送养方","en-US":"Pet given for adoption"}', 10),
    ( 2, 100, 'apply',    '{"zh-CN":"领养申请","en-US":"Apply"}',
        '{"zh-CN":"领养方","en-US":"Adoption application"}', 20);


-- ============================================================
-- 1.18 t_volunteer_type / 志愿者类型
-- ============================================================
INSERT INTO public.t_volunteer_type (f_id, f_ver, f_code, f_name, f_desc, f_order) VALUES
    (-1, 100, 'NOT-SET',   '{"zh-CN":"未设置","en-US":"Not Set"}',          '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, 'rescue',    '{"zh-CN":"救助","en-US":"Rescue"}',
        '{"zh-CN":"现场救助","en-US":"On-site rescue"}', 10),
    ( 2, 100, 'adoption',  '{"zh-CN":"送养协助","en-US":"Adoption"}',
        '{"zh-CN":"送养流程协助","en-US":"Adoption assistance"}', 20),
    ( 3, 100, 'translate', '{"zh-CN":"翻译","en-US":"Translation"}',
        '{"zh-CN":"多语种翻译","en-US":"Multilingual translation"}', 30),
    ( 4, 100, 'photo',     '{"zh-CN":"拍照","en-US":"Photography"}',
        '{"zh-CN":"宠物摄影","en-US":"Pet photography"}', 40),
    ( 5, 100, 'transport', '{"zh-CN":"运送","en-US":"Transportation"}',
        '{"zh-CN":"宠物运送","en-US":"Pet transport"}', 50),
    ( 6, 100, 'foster',    '{"zh-CN":"暂养","en-US":"Foster Care"}',
        '{"zh-CN":"短期寄养","en-US":"Short-term foster"}', 60),
    ( 7, 100, 'fundraise', '{"zh-CN":"募捐","en-US":"Fundraising"}',
        '{"zh-CN":"资金/物资募集","en-US":"Funds & supplies"}', 70),
    ( 8, 100, 'training',  '{"zh-CN":"培训","en-US":"Training"}',
        '{"zh-CN":"宠物行为培训","en-US":"Pet training"}', 80),
    ( 9, 100, 'promotion', '{"zh-CN":"宣传","en-US":"Promotion"}',
        '{"zh-CN":"公益宣传","en-US":"Publicity"}', 90),
    (10, 100, 'medical',   '{"zh-CN":"医疗协助","en-US":"Medical Aid"}',
        '{"zh-CN":"医疗陪护/翻译","en-US":"Medical companion"}', 100);


-- ============================================================
-- 1.19 t_share_type / 分享类型
-- ============================================================
INSERT INTO public.t_share_type (f_id, f_ver, f_code, f_name, f_desc, f_order) VALUES
    (-1, 100, 'NOT-SET',           '{"zh-CN":"未设置","en-US":"Not Set"}',         '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, 'report_emotion',    '{"zh-CN":"情绪报告","en-US":"Emotion Report"}',
        '{"zh-CN":"情绪分析报告","en-US":"Emotion analysis report"}', 10),
    ( 2, 100, 'report_health',     '{"zh-CN":"健康报告","en-US":"Health Report"}',
        '{"zh-CN":"健康评估报告","en-US":"Health assessment report"}', 20),
    ( 3, 100, 'report_hpr',        '{"zh-CN":"人宠风险报告","en-US":"Human-Pet Risk Report"}',
        '{"zh-CN":"人宠相处风险报告","en-US":"Human-pet risk report"}', 30),
    ( 4, 100, 'report_personality','{"zh-CN":"性格报告","en-US":"Personality Report"}',
        '{"zh-CN":"性格画像报告","en-US":"Personality profile report"}', 40),
    ( 5, 100, 'post',              '{"zh-CN":"动态","en-US":"Post"}',
        '{"zh-CN":"社区动态","en-US":"Social post"}', 50),
    ( 6, 100, 'pet_profile',       '{"zh-CN":"宠物档案","en-US":"Pet Profile"}',
        '{"zh-CN":"宠物公开档案","en-US":"Public pet profile"}', 60),
    ( 7, 100, 'lost_pet',          '{"zh-CN":"寻宠启事","en-US":"Lost Pet Notice"}',
        '{"zh-CN":"寻宠启事","en-US":"Lost pet notice"}', 70),
    ( 8, 100, 'rescue',            '{"zh-CN":"救助申请","en-US":"Rescue Request"}',
        '{"zh-CN":"救助申请","en-US":"Rescue request"}', 80),
    ( 9, 100, 'adoption',          '{"zh-CN":"领养信息","en-US":"Adoption Post"}',
        '{"zh-CN":"领养信息","en-US":"Adoption info"}', 90),
    (10, 100, 'activity',          '{"zh-CN":"活动","en-US":"Activity"}',
        '{"zh-CN":"活动邀请","en-US":"Activity invite"}', 100),
    (11, 100, 'product',           '{"zh-CN":"商品","en-US":"Product"}',
        '{"zh-CN":"商品分享","en-US":"Product share"}', 110),
    (12, 100, 'voice',             '{"zh-CN":"语音解读","en-US":"Voice Insight"}',
        '{"zh-CN":"AI 语音解读","en-US":"AI voice insight"}', 120);


-- ============================================================
-- 1.20 t_share_channel / 分享渠道
-- ============================================================
INSERT INTO public.t_share_channel (f_id, f_ver, f_code, f_name, f_desc, f_order) VALUES
    (-1, 100, 'NOT-SET',     '{"zh-CN":"未设置","en-US":"Not Set"}',         '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    -- 国内
    ( 1, 100, 'wechat',      '{"zh-CN":"微信好友","en-US":"WeChat Friend"}',
        '{"zh-CN":"微信好友/群","en-US":"WeChat friend / group"}', 10),
    ( 2, 100, 'moments',     '{"zh-CN":"朋友圈","en-US":"WeChat Moments"}',
        '{"zh-CN":"微信朋友圈","en-US":"WeChat Moments"}', 20),
    ( 3, 100, 'wechat_mini', '{"zh-CN":"微信小程序","en-US":"WeChat Mini Program"}',
        '{"zh-CN":"微信小程序内分享","en-US":"In WeChat mini program"}', 30),
    ( 4, 100, 'qq',          '{"zh-CN":"QQ","en-US":"QQ"}',
        '{"zh-CN":"QQ 好友/群","en-US":"QQ friend / group"}', 40),
    ( 5, 100, 'weibo',       '{"zh-CN":"微博","en-US":"Weibo"}',
        '{"zh-CN":"新浪微博","en-US":"Sina Weibo"}', 50),
    ( 6, 100, 'douyin',      '{"zh-CN":"抖音","en-US":"Douyin / TikTok"}',
        '{"zh-CN":"抖音 / TikTok","en-US":"Douyin / TikTok"}', 60),
    ( 7, 100, 'xiaohongshu', '{"zh-CN":"小红书","en-US":"Xiaohongshu"}',
        '{"zh-CN":"小红书","en-US":"RED (Xiaohongshu)"}', 70),
    -- 国际
    (10, 100, 'twitter',     '{"zh-CN":"Twitter","en-US":"Twitter / X"}',
        '{"zh-CN":"Twitter / X","en-US":"Twitter / X"}', 100),
    (11, 100, 'facebook',    '{"zh-CN":"Facebook","en-US":"Facebook"}',
        '{"zh-CN":"Facebook","en-US":"Facebook"}', 110),
    (12, 100, 'instagram',   '{"zh-CN":"Instagram","en-US":"Instagram"}',
        '{"zh-CN":"Instagram","en-US":"Instagram"}', 120),
    (13, 100, 'whatsapp',    '{"zh-CN":"WhatsApp","en-US":"WhatsApp"}',
        '{"zh-CN":"WhatsApp","en-US":"WhatsApp"}', 130),
    (14, 100, 'telegram',    '{"zh-CN":"Telegram","en-US":"Telegram"}',
        '{"zh-CN":"Telegram","en-US":"Telegram"}', 140),
    (15, 100, 'line',        '{"zh-CN":"LINE","en-US":"LINE"}',
        '{"zh-CN":"LINE (日本/台湾)","en-US":"LINE (JP/TW)"}', 150),
    -- 系统
    (20, 100, 'copy_link',   '{"zh-CN":"复制链接","en-US":"Copy Link"}',
        '{"zh-CN":"复制链接","en-US":"Copy link to clipboard"}', 200),
    (21, 100, 'qr_code',     '{"zh-CN":"二维码","en-US":"QR Code"}',
        '{"zh-CN":"生成二维码","en-US":"Generate QR code"}', 210),
    (22, 100, 'in_app',      '{"zh-CN":"站内","en-US":"In-App"}',
        '{"zh-CN":"APP 内部","en-US":"In-app share"}', 220),
    (23, 100, 'sms',         '{"zh-CN":"短信","en-US":"SMS"}',
        '{"zh-CN":"短信分享","en-US":"SMS"}', 230),
    (24, 100, 'email',       '{"zh-CN":"邮件","en-US":"Email"}',
        '{"zh-CN":"邮件分享","en-US":"Email"}', 240);


-- ============================================================
-- 1.21 t_activity_type / 活动类型
-- ============================================================
INSERT INTO public.t_activity_type (f_id, f_ver, f_code, f_name, f_desc, f_order) VALUES
    (-1, 100, 'NOT-SET',     '{"zh-CN":"未设置","en-US":"Not Set"}',       '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, 'adoption',    '{"zh-CN":"领养活动","en-US":"Adoption"}',
        '{"zh-CN":"线下领养","en-US":"Adoption event"}', 10),
    ( 2, 100, 'lecture',     '{"zh-CN":"讲座","en-US":"Lecture"}',
        '{"zh-CN":"宠物知识讲座","en-US":"Pet care lecture"}', 20),
    ( 3, 100, 'volunteer',   '{"zh-CN":"志愿者活动","en-US":"Volunteer"}',
        '{"zh-CN":"志愿者招募","en-US":"Volunteer recruitment"}', 30),
    ( 4, 100, 'exhibition',  '{"zh-CN":"展览","en-US":"Exhibition"}',
        '{"zh-CN":"宠物展 / 博览会","en-US":"Pet expo / exhibition"}', 40),
    ( 5, 100, 'offline',     '{"zh-CN":"线下聚会","en-US":"Offline Meetup"}',
        '{"zh-CN":"同城线下聚会","en-US":"Local meetup"}', 50),
    ( 6, 100, 'online',      '{"zh-CN":"线上直播","en-US":"Online Live"}',
        '{"zh-CN":"线上直播活动","en-US":"Online livestream"}', 60),
    ( 7, 100, 'training',    '{"zh-CN":"培训","en-US":"Training"}',
        '{"zh-CN":"宠物行为培训","en-US":"Pet training"}', 70),
    ( 8, 100, 'competition', '{"zh-CN":"比赛","en-US":"Competition"}',
        '{"zh-CN":"宠物比赛","en-US":"Pet competition"}', 80),
    ( 9, 100, 'charity',     '{"zh-CN":"公益活动","en-US":"Charity"}',
        '{"zh-CN":"公益慈善","en-US":"Charity event"}', 90),
    (10, 100, 'festival',    '{"zh-CN":"节日活动","en-US":"Festival"}',
        '{"zh-CN":"节日主题活动","en-US":"Festival-themed"}', 100);


-- ============================================================
-- 1.22 t_subscription_type / 订阅类型
-- ============================================================
INSERT INTO public.t_subscription_type (f_id, f_ver, f_code, f_name, f_desc, f_order) VALUES
    (-1, 100, 'NOT-SET',  '{"zh-CN":"未设置","en-US":"Not Set"}',     '{"zh-CN":"占位符","en-US":"Sentinel"}', 0),
    ( 1, 100, 'trial',    '{"zh-CN":"试用","en-US":"Trial"}',
        '{"zh-CN":"免费试用","en-US":"Free trial"}', 10),
    ( 2, 100, 'paid',     '{"zh-CN":"付费","en-US":"Paid"}',
        '{"zh-CN":"付费订阅","en-US":"Paid subscription"}', 20),
    ( 3, 100, 'gift',     '{"zh-CN":"礼品","en-US":"Gift"}',
        '{"zh-CN":"礼品赠送","en-US":"Gift subscription"}', 30),
    ( 4, 100, 'promo',    '{"zh-CN":"促销","en-US":"Promo"}',
        '{"zh-CN":"促销活动","en-US":"Promotional offer"}', 40),
    ( 5, 100, 'family',   '{"zh-CN":"家庭共享","en-US":"Family"}',
        '{"zh-CN":"家庭共享套餐","en-US":"Family shared"}', 50),
    ( 6, 100, 'student',  '{"zh-CN":"学生","en-US":"Student"}',
        '{"zh-CN":"学生优惠","en-US":"Student discount"}', 60),
    ( 7, 100, 'enterprise','{"zh-CN":"企业","en-US":"Enterprise"}',
        '{"zh-CN":"企业账号","en-US":"Enterprise account"}', 70),
    ( 8, 100, 'lifetime', '{"zh-CN":"终身","en-US":"Lifetime"}',
        '{"zh-CN":"终身订阅","en-US":"Lifetime subscription"}', 80),
    ( 9, 100, 'limited',  '{"zh-CN":"限时","en-US":"Limited"}',
        '{"zh-CN":"限时订阅","en-US":"Limited time"}', 90);


-- ============================================================
-- 1.23 t_banner_type / Banner 跳转类型
-- ============================================================
-- f_id: -1=NOT-SET, 1=product(商品), 2=activity(活动), 3=subscription(订阅套餐),
--       4=external(外部链接), 5=page(站内页面), 6=none(无跳转)
INSERT INTO public.t_banner_type (f_id, f_ver, f_code, f_name, f_order) VALUES
    (-1, 100, 'NOT-SET',      '{"zh-CN":"未设置","en-US":"Not Set"}',            0),
    ( 1, 100, 'product',      '{"zh-CN":"商品详情","en-US":"Product"}',           10),
    ( 2, 100, 'activity',     '{"zh-CN":"活动页","en-US":"Activity"}',            20),
    ( 3, 100, 'subscription', '{"zh-CN":"订阅套餐","en-US":"Subscription Plan"}', 30),
    ( 4, 100, 'external',     '{"zh-CN":"外部链接","en-US":"External URL"}',      40),
    ( 5, 100, 'page',         '{"zh-CN":"站内页面","en-US":"In-app Page"}',       50),
    ( 6, 100, 'none',         '{"zh-CN":"无跳转","en-US":"None"}',                60);


-- ============================================================
-- 1.24 t_usage_type / 用量记录类型
-- ============================================================
-- f_id: -1=NOT-SET, 1=report(AI报告), 2=chat(AI聊天), 3=analysis(图像分析),
--        4=voice(语音解读), 5=export(导出), 6=api(API调用), 7=share(分享), 8=other(其他)
INSERT INTO public.t_usage_type (f_id, f_ver, f_code, f_name, f_order) VALUES
    (-1, 100, 'NOT-SET',  '{"zh-CN":"未设置","en-US":"Not Set"}',          0),
    ( 1, 100, 'report',   '{"zh-CN":"AI 报告","en-US":"AI Report"}',      10),
    ( 2, 100, 'chat',     '{"zh-CN":"AI 聊天","en-US":"AI Chat"}',        20),
    ( 3, 100, 'analysis', '{"zh-CN":"图像分析","en-US":"Image Analysis"}', 30),
    ( 4, 100, 'voice',    '{"zh-CN":"语音解读","en-US":"Voice Insight"}',  40),
    ( 5, 100, 'export',   '{"zh-CN":"数据导出","en-US":"Export"}',         50),
    ( 6, 100, 'api',      '{"zh-CN":"API 调用","en-US":"API Call"}',      60),
    ( 7, 100, 'share',    '{"zh-CN":"分享解读","en-US":"Share"}',          70),
    ( 8, 100, 'other',    '{"zh-CN":"其他","en-US":"Other"}',              80);


-- ============================================================
-- 2. AB 平台 enum 初始数据 (from 50_ab.sql, design in v0.7.md)
-- ============================================================

-- ============================================================
-- 2.1 t_ab_domain / AB 实验所属域
-- ============================================================
INSERT INTO public.t_ab_domain (f_code, f_name, f_max_concurrent) VALUES
    ('PROMPT',       'AI 提示词',  1),
    ('FEATURE',      '功能灰度',  1),
    ('SKIN',         '皮肤',      1),
    ('AD',           '广告+落地页', 1),
    ('SUBSCRIPTION', '订阅定价',  1);


-- ============================================================
-- 2.2 t_ab_status / AB 实验状态
-- ============================================================
INSERT INTO public.t_ab_status (f_id, f_code, f_name) VALUES
    (-1, 'NOT-SET',   '{"zh-CN":"未设置","en-US":"Not Set"}'),
    ( 1, 'DRAFT',     '{"zh-CN":"草稿","en-US":"Draft"}'),
    (10, 'RUNNING',   '{"zh-CN":"运行中","en-US":"Running"}'),
    (15, 'PAUSED',    '{"zh-CN":"已暂停","en-US":"Paused"}'),
    (20, 'DELETED',   '{"zh-CN":"已删除","en-US":"Deleted"}'),
    (30, 'COMPLETED', '{"zh-CN":"已完成","en-US":"Completed"}'),
    (40, 'KILLED',    '{"zh-CN":"已终止","en-US":"Killed"}');


-- ============================================================
-- 2.3 t_ab_event / 事件分类 (前端技术 / 业务 / 后端技术)
-- ============================================================
-- 事件分类 (f_type 字段):
--   [前端技术] UI 交互 / 导航 / 生命周期 / 媒体 / 手势 / 错误
--   [业务域]   COMMERCE / REPORT / CHAT / PET / SUBSCRIPTION / WELFARE
--              / HEALTHCARE / SKIN / SOCIAL / CONTENT
--   [后端技术] API / DB / CACHE / QUEUE / AUTH / PAYMENT / SYNC
-- =================================================================

-- 2.3.1 前端技术 - UI 交互 (UI_INTERACTION)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('UI_INTERACTION', 'PAGE_VIEW',         '页面浏览/曝光'),
    ('UI_INTERACTION', 'BUTTON_CLICK',      '按钮点击'),
    ('UI_INTERACTION', 'LINK_CLICK',        '链接点击'),
    ('UI_INTERACTION', 'MENU_CLICK',        '菜单点击'),
    ('UI_INTERACTION', 'TAB_SWITCH',        'Tab 切换'),
    ('UI_INTERACTION', 'CHECKBOX_CLICK',    '复选框点击'),
    ('UI_INTERACTION', 'RADIO_CLICK',       '单选点击'),
    ('UI_INTERACTION', 'SWITCH_TOGGLE',     '开关切换'),
    ('UI_INTERACTION', 'DROPDOWN_SELECT',   '下拉选择'),
    ('UI_INTERACTION', 'MODAL_OPEN',        '弹窗打开'),
    ('UI_INTERACTION', 'MODAL_CLOSE',       '弹窗关闭'),
    ('UI_INTERACTION', 'TOAST_SHOW',        'Toast 显示'),
    ('UI_INTERACTION', 'INPUT_CHANGE',      '输入框变化'),
    ('UI_INTERACTION', 'INPUT_SUBMIT',      '输入提交'),
    ('UI_INTERACTION', 'FORM_FOCUS',        '表单聚焦'),
    ('UI_INTERACTION', 'FORM_BLUR',         '表单失焦'),
    ('UI_INTERACTION', 'SEARCH_SUBMIT',     '搜索提交'),
    ('UI_INTERACTION', 'FILTER_APPLY',      '筛选应用'),
    ('UI_INTERACTION', 'SORT_CHANGE',       '排序变化'),
    ('UI_INTERACTION', 'COPY_CLICK',        '复制点击'),
    ('UI_INTERACTION', 'SHARE_CLICK',       '分享按钮点击'),
    ('UI_INTERACTION', 'LOCATION_REQUEST',  '位置请求');

-- 2.3.2 前端技术 - 导航 (NAVIGATION)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('NAVIGATION', 'PAGE_ENTER',         '页面进入'),
    ('NAVIGATION', 'PAGE_LEAVE',         '页面离开'),
    ('NAVIGATION', 'PAGE_BACK',          '页面返回'),
    ('NAVIGATION', 'PAGE_FORWARD',       '页面前进'),
    ('NAVIGATION', 'DEEP_LINK_OPEN',     '深链接打开'),
    ('NAVIGATION', 'ROUTER_REDIRECT',    '路由重定向');

-- 2.3.3 前端技术 - APP 生命周期 (APP_LIFECYCLE)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('APP_LIFECYCLE', 'APP_LAUNCH',           'APP 启动'),
    ('APP_LIFECYCLE', 'APP_FOREGROUND',       'APP 进入前台'),
    ('APP_LIFECYCLE', 'APP_BACKGROUND',       'APP 进入后台'),
    ('APP_LIFECYCLE', 'APP_TERMINATE',        'APP 终止'),
    ('APP_LIFECYCLE', 'APP_UPGRADE',          'APP 升级'),
    ('APP_LIFECYCLE', 'APP_CRASH',            'APP 崩溃'),
    ('APP_LIFECYCLE', 'NETWORK_CHANGE',       '网络环境变化'),
    ('APP_LIFECYCLE', 'PERMISSION_REQUEST',   '权限请求'),
    ('APP_LIFECYCLE', 'PERMISSION_GRANT',     '权限授予'),
    ('APP_LIFECYCLE', 'PERMISSION_DENY',      '权限拒绝'),
    ('APP_LIFECYCLE', 'PUSH_RECEIVED',        '收到推送'),
    ('APP_LIFECYCLE', 'PUSH_OPEN',            '打开推送');

-- 2.3.4 前端技术 - 媒体 (MEDIA)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('MEDIA', 'IMAGE_LOAD',         '图片加载完成'),
    ('MEDIA', 'IMAGE_LOAD_FAIL',    '图片加载失败'),
    ('MEDIA', 'IMAGE_PREVIEW',      '图片预览'),
    ('MEDIA', 'VIDEO_PLAY',         '视频播放'),
    ('MEDIA', 'VIDEO_PAUSE',        '视频暂停'),
    ('MEDIA', 'VIDEO_ENDED',        '视频结束'),
    ('MEDIA', 'VIDEO_FULLSCREEN',   '视频全屏'),
    ('MEDIA', 'AUDIO_PLAY',         '音频播放'),
    ('MEDIA', 'AUDIO_PAUSE',        '音频暂停'),
    ('MEDIA', 'AUDIO_ENDED',        '音频结束'),
    ('MEDIA', 'CAMERA_OPEN',        '打开相机'),
    ('MEDIA', 'CAMERA_SHOT',        '拍照'),
    ('MEDIA', 'FILE_UPLOAD',        '文件上传'),
    ('MEDIA', 'FILE_DOWNLOAD',      '文件下载');

-- 2.3.5 前端技术 - 手势 (GESTURE)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('GESTURE', 'LONG_PRESS',       '长按'),
    ('GESTURE', 'DOUBLE_TAP',       '双击'),
    ('GESTURE', 'SWIPE_LEFT',       '左滑'),
    ('GESTURE', 'SWIPE_RIGHT',      '右滑'),
    ('GESTURE', 'SWIPE_UP',         '上滑'),
    ('GESTURE', 'SWIPE_DOWN',       '下滑'),
    ('GESTURE', 'PAGE_SCROLL',      '页面滚动'),
    ('GESTURE', 'PULL_TO_REFRESH',  '下拉刷新'),
    ('GESTURE', 'INFINITE_SCROLL',  '无限滚动触底'),
    ('GESTURE', 'PINCH_ZOOM',       '捏合缩放');

-- 2.3.6 前端技术 - 错误 (FRONTEND_ERROR)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('FRONTEND_ERROR', 'JS_ERROR',           'JS 运行时错误'),
    ('FRONTEND_ERROR', 'RENDER_ERROR',       '组件渲染错误'),
    ('FRONTEND_ERROR', 'IMAGE_BROKEN',       '图片资源失效'),
    ('FRONTEND_ERROR', 'WEBVIEW_ERROR',      'WebView 加载错误'),
    ('FRONTEND_ERROR', 'SCRIPT_TIMEOUT',     '脚本执行超时');

-- 2.3.7 业务 - 电商 (COMMERCE)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('COMMERCE', 'PRODUCT_LIST_VIEW',     '商品列表查看'),
    ('COMMERCE', 'PRODUCT_DETAIL_VIEW',   '商品详情查看'),
    ('COMMERCE', 'PRODUCT_SEARCH',        '商品搜索'),
    ('COMMERCE', 'PRODUCT_FILTER',        '商品筛选'),
    ('COMMERCE', 'ADD_TO_CART',           '加入购物车'),
    ('COMMERCE', 'REMOVE_FROM_CART',      '移出购物车'),
    ('COMMERCE', 'CART_VIEW',             '查看购物车'),
    ('COMMERCE', 'CHECKOUT_START',        '开始结算'),
    ('COMMERCE', 'ADDRESS_SELECT',        '选择收货地址'),
    ('COMMERCE', 'COUPON_CLAIM',          '领取优惠券'),
    ('COMMERCE', 'COUPON_USE',            '使用优惠券'),
    ('COMMERCE', 'ORDER_CREATE',          '创建订单'),
    ('COMMERCE', 'ORDER_PAY_START',       '开始支付'),
    ('COMMERCE', 'ORDER_PAY_SUCCESS',     '支付成功'),
    ('COMMERCE', 'ORDER_PAY_FAIL',        '支付失败'),
    ('COMMERCE', 'ORDER_CANCEL',          '取消订单'),
    ('COMMERCE', 'ORDER_REFUND',          '申请退款'),
    ('COMMERCE', 'ORDER_COMPLETE',        '订单完成'),
    ('COMMERCE', 'ORDER_REVIEW',          '订单评价'),
    ('COMMERCE', 'FAVORITE_ADD',          '收藏商品'),
    ('COMMERCE', 'FAVORITE_REMOVE',       '取消收藏');

-- 2.3.8 业务 - AI 报告 (REPORT)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('REPORT', 'EMOTION_REPORT_VIEW',       '情绪报告查看'),
    ('REPORT', 'EMOTION_REPORT_GENERATE',   '情绪报告生成'),
    ('REPORT', 'EMOTION_REPORT_LIKE',       '情绪报告点赞'),
    ('REPORT', 'EMOTION_REPORT_DISLIKE',    '情绪报告点踩'),
    ('REPORT', 'EMOTION_REPORT_SHARE',      '情绪报告分享'),
    ('REPORT', 'EMOTION_REPORT_DOWNLOAD',   '情绪报告下载'),
    ('REPORT', 'HEALTH_REPORT_VIEW',        '健康报告查看'),
    ('REPORT', 'HEALTH_REPORT_GENERATE',    '健康报告生成'),
    ('REPORT', 'HEALTH_REPORT_SHARE',       '健康报告分享'),
    ('REPORT', 'HEALTH_REPORT_DOWNLOAD',    '健康报告下载'),
    ('REPORT', 'HPR_REPORT_VIEW',           '人宠风险报告查看'),
    ('REPORT', 'HPR_REPORT_GENERATE',       '人宠风险报告生成'),
    ('REPORT', 'PERSONALITY_REPORT_VIEW',   '性格报告查看'),
    ('REPORT', 'PERSONALITY_REPORT_GENERATE','性格报告生成'),
    ('REPORT', 'REPORT_VOICE_PLAY',         '报告语音播放'),
    ('REPORT', 'REPORT_VOICE_DOWNLOAD',     '报告语音下载'),
    ('REPORT', 'REPORT_REGENERATE',         '报告重新生成'),
    ('REPORT', 'REPORT_HISTORY_VIEW',       '报告历史查看'),
    ('REPORT', 'REPORT_EXPORT',             '报告导出');

-- 2.3.9 业务 - 聊天 (CHAT)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('CHAT', 'SESSION_START',         '会话开始'),
    ('CHAT', 'SESSION_END',           '会话结束'),
    ('CHAT', 'MESSAGE_SEND',          '消息发送'),
    ('CHAT', 'MESSAGE_RECEIVE',       '消息接收'),
    ('CHAT', 'MESSAGE_RETRY',         '消息重发'),
    ('CHAT', 'QUICK_REPLY_USE',       '快捷回复使用'),
    ('CHAT', 'VOICE_INPUT',           '语音输入'),
    ('CHAT', 'IMAGE_INPUT',           '图片输入'),
    ('CHAT', 'CHAT_FEEDBACK',         '聊天反馈'),
    ('CHAT', 'CHAT_LIKE',             '回复点赞'),
    ('CHAT', 'CHAT_DISLIKE',          '回复点踩');

-- 2.3.10 业务 - 宠物档案 (PET)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('PET', 'PET_CREATE',             '创建宠物档案'),
    ('PET', 'PET_EDIT',               '编辑宠物档案'),
    ('PET', 'PET_DELETE',             '删除宠物档案'),
    ('PET', 'PET_PHOTO_UPLOAD',       '上传宠物照片'),
    ('PET', 'PET_PHOTO_DELETE',       '删除宠物照片'),
    ('PET', 'PET_AVATAR_CHANGE',      '修改头像'),
    ('PET', 'PET_TAG_ADD',            '添加标签'),
    ('PET', 'PET_TAG_REMOVE',         '移除标签'),
    ('PET', 'PET_WEIGHT_RECORD',      '记录体重'),
    ('PET', 'PET_VACCINE_RECORD',     '记录疫苗'),
    ('PET', 'PET_PROFILE_SHARE',      '宠物档案分享');

-- 2.3.11 业务 - 订阅 (SUBSCRIPTION)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('SUBSCRIPTION', 'PLAN_VIEW',          '套餐查看'),
    ('SUBSCRIPTION', 'PLAN_COMPARE',       '套餐对比'),
    ('SUBSCRIPTION', 'SUBSCRIBE_START',    '开始订阅'),
    ('SUBSCRIPTION', 'SUBSCRIBE_SUCCESS',  '订阅成功'),
    ('SUBSCRIPTION', 'SUBSCRIBE_FAIL',     '订阅失败'),
    ('SUBSCRIPTION', 'SUBSCRIBE_RENEW',    '续订'),
    ('SUBSCRIPTION', 'SUBSCRIBE_CANCEL',   '取消订阅'),
    ('SUBSCRIPTION', 'SUBSCRIBE_UPGRADE',  '升级订阅'),
    ('SUBSCRIPTION', 'SUBSCRIBE_DOWNGRADE','降级订阅'),
    ('SUBSCRIPTION', 'QUOTA_VIEW',         '查看配额'),
    ('SUBSCRIPTION', 'QUOTA_EXHAUST',      '配额耗尽'),
    ('SUBSCRIPTION', 'QUOTA_LOW',          '配额不足提示');

-- 2.3.12 业务 - 公益 (WELFARE)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('WELFARE', 'DONATION_PAGE_VIEW',   '捐款页查看'),
    ('WELFARE', 'DONATION_START',       '开始捐款'),
    ('WELFARE', 'DONATION_SUCCESS',     '捐款成功'),
    ('WELFARE', 'DONATION_FAIL',        '捐款失败'),
    ('WELFARE', 'RESCUE_SUBMIT',        '提交救助申请'),
    ('WELFARE', 'RESCUE_VIEW',          '查看救助'),
    ('WELFARE', 'ADOPTION_LIST_VIEW',   '领养列表查看'),
    ('WELFARE', 'ADOPTION_DETAIL_VIEW', '领养详情查看'),
    ('WELFARE', 'ADOPTION_APPLY',       '领养申请'),
    ('WELFARE', 'LOST_PET_PUBLISH',     '发布寻宠'),
    ('WELFARE', 'LOST_PET_VIEW',        '查看寻宠'),
    ('WELFARE', 'VOLUNTEER_REGISTER',   '志愿者注册'),
    ('WELFARE', 'VOLUNTEER_JOIN',       '参与志愿活动');

-- 2.3.13 业务 - 医疗 (HEALTHCARE)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('HEALTHCARE', 'HOSPITAL_SEARCH',     '搜索医院'),
    ('HEALTHCARE', 'HOSPITAL_VIEW',       '查看医院'),
    ('HEALTHCARE', 'HOSPITAL_PHONE',      '拨打医院电话'),
    ('HEALTHCARE', 'HOSPITAL_NAVIGATE',   '导航到医院'),
    ('HEALTHCARE', 'DOCTOR_VIEW',         '查看医生'),
    ('HEALTHCARE', 'APPOINTMENT_CREATE',  '创建预约'),
    ('HEALTHCARE', 'APPOINTMENT_CANCEL',  '取消预约'),
    ('HEALTHCARE', 'APPOINTMENT_COMPLETE','完成预约'),
    ('HEALTHCARE', 'APPOINTMENT_REMIND',  '预约提醒'),
    ('HEALTHCARE', 'MEDICAL_RECORD_VIEW', '查看病历'),
    ('HEALTHCARE', 'INSURANCE_VIEW',      '查看保险'),
    ('HEALTHCARE', 'INSURANCE_CLAIM',     '理赔申请');

-- 2.3.14 业务 - 皮肤 (SKIN)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('SKIN', 'SKIN_PREVIEW_SHOW',  '皮肤预览弹窗显示'),
    ('SKIN', 'SKIN_TRIAL_ACCEPT',  '皮肤试用接受'),
    ('SKIN', 'SKIN_TRIAL_REJECT',  '皮肤试用拒绝'),
    ('SKIN', 'SKIN_APPLY',         '应用皮肤'),
    ('SKIN', 'SKIN_RESTORE',       '恢复默认皮肤'),
    ('SKIN', 'SKIN_PURCHASE',      '购买皮肤');

-- 2.3.15 业务 - 社交 (SOCIAL)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('SOCIAL', 'POST_PUBLISH',    '发布动态'),
    ('SOCIAL', 'POST_VIEW',       '查看动态'),
    ('SOCIAL', 'POST_LIKE',       '点赞动态'),
    ('SOCIAL', 'POST_UNLIKE',     '取消点赞'),
    ('SOCIAL', 'POST_COMMENT',    '评论动态'),
    ('SOCIAL', 'POST_REPLY',      '回复评论'),
    ('SOCIAL', 'POST_SHARE',      '分享动态'),
    ('SOCIAL', 'POST_DELETE',     '删除动态'),
    ('SOCIAL', 'POST_REPORT',     '举报动态'),
    ('SOCIAL', 'USER_FOLLOW',     '关注用户'),
    ('SOCIAL', 'USER_UNFOLLOW',   '取消关注'),
    ('SOCIAL', 'USER_PROFILE_VIEW','查看用户主页'),
    ('SOCIAL', 'COMMENT_LIKE',    '点赞评论');

-- 2.3.16 业务 - 内容 (CONTENT)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('CONTENT', 'CONTENT_SHARED',       '内容分享'),
    ('CONTENT', 'CONTENT_VIEW',         '内容查看'),
    ('CONTENT', 'CONTENT_FAVORITE',     '内容收藏'),
    ('CONTENT', 'CONTENT_LIKE',         '内容点赞'),
    ('CONTENT', 'CONTENT_COMMENT',      '内容评论'),
    ('CONTENT', 'CONTENT_TRANSLATE',    '内容翻译'),
    ('CONTENT', 'CONTENT_REPORT',       '内容举报');

-- 2.3.17 后端技术 - API (API)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('API', 'API_REQUEST',         'API 请求发起'),
    ('API', 'API_SUCCESS',         'API 成功响应'),
    ('API', 'API_TIMEOUT',         'API 超时'),
    ('API', 'API_ERROR',           'API 错误响应'),
    ('API', 'API_4XX',             'API 客户端错误 (4xx)'),
    ('API', 'API_5XX',             'API 服务端错误 (5xx)'),
    ('API', 'API_RATE_LIMIT',      'API 限流触发'),
    ('API', 'API_AUTH_FAIL',       'API 鉴权失败'),
    ('API', 'API_VALIDATION_FAIL', 'API 参数校验失败');

-- 2.3.18 后端技术 - 数据库 (DB)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('DB', 'DB_QUERY_SLOW',       '慢查询'),
    ('DB', 'DB_QUERY_FAIL',       '查询失败'),
    ('DB', 'DB_QUERY_TIMEOUT',    '查询超时'),
    ('DB', 'DB_DEADLOCK',         '死锁'),
    ('DB', 'DB_CONNECTION_FAIL',  '连接失败'),
    ('DB', 'DB_SAVE_FAIL',        '写入失败'),
    ('DB', 'DB_UPDATE_FAIL',      '更新失败'),
    ('DB', 'DB_DELETE_FAIL',      '删除失败'),
    ('DB', 'DB_TRANSACTION_FAIL', '事务回滚');

-- 2.3.19 后端技术 - 缓存 (CACHE)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('CACHE', 'CACHE_HIT',         '缓存命中'),
    ('CACHE', 'CACHE_MISS',        '缓存未命中'),
    ('CACHE', 'CACHE_SET',         '缓存写入'),
    ('CACHE', 'CACHE_INVALIDATE',  '缓存失效'),
    ('CACHE', 'CACHE_EVICT',       '缓存淘汰'),
    ('CACHE', 'CACHE_ERROR',       '缓存错误');

-- 2.3.20 后端技术 - 队列 (QUEUE)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('QUEUE', 'QUEUE_PUBLISH',     '消息发布'),
    ('QUEUE', 'QUEUE_CONSUME',     '消息消费'),
    ('QUEUE', 'QUEUE_RETRY',       '消息重试'),
    ('QUEUE', 'QUEUE_DEAD_LETTER', '死信队列'),
    ('QUEUE', 'QUEUE_BACKLOG',     '队列积压告警'),
    ('QUEUE', 'QUEUE_TIMEOUT',     '消费超时');

-- 2.3.21 后端技术 - 认证 (AUTH)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('AUTH', 'LOGIN_SUCCESS',      '登录成功'),
    ('AUTH', 'LOGIN_FAIL',         '登录失败'),
    ('AUTH', 'LOGOUT',             '登出'),
    ('AUTH', 'SIGNUP',             '注册'),
    ('AUTH', 'PASSWORD_RESET',     '密码重置'),
    ('AUTH', 'PASSWORD_CHANGE',    '密码修改'),
    ('AUTH', 'TOKEN_REFRESH',      'Token 刷新'),
    ('AUTH', 'TOKEN_EXPIRED',      'Token 过期'),
    ('AUTH', 'WECHAT_SCAN_LOGIN',  '微信扫码登录'),
    ('AUTH', 'PHONE_LOGIN',        '手机号登录'),
    ('AUTH', 'OAUTH_LOGIN',        '第三方登录'),
    ('AUTH', 'MFA_VERIFY',         '二次验证');

-- 2.3.22 后端技术 - 支付 (PAYMENT)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('PAYMENT', 'PAYMENT_INIT',       '支付初始化'),
    ('PAYMENT', 'PAYMENT_CALLBACK',   '支付回调'),
    ('PAYMENT', 'PAYMENT_RECONCILE',  '支付对账'),
    ('PAYMENT', 'WECHAT_PAY',         '微信支付'),
    ('PAYMENT', 'ALIPAY',             '支付宝'),
    ('PAYMENT', 'UNIONPAY',           '银联'),
    ('PAYMENT', 'STRIPE',             'Stripe (国际)'),
    ('PAYMENT', 'PAYPAL',             'PayPal (国际)'),
    ('PAYMENT', 'PAYMENT_FAIL',       '支付失败'),
    ('PAYMENT', 'REFUND_SUCCESS',     '退款成功'),
    ('PAYMENT', 'REFUND_FAIL',        '退款失败');

-- 2.3.23 后端技术 - 同步 (SYNC)
INSERT INTO public.t_ab_event (f_type, f_name, f_desc) VALUES
    ('SYNC', 'DEVICE_SYNC_START',   '设备同步开始'),
    ('SYNC', 'DEVICE_SYNC_SUCCESS', '设备同步成功'),
    ('SYNC', 'DEVICE_SYNC_FAIL',    '设备同步失败'),
    ('SYNC', 'DATA_PULL',           '数据拉取'),
    ('SYNC', 'DATA_PUSH',           '数据推送'),
    ('SYNC', 'CONFLICT_DETECTED',   '同步冲突检测');


-- ============================================================
-- db_init.sql 结束
-- ============================================================
-- 至此所有 enum 初始数据写入完成; 验证:
--
-- 基础枚举 (01_enums.sql):
--   SELECT count(*) FROM t_lang;                  -- 18
--   SELECT count(*) FROM t_pet_type;              -- 14
--   SELECT count(*) FROM t_pet_breed;             -- ~50 (犬27 + 猫21)
--   SELECT count(*) FROM t_gender;                -- 10
--   SELECT count(*) FROM t_photo_type;            -- ~20
--   SELECT count(*) FROM t_report_type;           -- 8
--   SELECT count(*) FROM t_risk_level;            -- 7
--   SELECT count(*) FROM t_health_level;          -- 6
--   SELECT count(*) FROM t_status;                -- 6
--   SELECT count(*) FROM t_personality_tag;       -- 16
--   SELECT count(*) FROM t_plan_type;             -- 10
--   SELECT count(*) FROM t_payment_status;        -- 9
--   SELECT count(*) FROM t_shipping_status;       -- 10
--   SELECT count(*) FROM t_sync_status;           -- 7
--   SELECT count(*) FROM t_inventory_status;      -- 7
--   SELECT count(*) FROM t_inventory_serial_status;-- 8
--   SELECT count(*) FROM t_adoption_type;         -- 3
--   SELECT count(*) FROM t_volunteer_type;        -- 11
--   SELECT count(*) FROM t_share_type;            -- 13
--   SELECT count(*) FROM t_share_channel;         -- 20
--   SELECT count(*) FROM t_activity_type;         -- 11
--   SELECT count(*) FROM t_subscription_type;     -- 10
--   SELECT count(*) FROM t_banner_type;           -- 7
--   SELECT count(*) FROM t_usage_type;            -- 9
--
-- AB 平台 (50_ab.sql):
--   SELECT count(*) FROM t_ab_domain;             -- 5
--   SELECT count(*) FROM t_ab_status;             -- 7
--   SELECT count(*) FROM t_ab_event;              -- ~190 (前端23+6+12+14+10+5 + 业务21+19+11+11+13+12+6+13+7 + 后端9+9+6+6+12+11+6)
-- ============================================================
