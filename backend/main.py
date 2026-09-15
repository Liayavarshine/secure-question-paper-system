from __future__ import annotations

import hashlib
import hmac
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

import firebase_admin
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from firebase_admin import auth, credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from supabase import create_client

load_dotenv()

# -------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
FERNET_KEY = os.getenv("FERNET_KEY")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")
FIREBASE_SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

MAX_FILE_SIZE = 10 * 1024 * 1024
BUCKET_NAME = "question-papers"

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")

if not FERNET_KEY:
    raise RuntimeError("FERNET_KEY is required.")

try:
    cipher = Fernet(FERNET_KEY.encode())
except Exception as error:
    raise RuntimeError("FERNET_KEY must be a valid Fernet key.") from error

# -------------------------------------------------------------------
# Firebase Admin
# Local: set FIREBASE_SERVICE_ACCOUNT_PATH.
# Cloud Run: leave it empty and use Application Default Credentials.
# -------------------------------------------------------------------

if not firebase_admin._apps:
    if FIREBASE_SERVICE_ACCOUNT_PATH:
        firebase_admin.initialize_app(
            credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_PATH)
        )
    else:
        options = {"projectId": FIREBASE_PROJECT_ID} if FIREBASE_PROJECT_ID else None
        firebase_admin.initialize_app(options=options)

firestore_db = firestore.client()
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# -------------------------------------------------------------------
# FastAPI
# -------------------------------------------------------------------

app = FastAPI(
    title="Secure Question Paper System API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def require_role(*roles: str):
    def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(
                status_code=403,
                detail="You are not authorised for this action.",
            )
        return user

    return dependency


def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    """Verify Firebase ID token and load role from Firestore."""

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Bearer token is required.",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        decoded_token = auth.verify_id_token(token)
    except Exception as error:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Firebase token.",
        ) from error

    uid = decoded_token["uid"]
    user_doc = firestore_db.collection("users").document(uid).get()

    if not user_doc.exists:
        raise HTTPException(
            status_code=403,
            detail="User role is not configured.",
        )

    user_data = user_doc.to_dict()

    if user_data.get("role") not in {
        "QUESTION_SETTER",
        "EXAMINATION_OFFICER",
        "EXAMINATION_CENTRE",
    }:
        raise HTTPException(
            status_code=403,
            detail="Invalid user role.",
        )

    return {
        "uid": uid,
        "email": decoded_token.get("email", ""),
        "displayName": user_data.get("displayName", ""),
        "role": user_data["role"],
    }


