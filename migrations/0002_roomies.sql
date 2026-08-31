-- ROOMIES core schema. user_id is TEXT to match Better Auth ids.

create table if not exists profiles (
  user_id text primary key,
  username text not null unique,
  display_name text not null,
  bio text not null default '',
  avatar_url text,
  website_url text not null default '',
  instagram_url text not null default '',
  x_url text not null default '',
  show_bio boolean not null default true,
  show_social boolean not null default false,
  show_joined boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx on profiles (lower(username));

create table if not exists rooms (
  id text primary key,
  name text not null,
  status text not null default 'waiting',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ends_at timestamptz,
  closing_notified boolean not null default false
);

create index if not exists rooms_status_idx on rooms (status, created_at);

create table if not exists matching_queue (
  user_id text primary key,
  joined_at timestamptz not null default now()
);

create table if not exists room_members (
  room_id text not null references rooms(id) on delete cascade,
  user_id text not null,
  temp_identity text not null,
  identity_animal text not null,
  identity_color text not null,
  revealed boolean not null default false,
  last_seen_at timestamptz not null default now(),
  saved_to_archive boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create unique index if not exists room_members_identity_idx on room_members (room_id, temp_identity);
create index if not exists room_members_user_idx on room_members (user_id);

create table if not exists messages (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_room_created_idx on messages (room_id, created_at);

create table if not exists wall_posts (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  user_id text not null,
  body text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists wall_posts_room_created_idx on wall_posts (room_id, created_at);

create table if not exists post_reactions (
  post_id text not null references wall_posts(id) on delete cascade,
  user_id text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

create table if not exists fridge_notes (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  user_id text not null,
  body text not null,
  color text not null,
  tilt smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists fridge_notes_room_idx on fridge_notes (room_id, created_at);

create table if not exists songs (
  id text primary key,
  room_id text not null references rooms(id) on delete cascade,
  user_id text not null,
  title text not null,
  artist text not null,
  url text not null,
  cover_url text,
  created_at timestamptz not null default now()
);

create index if not exists songs_room_idx on songs (room_id, created_at);

create table if not exists daily_questions (
  id serial primary key,
  prompt text not null
);

create table if not exists daily_answers (
  room_id text not null references rooms(id) on delete cascade,
  day_index int not null,
  question_id int not null references daily_questions(id),
  user_id text not null,
  body text not null,
  created_at timestamptz not null default now(),
  primary key (room_id, day_index, user_id)
);

create table if not exists reports (
  id text primary key,
  reporter_id text not null,
  target_user_id text,
  target_type text not null,
  target_id text,
  room_id text,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists reports_created_idx on reports (created_at);

create table if not exists blocks (
  blocker_id text not null,
  blocked_id text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  kind text not null,
  title text not null,
  body text not null default '',
  room_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

insert into daily_questions (prompt) values
  ('What is something you are currently obsessed with?'),
  ('What is your comfort food?'),
  ('What song describes your week?'),
  ('What is something you have always wanted to try?'),
  ('What is a completely useless skill you have?'),
  ('What does a perfect evening look like for you?'),
  ('What is a place that still lives in your head?'),
  ('What are you avoiding lately, kindly?'),
  ('What is the last thing that made you laugh too hard?'),
  ('If your week had a weather, what would it be?'),
  ('What do you collect, on purpose or by accident?'),
  ('What is a tiny ritual you protect?'),
  ('Which hour of the day feels most like you?'),
  ('What would you put on the fridge of your real kitchen?'),
  ('What is a story you never get tired of telling?'),
  ('What are you learning to be gentler about?'),
  ('If this room had a house rule, what should it be?'),
  ('What is a smell that teleports you?'),
  ('What are you looking forward to, even a little?'),
  ('What did you used to believe that you do not anymore?'),
  ('What is the kindest thing a stranger has done for you?')
on conflict do nothing;
