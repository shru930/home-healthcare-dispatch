-- Synthetic demo data (Chennai area). No real people or patients.
INSERT INTO nurse (username, full_name, phone, email, skills, base_area, latitude, longitude, available, max_patients, current_patients, created_at) VALUES
 ('nurse.anita',  'Anita Raman',     '9840011001', 'anita.raman@homecare.example',  'WOUND_CARE,POST_OP,IV_THERAPY', 'Guindy',        13.0067, 80.2206, TRUE,  4, 0, CURRENT_TIMESTAMP),
 ('nurse.farhan', 'Farhan Siddiqui', '9840011002', 'farhan.s@homecare.example',     'POST_OP,CARDIAC',              'Tambaram',      12.9249, 80.1000, TRUE,  4, 0, CURRENT_TIMESTAMP),
 ('nurse.priya',  'Priya Natarajan', '9840011003', 'priya.n@homecare.example',      'WOUND_CARE,POST_OP',           'Velachery',     12.9815, 80.2180, TRUE,  4, 0, CURRENT_TIMESTAMP),
 ('nurse.joseph', 'Joseph Mathew',   '9840011004', 'joseph.m@homecare.example',     'WOUND_CARE,ORTHO',             'Potheri (SRM)', 12.8230, 80.0440, TRUE,  4, 0, CURRENT_TIMESTAMP),
 ('nurse.kavya',  'Kavya Iyer',      '9840011005', 'kavya.i@homecare.example',      'POST_OP,PAEDIATRIC',           'Anna Nagar',    13.0850, 80.2101, FALSE, 4, 4, CURRENT_TIMESTAMP);

INSERT INTO pharmacy_stock (pharmacy, partner, medication, quantity) VALUES
 ('CityCare Pharmacy',           FALSE, 'Paracetamol 500mg',     500),
 ('CityCare Pharmacy',           FALSE, 'Amoxicillin 500mg',     120),
 ('CityCare Pharmacy',           FALSE, 'Pantoprazole 40mg',     200),
 ('CityCare Pharmacy',           FALSE, 'Enoxaparin 40mg',         0),
 ('CityCare Pharmacy',           FALSE, 'Tramadol 50mg',          60),
 ('MedPlus Partner Pharmacy',    TRUE,  'Enoxaparin 40mg',        30),
 ('MedPlus Partner Pharmacy',    TRUE,  'Cefuroxime 500mg',       40),
 ('CityCare Pharmacy',           FALSE, 'Ondansetron 4mg',        80);
