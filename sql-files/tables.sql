Create table bus
(
	id int Primary key AUTO_INCREMENT,
	from_city varchar(100) not null,
	to_city varchar(100) not null,
	bus_name varchar(100) not null,
	bus_number varchar(100) not null,
	bus_time varchar(100) not null,
	bus_date varchar(100) not null,
	available_seats int not null default 0
);

Create table train
(
	id int Primary key AUTO_INCREMENT,
	from_city varchar(100) not null,
	to_city varchar(100) not null,
	train_name varchar(100) not null,
	coach_number varchar(100) not null,
	train_time varchar(100) not null,
	train_date varchar(100) not null,
	available_seats int not null default 0
);

Create table plane
(
	id int Primary key AUTO_INCREMENT,
	from_city varchar(100) not null,
	to_city varchar(100) not null,
	plane_name varchar(100) not null,
	plane_number varchar(100) not null,
	plane_time varchar(100) not null,
	plane_date varchar(100) not null,
	available_seats int not null default 0
);

Create table tickets
(
	id int Primary key AUTO_INCREMENT,
	from_city varchar(100) not null,
	to_city varchar(100) not null,
	transport_mode varchar(100) not null,
	transport_name varchar(100) not null,
	travel_time varchar(100) not null,
	travel_date varchar(100) not null,
	seat_numbers varchar(100) not null
);
alter table tickets AUTO_INCREMENT=1000; 