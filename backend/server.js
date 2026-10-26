require('dotenv').config();
const fs = require('fs');
const cors = require('cors');
const express = require('express'), mysql = require('mysql2/promise'), jwt = require('jsonwebtoken'), path = require('path');
const app = express(); 
app.use(cors({
  origin: 'https://manaalsaqib.github.io',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    ca: fs.readFileSync(path.join(__dirname, 'ca.pem'), 'utf8'),
    rejectUnauthorized: true
  },
  dateStrings: true,
  connectionLimit: 5,
  connectTimeout: 10000
});
// Each list = one SQL query. Edit here to change what a screen shows.
const LISTS = {
  employees: `SELECT e.EmployeeID, e.FullName, e.Role, e.CNIC, e.PhoneNumber, b.BranchName AS Branch, e.HireDate
              FROM EMPLOYEE e LEFT JOIN BRANCH b ON b.BranchID = e.BranchID ORDER BY e.EmployeeID`,
  guards: `SELECT g.EmployeeID, e.FullName, e.CNIC, g.Availability, g.Status
           FROM GUARD g JOIN EMPLOYEE e ON e.EmployeeID = g.EmployeeID ORDER BY g.EmployeeID`,
  clients: `SELECT ClientID, CompanyName, ContactPerson, ContactNumber, Email, ContractStartDate, ContractEndDate FROM CLIENT`,
  sites: `SELECT s.SiteID, s.SiteName, c.CompanyName AS Client, s.City, sup.FullName AS Supervisor
          FROM SECURITY_SITE s JOIN CLIENT c ON c.ClientID = s.ClientID JOIN EMPLOYEE sup ON sup.EmployeeID = s.SupervisorID`,
  deployments: `SELECT d.DeploymentID, e.FullName AS Guard, s.SiteName AS Site, d.Shift, d.StartDate
                FROM GUARD_DEPLOYMENT d JOIN EMPLOYEE e ON e.EmployeeID = d.GuardID JOIN SECURITY_SITE s ON s.SiteID = d.SiteID`,
  attendance: `SELECT a.AttendanceDate AS Date, e.FullName, e.Role, a.CheckIn, a.CheckOut, a.AttendanceStatus AS Status
               FROM ATTENDANCE a JOIN EMPLOYEE e ON e.EmployeeID = a.EmployeeID ORDER BY a.AttendanceDate DESC, e.FullName LIMIT 500`,
  payroll: `SELECT p.PayrollID, e.FullName, e.Role, p.BaseSalary, p.Allowances, p.NetSalary, p.PaymentMethod, p.PaymentStatus AS Status
            FROM PAYROLL p JOIN EMPLOYEE e ON e.EmployeeID = p.EmployeeID`,
  equipment: `SELECT q.EquipmentID, q.EquipmentName, q.SerialNo, q.Status, e.FullName AS AssignedTo
              FROM EQUIPMENT q LEFT JOIN EMPLOYEE e ON e.EmployeeID = q.AssignedTo`,
  invoices: `SELECT i.InvoiceID, c.CompanyName AS Client, i.InvoiceDate, i.DueDate, i.Amount, i.Status
             FROM INVOICE i JOIN CLIENT c ON c.ClientID = i.ClientID ORDER BY i.InvoiceDate DESC`
};
// Who can open what
LISTS.incidents = `SELECT i.IncidentID, i.IncidentDate AS Date, s.SiteName AS Site, e.FullName AS Guard, i.Severity, i.Description, i.Status
  FROM INCIDENT i JOIN SECURITY_SITE s ON s.SiteID = i.SiteID LEFT JOIN EMPLOYEE e ON e.EmployeeID = i.GuardID ORDER BY i.IncidentDate DESC`;
LISTS.complaints = `SELECT m.ComplaintID, m.ComplaintDate AS Date, c.CompanyName AS Client, m.Subject, m.Status
  FROM COMPLAINT m JOIN CLIENT c ON c.ClientID = m.ClientID ORDER BY m.ComplaintDate DESC`;
const OPS = ['employees','guards','clients','sites','deployments','attendance','equipment','incidents','complaints'];
const ACCESS = { 'General Manager': Object.keys(LISTS), 'Operations Manager': OPS,
                 'Accountant': ['employees','clients','payroll','invoices','attendance'] };

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const [r] = await db.query(`SELECT u.UserID, u.Username, e.FullName, e.Role FROM USERS u
    JOIN EMPLOYEE e ON e.EmployeeID = u.EmployeeID WHERE u.Username = ? AND u.PasswordHash = SHA2(?, 256)`, [username, password]);
  if (!r.length) return res.status(401).json({ error: 'Wrong username or password' });
  const user = r[0];
  res.json({ token: jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '8h' }), user, tables: ACCESS[user.Role], write: WRITE[user.Role] });
});

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Please sign in again' }); }
}

app.get('/api/dashboard', auth, async (req, res) => {
  const [[c]] = await db.query(`SELECT
    (SELECT COUNT(*) FROM EMPLOYEE) AS employees,
    (SELECT COUNT(*) FROM GUARD WHERE Status='Active') AS activeGuards,
    (SELECT COUNT(*) FROM GUARD WHERE Availability='Available') AS benchGuards,
    (SELECT COUNT(*) FROM CLIENT) AS clients,
    (SELECT COUNT(*) FROM SECURITY_SITE) AS sites,
    (SELECT COUNT(*) FROM ATTENDANCE WHERE AttendanceDate=(SELECT MAX(AttendanceDate) FROM ATTENDANCE) AND AttendanceStatus IN ('Present','Late')) AS presentLastDay,
    (SELECT MAX(AttendanceDate) FROM ATTENDANCE) AS lastDay,
    (SELECT COUNT(*) FROM PAYROLL WHERE PaymentStatus='Pending') AS pendingPayroll,
    (SELECT COALESCE(SUM(Amount),0) FROM INVOICE WHERE Status='Overdue') AS overdueAmount`);
  res.json(c);
});

