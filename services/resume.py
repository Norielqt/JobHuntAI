"""
Resume parsing service — extracts plain text from PDF, DOCX, and TXT files.
"""
import io


async def parse_resume_file(content: bytes, filename: str) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        return _parse_pdf(content)
    if name.endswith(".docx"):
        return _parse_docx(content)
    if name.endswith(".doc"):
        raise ValueError(".doc format is not supported. Please save as .docx or .pdf.")
    # Plain text
    return content.decode("utf-8", errors="replace")


def _parse_pdf(content: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(content))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n".join(pages).strip()


def _parse_docx(content: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(content))
    lines = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(lines)
