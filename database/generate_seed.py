"""Generates 02_seed_data.sql. Change the constants and re-run: python generate_seed.py"""
import random, datetime as dt, itertools
random.seed(7)
GUARDS, SUPERVISORS, SITES, CLIENTS, DAYS = 348, 8, 60, 36, 30
TODAY = dt.date(2026, 10, 25)
FIRST = "Muhammad Ali Ahmed Hassan Usman Bilal Imran Kamran Faisal Tariq Zubair Hamza Saad Asad Raza Naveed Adnan Shahid Waqas Irfan Junaid Salman Rizwan Danish Asif Nadeem Fahad Haider Owais".split()
LAST = "Khan Malik Sheikh Siddiqui Qureshi Baloch Raja Chaudhry Ansari Memon Abbasi Mirza Butt Jatoi Rind Shah Hussain Awan Niazi Lodhi".split()
BRANCHES = [("Karachi Head Office","Karachi","Shahrah-e-Faisal"),("Karachi North","Karachi","North Nazimabad"),
            ("Lahore Branch","Lahore","Gulberg III"),("Islamabad Branch","Islamabad","Blue Area")]
AREAS = ["Gulshan","Korangi","Malir","Saddar","Clifton","Orangi","Landhi","Defence","Johar","Liaquatabad"]
def q(v):
    if v is None: return "NULL"
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"
out = ["USE ssms;", "SET FOREIGN_KEY_CHECKS=0;"]
def ins(t, cols, rows, n=400):
    for i in range(0, len(rows), n):
        vals = ",\n".join("(" + ",".join(q(x) for x in r) + ")" for r in rows[i:i+n])
        out.append(f"INSERT INTO {t} ({cols}) VALUES\n{vals};")
phone = lambda: f"03{random.randint(0,4)}{random.randint(0,9)}-{random.randint(1000000,9999999)}"
cnics = set()
def cnic():
    while True:
        c = f"4{random.randint(1000,9999)}-{random.randint(1000000,9999999)}-{random.randint(1,9)}"
        if c not in cnics: cnics.add(c); return c

ins("BRANCH","BranchName,City,Address,ContactNumber",[(b,c,a,phone()) for b,c,a in BRANCHES])

roles = ["General Manager","Operations Manager","Accountant"] + ["Supervisor"]*SUPERVISORS + ["Guard"]*GUARDS
emps = []
for i, r in enumerate(roles):
    branch = 1 if i < 3 else random.choices([1,2,3,4],[5,3,2,1])[0]
    hire = TODAY - dt.timedelta(days=random.randint(90, 2200))
    emps.append((f"{random.choice(FIRST)} {random.choice(FIRST+LAST)} {random.choice(LAST)}", cnic(), phone(),
                 f"House {random.randint(1,400)}, {random.choice(AREAS)}", branch, r, hire))
ins("EMPLOYEE","FullName,CNIC,PhoneNumber,Address,BranchID,Role,HireDate",emps)
sup_ids = list(range(4, 4+SUPERVISORS)); guard_ids = list(range(4+SUPERVISORS, 4+SUPERVISORS+GUARDS))

pre = "Crescent Karakoram Sapphire Falcon Zameen Noor Pioneer Bolan Sunrise Orient Mehran Chenab".split()
typ = ["Textiles Ltd","Pharma (Pvt) Ltd","Logistics","Developers"]
names = [f"{p} {t}" for p, t in itertools.product(pre, typ)]; random.shuffle(names)
clients = []
for n in names[:CLIENTS]:
    s = TODAY - dt.timedelta(days=random.randint(60, 1000)); e = s + dt.timedelta(days=365*random.choice([1,2,3]))
    clients.append((n, f"{random.choice(FIRST)} {random.choice(LAST)}", phone(), n.split()[0].lower()+"@example.com",
                    f"Plot {random.randint(1,99)}, {random.choice(AREAS)}, Karachi", s, e))
ins("CLIENT","CompanyName,ContactPerson,ContactNumber,Email,OfficeAddress,ContractStartDate,ContractEndDate",clients)