app.get('/api/:list', auth, async (req, res) => {
  const { list } = req.params;
  if (!LISTS[list]) return res.status(404).json({ error: 'Unknown list' });
  if (!ACCESS[req.user.Role].includes(list)) return res.status(403).json({ error: 'Your role cannot open this page' });
  const [rows] = await db.query(LISTS[list]); res.json(rows);
});


// ---- Add / edit / delete. f = columns the form edits (exact column names). ----
const CRUD = {
  employees:   { t: 'EMPLOYEE', pk: 'EmployeeID', f: ['FullName','CNIC','PhoneNumber','Address','BranchID','Role','HireDate'] },
  clients:     { t: 'CLIENT', pk: 'ClientID', f: ['CompanyName','ContactPerson','ContactNumber','Email','OfficeAddress','ContractStartDate','ContractEndDate'] },
  sites:       { t: 'SECURITY_SITE', pk: 'SiteID', f: ['ClientID','SiteName','City','ContactNumber','SupervisorID'] },
  deployments: { t: 'GUARD_DEPLOYMENT', pk: 'DeploymentID', f: ['GuardID','SiteID','Shift','StartDate','EndDate'] },
  equipment:   { t: 'EQUIPMENT', pk: 'EquipmentID', f: ['EquipmentName','SerialNo','Status','AssignedTo'] },
  payroll:     { t: 'PAYROLL', pk: 'PayrollID', f: ['EmployeeID','BaseSalary','Allowances','NetSalary','PaymentMethod','PaymentStatus'] },
  invoices:    { t: 'INVOICE', pk: 'InvoiceID', f: ['ClientID','InvoiceDate','DueDate','Amount','Status'] },
  incidents:   { t: 'INCIDENT', pk: 'IncidentID', f: ['SiteID','GuardID','IncidentDate','Severity','Description','Status'] },
  complaints:  { t: 'COMPLAINT', pk: 'ComplaintID', f: ['ClientID','ComplaintDate','Subject','Status'] }
};
const WRITE = { 'General Manager': Object.keys(CRUD),
  'Operations Manager': ['employees','clients','sites','deployments','equipment','incidents','complaints'],
  'Accountant': ['payroll','invoices'] };
const friendly = e => e.code === 'ER_DUP_ENTRY' ? 'That value already exists (duplicate CNIC or serial number).'
  : e.code === 'ER_ROW_IS_REFERENCED_2' ? 'This record is used by other records (attendance, deployments, invoices...), so it cannot be deleted.'
  : e.code === 'ER_NO_REFERENCED_ROW_2' ? 'One of the IDs you entered does not exist (client, site, employee or branch).' : e.sqlMessage || e.message;
const row = (req, res) => { const c = CRUD[req.params.l];
  if (!c || !(WRITE[req.user.Role] || []).includes(req.params.l)) { res.status(403).json({ error: 'Your role cannot change this page' }); return null; } return c; };
const vals = (c, b) => c.f.map(k => (b[k] === '' || b[k] === undefined) ? null : b[k]);

app.get('/api/meta/:l', auth, (req, res) => CRUD[req.params.l] ? res.json(CRUD[req.params.l].f) : res.sendStatus(404));
app.get('/api/:l/:id', auth, async (req, res) => { const c = CRUD[req.params.l];
  if (!c || !ACCESS[req.user.Role].includes(req.params.l)) return res.sendStatus(404);
  const [r] = await db.query('SELECT * FROM ?? WHERE ?? = ?', [c.t, c.pk, req.params.id]); r.length ? res.json(r[0]) : res.sendStatus(404); });
app.post('/api/:l', auth, async (req, res) => { const c = row(req, res); if (!c) return;
  try { const [r] = await db.query('INSERT INTO ?? (??) VALUES (?)', [c.t, c.f, vals(c, req.body)]);
    if (c.t === 'EMPLOYEE' && req.body.Role === 'Guard') await db.query("INSERT INTO GUARD (EmployeeID, Availability, Status) VALUES (?, 'Available', 'Active')", [r.insertId]);
    res.json({ id: r.insertId }); } catch (e) { res.status(400).json({ error: friendly(e) }); } });
app.put('/api/:l/:id', auth, async (req, res) => { const c = row(req, res); if (!c) return;
  try { const v = vals(c, req.body); await db.query('UPDATE ?? SET ? WHERE ?? = ?', [c.t, Object.fromEntries(c.f.map((k, i) => [k, v[i]])), c.pk, req.params.id]); res.json({ ok: 1 }); }
  catch (e) { res.status(400).json({ error: friendly(e) }); } });
app.delete('/api/:l/:id', auth, async (req, res) => { const c = row(req, res); if (!c) return; const cn = await db.getConnection();
  try { await cn.beginTransaction();
    if (c.t === 'EMPLOYEE') await cn.query('DELETE FROM GUARD WHERE EmployeeID = ?', [req.params.id]);
    await cn.query('DELETE FROM ?? WHERE ?? = ?', [c.t, c.pk, req.params.id]); await cn.commit(); res.json({ ok: 1 }); }
  catch (e) { await cn.rollback(); res.status(400).json({ error: friendly(e) }); } finally { cn.release(); } });

app.use(express.static(path.join(__dirname, '../frontend')));

if (require.main === module) {
  db.query('SELECT 1')
    .then(() => {
      app.listen(process.env.PORT || 3000, () => {
        console.log('SSMS backend running');
      });
    })
    .catch(e => {
      console.error('Cannot connect to MySQL:', e.message);
      process.exit(1);
    });
}

module.exports = app;
