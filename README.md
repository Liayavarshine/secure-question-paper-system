# Secure Question Paper System

## Project Description

Secure Question Paper System is a web application designed to protect examination question papers throughout their lifecycle.

The system allows a Question Setter to securely upload a PDF question paper. The paper is encrypted before storage, protected with a SHA-256 integrity hash, reviewed by an Examination Officer, and released only to an authorised Examination Centre during a scheduled examination time.

The application uses Firebase Authentication for user login, Firestore for user roles, question-paper metadata, and audit logs, and Supabase Storage for private encrypted file storage.

## System workflow

Question Setter -> 
Firebase Authentication -> 
PDF Upload -> 
SHA-256 Hash Generation -> 
Fernet Encryption -> 
Private Supabase Storage -> 
Firestore Metadata and Audit Log -> 
Examination Officer Approval -> 
Controlled Release Scheduling -> 
Examination Centre Access During Exam Window -> 
Decryption and Integrity Check -> 
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

cd secure-question-paper-system

## Run

Use two terminals from the project folder.

cd backend
python -m pip install -r requirements.txt
uvicorn main:app --reload

npm install
npm run dev

Open the Vite address, normally `http://localhost:5173`.

## Demo accounts

| Role | Email | Password |
| Question Setter | question.setter@gmail.com | questionsetter |
| Examination Officer | officer@gmail.com | officer |
| Examination Centre | centre@gmail.com | centre |

Development mode displays the OTP on the login screen. Set `DEV_MODE=false` in a deployment and replace this with an approved email/SMS provider. Set unique `APP_SECRET` and `FERNET_KEY` variables before deployment.

## Security boundary

The delivered project deliberately excludes Firebase keys, Supabase keys, `.env` files, and the service-account credential found in the original archive. Generated encrypted papers and audit data reside in `backend/data/`, which Git ignores.

## Sample Input and Output

### 1. Question Setter Login

#### Sample Input

Email: question.setter@gmail.com
Password: (password)

#### Sample Output

Login successful.

Role: QUESTION_SETTER
Dashboard: Question Setter Dashboard

### 2. Upload Question Paper

#### Sample Input

Examination Name: End semester Examination
Subject Name: Cloud computing
Examination Date: 2026-10-08
Examination Time: 10:00
Question Paper File: Cloud_computing.pdf
File Type: PDF

#### Sample Output

The system performs these actions:

PDF validated
↓
SHA-256 hash generated
↓
PDF encrypted
↓
Encrypted file stored in private Supabase bucket
↓
Paper metadata stored in Firestore
↓
Audit log created
↓
Paper status: PENDING_APPROVAL

### 3. Examination Officer Approval

#### Sample Input

Email: officer@gmail.com
Password: (password)

Officer Account Role: EXAMINATION_OFFICER
Paper ID: 9a68d0d2-fec0-4e81-9327-34dd0cbf6f3e
Action: Approve

#### Sample Output

Updated paper status:

APPROVED

### 4. Controlled Release Scheduling

#### Sample Input

Paper ID: 9a68d0d2-fec0-4e81-9327-34dd0cbf6f3e
Release Time: 2026-10-15T09:45
Release Window: 120 minutes

#### Sample Output

Updated paper status:

SCHEDULED

### 5. Examination Centre Download

#### Sample Input

Email: centre@gmail.com
Password: (password)

Centre Account Role: EXAMINATION_CENTRE
Paper ID: 9a68d0d2-fec0-4e81-9327-34dd0cbf6f3e
Current Time: 2026-10-15T10:00

#### Sample Output

SHA-256 integrity verification successful.
Question paper decrypted successfully.
PDF download started: Cloud_computing.pdf

### 6. Unauthorised Download Attempt

#### Sample Input

Centre Account Role: EXAMINATION_CENTRE
Paper ID: 9a68d0d2-fec0-4e81-9327-34dd0cbf6f3e
Current Time: 2026-10-15T08:30:00+05:30

#### Sample Output

{
  "detail": "Paper is available only during the authorised examination window."
}

The denied attempt is recorded in the Firestore `auditLogs` collection.
