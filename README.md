# GRN Web UI - AHM

This is the AHM database version of the GRN Web UI.

## Features

- Automatic connection to AHM database
- No database selection required
- Username-only login

## Deployment

This site is designed to be deployed as a static site on Render.

### Deploy to Render

1. Push this folder to a GitHub repository
2. Connect the repository to Render
3. Create a new Static Site
4. Set the following:
   - **Build Command**: Leave empty or use `echo "No build required"`
   - **Publish Directory**: `.` (current directory)
   - **Branch**: `main` or your preferred branch

## Local Development

Open `index.html` in a web browser or run a local server:

```bash
# Using Python 3
python3 -m http.server 8080

# Using Python 2
python -m SimpleHTTPServer 8080

# Using Node.js http-server
npx http-server -p 8080
```

Then visit: `http://localhost:8080`

## Configuration

The database is hardcoded to **AHM** in `script.js`. The API endpoint is configured at the top of `script.js`:

```javascript
const DEFAULT_API_BASE = 'https://cdcapi.onrender.com/api/';
```

## Files

- `index.html` - Main HTML structure
- `script.js` - JavaScript logic with AHM database fixed
- `styles.css` - Styling

