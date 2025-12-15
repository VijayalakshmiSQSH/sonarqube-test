from elasticsearch import Elasticsearch, helpers
from faker import Faker
import uuid
import random
import json
import time

# --- 🔧 Config ---
ES_NA_HOST_URL = "https://konferry-pdl.es.eastus.azure.elastic-cloud.com:9243"
ES_NA_USERNAME = "elastic"
ES_NA_PASSWORD = "HMOUwNx0m1DOfK7qUvD10KLq"
INDEX_NAME = "pdl_skills"

TOTAL_DOCS = 3000  # Adjust this to reach ~10GB based on doc size
BATCH_SIZE = 500

# --- 📦 Faker Setup ---
fake = Faker()
Faker.seed(42)

# --- 🧠 Logic to Generate a Candidate Doc ---
def generate_candidate_doc(doc_id):
    uid = str(uuid.uuid4())
    first_name = f"{uid}_fn"
    last_name = f"{uid}_ln"
    email = f"{uid}@fake.guid"
    location = fake.local_latlng(country_code="FI", coords_only=True)
    lat, lon = map(float, location)

    # Fake nested employment history
    def make_employment(index):
        return {
            "company": {
                "name": fake.company(),
                "size": random.choice(["1-10", "11-50", "51-200", "201-500", "1001-5000"]),
                "location": {
                    "name": fake.city(),
                    "country": fake.country(),
                    "continent": "Europe",
                    "street_address": fake.street_address()
                },
                "website": fake.url()
            },
            "title": {
                "name": "Project Manager",
                "raw": ["Project Manager"],
                "role": "Fulfillment",
                "sub_role": "Project_management",
                "levels": []
            },
            "employerName": fake.company(),
            "employmentRelevance": index + 1,
            "isCurrent": (index == 0),
            "isPrimary": (index == 0),
            "jobTitle": "Project Manager",
            "startDate": "2027-01-01T00:00:00",
            "endDate": "0001-01-01T00:00:00"
        }

    doc = {
        "_index": INDEX_NAME,
        "_id": f"{uid}_{doc_id:04d}",
        "_source": {
            "id": f"{uid}_{doc_id:04d}",
            "firstName": first_name,
            "candidateId": doc_id,
            "sourceCandidateId": f"{uid}_{doc_id:04d}",
            "lastName": last_name,
            "candidateSource": "PDL",
            "candidateSourceSpecifics": "PDL",
            "city": fake.city(),
            "country": fake.country(),
            "currentEmployment": {
                "employerName": fake.company(),
                "jobTitle": "Project Manager"
            },
            "educationLevel": ["masters"],
            "email": email,
            "employmentHistory": [make_employment(i) for i in range(random.randint(2, 6))],
            "experienceLevel": random.randint(0, 5),
            "isActive": True,
            "isPublic": True,
            "linkedinId": f"{uid}_linkedIn",
            "location": {
                "lat": lat,
                "lon": lon
            },
            "orgId": 0,
            "profileId": 0,
            "state": fake.state(),
            "totalYearsOfExperience": random.randint(5, 20),
            "updatedDt": fake.date_time_this_year().isoformat(),
            "willingToRelocate": random.choice([True, False]),
            "addressAvailability": True,
            "certifications": [
                {
                    "name": fake.job(),
                    "organization": fake.company(),
                    "startDate": "2024-01-01T00:00:00",
                    "endDate": "2024-12-31T00:00:00"
                }
            ],
            "credentials": [
                {
                    "school": {
                        "name": fake.company(),
                        "location": {
                            "name": fake.city()
                        }
                    },
                    "degrees": ["Masters"],
                    "startDate": "2022-01-01T00:00:00",
                    "endDate": "2023-01-01T00:00:00",
                    "majors": ["Engineering"]
                }
            ],
            "isPdlLicensed": True,
            "industry": "Oil & Energy",
            "inferred_salary": "45,000-55,000",
            "inferred_years_experience": random.randint(5, 20),
            "languages": [
                {"name": "English"}, {"name": "Finnish"}, {"name": "Swedish"}
            ],
            "profiles": [
                {
                    "network": "linkedin",
                    "id": str(doc_id),
                    "url": f"{uid}_profileUrl",
                    "username": f"{uid}_profileUsername",
                    "num_sources": 2,
                    "first_seen": "2023-01-01",
                    "last_seen": "2024-01-01"
                }
            ],
            "emails": [
                {
                    "is_primary": True,
                    "address": email,
                    "type": "personal",
                    "first_seen": "2023-01-01",
                    "last_seen": "2023-01-01",
                    "num_sources": 1
                }
            ],
            "relevantJobTitles": ["project manager"],
            "previousJobTitles": ["project manager"] * 3,
            "relevantEmployers": [fake.company()],
            "previousEmployers": [fake.company() for _ in range(3)],
            "skillList": random.sample([
                "Python", "Java", "C#", "C++", "JavaScript", "Go", "Rust", "Ruby",
                "Kotlin", "TypeScript", "SQL", "HTML", "CSS", "Bash", "PowerShell"
            ], random.randint(0, 15)),
            "source": f"PDL|{uid}_{doc_id:04d}"
        }
    }

    return doc

# --- ⚙️ Elasticsearch Client ---
es = Elasticsearch(
    ES_NA_HOST_URL,
    basic_auth=(ES_NA_USERNAME, ES_NA_PASSWORD),
    verify_certs=True
)

# --- 🚀 Bulk Ingest Logic ---
def bulk_ingest():
    total_indexed = 0
    start = time.time()

    while total_indexed < TOTAL_DOCS:
        actions = [
            generate_candidate_doc(doc_id=total_indexed + i)
            for i in range(BATCH_SIZE)
        ]

        helpers.bulk(es, actions)
        total_indexed += BATCH_SIZE

        print(f"[+] Indexed: {total_indexed}/{TOTAL_DOCS}")

    end = time.time()
    print(f"✅ Done. Total time: {round(end - start, 2)} seconds")

if __name__ == "__main__":
    bulk_ingest()

