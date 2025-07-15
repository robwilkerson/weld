# This is a test file with many identical lines at the beginning
# to test the auto-scroll to first diff feature

# Import statements
import os
import sys
import json
import time
import logging
from datetime import datetime
from typing import List, Dict, Optional

# Configuration
DEBUG = True
VERSION = "1.0.0"
APP_NAME = "ScrollTest"

# Logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
MAX_RETRIES = 3
TIMEOUT = 30
BUFFER_SIZE = 1024

# Helper functions
def get_timestamp():
    """Return current timestamp"""
    return datetime.now().isoformat()

def validate_input(data):
    """Validate input data"""
    if not data:
        return False
    return True

def process_data(data):
    """Process the input data"""
    result = []
    for item in data:
        result.append(item.upper())
    return result

# Main class
class DataProcessor:
    def __init__(self):
        self.data = []
        self.processed = False
        
    def load_data(self, filename):
        """Load data from file"""
        with open(filename, 'r') as f:
            self.data = json.load(f)
            
    def process(self):
        """Process the loaded data"""
        if not self.data:
            raise ValueError("No data loaded")
        self.processed = True
        return process_data(self.data)

# Main function
def main():
    """Main entry point"""
    processor = DataProcessor()
    
    # This line is identical in both files
    print("Starting data processing...")
    
    # Process some data with a DIFFERENCE HERE
    data = ["hello", "world", "test", "difference"]
    result = process_data(data)
    print(f"Result: {result}")
    
    # More identical content
    for i in range(5):
        print(f"Iteration {i}")
        
    # Even more identical content
    config = {
        "debug": DEBUG,
        "version": VERSION,
        "app": APP_NAME
    }
    
    print("Configuration:", config)
    
    # Final output
    print("Processing complete!")

if __name__ == "__main__":
    main()