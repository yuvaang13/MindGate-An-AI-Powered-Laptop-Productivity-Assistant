# GitHub Setup Instructions

Since GitHub CLI (gh) is not available on your system, follow these steps to create the repository and push your code:

## Step 1: Create GitHub Repository

1. Go to https://github.com and sign in to your account
2. Click the "+" icon in the top-right corner
3. Select "New repository"
4. Repository name: `MindGate-An-AI-Powered-Laptop-Productivity-Assistant`
5. Description: `AI-powered macOS productivity assistant with local Ollama integration`
6. Make it **Public**
7. **Do not** initialize with README, .gitignore, or license (we already have these)
8. Click "Create repository"

## Step 2: Push to GitHub

After creating the repository, GitHub will show you instructions. Run these commands in your terminal:

```bash
cd /Users/Yuvi10/Desktop/laptop_productivity_app
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/MindGate-An-AI-Powered-Laptop-Productivity-Assistant.git
git push -u origin main
```

**Important**: Replace `YOUR_USERNAME` with your actual GitHub username.

## Step 3: Verify

After pushing, visit your repository at:
```
https://github.com/YOUR_USERNAME/MindGate-An-AI-Powered-Laptop-Productivity-Assistant
```

You should see all your files committed and the README displayed on the repository page.

## Alternative: Using SSH

If you prefer SSH instead of HTTPS:

```bash
git remote add origin git@github.com:YOUR_USERNAME/MindGate-An-AI-Powered-Laptop-Productivity-Assistant.git
git push -u origin main
```

## Troubleshooting

If you encounter authentication issues with HTTPS:
1. GitHub may require a Personal Access Token
2. Go to GitHub Settings > Developer settings > Personal access tokens
3. Generate a new token with "repo" scope
4. Use the token as your password when prompted

## Repository URL

Once set up, your repository will be available at:
```
https://github.com/YOUR_USERNAME/MindGate-An-AI-Powered-Laptop-Productivity-Assistant
```

Update the README.md file to replace `YOUR_USERNAME` with your actual GitHub username in the clone URL.
