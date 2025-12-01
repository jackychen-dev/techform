# Airgap Comparison Dashboard

A React + Vite web application for comparing Techform and Eclipse fixture airgap measurements. The app runs 100% client-side and can be deployed as a static website.

## Features

- Upload Excel files (Techform + multiple Eclipse files)
- Automatic file detection and parsing
- Parse multiple sheets from Eclipse files
- Merge data by serial and part
- Visualize pre-toggle vs post-toggle airgap measurements
- Aggregate statistics across all matched serials

## Tech Stack

- React 18 + TypeScript
- Vite
- SheetJS (xlsx) for Excel parsing
- Recharts for data visualization
- Tailwind CSS for styling
- React Dropzone for file uploads

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

The built files will be in the `dist` directory, ready for static deployment.

## Configuration

Edit `src/utils/constants.ts` to configure:

- Column names for Serial and Part
- Valid parts filter
- Pre-toggle and post-toggle column letters
- File name prefixes

## File Requirements

### Techform File
- Exactly one file
- Filename must start with: "Techform Read Probe Values"
- Must contain columns: Serial, Part

### Eclipse Files
- Multiple files allowed
- Filenames must start with: "Eclipse Check Fixture Sheet Share"
- Each file can contain multiple sheets (one per date)
- Must contain columns: Serial, Part

## Deployment

This app can be deployed to any static hosting service:

- **Vercel**: `vercel --prod`
- **Netlify**: Drag and drop the `dist` folder
- **GitHub Pages**: Configure to serve from `dist` directory

## License

MIT


