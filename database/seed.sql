-- Sample data taken from the original prototype
INSERT OR IGNORE INTO routes VALUES
 ('A','Ashulia to Campus','DIU-03',50,35,'M40 300 C120 280 160 200 250 220 S400 280 470 200 S560 170 590 180',18,78),
 ('B','Mirpur to Campus','DIU-07',40,45,'M40 70 C130 60 200 130 280 120 S420 60 480 130 S560 175 590 180',30,91),
 ('C','Uttara to Campus','DIU-11',50,50,'M60 180 C140 150 220 190 300 170 S430 220 500 190 S570 182 590 180',12,54),
 ('D','Dhanmondi to Campus','DIU-15',35,55,'M200 335 C260 300 300 260 360 270 S480 250 520 215 S575 190 590 180',8,32);

INSERT OR IGNORE INTO stops (route_id,seq,name,position) VALUES
 ('A',0,'Ashulia Bus Stand',0),('A',1,'Zirabo',.28),('A',2,'Baipail',.55),('A',3,'Nabinagar',.8),('A',4,'DIU Campus',1),
 ('B',0,'Mirpur 10',0),('B',1,'Mirpur 1',.22),('B',2,'Gabtoli',.5),('B',3,'Savar',.78),('B',4,'DIU Campus',1),
 ('C',0,'Uttara Sector 7',0),('C',1,'Abdullahpur',.25),('C',2,'Ashulia Road',.55),('C',3,'Birulia',.82),('C',4,'DIU Campus',1),
 ('D',0,'Dhanmondi 27',0),('D',1,'Asad Gate',.2),('D',2,'Gabtoli',.45),('D',3,'Savar',.75),('D',4,'DIU Campus',1);

INSERT INTO departures (route_id,depart) VALUES
 ('A','06:45'),('A','07:30'),('A','08:00'),('A','13:00'),('A','16:30'),
 ('B','06:30'),('B','07:30'),('B','08:00'),('B','13:00'),('B','16:30'),
 ('C','06:30'),('C','07:30'),('C','08:00'),('C','13:00'),('C','16:30'),
 ('D','06:45'),('D','08:00'),('D','13:00'),('D','16:30');

INSERT OR IGNORE INTO time_slots VALUES (0,'7:30 AM'),(1,'8:00 AM'),(2,'1:00 PM'),(3,'4:30 PM');

INSERT OR IGNORE INTO forecasts VALUES
 ('A',0,42),('A',1,58),('A',2,24),('A',3,46),
 ('B',0,44),('B',1,52),('B',2,20),('B',3,41),
 ('C',0,30),('C',1,36),('C',2,18),('C',3,33),
 ('D',0,12),('D',1,15),('D',2,9),('D',3,14);

INSERT OR IGNORE INTO trip_status (route_id,active,progress) VALUES
 ('A',1,.42),('B',1,.15),('C',1,.66),('D',0,0);

INSERT INTO notices (route_id,text,kind) VALUES
 (NULL,'Welcome to DIU Bus Buddy. Pick a route to see live bus information.','ok'),
 ('B','Route B is usually full at 8:00 AM. Try the 7:30 AM bus if you can.','delay');

INSERT INTO complaints (route_id,type,text,status) VALUES
 ('B','Complaint: too crowded','The 8:00 AM bus had people standing in the aisle from Gabtoli.','open'),
 ('A','Complaint: bus was late','Bus arrived 12 minutes late at Zirabo.','open'),
 ('C','Feedback','Driver was very helpful on the rainy morning.','done');
-- Demo users (student01, driver07, admin) are created by backend/init-db.js so passwords are hashed.
