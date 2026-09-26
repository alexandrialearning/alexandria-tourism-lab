import requests
import json

api_key = "Z29vZ2xlLW9hdXRoMnwxMDc1NTk3ODQ4NjM2MjcxNDA2OTdAYWtfeDl2ZmIxNEFNOHlIYWxjb3RhMlhq:2EaJXmDOiNV6YDQ3sd9fk"
user, pwd = api_key.split(':')

url = "https://api.d-id.com/images"
with open("avatar.jpg", "rb") as f:
    files = {"image": ("avatar.jpg", f, "image/jpeg")}
    response = requests.post(url, files=files, auth=(user, pwd))
    
    print(response.status_code)
    print(response.text)
