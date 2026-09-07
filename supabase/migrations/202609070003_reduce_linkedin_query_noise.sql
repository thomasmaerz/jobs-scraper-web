-- Replace fuzzy Boolean/title searches with a smaller empirically tested set.
-- Keep ambiguous matches in review while downstream workers process included rows only.

update public.career_lane_definitions set
  title_include = array['project manager','program manager','delivery manager','implementation manager','technical program manager','IT project manager','chef de projet informatique','gestionnaire de projet informatique'],
  title_exclude = array['\bprocess project manager\b','civil','clinical','construction','land development','\bproduct manager\b','\bscrum master\b','\bsales program manager\b','\b(?:SSEQ|HSEQ)\b'],
  description_exclude = '{}', updated_at = now()
where archetype = 'technology_delivery';

update public.career_lane_definitions set
  title_exclude = array['\bbackend (?:software )?engineer\b','full stack','product manager','sales engineer','\b(?:software|data|machine learning|ML)[ -]+(?:engineer|developer)\b','\b(?:civil|municipal|water(?: and | & )wastewater)[ -]+engineer\b','\bDataStage\b','\btelecommunications? analyst\b','\b(?:ML|machine learning).*engineer\b','\bAPI engineer\b'],
  description_include = array['(?is)\A(?=.*\b(?:infrastructure|systems?|compute|platform)\b)(?=.*\b(?:VMware|vSphere|ESXi|Active Directory|Linux|Windows Server|storage|backup|Kubernetes|OpenShift)\b)'],
  description_exclude = '{}', updated_at = now()
where archetype = 'systems_platform_ops';

update public.career_lane_definitions set
  title_exclude = array['\bnetwork software engineer\b','network software','product manager','telecom sales','\bdata engineer\b','\b(?:database administrator|DBA)\b','\bcyber ?security intern\b','\blinux patching\b','\bsignal integrity(?: design)? engineer\b','^(?:senior |staff )?site reliability engineer(?: - telemetry)?$','\bIT systems administrator\b','\bstaff software engineer\b'],
  description_include = array['(?is)\A(?=.*\b(?:network|connectivity|NOC)\b)(?=.*\b(?:BGP|OSPF|VLAN|WAN|LAN|VPN|firewall|routing|switching|wireless|SD-WAN)\b)'],
  description_exclude = '{}', updated_at = now()
where archetype = 'network_infrastructure';

update public.career_lane_definitions set
  title_include = array['data[ -]?cent(?:er|re) (?:technician|associate|operations|infrastructure|hardware)','datacenter (?:technician|associate|operations|infrastructure|hardware)','smart hands'],
  title_exclude = array['\bsoftware engineer\b','construction manager','data center sales','\bbuilding operator\b','\bfacilities technician\b','\bHVAC technician\b','\bstationary mechanical technician\b','\bP\.C\. technician\b','\btechnical support analyst\b','\bsystems analyst\b','\bcloud(?: & infrastructure)? specialist\b','\bwarehouse technical inspector\b','\bmachine learning operations & support\b','\bdeskside technician\b','\bhosting systems principal\b','\bcontrol systems technologist\b'],
  description_include = array['(?is)\A(?=.*\b(?:data cent(?:er|re)|datacenter)\b)(?=.*\b(?:server hardware|rack|cabling|break.?fix|smart hands|PDU)\b)'],
  description_exclude = '{}', updated_at = now()
where archetype = 'datacenter_operations';

update public.career_lane_definitions set
  title_exclude = array['\bsoftware (?:developer|engineer)\b.*\bbrokerage\b','data scientist','product manager','research scientist','\bsite reliability engineer\b','\bcontrol systems?(?: software)? (?:designer|technologist|engineer)\b','solutions architect for automotive','analytics consulting','\bapplied researcher\b','\bAPI engineer\b','\binference infrastructure\b','\bcustomer experience engineer\b'],
  description_include = array['(?is)\A(?=.*\b(?:LLM|RAG|agentic|generative AI)\b)(?=.*\b(?:workflow|automation|integration|orchestration|business process)\b)','\b(?:n8n|Zapier|Make\.com|Power Automate)\b'],
  description_exclude = '{}', updated_at = now()
where archetype = 'ai_workflow_automation';

update public.career_lane_definitions set
  title_exclude = array['\bdata scientist\b','QA automation','software automation','\b(?:internal auditor|financial controller)\b','contr[oô]leur financier','\bproject controls? (?:professional|specialist|manager)\b','\baccount executive\b','^sales engineer\b','\bBIM facilities specialist\b','\btransmission engineering\b','\bpower systems technician\b','\bmechanical commissioning supervisor\b'],
  description_include = array['(?is)\A(?=.*\b(?:PLC|HMI|SCADA|BACnet|Modbus|BAS|BMS|building automation|control panel)\b)(?=.*\b(?:commission|program|integrat|troubleshoot|maintain|design)\w*)'],
  description_exclude = '{}', updated_at = now()
where archetype = 'building_controls';

update public.career_lane_search_queries
set enabled = false, retired_at = coalesce(retired_at, now()), updated_at = now();

insert into public.career_lane_search_queries
  (archetype, query, query_type, language, sort_order, enabled, retired_at)
values
  ('technology_delivery','technical program delivery manager','precision','en',10,true,null),
  ('technology_delivery','IT technology project manager','recall','en',20,true,null),
  ('technology_delivery','gestionnaire de projet informatique TI','precision','fr',30,true,null),
  ('systems_platform_ops','VMware virtualization infrastructure administrator','precision','en',10,true,null),
  ('systems_platform_ops','systems administrator infrastructure operations','recall','en',20,true,null),
  ('network_infrastructure','Network Engineer','precision','en',10,true,null),
  ('network_infrastructure','Network Administrator','recall','en',20,true,null),
  ('datacenter_operations','Data Center Technician','precision','en',10,true,null),
  ('datacenter_operations','Data Centre Technician','recall','en',20,true,null),
  ('ai_workflow_automation','agentic AI engineer RAG workflow automation','precision','en',10,true,null),
  ('ai_workflow_automation','AI solutions engineer LLM workflow integration','recall','en',20,true,null),
  ('building_controls','building automation controls specialist BAS BACnet','precision','en',10,true,null),
  ('building_controls','industrial controls engineer PLC SCADA commissioning','recall','en',20,true,null)
on conflict (archetype, query, language) do update set
  query_type = excluded.query_type, sort_order = excluded.sort_order,
  enabled = true, retired_at = null, updated_at = now();

do $$
declare
  new_revision_id bigint;
begin
  insert into public.career_lane_config_revisions (source, actor_email, configuration)
  values ('migration', 'relevance-audit-2026-09-07', public.get_scraper_configuration())
  returning revision_id into new_revision_id;

  update public.career_lane_config_revisions
  set configuration = public.get_scraper_configuration()
  where career_lane_config_revisions.revision_id = new_revision_id;
end $$;
