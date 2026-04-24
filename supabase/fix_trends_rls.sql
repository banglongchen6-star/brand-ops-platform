-- 内部工具，用 anon key 统一读写，关闭内容运营相关表的 RLS
-- （若未来接入 Supabase Auth，再按角色补 policy）

ALTER TABLE content_trends             DISABLE ROW LEVEL SECURITY;
ALTER TABLE content_platforms          DISABLE ROW LEVEL SECURITY;
ALTER TABLE content_keyword_library    DISABLE ROW LEVEL SECURITY;
ALTER TABLE content_hit_factors        DISABLE ROW LEVEL SECURITY;
ALTER TABLE content_candidate_pool     DISABLE ROW LEVEL SECURITY;
ALTER TABLE content_tropes             DISABLE ROW LEVEL SECURITY;
ALTER TABLE content_workspace_settings DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
