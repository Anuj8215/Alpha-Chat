# Alpha-Chat

A production-ready ChatGPT clone with multi-AI integration, real-time features, and enterprise-grade security.

## 📋 **SYSTEM ARCHITECTURE OVERVIEW**

Alpha-Chat follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                             │
│  React Native App / Web Frontend / Postman / Mobile Apps   │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/HTTPS + WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│                  API GATEWAY LAYER                          │
│  Express Server (Port 3000) + Socket.IO Real-time          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                MIDDLEWARE LAYER                             │
│  Auth • Rate Limiting • CORS • Security • Validation       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 ROUTING LAYER                               │
│  /api/auth • /api/ai • /api/profile • /api/admin • /health  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                BUSINESS LOGIC LAYER                         │
│     Services: AI • Auth • Chat • Admin • Email             │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 DATA ACCESS LAYER                           │
│  MongoDB Models: Users • Conversations • ImageLibrary      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              EXTERNAL INTEGRATIONS                          │
│  MongoDB Atlas • OpenAI • DeepSeek • Gemini • Email SMTP   │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 **BACKEND WORKFLOW**

### **1. 🔄 SERVER STARTUP SEQUENCE**

```javascript
// 1. Load Environment Variables
require('dotenv').config();

// 2. Initialize Express App with Middleware
const app = require('./config/app');

// 3. Create HTTP Server + Socket.IO
const server = http.createServer(app);
const io = socketIO(server);

// 4. Connect to MongoDB Atlas
connectDB();

// 5. Start Server on Port 3000
server.listen(PORT);
```

### **2. 🛡️ MIDDLEWARE STACK**

Every incoming request goes through this pipeline:

```
Request → Helmet Security → CORS → Rate Limiting → Body Parsing → Logging → Authentication → Routes
```

### **3. 🗺️ KEY API ENDPOINTS**

#### **🔐 Authentication**
```
POST /api/auth/register       → Register new user
POST /api/auth/login          → Login with email/password
POST /api/auth/google         → Google OAuth login
GET  /api/auth/me             → Get current user profile
POST /api/auth/forgot-password → Request password reset
```

#### **🤖 AI Features**
```
POST /api/ai/conversation/new → Create new AI conversation
POST /api/ai/chat             → Chat with OpenAI GPT
POST /api/ai/code             → Code generation with DeepSeek
POST /api/ai/research         → Combined research (GPT + DeepSeek)
POST /api/ai/document         → Document generation with GPT-4
POST /api/ai/generate-image   → Image generation with DALL-E
GET  /api/ai/library          → Get image library (30-day retention)
```

### **4. 🤖 AI INTEGRATION**

Alpha-Chat integrates **3 AI providers** for different purposes:

- **OpenAI GPT**: Primary chat engine & DALL-E image generation
- **DeepSeek**: Code generation & technical content
- **Google Gemini**: (Coming soon for enhanced video capabilities)

### **5. 🔄 REAL-TIME FEATURES**

Real-time communication via Socket.IO:

- Typing indicators while AI generates responses
- Instant message delivery
- Media generation status updates
- Live conversation updates

### **6. 💾 DATA MODELS**

#### **👥 Users**
```javascript
{
  firstName, lastName, email, password,
  authProvider: 'local' | 'google',
  subscription: {
    type: 'free' | 'premium' | 'pro',
    features: {
      dailyChatLimit: 50,
      dailyImageLimit: 5,
      canAccessGPT4: false
    }
  }
}
```

#### **💬 Conversations**
```javascript
{
  user: ObjectId,
  title: "Chat title",
  aiMode: 'chat' | 'code' | 'image' | 'research' | 'document',
  messages: [{
    role: 'user' | 'assistant',
    content: "Message text",
    aiModel: 'gpt-3.5-turbo' | 'deepseek-coder' | 'dall-e-3',
    metadata: { processingTime, tokenCount }
  }]
}
```

## 🎯 **KEY FEATURES**

- **🤖 Multi-Modal AI**: Chat, code, image, document & research modes
- **🔄 Real-time Experience**: Socket.IO for instant responses
- **🖼️ Image Library**: 30-day retention for generated images
- **🔐 Authentication**: JWT + Google OAuth
- **🛡️ Security**: Helmet, rate limiting & input validation
- **👑 Admin Dashboard**: User management, analytics & audit logs
- **📱 Mobile-Ready APIs**: For React Native integration
- **🚀 Scalable**: MongoDB Atlas optimized for 10,000+ users

## 🛠️ **TECHNOLOGIES**

- **Backend**: Node.js + Express
- **Database**: MongoDB Atlas (M30 recommended)
- **Real-time**: Socket.IO
- **AI**: OpenAI GPT-4/3.5, DeepSeek, Google Gemini
- **Authentication**: JWT + bcrypt
- **Logging**: Winston
- **Email**: Nodemailer

## 🚀 **GETTING STARTED**

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- OpenAI API key
- DeepSeek API key
- Google Gemini API key

### Installation
```bash
# Clone the repository
git clone https://github.com/Anuj8215/Alpha-Chat.git

# Install dependencies
cd Alpha-Chat/backend
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys and MongoDB URI

# Start the server
npm start
```

## 📜 **API DOCUMENTATION**

Complete API documentation is available in the [ADMIN_DOCUMENTATION.md](backend/ADMIN_DOCUMENTATION.md) file.

## 📈 **SCALABILITY**

Alpha-Chat is designed for production use with 10,000+ users:
- Optimized MongoDB connection pooling
- Rate limiting to prevent abuse
- Efficient conversation management
- 30-day automatic cleanup for image library

## 🤝 **CONTRIBUTING**

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 **LICENSE**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
