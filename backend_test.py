import requests
import pytest
from datetime import datetime
import os

# Get the backend URL from environment variable
BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')

# Global variables to store state between tests
conversation_id = None
task_id = None

class TestAIAssistant:
    def setup_method(self):
        """Setup for each test"""
        self.base_url = BACKEND_URL
        global conversation_id, task_id
        self.conversation_id = conversation_id
        self.task_id = task_id

    def test_01_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{self.base_url}/api")
        assert response.status_code == 200
        assert response.json()["message"] == "AI Assistant API is running"

    def test_02_create_conversation(self):
        """Test creating a new conversation"""
        response = requests.post(
            f"{self.base_url}/api/conversations",
            json={"title": "Test Conversation"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Conversation"
        assert "id" in data
        self.conversation_id = data["id"]
        
        # Update global variable
        global conversation_id
        conversation_id = data["id"]

    def test_03_get_conversations(self):
        """Test getting all conversations"""
        response = requests.get(f"{self.base_url}/api/conversations")
        assert response.status_code == 200
        conversations = response.json()
        assert isinstance(conversations, list)
        assert len(conversations) > 0

    def test_04_get_conversation(self):
        """Test getting a specific conversation"""
        assert self.conversation_id is not None
        response = requests.get(f"{self.base_url}/api/conversations/{self.conversation_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == self.conversation_id

    def test_05_send_message(self):
        """Test sending a message and getting AI response"""
        assert self.conversation_id is not None
        response = requests.post(
            f"{self.base_url}/api/conversations/{self.conversation_id}/messages",
            json={"message": "Hello, how are you?"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_message" in data
        assert "ai_message" in data
        assert data["user_message"]["content"] == "Hello, how are you?"
        assert data["ai_message"]["role"] == "assistant"

    def test_06_create_task(self):
        """Test creating a new task"""
        response = requests.post(
            f"{self.base_url}/api/tasks",
            json={
                "title": "Test Task",
                "description": "This is a test task"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Task"
        assert data["description"] == "This is a test task"
        assert not data["completed"]
        self.task_id = data["id"]
        
        # Update global variable
        global task_id
        task_id = data["id"]

    def test_07_get_tasks(self):
        """Test getting all tasks"""
        response = requests.get(f"{self.base_url}/api/tasks")
        assert response.status_code == 200
        tasks = response.json()
        assert isinstance(tasks, list)
        assert len(tasks) > 0

    def test_08_update_task(self):
        """Test updating a task"""
        assert self.task_id is not None
        response = requests.put(
            f"{self.base_url}/api/tasks/{self.task_id}",
            json={"completed": True}
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Task updated"

    def test_09_delete_task(self):
        """Test deleting a task"""
        assert self.task_id is not None
        response = requests.delete(f"{self.base_url}/api/tasks/{self.task_id}")
        assert response.status_code == 200
        assert response.json()["message"] == "Task deleted"

    def test_10_delete_conversation(self):
        """Test deleting a conversation"""
        assert self.conversation_id is not None
        response = requests.delete(f"{self.base_url}/api/conversations/{self.conversation_id}")
        assert response.status_code == 200
        assert response.json()["message"] == "Conversation deleted"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