site_client = list(range(1, CLIENTS+1)) + [random.randint(1, CLIENTS) for _ in range(SITES-CLIENTS)]
sites = [(c, f"{clients[c-1][0].split()[0]} {random.choice(['Main Gate','Warehouse','Plant','Tower','Depot'])} {i+1}", "Karachi", phone(), sup_ids[i % SUPERVISORS])
         for i, c in enumerate(site_client)]
ins("SECURITY_SITE","ClientID,SiteName,City,ContactNumber,SupervisorID",sites)

deployed = guard_ids[:-20]; shift_of = {}; dep = []; per_client = {}   # last 20 guards stay on the bench
for k, g in enumerate(deployed):
    s = k % SITES; sh = "Day" if (k // SITES) % 2 == 0 else "Night"; shift_of[g] = sh
    dep.append((g, s+1, sh, TODAY - dt.timedelta(days=random.randint(10, 400)), None))
    per_client[site_client[s]] = per_client.get(site_client[s], 0) + 1
ins("GUARD","EmployeeID,Availability,Status",
    [(g, "Deployed" if g in shift_of else random.choice(["Available","On Leave"]), "Active" if random.random() > .04 else "Inactive") for g in guard_ids])
ins("GUARD_DEPLOYMENT","GuardID,SiteID,Shift,StartDate,EndDate",dep)

att = []
for e in range(1, len(emps)+1):
    sh = shift_of.get(e, "Office")
    ci, co = {"Day":("08:00","20:00"),"Night":("20:00","08:00"),"Office":("09:00","17:00")}[sh]
    for d in range(DAYS, 0, -1):
        day = TODAY - dt.timedelta(days=d); x = random.random()
        if x < .04: att.append((e, day, None, None, "Absent"))
        elif x < .07: att.append((e, day, None, None, "Leave"))
        else:
            late = x < .15; h, m = map(int, ci.split(":")); mins = h*60 + m + (random.randint(15,40) if late else random.randint(-10,5))
            att.append((e, day, f"{(mins//60)%24:02d}:{mins%60:02d}:00", co+":00", "Late" if late else "Present"))
ins("ATTENDANCE","EmployeeID,AttendanceDate,CheckIn,CheckOut,AttendanceStatus",att,1000)

base = {"Guard":40000,"Supervisor":70000,"Operations Manager":150000,"General Manager":250000,"Accountant":90000}
pay = []
for i, e in enumerate(emps, 1):
    b = base[e[5]]; a = random.choice([2000,3000,5000,8000])
    pay.append((i, b, a, b+a, "Cash" if e[5]=="Guard" and random.random()<.3 else "Bank Transfer", "Paid" if random.random() < .7 else "Pending"))
ins("PAYROLL","EmployeeID,BaseSalary,Allowances,NetSalary,PaymentMethod,PaymentStatus",pay)

kinds = ["Walkie-Talkie","Baton","Torch","Uniform Set","Metal Detector","Raincoat"]
eq = []
for i in range(1, 421):
    st = random.choice(["Issued","Issued","In Store","Repair"])
    eq.append((random.choice(kinds), f"EQ-{i:05d}", st, random.choice(guard_ids) if st == "Issued" else None))
ins("EQUIPMENT","EquipmentName,SerialNo,Status,AssignedTo",eq)

inv = []   # Aug, Sep, Oct 2026: guards on site x PKR 62,000
for c in range(1, CLIENTS+1):
    for m, st in ((8,"Paid"),(9,random.choice(["Paid","Paid","Overdue"])),(10,"Pending")):
        d = dt.date(2026, m, 1); inv.append((c, d, d + dt.timedelta(days=30), per_client.get(c,1)*62000, st))
ins("INVOICE","ClientID,InvoiceDate,DueDate,Amount,Status",inv)

out.append("INSERT INTO USERS (EmployeeID,Username,PasswordHash) VALUES (1,'gm',SHA2('gm123',256)),(2,'operations',SHA2('ops123',256)),(3,'accountant',SHA2('acc123',256));")
out.append("SET FOREIGN_KEY_CHECKS=1;")
open("02_seed_data.sql","w",encoding="utf-8").write("\n".join(out)+"\n")
print(len(emps),"employees |",GUARDS,"guards |",len(clients),"clients |",len(sites),"sites |",len(att),"attendance rows")
