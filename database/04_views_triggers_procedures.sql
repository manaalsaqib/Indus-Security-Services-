-- Run last. Views, a trigger and a stored procedure for the report/logic requirements.
USE ssms;

CREATE OR REPLACE VIEW v_site_staffing AS
SELECT s.SiteID, s.SiteName, c.CompanyName, sup.FullName AS Supervisor,
  SUM(d.Shift='Day') AS DayGuards, SUM(d.Shift='Night') AS NightGuards
FROM SECURITY_SITE s
JOIN CLIENT c ON c.ClientID = s.ClientID
JOIN EMPLOYEE sup ON sup.EmployeeID = s.SupervisorID
LEFT JOIN GUARD_DEPLOYMENT d ON d.SiteID = s.SiteID AND d.EndDate IS NULL
GROUP BY s.SiteID, s.SiteName, c.CompanyName, sup.FullName;

CREATE OR REPLACE VIEW v_attendance_summary AS
SELECT e.EmployeeID, e.FullName, e.Role,
  SUM(a.AttendanceStatus='Present') AS PresentDays, SUM(a.AttendanceStatus='Late') AS LateDays,
  SUM(a.AttendanceStatus='Absent') AS AbsentDays, SUM(a.AttendanceStatus='Leave') AS LeaveDays
FROM EMPLOYEE e JOIN ATTENDANCE a ON a.EmployeeID = e.EmployeeID
GROUP BY e.EmployeeID, e.FullName, e.Role;

DROP TRIGGER IF EXISTS trg_block_inactive_guard;
DROP TRIGGER IF EXISTS trg_mark_guard_deployed;
DROP PROCEDURE IF EXISTS sp_attendance_report;
DELIMITER $$
CREATE TRIGGER trg_block_inactive_guard BEFORE INSERT ON GUARD_DEPLOYMENT
FOR EACH ROW BEGIN
  IF (SELECT Status FROM GUARD WHERE EmployeeID = NEW.GuardID) = 'Inactive' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Inactive guards cannot be deployed';
  END IF;
END$$
CREATE TRIGGER trg_mark_guard_deployed AFTER INSERT ON GUARD_DEPLOYMENT
FOR EACH ROW BEGIN
  UPDATE GUARD SET Availability = 'Deployed' WHERE EmployeeID = NEW.GuardID;
END$$
CREATE PROCEDURE sp_attendance_report(IN d1 DATE, IN d2 DATE)
BEGIN
  SELECT e.FullName, e.Role, a.AttendanceStatus, COUNT(*) AS Days
  FROM ATTENDANCE a JOIN EMPLOYEE e ON e.EmployeeID = a.EmployeeID
  WHERE a.AttendanceDate BETWEEN d1 AND d2
  GROUP BY e.FullName, e.Role, a.AttendanceStatus ORDER BY e.FullName;
END$$
DELIMITER ;
-- Try: SELECT * FROM v_site_staffing;   CALL sp_attendance_report('2026-10-01','2026-10-24');
