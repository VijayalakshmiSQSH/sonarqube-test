import mysql.connector
from faker import Faker
import random
from datetime import datetime, timedelta

# MySQL connection details
DB_HOST = "172.206.113.7"
DB_PORT = 1433
DB_USER = "sa"
DB_PASSWORD = "Squareshift@123"
DB_NAME = "master"  # will create if not exists

# Connect to MySQL (without specifying database first)
conn = mysql.connector.connect(
    host=DB_HOST,
    port=DB_PORT,
    user=DB_USER,
    password=DB_PASSWORD
)

cursor = conn.cursor()

# Create database if it doesn't exist
cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
conn.database = DB_NAME  # switch to the new database

# Create table
cursor.execute("""
CREATE TABLE IF NOT EXISTS products (
    modelID VARCHAR(50),
    id VARCHAR(50),
    lineCode VARCHAR(50),
    searchTerm VARCHAR(255),
    modelNumber VARCHAR(50),
    modelDescription VARCHAR(255),
    displayName VARCHAR(100),
    logo VARCHAR(10),
    boxLogo VARCHAR(10),
    webPhoto VARCHAR(10),
    numberOfParts INT,
    webViewCount INT,
    lastUpdated DATETIME(3)
)
""")

fake = Faker()
BATCH_SIZE = 50000
total_records = 2000000
records = []

# Random date range from 2015-01-01 to now
start_time = datetime(2015, 1, 1, 0, 0, 0)
end_time = datetime.now()

for i in range(1, total_records + 1):
    modelID = f"ACODLFLCAH36XAK{i%3+1:02d}"
    id_field = f"{modelID}*{chr(65 + i%3)}"
    lineCode = "ACO"
    searchTerm = f"Product {i}"
    modelNumber = f"DLFLCAH36XAK{i%3+1:02d}"
    modelDescription = f"Mock description {i}"
    displayName = f"Arcoaire {i}"
    logo = "N"
    boxLogo = "N"
    webPhoto = "L"
    numberOfParts = random.randint(1,5)
    webViewCount = random.randint(0,50)

    # Random datetime with milliseconds
    random_seconds = random.randint(0, int((end_time - start_time).total_seconds()))
    random_microsecond = random.randint(0, 999) * 1000  # for DATETIME(3)
    last_updated = start_time + timedelta(seconds=random_seconds, microseconds=random_microsecond)

    records.append((
        modelID, id_field, lineCode, searchTerm, modelNumber, modelDescription,
        displayName, logo, boxLogo, webPhoto, numberOfParts, webViewCount, last_updated
    ))

    # Insert in batches
    if i % BATCH_SIZE == 0:
        cursor.executemany("""
        INSERT INTO products 
        (modelID,id,lineCode,searchTerm,modelNumber,modelDescription,displayName,logo,boxLogo,webPhoto,numberOfParts,webViewCount,lastUpdated)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, records)
        conn.commit()
        records = []
        print(f"{i} records inserted...")

# Insert remaining records
if records:
    cursor.executemany("""
    INSERT INTO products 
    (modelID,id,lineCode,searchTerm,modelNumber,modelDescription,displayName,logo,boxLogo,webPhoto,numberOfParts,webViewCount,lastUpdated)
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, records)
    conn.commit()
    print(f"{total_records} records inserted successfully!")

cursor.close()
conn.close()
print("All done! Database and table created with 200,000 mock records.")

