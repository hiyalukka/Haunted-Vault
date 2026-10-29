from dotenv import load_dotenv
import os
from pymongo import MongoClient

load_dotenv()
uri = os.getenv("MONGODB_URI")
print("URI found:", uri is not None)
print(MongoClient(uri, serverSelectionTimeoutMS=3000).admin.command("ping"))