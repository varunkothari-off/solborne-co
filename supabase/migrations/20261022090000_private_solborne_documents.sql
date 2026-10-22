create table solborne_presales.documents (
 id uuid primary key default gen_random_uuid(),
 registration_id text not null references solborne_presales.enquiries(registration_id),
 bucket_id text not null default 'solborne-walk-files' check (bucket_id='solborne-walk-files'),
 object_path text not null unique,
 filename text not null check (length(filename) between 1 and 180),
 mime_type text not null,
 size_bytes bigint not null check (size_bytes between 1 and 5242880),
 sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
 source_kind text not null check (source_kind in ('email','walk','owner_import')),
 source_reference text,
 created_at timestamptz not null default now(),
 unique (registration_id,sha256),
 check (object_path ~ ('^' || registration_id || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
);
alter table solborne_presales.documents enable row level security;
revoke all on solborne_presales.documents from public,anon,authenticated;
comment on table solborne_presales.documents is 'Private owner-imported document metadata. Object bytes remain in a private Storage bucket; never included in public site output.';
