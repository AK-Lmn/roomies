alter table messages add column if not exists reply_to_id text;
alter table messages add column if not exists reply_to_body text;
alter table messages add column if not exists reply_to_identity text;
