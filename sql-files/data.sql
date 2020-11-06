-- These are dummy data for testing purpose

Insert into bus (from_city, to_city, bus_name, bus_number, bus_time, bus_date, available_seats) 
values ('Delhi', 'Jaipur', 'Real Bus Co.', 'DL01 1234', '9:00 PM', '20/01/2022', 30),
('Jaipur', 'Delhi', 'Real Bus Co.', 'DL01 4321', '9:00 PM', '20/01/2022', 30),
('Delhi', 'Jaipur', 'Adirondack Trailways', 'RJ45 7894', '10:00 AM', '20/01/2022', 30),
('Jaipur', 'Delhi', 'Adirondack Trailways', 'RJ45 4987', '10:00 AM', '20/01/2022', 30),
('Delhi', 'Jaipur', 'Express Arrow', 'RJ17 3355', '7:00 PM', '20/01/2022', 30),
('Jaipur', 'Delhi', 'Express Arrow', 'RJ17 2233', '7:00 PM', '20/01/2022', 30),
('Kolkata', 'Bhubaneswar', 'AAA Buses', 'OD02 2345', '7:30 PM', '20/01/2022', 30),
('Bhubaneswar', 'Kolkata', 'AAA Buses', 'OD02 5432', '7:30 PM', '20/01/2022', 30),
('Damanjodi', 'Bhubaneswar', 'Reliance', 'OD03 3456', '10:30 PM', '20/01/2022', 30),
('Bhubaneswar', 'Damanjodi', 'Reliance', 'OD03 3456', '10:30 PM', '20/01/2022', 30)
;

Insert into train (from_city, to_city, train_name, coach_number, train_time, train_date, available_seats) 
values ('Delhi', 'Jaipur', 'Rajdhani Express', 'S4', '9:00 PM', '20/01/2022', 77),
('Jaipur', 'Bhubaneswar', 'Rajdhani Express', 'S4', '9:00 AM', '20/01/2022', 71),
('Kolkata', 'Bhubaneswar', 'Shatabdi Express', 'D7', '7:30 PM', '20/01/2022', 201),
('Bhubaneswar', 'Kolkata', 'Shatabdi Express', 'D7', '7:30 AM', '20/01/2022', 43),
('Damanjodi', 'Bhubaneswar', 'Hirakhand', 'S2', '10:30 AM', '20/01/2022', 31),
('Bhubaneswar', 'Damanjodi', 'Hirakhand', 'D2', '10:30 PM', '20/01/2022', 57)
;

Insert into plane (from_city, to_city, plane_name, plane_number, plane_time, plane_date, available_seats) 
values ('Delhi', 'Jaipur', 'IndiGo', 'AC 2505', '9:00 PM', '20/01/2022', 77),
('Jaipur', 'Bhubaneswar', 'IndiGo', 'AC 2045', '9:00 AM', '20/01/2022', 71),
('Kolkata', 'Bhubaneswar', 'GoAir', 'AC 3457', '7:30 PM', '20/01/2022', 201),
('Bhubaneswar', 'Kolkata', 'GoAir', 'AC 3569', '7:30 AM', '20/01/2022', 43),
('Damanjodi', 'Bhubaneswar', 'Air India Express', 'AC 7012', '10:30 AM', '20/01/2022', 31),
('Bhubaneswar', 'Damanjodi', 'Air India Express', 'AC 7894', '10:30 PM', '20/01/2022', 57)
;