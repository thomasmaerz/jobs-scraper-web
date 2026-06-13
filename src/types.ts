// Define basic types (you can refine these later based on your actual table structure)
export interface ListingInstance {
  job_id: string;
  scraped_at: string;
  posted_at: string | null;
  posted_relative_text: string | null;
  applicant_count: number | null;
  salary_text: string | null;
  recruiter_name: string | null;
  recruiter_profile_url: string | null;
  recruiter_identifier: string | null;
}

export interface Job {
  job_id: string;
  company: string;
  job_title: string;
  level: string;
  location: string;
  description: string;
  status: string;
  is_active: boolean;
  application_date: string;
  resume_score?: number;
  notes?: string;
  scraped_at: string;
  last_checked: string;
  job_state: string;
  resume_score_stage: string;
  is_interested: boolean | null;
  customized_resume_id?: string | null;
  customized_resumes?: Resume | null;
  resume_link?: string | null;
  provider: string;
  posted_at?: string | null;
  last_seen_posted_at?: string | null;
  posted_relative_text?: string | null;
  applicant_count?: number | null;
  salary_text?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  recruiter_name?: string | null;
  recruiter_profile_url?: string | null;
  recruiter_identifier?: string | null;
  original_job_id?: string | null;
  latest_job_id?: string | null;
  canonical_key?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  seen_count?: number | null;
  repost_count?: number | null;
  listing_instances?: ListingInstance[] | null;
}

// --- Resume Related Interfaces ---

export interface Education {
  degree: string;
  field_of_study: string | null;
  institution: string;
  start_year: string | null;
  end_year: string | null;
}

export interface Experience {
  job_title: string;
  company: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

export interface Project {
  name: string;
  description: string | null;
  technologies: string[] | null;
}

export interface Certification {
  name: string;
  issuer: string | null;
  year: string | null;
}

export interface Links {
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
}

// Updated Resume Interface
export interface Resume {
  id: string; // Assuming this is the primary key for the resume table
  name: string;
  email: string;
  created_at: string; // Keep this if it's the resume creation timestamp
  phone: string;
  location: string;
  summary: string;
  skills: string[]; 
  education: Education[];
  experience: Experience[];
  projects: Project[];
  certifications: Certification[];
  languages: string[];
  links: Links; // Changed to single object based on Python model
  parsed_at: string;
  last_updated?: string; // Optional field for last update timestamp
  resume_link?: string; // Optional field for resume link ur
}
