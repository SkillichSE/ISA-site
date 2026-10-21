-- One-off: strip the leading "--- ISA news ---" banner from existing posts.
-- Run once in the Supabase SQL editor. Safe to re-run.
with p as (
  select '^\s*(?:[-‐-―−*_~=]+\s*ISA\s*NEWS\s*[-‐-―−*_~=]*|ISA\s*NEWS\s*[-‐-―−*_~=]+|ISA\s*NEWS(?=[ \t]*(?:\r?\n|$)))[ \t]*(?:\r?\n\s*)?'::text as re
)
update news n
set
  body  = c.b,
  -- the title was built from the first line, so it was the banner itself;
  -- rebuild it the same way (first line, up to the first period)
  title = case when n.title ~* p.re
    then btrim(split_part(split_part(c.b, E'\n', 1), '.', 1), E' \r\t')
    else n.title end
from p,
     (select id, btrim(regexp_replace(body, (select re from p), '', 'i')) as b from news) c
where c.id = n.id
  and (n.body ~* p.re or n.title ~* p.re);
