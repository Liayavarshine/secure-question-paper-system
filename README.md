# Secure Question Paper System

## Project Description

Secure Question Paper System is a web application designed to protect examination question papers throughout their lifecycle.

The system allows a Question Setter to securely upload a PDF question paper. The paper is encrypted before storage, protected with a SHA-256 integrity hash, reviewed by an Examination Officer, and released only to an authorised Examination Centre during a scheduled examination time.

The application uses Firebase Authentication for user login, Firestore for user roles, question-paper metadata, and audit logs, and Supabase Storage for private encrypted file storage.

## System workflow

Question Setter
      ↓
Firebase Authentication
      ↓
PDF Upload
      ↓
SHA-256 Hash Generation
      ↓
Fernet Encryption
      ↓
Private Supabase Storage
      ↓
Firestore Metadata and Audit Log
      ↓
Examination Officer Approval
      ↓
Controlled Release Scheduling
      ↓
Examination Centre Access During Exam Window
      ↓
Decryption and Integrity Check
      ↓
PDF Download

## Features

- Firebase email/password authentication
- Role-based access control
  - Question Setter
  - Examination Officer
  - Examination Centre
- Secure PDF question-paper upload
- Fernet encryption before cloud storage
- SHA-256 file integrity verification
- Private Supabase Storage bucket
- Officer approval workflow
- Controlled time-based paper release
- Examination-centre-only download access
- Firestore audit logging

## Technologies and Tools Used

### Frontend

- React
- Vite
- Firebase JavaScript SDK
- Firebase Authentication
- Cloud Firestore
- HTML
- CSS
- JavaScript

### Backend

- Python
- FastAPI
- Uvicorn
- Firebase Admin SDK
- Supabase Python SDK
- Cryptography Fernet
- Python Multipart

### Cloud Services

- Firebase Authentication
- Cloud Firestore
- Supabase Storage
- Google Cloud Run, optional for deployment
- Firebase Hosting, optional for frontend deployment

## Prerequisites

Install the following software:

- Node.js 18 or newer
- Python 3.10 or newer
- Firebase project
- Supabase project
- Git, optional

## Installation

### 1. Clone or extract the project

```powershell
cd secure-question-paper-system
## Run

Use two terminals from the project folder.

```powershell
cd backend
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

```powershell
npm install
npm run dev
```

Open the Vite address, normally `http://localhost:5173`.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Question Setter | question.setter@gmail.com | questionsetter |
| Examination Officer | officer@gmail.com | officer |
| Examination Centre | centre@gmail.com | centre |

Development mode displays the OTP on the login screen. Set `DEV_MODE=false` in a deployment and replace this with an approved email/SMS provider. Set unique `APP_SECRET` and `FERNET_KEY` variables before deployment.

## Security boundary

The delivered project deliberately excludes Firebase keys, Supabase keys, `.env` files, and the service-account credential found in the original archive. Generated encrypted papers and audit data reside in `backend/data/`, which Git ignores.
