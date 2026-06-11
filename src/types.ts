// Define basic types (you can refine these later based on your actual table structure)
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
