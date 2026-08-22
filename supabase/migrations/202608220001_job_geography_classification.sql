create or replace function public.classify_job_location_province(location_text text)
returns text language sql immutable strict set search_path = '' as $$
  select case
    when location_text ~* '(Alberta|(^|, )[Aa][Bb](,|$))' then 'AB'
    when location_text ~* '(British Columbia|(^|, )[Bb][Cc](,|$)|Greater Vancouver|Greater Victoria)' then 'BC'
    when location_text ~* '(Manitoba|(^|, )[Mm][Bb](,|$))' then 'MB'
    when location_text ~* '(New Brunswick|(^|, )[Nn][Bb](,|$))' then 'NB'
    when location_text ~* '(Newfoundland and Labrador|(^|, )[Nn][Ll](,|$))' then 'NL'
    when location_text ~* '(Nova Scotia|(^|, )[Nn][Ss](,|$)|Halifax Regional)' then 'NS'
    when location_text ~* '(Northwest Territories|(^|, )[Nn][Tt](,|$))' then 'NT'
    when location_text ~* '(Nunavut|(^|, )[Nn][Uu](,|$))' then 'NU'
    when location_text ~* '(Ontario|(^|, )[Oo][Nn](,|$)|Greater Toronto|National Capital Region)' then 'ON'
    when location_text ~* '(Prince Edward Island|(^|, )[Pp][Ee](,|$))' then 'PE'
    when location_text ~* '(Quebec|Québec|(^|, )[Qq][Cc](,|$)|Greater Montreal)' then 'QC'
    when location_text ~* '(Saskatchewan|(^|, )[Ss][Kk](,|$))' then 'SK'
    when location_text ~* '(Yukon|(^|, )[Yy][Tt](,|$))' then 'YT'
    else null
  end;
$$;

create or replace function public.classify_job_location_scope(location_text text)
returns text language sql immutable strict set search_path = '' as $$
  select case
    when trim(location_text) ~* '^Canada$' then 'country'
    when trim(location_text) ~* '^(Alberta|British Columbia|Manitoba|New Brunswick|Newfoundland and Labrador|Nova Scotia|Northwest Territories|Nunavut|Ontario|Prince Edward Island|Quebec|Québec|Saskatchewan|Yukon), Canada$' then 'province'
    else 'local'
  end;
$$;

create or replace function public.classify_job_location_metro(location_text text)
returns text language sql immutable strict set search_path = '' as $$
  select case
    when location_text ~* '(Toronto|Mississauga|Brampton|Markham|Vaughan|Oakville|Burlington|Richmond Hill|North York|Scarborough|Etobicoke|Greater Toronto)' then 'toronto'
    when location_text ~* '(Montreal|Montréal|Laval|Longueuil|Dorval|Saint-Laurent|Greater Montreal)' then 'montreal'
    when location_text ~* '(Vancouver|Burnaby|Surrey|Richmond, British Columbia|North Vancouver|West Vancouver|New Westminster|Coquitlam|Delta|Greater Vancouver)' then 'vancouver'
    when location_text ~* '(Calgary|Greater Calgary)' then 'calgary'
    when location_text ~* '(Edmonton|Greater Edmonton)' then 'edmonton'
    when location_text ~* '(Ottawa|Gatineau|National Capital Region)' then 'ottawa_gatineau'
    when location_text ~* '(Winnipeg)' then 'winnipeg'
    when location_text ~* '(Quebec City|Québec, Quebec)' then 'quebec_city'
    when location_text ~* '(Hamilton)' then 'hamilton'
    when location_text ~* '(Kitchener|Waterloo|Cambridge, Ontario)' then 'kitchener_waterloo'
    when location_text ~* '(London, Ontario)' then 'london'
    when location_text ~* '(Halifax|Dartmouth)' then 'halifax'
    when location_text ~* '(Victoria, British Columbia|Greater Victoria)' then 'victoria'
    when location_text ~* '(Regina)' then 'regina'
    when location_text ~* '(Saskatoon)' then 'saskatoon'
    else null
  end;
$$;

alter table public.jobs
  add column if not exists location_province_code text generated always as (public.classify_job_location_province(location)) stored,
  add column if not exists location_scope text generated always as (public.classify_job_location_scope(location)) stored,
  add column if not exists location_metro text generated always as (public.classify_job_location_metro(location)) stored;

create index if not exists idx_jobs_location_province_code on public.jobs (location_province_code);
create index if not exists idx_jobs_location_scope on public.jobs (location_scope);
create index if not exists idx_jobs_location_metro on public.jobs (location_metro);
