#!/usr/bin/env python3
"""
A sample Python file with various syntax elements for testing syntax highlighting.
This includes classes, functions, decorators, string formatting, and more.
"""

import os
import sys
from typing import List, Dict, Optional
from dataclasses import dataclass
import asyncio

# Global constants
MAX_RETRIES = 3
DEFAULT_CONFIG = {
    "host": "localhost",
    "port": 8080,
    "debug": True,
    "timeout": 30.5
}

@dataclass
class User:
    """A simple user dataclass with validation."""
    name: str
    email: str
    age: int = 18
    
    def __post_init__(self):
        if self.age < 0:
            raise ValueError("Age cannot be negative")

class DatabaseManager:
    """Database connection manager with connection pooling."""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self._pool = None
        
    @property
    def is_connected(self) -> bool:
        return self._pool is not None
    
    async def connect(self) -> None:
        """Establish database connection."""
        try:
            # Simulate connection logic
            self._pool = f"connection_pool_{id(self)}"
            print(f"Connected to database: {self.connection_string}")
        except Exception as e:
            raise ConnectionError(f"Failed to connect: {e}")
    
    @staticmethod
    def validate_query(query: str) -> bool:
        """Validate SQL query for basic safety."""
        dangerous_keywords = ['DROP', 'DELETE', 'TRUNCATE']
        return not any(keyword in query.upper() for keyword in dangerous_keywords)

def process_data(data: List[Dict], filter_func=lambda x: True) -> List[Dict]:
    """Process and filter data using comprehensions and lambdas."""
    # List comprehension with conditional
    filtered = [item for item in data if filter_func(item) and item.get('active', False)]
    
    # Dictionary comprehension
    result = {
        item['id']: {
            **item,
            'processed': True,
            'timestamp': f"{item.get('created_at', 'unknown')}"
        }
        for item in filtered
    }
    
    return list(result.values())

async def fetch_user_data(user_id: int, retries: int = MAX_RETRIES) -> Optional[User]:
    """Fetch user data with retry logic and async/await."""
    for attempt in range(retries):
        try:
            # Simulate API call with f-string formatting
            url = f"https://api.example.com/users/{user_id}"
            
            # Simulate async operation
            await asyncio.sleep(0.1)
            
            # Mock response data
            if user_id == 42:
                return User(
                    name="Alice Johnson", 
                    email="alice@example.com",
                    age=25
                )
            elif user_id in [1, 2, 3]:
                # Multi-line string with triple quotes
                error_msg = """
                User not found in database.
                Please check the user ID and try again.
                """
                raise ValueError(error_msg.strip())
            
            return None
            
        except (ConnectionError, TimeoutError) as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            if attempt == retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)  # Exponential backoff

def main():
    """Main function demonstrating various Python features."""
    # String interpolation and raw strings
    config_path = r"C:\Users\example\config.ini"
    welcome_message = f"""
    Welcome to the Python Syntax Highlighter Test!
    Config loaded from: {config_path}
    Python version: {sys.version_info.major}.{sys.version_info.minor}
    """
    
    print(welcome_message)
    
    # Context manager and file operations
    try:
        with open("sample.txt", "w") as file:
            file.write("# This is a test file\n")
            file.write(f"Generated at: {__name__}\n")
    except IOError:
        pass
    
    # Tuple unpacking and enumerate
    sample_data = [
        {"id": 1, "name": "Item 1", "active": True},
        {"id": 2, "name": "Item 2", "active": False},
        {"id": 3, "name": "Item 3", "active": True}
    ]
    
    for index, item in enumerate(sample_data, start=1):
        status = "✓" if item["active"] else "✗"
        print(f"{index}. {item['name']} [{status}]")
    
    # Regular expressions and sets
    import re
    pattern = r"\d+\.\s+(\w+)"
    matches = {match.group(1) for line in ["1. Apple", "2. Banana", "3. Cherry"] 
               if (match := re.search(pattern, line))}
    
    print(f"Found items: {', '.join(sorted(matches))}")

if __name__ == "__main__":
    main()

# Additional line to demonstrate diff functionality
print("This line exists only in python-sample-2.py")