# orbit3.0_backend
A Pomodoro timer backend API with user authentication and task management.

🚀 Quick Start
bash
npm install
npm start
🔧 Environment Variables
Create .env file:

env
MONGODB_URI=your_mongodb_connection_string
PORT=3000
NODE_ENV=development
📡 API Endpoints
Endpoint	Method	Description
/signup	GET	Create new user account
/login	GET	User authentication
/logout	GET	Clear user session
/getTasks	GET	Fetch user's tasks
/addTask	GET	Create new task
/updateTask	GET	Update task progress
/deleteTask	GET	Delete single task
/deleteAll	GET	Delete all user tasks
/recordAdd	GET	Log pomodoro completion
/report	GET	Get 7-day statistics
🛠️ Tech Stack
Node.js - Runtime
Express - Web framework
MongoDB - Database
Cookie-based auth - Session management
📦 Dependencies
JSON
{
  "express": "^4.18.2",
  "mongoose": "^6.13.8",
  "cookie-parser": "^1.4.6",
  "cors":  "^2.8.5"
}
🚂 Deployment
Deployed on Railway: [Live Backend](https://orbit3-0-backend-production. up.railway.app)
