# MediVoice AI 🩺🎙️

**An AI-Powered Voice Assistant for Healthcare Management**

MediVoice AI is an intelligent healthcare assistant designed to simplify communication between patients and healthcare services through voice-based interactions. It combines AI-powered conversations, speech processing, and healthcare management features in a modern web application.

## 🚀 Features

- **AI Voice Assistant:** Supports voice-based interactions using ElevenLabs.
- **Speech-to-Text:** Converts spoken input into text.
- **Text-to-Speech:** Converts AI-generated responses into speech.
- **AI-Powered Conversations:** Uses Google Gemini for intelligent responses.
- **Doctor Management:** Displays and manages doctor information.
- **Appointment Management:** Supports appointment-related operations.
- **Appointment Slots:** Provides appointment slot information.
- **Dashboard:** Displays healthcare activity and appointment information.
- **Real-Time Updates:** Uses WebSockets for live dashboard events.
- **Modern Interface:** Responsive frontend built with React and TypeScript.

## 🛠️ Tech Stack

### Frontend
- React
- TypeScript
- Vite
- CSS

### Backend
- Python
- FastAPI
- Uvicorn
- SQLAlchemy / SQLite

### AI & Voice Integration
- Google Gemini API
- ElevenLabs API

### Development Tools
- Git
- GitHub
- VS Code
- Python Virtual Environment

## 📁 Project Structure

```text
MediVoice-AI/
│
├── backend/
│   ├── app/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── tools/
│   │   ├── voice/
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   │
│   ├── tests/
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   │
│   ├── index.html
│   └── package.json
│
├── .env.example
├── .gitignore
└── README.md
```

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/gayathri78789/MediVoice-AI.git
```

```bash
cd MediVoice-AI
```

### 2. Backend Setup

Open a terminal:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it on Windows:

```bash
.venv\Scripts\activate
```

Install the required dependencies:

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file in the project root directory.

Use `.env.example` as your reference and add your own API keys.

Required configuration:

```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

GOOGLE_API_KEY=your_google_api_key
GEMINI_MODEL=gemini-2.5-flash

DATABASE_URL=sqlite:///./medivoice.db

BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**Note:** Never upload your actual `.env` file or API keys to GitHub.

### 4. Start the Backend

From the project root:

```bash
cd backend
```

Run:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend URL:

```text
http://localhost:8000
```

API Documentation:

```text
http://localhost:8000/docs
```

Alternative API Documentation:

```text
http://localhost:8000/redoc
```

### 5. Frontend Setup

Open a second terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## 🔌 API Modules

The backend provides API modules for:

- Doctors
- Appointments
- Appointment Slots
- Dashboard
- Voice Assistant

Interactive API documentation is available through FastAPI Swagger UI at `/docs`.

## 🔐 Security

- API keys are stored in environment variables.
- `.env` is excluded from version control.
- `.env.example` contains placeholder configuration values.
- Never commit passwords, private credentials, or secret API keys.

## 🎯 Project Objective

The main objective of MediVoice AI is to explore how artificial intelligence and voice technologies can improve healthcare interactions and simplify appointment management.

## 👩‍💻 Developer

**Gayathri Kona**

GitHub: [@gayathri78789](https://github.com/gayathri78789)

## 📌 Future Enhancements

- Improved conversational AI capabilities.
- Enhanced voice interaction experience.
- Patient profile management.
- Appointment booking enhancements.
- Additional healthcare integrations.

---

⭐ If you find this project interesting, consider giving the repository a star!

**MediVoice AI – Making Healthcare Interactions Smarter with AI and Voice Technology.**
