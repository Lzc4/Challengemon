\set pw `echo "$POSTGRES_PASSWORD"`
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit password :'pw';
create role supabase_auth_admin login createrole password :'pw';
create role supabase_admin login superuser replication password :'pw';
grant anon, authenticated, service_role to authenticator;
create schema auth authorization supabase_auth_admin;
create schema _realtime authorization supabase_admin;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant create on database challengemon to supabase_auth_admin;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create publication supabase_realtime;
