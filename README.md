# 💪 AI Fitness Coach

A comprehensive, AI-powered fitness application built with Next.js that provides personalized workout plans, diet recommendations, motivational quotes, voice guidance, and milestone tracking. The application features a beautiful dark/light mode toggle and a modern, responsive UI.

## ✨ Features

### Core Functionality
- **AI-Powered Personalization**: Generate customized 7-day workout and diet plans using Google Gemini AI
- **User Authentication**: Secure signup and login system with user profile management
- **Personalized Quotes**: Get AI-generated motivational quotes tailored to your fitness journey
- **Voice Guidance**: AI-generated voice instructions for workouts
- **Image Generation**: AI-generated fitness motivation images
- **Milestone Tracking**: Track your fitness progress and achievements
- **Dashboard**: Comprehensive dashboard with tabs for plans, milestones, and user management

### UI/UX Features
- **Dark/Light Mode**: Toggle between dark and light themes with system preference detection
- **Responsive Design**: Fully responsive design that works on all devices
- **Modern UI**: Built with Tailwind CSS and Radix UI components
- **Smooth Animations**: Framer Motion animations for enhanced user experience

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI
- **Animations**: Framer Motion
- **Database**: MongoDB
- **AI Integration**: Google Gemini API
- **Theme Management**: next-themes
- **Icons**: Lucide React

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18+ and npm/yarn/pnpm
- MongoDB database (local or cloud instance like MongoDB Atlas)
- Google Gemini API key

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd y
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Environment Variables

Create a `.env.local` file in the root directory and add the following variables:

```env
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# MongoDB Connection URI
MONGODB_URI=mongodb://localhost:27017/fitness
# or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/fitness
```

### 4. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### 5. Build for Production

```bash
npm run build
npm start
```

## 🌐 Deployment on Vercel

Vercel is the recommended platform for deploying this Next.js application. Follow these steps:

### Option 1: Deploy via Vercel CLI

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   
   Follow the prompts to configure your project.

4. **Set Environment Variables**:
   - Go to your project dashboard on Vercel
   - Navigate to Settings → Environment Variables
   - Add the following variables:
     - `GEMINI_API_KEY`: Your Google Gemini API key
     - `MONGODB_URI`: Your MongoDB connection string

5. **Redeploy** (if needed):
   ```bash
   vercel --prod
   ```

### Option 2: Deploy via GitHub Integration

1. **Push your code to GitHub** (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will automatically detect Next.js

3. **Configure Environment Variables**:
   - In the project settings, add:
     - `GEMINI_API_KEY`
     - `MONGODB_URI`

4. **Deploy**:
   - Click "Deploy" and Vercel will build and deploy your application automatically

### Option 3: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select your repository
4. Configure environment variables
5. Click "Deploy"

## 📁 Project Structure

```
y/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── generate-image/
│   │   ├── generate-plan/
│   │   ├── generate-quote/
│   │   ├── generate-voice/
│   │   ├── milestones/
│   │   ├── personalized-quote/
│   │   └── users/
│   ├── dashboard/         # Dashboard page
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   ├── layout.tsx         # Root layout with ThemeProvider
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles with dark mode support
├── components/            # React components
│   ├── dashboard-tabs.tsx
│   ├── footer.tsx
│   ├── image-gallery-modal.tsx
│   ├── milestones-tab.tsx
│   ├── navbar.tsx         # Navbar with theme toggle
│   ├── plan-tab.tsx
│   ├── signup-form.tsx
│   ├── theme-toggle.tsx   # Dark/Light mode toggle
│   └── voice-player.tsx
├── lib/                   # Utility libraries
│   ├── gemini.ts          # Gemini AI integration
│   ├── gemini-image.ts    # Image generation
│   ├── gemini-voice.ts    # Voice generation
│   ├── mongodb.ts         # MongoDB connection
│   ├── storage.ts         # Local storage utilities
│   └── utils.ts           # General utilities
├── types/                 # TypeScript type definitions
│   ├── milestone.ts
│   └── user.ts
└── next.config.ts         # Next.js configuration
```

## 🎨 Dark Mode

The application includes a fully functional dark/light mode toggle:

- **Toggle Button**: Located in the navbar (top right)
- **System Preference**: Automatically detects and follows your system's theme preference
- **Persistence**: Your theme preference is saved and persists across sessions
- **Smooth Transitions**: Smooth theme transitions for better UX

The theme is implemented using `next-themes` and Tailwind CSS dark mode classes.

## 🔐 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key for AI features | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |

## 📝 API Routes

### Public Endpoints
- `GET /api/generate-quote` - Generate a motivational quote
- `POST /api/generate-plan` - Generate personalized fitness plan
- `POST /api/generate-image` - Generate fitness motivation image
- `POST /api/generate-voice` - Generate voice guidance
- `POST /api/personalized-quote` - Generate personalized quote for user
- `GET /api/milestones` - Get user milestones
- `POST /api/users` - Create new user
- `GET /api/users/[id]` - Get user by ID

## 🧪 Development

### Linting

```bash
npm run lint
```

### Building

```bash
npm run build
```

### Running Production Build Locally

```bash
npm run build
npm start
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running locally or your Atlas cluster is accessible
   - Verify `MONGODB_URI` is correct in `.env.local`

2. **Gemini API Errors**
   - Check that `GEMINI_API_KEY` is set correctly
   - Verify your API key has proper permissions
   - Check API rate limits

3. **Theme Toggle Not Working**
   - Ensure `next-themes` is installed: `npm install next-themes`
   - Clear browser cache and reload

4. **Build Errors on Vercel**
   - Ensure all environment variables are set in Vercel dashboard
   - Check build logs in Vercel for specific errors
   - Verify Node.js version compatibility

## 📄 License

This project is private and proprietary.

## 👤 Author

Your Name/Organization

## 🙏 Acknowledgments

- Google Gemini for AI capabilities
- Next.js team for the amazing framework
- Vercel for seamless deployment
- All contributors to the open-source libraries used in this project

---

**Note**: Make sure to keep your API keys and database credentials secure. Never commit `.env.local` files to version control.
