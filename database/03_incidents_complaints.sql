-- Run after 02_seed_data.sql. Adds the Incident Reporting and Complaint modules.
USE ssms;
DROP TABLE IF EXISTS INCIDENT; DROP TABLE IF EXISTS COMPLAINT;
CREATE TABLE INCIDENT (
  IncidentID INT AUTO_INCREMENT PRIMARY KEY,
  SiteID INT NOT NULL, GuardID INT NULL, IncidentDate DATE,
  Severity ENUM('Low','Medium','High') NOT NULL DEFAULT 'Low',
  Description VARCHAR(255), Status ENUM('Open','Investigating','Closed') NOT NULL DEFAULT 'Open',
  FOREIGN KEY (SiteID) REFERENCES SECURITY_SITE(SiteID),
  FOREIGN KEY (GuardID) REFERENCES GUARD(EmployeeID)
) ENGINE=InnoDB;
CREATE TABLE COMPLAINT (
  ComplaintID INT AUTO_INCREMENT PRIMARY KEY,
  ClientID INT NOT NULL, ComplaintDate DATE, Subject VARCHAR(200),
  Status ENUM('Open','In Progress','Resolved') NOT NULL DEFAULT 'Open',
  FOREIGN KEY (ClientID) REFERENCES CLIENT(ClientID)
) ENGINE=InnoDB;

INSERT INTO INCIDENT (SiteID, GuardID, IncidentDate, Severity, Description, Status)
SELECT SiteID, GuardID, DATE_SUB('2026-10-25', INTERVAL FLOOR(RAND()*30) DAY),
  ELT(1+FLOOR(RAND()*3),'Low','Medium','High'),
  ELT(1+FLOOR(RAND()*5),'Unauthorized entry attempt','Fire alarm triggered','Vehicle theft attempt','Suspicious package reported','Gate barrier damaged'),
  ELT(1+FLOOR(RAND()*3),'Open','Investigating','Closed')
FROM GUARD_DEPLOYMENT ORDER BY RAND() LIMIT 45;

INSERT INTO COMPLAINT (ClientID, ComplaintDate, Subject, Status)
SELECT ClientID, DATE_SUB('2026-10-25', INTERVAL FLOOR(RAND()*60) DAY),
  ELT(1+FLOOR(RAND()*4),'Guard arrived late','Guard not in uniform','Request for extra night guard','Invoice query'),
  ELT(1+FLOOR(RAND()*3),'Open','In Progress','Resolved')
FROM CLIENT ORDER BY RAND() LIMIT 25;
