create table if not exists message_reactions (
  message_id text not null references messages(id) on delete cascade,
  user_id text not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists message_reactions_msg_idx on message_reactions (message_id);
