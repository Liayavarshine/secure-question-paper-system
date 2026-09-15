# Secure Question Paper System

A complete local demonstration of the supplied flow: OTP login, role-controlled submission, encrypted private storage, SHA-256 integrity checks, officer approval, controlled time-window release, and audit logging.

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
| Question Setter | setter@example.edu | Setter@123 |
| Examination Officer | officer@example.edu | Officer@123 |
| Examination Centre | centre@example.edu | Centre@123 |

Development mode displays the OTP on the login screen. Set `DEV_MODE=false` in a deployment and replace this with an approved email/SMS provider. Set unique `APP_SECRET` and `FERNET_KEY` variables before deployment.

## Security boundary

The delivered project deliberately excludes Firebase keys, Supabase keys, `.env` files, and the service-account credential found in the original archive. Generated encrypted papers and audit data reside in `backend/data/`, which Git ignores.
