import pytest
import httpx
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get the backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')

@pytest.mark.asyncio
async def test_task_crud_operations():
    """Test Create, Read, Update, Delete operations for tasks"""
    async with httpx.AsyncClient() as client:
        # Test task creation
        print("\nTesting task creation...")
        create_response = await client.post(
            f"{BACKEND_URL}/api/tasks",
            json={
                "title": "Test Task",
                "description": "Test Description"
            }
        )
        assert create_response.status_code == 200, f"Failed to create task: {create_response.text}"
        task_data = create_response.json()
        task_id = task_data['id']
        print("✅ Task created successfully")

        # Test get all tasks
        print("\nTesting get all tasks...")
        get_all_response = await client.get(f"{BACKEND_URL}/api/tasks")
        assert get_all_response.status_code == 200, "Failed to get tasks"
        tasks = get_all_response.json()
        assert len(tasks) > 0, "No tasks found"
        print("✅ Successfully retrieved all tasks")

        # Test update task
        print("\nTesting task update...")
        update_response = await client.put(
            f"{BACKEND_URL}/api/tasks/{task_id}",
            json={"completed": True}
        )
        assert update_response.status_code == 200, "Failed to update task"
        print("✅ Task updated successfully")

        # Test delete task
        print("\nTesting task deletion...")
        delete_response = await client.delete(f"{BACKEND_URL}/api/tasks/{task_id}")
        assert delete_response.status_code == 200, "Failed to delete task"
        print("✅ Task deleted successfully")

        # Verify task is deleted
        get_all_response = await client.get(f"{BACKEND_URL}/api/tasks")
        tasks = get_all_response.json()
        assert not any(task['id'] == task_id for task in tasks), "Task was not properly deleted"
        print("✅ Verified task deletion")

if __name__ == "__main__":
    pytest.main([__file__, "-v"])