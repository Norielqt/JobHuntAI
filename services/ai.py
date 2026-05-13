"""
AI generation service — calls Anthropic to produce cover letters and tailored resumes.
"""
import asyncio
from anthropic import AsyncAnthropic

SYSTEM = (
    "You are an expert career coach and professional resume writer. "
    "You ONLY use real experience from the provided resume. You never fabricate, invent, or embellish. "
    "You tailor language using keywords from the job description. Return ONLY the document with no preamble."
)


async def generate_docs(
    api_key: str,
    resume: str,
    job_title: str,
    job_company: str,
    job_description: str,
) -> tuple[str, str]:
    client = AsyncAnthropic(api_key=api_key)

    cover_prompt = (
        f"Write a compelling cover letter for this job. Under 350 words.\n"
        f"Be specific to the role and company. Use keywords from the JD naturally.\n"
        f"Never use generic phrases like 'I am writing to express my interest.'\n\n"
        f"RESUME:\n{resume}\n\n"
        f"JOB TITLE: {job_title}\n"
        f"COMPANY: {job_company}\n"
        f"JOB DESCRIPTION:\n{job_description}"
    )

    resume_prompt = (
        f"Rewrite this resume tailored to the job below.\n"
        f"Reorder and rephrase bullets to highlight relevant experience and match JD keywords.\n"
        f"Keep all facts 100% truthful. Only rephrase and reorder — never invent.\n\n"
        f"RESUME:\n{resume}\n\n"
        f"JOB TITLE: {job_title}\n"
        f"COMPANY: {job_company}\n"
        f"JOB DESCRIPTION:\n{job_description}"
    )

    cover_resp, resume_resp = await asyncio.gather(
        client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            system=SYSTEM,
            messages=[{"role": "user", "content": cover_prompt}],
        ),
        client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=SYSTEM,
            messages=[{"role": "user", "content": resume_prompt}],
        ),
    )

    cover_letter = "".join(b.text for b in cover_resp.content if hasattr(b, "text"))
    tailored_resume = "".join(b.text for b in resume_resp.content if hasattr(b, "text"))

    return cover_letter, tailored_resume
