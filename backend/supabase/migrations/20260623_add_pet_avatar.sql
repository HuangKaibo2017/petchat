-- Migration: Add f_avatar_url to t_pet
-- Date: 2026-06-23
-- Purpose: Frontend unification — pet avatar stored directly on t_pet

ALTER TABLE public.t_pet
  ADD COLUMN IF NOT EXISTS f_avatar_url VARCHAR(512) NOT NULL DEFAULT '';

COMMENT ON COLUMN public.t_pet.f_avatar_url IS '宠物头像 URL (主图, 与 t_pet_photo 表联动)';
