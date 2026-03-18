# AI Recruiter

An intelligent recruitment platform that automates candidate screening, interview scheduling, and evaluation using AI.

## Features

- **Resume Parsing** - Upload resumes and automatically extract candidate information
- **AI-Powered Interviews** - Conduct video interviews with real-time transcription
- **Smart Evaluation** - Get AI-generated interview reports with scores and recommendations
- **Email Automation** - Send personalized acceptance/rejection emails via Brevo
- **Candidate Management** - Track candidates through the hiring pipeline

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript
- **Backend**: Next.js API Routes
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **AI**: Google Gemini
- **Video**: Cloudinary, AssemblyAI
- **Email**: Brevo (Sendinblue)

## Prerequisites

- Node.js 18+
- npm or yarn
- Firebase account
- Google Gemini API key
- Brevo API key
- AssemblyAI API key
- Cloudinary account

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/GitNimay/ai-recruiter.git
cd ai-recruiter
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Brevo (Sendinblue) API Key
BREVO_API_KEY=your_brevo_api_key

# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cloudinary Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset

# AssemblyAI API Key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
```

### 4. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication** (Email/Password provider)
4. Enable **Firestore Database**
5. Create a web app and copy the config values to `.env.local`

#### Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /workspaces/{workspaceId} {
      allow read, write: if request.auth != null;
      match /candidates/{candidateId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

### 5. Google Gemini Setup

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Copy to `GEMINI_API_KEY` in `.env.local`

### 6. Brevo Setup

1. Sign up at [Brevo](https://www.brevo.com)
2. Go to **Settings > SMTP & API**
3. Copy your API key to `BREVO_API_KEY` in `.env.local`
4. Verify your sender email

### 7. AssemblyAI Setup

1. Sign up at [AssemblyAI](https://www.assemblyai.com)
2. Copy your API key to `ASSEMBLYAI_API_KEY` in `.env.local`

### 8. Cloudinary Setup

1. Sign up at [Cloudinary](https://cloudinary.com)
2. Go to **Settings > Upload**
3. Create an unsigned upload preset
4. Copy cloud name and preset to `.env.local`

## Running the Application

### Development Mode

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
ai-recruiter/
├── src/
│   ├── app/
│   │   ├── api/                    # API Routes
│   │   │   ├── analyze-resume/     # Resume analysis
│   │   │   ├── evaluate-interview/ # Interview evaluation
│   │   │   ├── generate-questions/ # AI question generation
│   │   │   ├── parse-resumes/      # Resume parsing
│   │   │   ├── send-decision/      # Accept/reject emails
│   │   │   ├── send-emails/        # Bulk email sending
│   │   │   └── transcribe/         # Audio transcription
│   │   ├── interview/              # Candidate interview portal
│   │   ├── workspaces/            # Recruiter dashboard
│   │   ├── login/                  # Login page
│   │   └── signup/                 # Signup page
│   ├── components/
│   │   ├── interview/              # Interview components
│   │   ├── DashboardHeader.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── ResumeUpload.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx         # Authentication context
│   ├── lib/
│   │   └── firebase.ts             # Firebase configuration
│   ├── app/
│   │   ├── globals.css             # Global styles
│   │   └── layout.tsx              # Root layout
│   └── page.tsx                    # Landing page
├── .env.local                      # Environment variables (create this)
├── .gitignore
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Usage Guide

### For Recruiters

1. **Sign Up / Login** - Create an account or log in
2. **Create Workspace** - Add a job position with requirements
3. **Upload Resumes** - Upload candidate resumes in bulk
4. **Send Interview Links** - Generate unique interview links for candidates
5. **Review Results** - View interview reports in the Results tab
6. **Make Decisions** - Accept or reject candidates with automated emails

### For Candidates

1. **Access Interview** - Click the link from the invitation email
2. **Enter Password** - Use the password provided by the recruiter
3. **Upload Resume** - Submit your resume (if not already provided)
4. **Complete Setup** - Configure camera and microphone
5. **Start Interview** - Answer AI-generated questions
6. **View Results** - Wait for recruiter feedback

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parse-resumes` | POST | Parse resume content |
| `/api/generate-questions` | POST | Generate interview questions |
| `/api/send-emails` | POST | Send bulk invitation emails |
| `/api/transcribe` | POST | Transcribe audio to text |
| `/api/evaluate-interview` | POST | Evaluate interview responses |
| `/api/send-decision` | POST | Send accept/reject emails |

## Interview Flow

1. **Auth Step** - Candidate enters interview password
2. **Resume Step** - Candidate uploads/verifies resume
3. **Setup Step** - Configure camera/mic, select language
4. **Interview Step** - Answer 5 AI-generated questions (video recorded)
5. **Processing Step** - AI transcribes and evaluates responses
6. **Report Step** - View AI-generated evaluation report

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key | Yes |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `BREVO_API_KEY` | Brevo SMTP API key | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `ASSEMBLYAI_API_KEY` | AssemblyAI transcription key | Yes |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary upload preset | Yes |

## Troubleshooting

### Firebase Connection Issues
- Ensure your Firebase config is correct in `.env.local`
- Check that Firestore rules allow your operations
- Verify authentication is enabled

### Email Not Sending
- Verify Brevo API key is valid
- Check sender email is verified in Brevo
- Ensure recipient email is valid

### Interview Recording Issues
- Check browser permissions for camera/microphone
- Ensure HTTPS is enabled (required for media devices)
- Verify Cloudinary configuration

### AI Responses Slow
- Gemini API may have rate limits
- Check your API key has sufficient quota

## License

MIT License - feel free to use this project for your own purposes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## Support

For issues or questions, please open an issue on GitHub.
