# Airgap Comparison Dashboard

A React + Vite web application for comparing airgap measurements between Techform raw data and Eclipse fixture results. The application runs 100% client-side and can be deployed as a static website.

## Features

- **File Upload**: Drag-and-drop Excel file uploads (.xlsx, .xlsm, .xls)
- **Data Parsing**: Automatic parsing of multiple sheets from Excel files
- **Data Merging**: Intelligent matching of serial numbers and parts across files
- **Visualization**: Interactive scatter charts for each part type with pre/post toggle comparison
- **Filtering**: Per-airgap filtering with rejection statistics
- **Statistics**: Comprehensive fixture statistics (range, median, average, span)

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Recharts
- SheetJS (xlsx)
- React Dropzone

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

## Deployment

This application is designed to be deployed as a static website. The build output in the `dist` folder can be deployed to:

- Vercel
- Netlify
- GitHub Pages
- Any static hosting service

## Usage

1. Upload Raw Airgap Data files (Excel format)
2. Upload Checked Fixture files (Excel format)
3. Click "Generate Dashboard" to create visualizations
4. View charts in the Dashboard tab
5. Use filters to exclude data points above threshold values

## Project Structure

```
src/
├── components/     # React components
├── utils/         # Utility functions for parsing and data processing
├── App.tsx        # Main application component
└── main.tsx       # Entry point
```
