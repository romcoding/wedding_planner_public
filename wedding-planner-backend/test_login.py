#!/usr/bin/env python3
"""
Quick test script to check if login endpoint is working
Run this in Render Shell to test: python test_login.py
"""

import requests
import json
import os

# Get backend URL from environment or use default
BACKEND_URL = os.getenv('BACKEND_URL', 'https://wedding-planner-backend-vupg.onrender.com')

def test_login():
    """Test admin login endpoint"""
    url = f"{BACKEND_URL}/api/auth/login"
    
    # You'll need to provide your actual email and password
    email = input("Enter your admin email: ")
    password = input("Enter your admin password: ")
    
    data = {
        'email': email,
        'password': password
    }
    
    try:
        response = requests.post(url, json=data)
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            print("\n✅ Login successful!")
        else:
            print("\n❌ Login failed!")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        print("\nThis might indicate the backend is not running or there's a connection issue.")

if __name__ == '__main__':
    test_login()

