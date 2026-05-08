# GreenPoint

### GIS-Based Urban Greening Framework for Mandaue City

**CMSC 129: Software Engineering**

---

## Project Overview

GreenPoint is a comprehensive Geographic Information System (GIS) and urban planning platform designed to identify, evaluate, and recommend data-driven greening interventions in Mandaue City, Cebu.

The system integrates high-resolution satellite imagery (NDVI, LST), air quality data (AQI), and socioeconomic indicators to compute a multi-dimensional **Greenery Index (GI)**. It empowers city planners and residents through:

- **GI Analysis**: Evaluating urban spaces based on Quantity, Equity, Resilience, and Connectivity.
- **AI Recommendation Engine**: Generating site-specific strategies (pocket parks, rooftop gardens, blue-green corridors) using a Retrieval-Augmented Generation (RAG) system backed by urban forestry research.
- **Project Lifecycle Management**: Tools for proposing, budgeting, and tracking the timeline of greening projects.
- **Community Engagement**: Allowing residents to contribute via geo-tagged photography and localized reporting.

## Technical Stack

- **Frontend**: Next.js 15 (App Router), Tailwind CSS 4, Lucide Icons, Framer Motion/GSAP.
- **Backend**: Supabase (Auth, Postgres, Storage), Prisma ORM.
- **GIS & Mapping**: Mapbox GL JS, Leaflet, Google Earth Engine (GEE), Turf.js.
- **AI/ML**: OpenAI/Gemini API (Recommendations), LangGraph (Agentic Workflows), Vector Database (pgvector).
- **Testing**: Vitest.

## Prerequisites

Before setting up the project, ensure you have the following:

- **Node.js**: Version 18.18.0 or higher.
- **Supabase Account**: A project with PostgreSQL (enabled with `pgvector`) and Auth.
- **Google Earth Engine**: Access to the GEE API for satellite data processing.
- **Mapbox Access Token**: For rendering high-performance maps.
- **Gemini API Key**: For the AI-driven recommendation engine.

## Getting Started

### 1. Installation

```bash
git clone https://github.com/sicefguroni/green-point
cd green-point
npm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory and populate it based on `.env.example`:

```bash
# Database Connections
DATABASE_URL="your-pooled-connection-url"
DIRECT_URL="your-direct-connection-url"

# Supabase Keys
NEXT_PUBLIC_SUPABASE_URL="your-project-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# AI & GIS Keys
GEMINI_API_KEY="your-gemini-key"
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN="your-mapbox-token"
```

### 3. Database Initialization

Synchronize the Prisma schema with your Supabase instance:

```bash
npx prisma generate
npm run db:push
```

### 4. Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Team

**Team CHATJPTY — CMSC 129**

- **Ishah Nicholei L. Bautista** (Project Lead / Engineering)
- **James Gabriel Elijah P. Ty**
- **Princess Jaena Marie O. De La Peña**
- **Ceferino S. Jumao-as V**
- **Kyle Johanstein M. Lee**

---

_Developed for the Department of Computer Science, University of the Philippines Cebu._