def write_audit_log(
    actor_uid: str,
    action: str,
    paper_id: str | None = None,
    details: str = "",
) -> None:
    firestore_db.collection("auditLogs").add(
        {
            "actorUid": actor_uid,
            "action": action,
            "paperId": paper_id,
            "details": details,
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
    )


def safe_filename(filename: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", filename)


def verify_pdf(file_content: bytes, filename: str, content_type: str | None) -> None:
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are allowed.")

    if content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(400, "Invalid PDF content type.")

    if not file_content.startswith(b"%PDF-"):
        raise HTTPException(400, "The uploaded file is not a valid PDF.")


def paper_response(document) -> dict:
    data = document.to_dict()
    data["id"] = document.id
    return data


def parse_release_time(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail="release_at must be ISO format, for example 2026-09-15T10:00:00+05:30.",
        ) from error

    if parsed.tzinfo is None:
        raise HTTPException(
            status_code=400,
            detail="release_at must include a timezone offset.",
        )

    return parsed.astimezone(timezone.utc)

# -------------------------------------------------------------------
# Basic health route
# -------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "authentication": "firebase",
        "database": "firestore",
        "storage": "private-supabase",
        "encryption": "fernet",
    }

# -------------------------------------------------------------------
# List papers
# -------------------------------------------------------------------

@app.get("/papers")
def list_papers(user: dict = Depends(get_current_user)):
    papers = firestore_db.collection("questionPapers")

    if user["role"] == "QUESTION_SETTER":
        query = papers.where(
            filter=FieldFilter("uploadedBy", "==", user["uid"])
        )
    elif user["role"] == "EXAMINATION_CENTRE":
        query = papers.where(
            filter=FieldFilter("status", "==", "SCHEDULED")
        )
    else:
        query = papers

    return [paper_response(document) for document in query.stream()]

# -------------------------------------------------------------------
# Upload encrypted question paper
# -------------------------------------------------------------------

@app.post("/papers")
async def upload_paper(
    file: UploadFile = File(...),
    exam_name: str = Form(...),
    subject_name: str = Form(...),
    exam_date: str = Form(...),
    exam_time: str = Form(...),
    user: dict = Depends(require_role("QUESTION_SETTER")),
):
    if not all(
        [
            exam_name.strip(),
            subject_name.strip(),
            exam_date.strip(),
            exam_time.strip(),
        ]
    ):
        raise HTTPException(400, "All examination fields are required.")

    file_content = await file.read()

    if not file_content:
        raise HTTPException(400, "Uploaded file is empty.")

    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(400, "PDF must not exceed 10 MB.")

    verify_pdf(file_content, file.filename, file.content_type)

    paper_id = str(uuid.uuid4())
    sha256_hash = hashlib.sha256(file_content).hexdigest()
    encrypted_content = cipher.encrypt(file_content)

    storage_path = f"{user['uid']}/{paper_id}.enc"

    try:
        supabase.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=encrypted_content,
            file_options={
                "content-type": "application/octet-stream",
                "upsert": "false",
            },
        )
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Encrypted upload to Supabase failed.",
        ) from error

    paper_data = {
        "examName": exam_name.strip(),
        "subjectName": subject_name.strip(),
        "examDate": exam_date,
        "examTime": exam_time,
        "fileName": safe_filename(file.filename),
        "filePath": storage_path,
        "fileHash": sha256_hash,
        "uploadedBy": user["uid"],
        "uploadedByEmail": user["email"],
        "status": "PENDING_APPROVAL",
        "integrityStatus": "VERIFIED_AT_UPLOAD",
        "createdAt": firestore.SERVER_TIMESTAMP,
        "approvedBy": None,
        "approvedAt": None,
        "releaseAt": None,
        "releaseWindowMinutes": None,
    }

    firestore_db.collection("questionPapers").document(paper_id).set(paper_data)

    write_audit_log(
        actor_uid=user["uid"],
        action="PAPER_UPLOADED_ENCRYPTED",
        paper_id=paper_id,
        details=f"SHA-256: {sha256_hash}",
    )

    return {
        "success": True,
        "paperId": paper_id,
        "message": "Paper encrypted and submitted for approval.",
        "sha256": sha256_hash,
    }

# -------------------------------------------------------------------
# Officer approval
# -------------------------------------------------------------------

@app.post("/papers/{paper_id}/approve")
def approve_paper(
    paper_id: str,
    user: dict = Depends(require_role("EXAMINATION_OFFICER")),
):
    paper_ref = firestore_db.collection("questionPapers").document(paper_id)
    paper_doc = paper_ref.get()

    if not paper_doc.exists:
        raise HTTPException(404, "Question paper not found.")

    paper = paper_doc.to_dict()

    if paper.get("status") != "PENDING_APPROVAL":
        raise HTTPException(
            status_code=409,
            detail="Only pending papers can be approved.",
        )

    paper_ref.update(
        {
            "status": "APPROVED",
            "approvedBy": user["uid"],
            "approvedByEmail": user["email"],
            "approvedAt": firestore.SERVER_TIMESTAMP,
        }
    )

    write_audit_log(
        actor_uid=user["uid"],
        action="PAPER_APPROVED",
        paper_id=paper_id,
        details="Approved for controlled release.",
    )

    return {"success": True, "message": "Paper approved."}

# -------------------------------------------------------------------
# Officer schedules controlled release
# -------------------------------------------------------------------

