import { useState, useEffect, useRef } from "react";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [activeTab, setActiveTab] = useState("chat");
  const messagesEndRef = useRef(null);

  // Fetch conversations on component mount
  useEffect(() => {
    fetchConversations();
    fetchTasks();
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [currentConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversations`);
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks`);
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const createNewConversation = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "New Conversation",
        }),
      });
      const newConversation = await response.json();
      setConversations([newConversation, ...conversations]);
      setCurrentConversation(newConversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  const selectConversation = async (conversation) => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/conversations/${conversation.id}`
      );
      const data = await response.json();
      setCurrentConversation(data);
    } catch (error) {
      console.error("Error fetching conversation:", error);
    }
  };

  const deleteConversation = async (id, e) => {
    e.stopPropagation();
    try {
      await fetch(`${BACKEND_URL}/api/conversations/${id}`, {
        method: "DELETE",
      });
      setConversations(conversations.filter((conv) => conv.id !== id));
      if (currentConversation && currentConversation.id === id) {
        setCurrentConversation(null);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !currentConversation) return;

    setLoading(true);
    const userMessage = message;
    setMessage("");

    // Optimistically update UI
    const updatedMessages = [
      ...(currentConversation.messages || []),
      { role: "user", content: userMessage },
    ];
    
    setCurrentConversation({
      ...currentConversation,
      messages: updatedMessages,
    });

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/conversations/${currentConversation.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userMessage,
          }),
        }
      );
      
      const data = await response.json();
      
      // Update conversation with actual response
      const updatedConversation = {
        ...currentConversation,
        messages: [
          ...(currentConversation.messages || []),
          data.user_message,
          data.ai_message,
        ],
      };
      
      setCurrentConversation(updatedConversation);
      
      // Update conversations list
      setConversations(
        conversations.map((conv) =>
          conv.id === currentConversation.id ? updatedConversation : conv
        )
      );
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newTask),
      });
      
      const task = await response.json();
      setTasks([...tasks, task]);
      setNewTask({ title: "", description: "" });
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const toggleTaskCompletion = async (taskId, completed) => {
    try {
      await fetch(`${BACKEND_URL}/api/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ completed }),
      });
      
      setTasks(
        tasks.map((task) =>
          task.id === taskId ? { ...task, completed } : task
        )
      );
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        // Update local state to remove the deleted task
        setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
        console.log("Task deleted successfully:", taskId);
      } else {
        console.error("Failed to delete task. Server returned:", response.status);
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">AI Assistant</h1>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            data-testid="chat-tab"
            className={`flex-1 py-3 ${
              activeTab === "chat"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600"
            }`}
            onClick={() => setActiveTab("chat")}
          >
            Chat
          </button>
          <button
            data-testid="tasks-tab"
            className={`flex-1 py-3 ${
              activeTab === "tasks"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600"
            }`}
            onClick={() => setActiveTab("tasks")}
          >
            Tasks
          </button>
        </div>
        
        {activeTab === "chat" ? (
          <>
            <div className="p-4">
              <button
                onClick={createNewConversation}
                data-testid="new-chat-button"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center justify-center"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  ></path>
                </svg>
                New Chat
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => selectConversation(conversation)}
                  className={`p-3 border-b border-gray-200 hover:bg-gray-50 cursor-pointer flex justify-between items-center ${
                    currentConversation && currentConversation.id === conversation.id
                      ? "bg-blue-50"
                      : ""
                  }`}
                >
                  <div className="truncate">{conversation.title}</div>
                  <button
                    onClick={(e) => deleteConversation(conversation.id, e)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      ></path>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="overflow-y-auto flex-1 p-4">
            <h2 className="text-lg font-medium mb-4">Tasks</h2>
            <form onSubmit={addTask} className="mb-4">
              <input
                type="text"
                placeholder="Task title"
                className="w-full p-2 border border-gray-300 rounded mb-2"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
              <textarea
                placeholder="Description (optional)"
                className="w-full p-2 border border-gray-300 rounded mb-2"
                value={newTask.description || ""}
                onChange={(e) =>
                  setNewTask({ ...newTask, description: e.target.value })
                }
              ></textarea>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md"
              >
                Add Task
              </button>
            </form>
            
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 bg-white border border-gray-200 rounded-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={(e) =>
                          toggleTaskCompletion(task.id, e.target.checked)
                        }
                        className="mr-2 h-4 w-4 text-blue-600"
                      />
                      <span
                        className={`font-medium ${
                          task.completed ? "line-through text-gray-400" : ""
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        ></path>
                      </svg>
                    </button>
                  </div>
                  {task.description && (
                    <p className="mt-1 text-sm text-gray-600">
                      {task.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Chat header */}
        {activeTab === "chat" && (
          <div className="p-4 border-b border-gray-200 bg-white">
            <h2 className="text-lg font-medium">
              {currentConversation
                ? currentConversation.title
                : "Select or create a conversation"}
            </h2>
          </div>
        )}

        {/* Chat messages */}
        {activeTab === "chat" && (
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {currentConversation && currentConversation.messages ? (
              <div className="space-y-4">
                {currentConversation.messages.length === 0 && (
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-blue-100 mb-6">
                    <h3 className="text-xl font-bold text-blue-700 mb-3">Welcome to Your ADHD-Friendly AI Assistant</h3>
                    <p className="mb-3 text-gray-700">I'm here to help with focus, organization, and managing tasks. Try asking me:</p>
                    <ul className="list-disc pl-5 space-y-2 text-gray-700">
                      <li><button onClick={() => setMessage("How can I stay focused during long tasks?")} className="text-blue-600 hover:underline">How can I stay focused during long tasks?</button></li>
                      <li><button onClick={() => setMessage("Help me break down my project into manageable steps")} className="text-blue-600 hover:underline">Help me break down my project into manageable steps</button></li>
                      <li><button onClick={() => setMessage("What are good strategies for managing time with ADHD?")} className="text-blue-600 hover:underline">What are good strategies for managing time with ADHD?</button></li>
                      <li><button onClick={() => setMessage("Give me a simple daily routine for better productivity")} className="text-blue-600 hover:underline">Give me a simple daily routine for better productivity</button></li>
                    </ul>
                  </div>
                )}
                
                {currentConversation.messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-3/4 p-3 rounded-lg ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-gray-200"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="max-w-3/4 p-3 rounded-lg bg-white border border-gray-200">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-lg">
                  <h3 className="text-xl font-semibold text-gray-700 mb-4">
                    {!currentConversation
                      ? "Your AI Assistant for ADHD Support"
                      : "No messages yet"}
                  </h3>
                  
                  <p className="mb-6 text-gray-600">
                    This assistant is designed to help with organization, focus, time management, 
                    and other challenges related to ADHD. You can chat with the AI or use the Tasks 
                    section to track important to-dos.
                  </p>
                  
                  {!currentConversation && (
                    <button
                      onClick={createNewConversation}
                      data-testid="start-conversation-button"
                      className="mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md"
                    >
                      Start a new conversation
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Task details or empty state */}
        {activeTab === "tasks" && (
          <div className="flex-1 p-6 bg-gray-50">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Task Management</h2>
              <p className="mb-6 text-gray-600">
                The task management system helps you stay organized and focused. 
                Use it to track important work tasks, manage your daily priorities, 
                and break down complex projects into manageable steps.
              </p>
              
              <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <h3 className="text-xl font-semibold mb-4">ADHD Support Features</h3>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>Break down complex tasks into smaller, more manageable steps</li>
                  <li>Prioritize tasks based on importance and urgency</li>
                  <li>Use the AI assistant for reminders and organization tips</li>
                  <li>Track completed tasks to build motivation and momentum</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">ADHD-Friendly Task Tips</h3>
                <div className="space-y-4 text-blue-800">
                  <div>
                    <h4 className="font-medium">🕒 Time Blocks</h4>
                    <p className="text-sm">Allocate specific time blocks for tasks and set timers to help maintain focus.</p>
                  </div>
                  <div>
                    <h4 className="font-medium">🔄 Task Batching</h4>
                    <p className="text-sm">Group similar tasks together to reduce context switching and maintain momentum.</p>
                  </div>
                  <div>
                    <h4 className="font-medium">🏆 Celebrate Small Wins</h4>
                    <p className="text-sm">Acknowledge and reward yourself for completing tasks, no matter how small.</p>
                  </div>
                  <div>
                    <h4 className="font-medium">✅ Visual Cues</h4>
                    <p className="text-sm">Use color coding, checklists, and visual reminders to stay on track.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input area */}
        {activeTab === "chat" && currentConversation && (
          <div className="p-4 border-t border-gray-200 bg-white">
            <form onSubmit={sendMessage} className="flex items-center">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                data-testid="message-input"
                className="flex-1 p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                type="submit"
                data-testid="send-message-button"
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-r-md"
                disabled={loading}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  ></path>
                </svg>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
