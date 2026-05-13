from pydantic import BaseModel, Field
from typing import Optional
import uuid


class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    title: str
    company: str
    platform: str
    location: str = "Remote"
    type: str = "full-time"          # "freelance" | "full-time"
    salary: str = ""
    description: str = ""
    url: str = ""
    postedAt: str = ""


class ScrapeRequest(BaseModel):
    keywords: str
    platforms: list[str]
    limit_per_platform: int = 10


class ScrapeResponse(BaseModel):
    jobs: list[Job]
    total: int
    errors: dict[str, str] = Field(default_factory=dict)


class GenerateRequest(BaseModel):
    resume: str
    job_title: str
    job_company: str
    job_description: str


class GenerateResponse(BaseModel):
    coverLetter: str
    tailoredResume: str
