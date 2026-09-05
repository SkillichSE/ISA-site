create table if not exists discord_sync_state (
  channel_id text primary key,
  last_message_id text not null,
  updated_at timestamptz not null default now()
);
