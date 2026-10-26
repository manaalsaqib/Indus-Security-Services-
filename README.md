# SSMS – Indus Security Services

```
ssms/
├─ database/   01_schema · 02_seed_data · 03_incidents_complaints · 04_views_triggers_procedures · generate_seed.py
├─ backend/    server.js · package.json · .env.example   (Node + Express + MySQL)
└─ frontend/   index.html                                  (served by the backend)
```

## 1. Database in MySQL Workbench
1. Open Workbench and click your local connection (host 127.0.0.1, port 3306, user root). If you have none: **+** next to *MySQL Connections* → Test Connection → OK.
2. **File → Open SQL Script** → `database/01_schema.sql` → click the lightning bolt.
3. Run, in this order: `02_seed_data.sql` (about 650 KB, a few seconds), then `03_incidents_complaints.sql`, then `04_views_triggers_procedures.sql`.
4. Right-click *Schemas* → Refresh. Check with:
   `SELECT Role, COUNT(*) FROM EMPLOYEE GROUP BY Role;`

## 2. Backend + frontend
1. Install Node.js (LTS). In a terminal: `cd backend`, then `copy .env.example .env` (Windows) or `cp .env.example .env`.
2. Edit `.env`: set `DB_PASSWORD` to your Workbench password.
3. `npm install` then `npm start`. Open http://localhost:3000.

Workbench and the backend connect to the same MySQL server with the same login, so any change you make in Workbench shows up in the dashboard after a page refresh.

## Logins
| Username | Password | Role |
|---|---|---|
| gm | gm123 | General Manager – all pages |
| operations | ops123 | Operations Manager – no payroll/invoices |
| accountant | acc123 | Accountant – payroll, invoices, clients, employees, attendance |

Passwords use SHA2 hashing: fine for a semester demo, not for production.

## Who can add, edit and delete
GM: every page. Operations Manager: employees, clients, sites, deployments, equipment, incidents, complaints. Accountant: payroll and invoices. Everyone else is read-only.

## Changing the data
Edit the constants at the top of `generate_seed.py`, then `python generate_seed.py` rewrites `02_seed_data.sql`.