@app.post("/papers/{paper_id}/release")
def schedule_release(
    paper_id: str,
    release_at: str = Form(...),
    release_window_minutes: int = Form(120),
    user: dict = Depends(require_role("EXAMINATION_OFFICER")),
):
    if not 1 <= release_window_minutes <= 360:
        raise HTTPException(
            status_code=400,
            detail="Release window must be between 1 and 360 minutes.",
        )

    release_time = parse_release_time(release_at)

    paper_ref = firestore_db.collection("questionPapers").document(paper_id)
    paper_doc = paper_ref.get()

    if not paper_doc.exists:
        raise HTTPException(404, "Question paper not found.")

    paper = paper_doc.to_dict()

    if paper.get("status") != "APPROVED":
        raise HTTPException(
            status_code=409,
            detail="Paper must be approved before scheduling release.",
        )

    paper_ref.update(
        {
            "status": "SCHEDULED",
            "releaseAt": release_time,
            "releaseWindowMinutes": release_window_minutes,
            "scheduledBy": user["uid"],
            "scheduledAt": firestore.SERVER_TIMESTAMP,
        }
    )

    write_audit_log(
        actor_uid=user["uid"],
        action="CONTROLLED_RELEASE_SCHEDULED",
        paper_id=paper_id,
        details=(
            f"Release at {release_time.isoformat()} "
            f"for {release_window_minutes} minutes."
        ),
    )

    return {
        "success": True,
        "message": "Controlled release scheduled.",
    }

# -------------------------------------------------------------------
# Centre controlled download
# -------------------------------------------------------------------

@app.get("/papers/{paper_id}/download")
def download_paper(
    paper_id: str,
    user: dict = Depends(require_role("EXAMINATION_CENTRE")),
):
    paper_ref = firestore_db.collection("questionPapers").document(paper_id)
    paper_doc = paper_ref.get()

    if not paper_doc.exists:
        raise HTTPException(404, "Question paper not found.")

    paper = paper_doc.to_dict()

    if paper.get("status") != "SCHEDULED":
        raise HTTPException(403, "Paper has not been released.")

    release_at = paper.get("releaseAt")
    release_window = paper.get("releaseWindowMinutes")

    if not release_at or not release_window:
        raise HTTPException(403, "Release schedule is incomplete.")

    if release_at.tzinfo is None:
        release_at = release_at.replace(tzinfo=timezone.utc)

    release_end = release_at + timedelta(minutes=release_window)

    if not release_at <= utc_now() <= release_end:
        write_audit_log(
            actor_uid=user["uid"],
            action="RELEASE_ACCESS_DENIED",
            paper_id=paper_id,
            details="Download attempted outside the authorised release window.",
        )

        raise HTTPException(
            status_code=403,
            detail="Paper is available only during the authorised examination window.",
        )

    try:
        encrypted_content = supabase.storage.from_(BUCKET_NAME).download(
            paper["filePath"]
        )
        decrypted_content = cipher.decrypt(encrypted_content)
    except InvalidToken as error:
        raise HTTPException(
            status_code=500,
            detail="Encrypted paper could not be decrypted.",
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Paper could not be retrieved from secure storage.",
        ) from error

    calculated_hash = hashlib.sha256(decrypted_content).hexdigest()

    if not hmac.compare_digest(calculated_hash, paper["fileHash"]):
        paper_ref.update({"integrityStatus": "FAILED"})
        write_audit_log(
            actor_uid=user["uid"],
            action="INTEGRITY_CHECK_FAILED",
            paper_id=paper_id,
            details="SHA-256 mismatch. Paper release blocked.",
        )

        raise HTTPException(
            status_code=500,
            detail="Integrity check failed. Paper release blocked.",
        )

    paper_ref.update(
        {
            "integrityStatus": "VERIFIED_AT_RELEASE",
            "lastReleasedAt": firestore.SERVER_TIMESTAMP,
        }
    )

    write_audit_log(
        actor_uid=user["uid"],
        action="PAPER_RELEASED_TO_CENTRE",
        paper_id=paper_id,
        details="Encrypted file decrypted and SHA-256 verified.",
    )

    filename = safe_filename(paper["fileName"])

    return Response(
        content=decrypted_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )

# -------------------------------------------------------------------
# Officer audit log access
# -------------------------------------------------------------------

@app.get("/audit")
def list_audit_logs(
    user: dict = Depends(require_role("EXAMINATION_OFFICER")),
):
    logs = (
        firestore_db.collection("auditLogs")
        .order_by("createdAt", direction=firestore.Query.DESCENDING)
        .limit(100)
        .stream()
    )

    return [
        {
            "id": document.id,
            **document.to_dict(),
        }
        for document in logs
    ]