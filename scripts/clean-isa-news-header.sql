-- One-off cleanup of already-published news posts. Run once in the Supabase
-- SQL editor (safe to re-run). It does two things:
--   1) strips the leading "--- ISA news ---" banner from title and body;
--      the title was built from the first line, so it is rebuilt from the
--      cleaned text (first line, up to the first period)
--   2) removes the title's first sentence from the start of the body, so the
--      description no longer repeats the title
update news n
set title = x.new_title,
    body  = x.new_body
from (
  select id, new_title,
    case
      when new_title <> '' and left(b0, length(new_title)) = new_title
        then btrim(regexp_replace(substr(b0, length(new_title) + 1), '^\.', ''))
      else b0
    end as new_body
  from (
    select n2.id, c.b0,
      case
        when n2.title ~* p.re
          then btrim(split_part(split_part(c.b0, E'\n', 1), '.', 1), E' \r\t')
        else btrim(n2.title)
      end as new_title
    from news n2
    cross join (select '^\s*(?:[-‐-―−*_~=]+\s*ISA\s*NEWS\s*[-‐-―−*_~=]*|ISA\s*NEWS\s*[-‐-―−*_~=]+|ISA\s*NEWS(?=[ \t]*(?:\r?\n|$)))[ \t]*(?:\r?\n\s*)?'::text as re) p
    cross join lateral (select btrim(regexp_replace(coalesce(n2.body, ''), p.re, '', 'i')) as b0) c
  ) y
) x
where x.id = n.id
  and (n.title is distinct from x.new_title or n.body is distinct from x.new_body);
