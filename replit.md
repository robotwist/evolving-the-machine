# Cultural Arcade Evolution

## Overview

Cultural Arcade Evolution is a full-stack web application that combines classic arcade gaming with cultural education. The project features a progressive journey through gaming history where players master different game mechanics while learning about world cultures. The application follows a unique narrative where an AI entity evolves through each gaming era, starting from simple Pong mechanics and progressing through Breakout, Asteroids, Defender, and culminating in advanced 3D combat scenarios. Each stage is culturally themed (Ancient Greece, Mayan astronomy, Japanese Bushido, Norse mythology, etc.) to provide educational context alongside entertainment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side is built as a modern React application using TypeScript and Vite for development tooling. The architecture follows a component-based structure with:

- **React 18** with TypeScript for type safety and modern React features
- **Vite** as the build tool and development server with hot module replacement
- **Tailwind CSS** for styling with a comprehensive design system using CSS custom properties
- **Radix UI** components for accessible, unstyled UI primitives
- **Canvas-based gaming engine** with custom game classes for each arcade stage
- **Zustand** for lightweight state management across game states, audio controls, and scoring
- **TanStack Query** for server state management and data fetching

The gaming system is architected around a base game class that each specific game (Pong, Breakout, Asteroids, etc.) extends, providing consistent interfaces for input handling, rendering, and state management. Each game incorporates cultural educational elements and AI narrative progression.

### Backend Architecture
The server follows an Express.js-based REST API pattern with:

- **Express.js** server with TypeScript for type-safe backend development
- **In-memory storage** for user data and game state (easily replaceable with database storage)
- **Session-based architecture** ready for user authentication and persistence
- **Modular routing system** with dedicated storage interface for CRUD operations
- **Development/production environment handling** with Vite integration in development

The backend is designed to be lightweight and focuses on providing API endpoints for user management and potentially game state persistence, though the current implementation emphasizes client-side gaming.

### Audio and Multimedia System
The application includes a sophisticated audio system with:

- **Web Audio API integration** for game sound effects and background music
- **Audio state management** through Zustand with mute/unmute controls
- **3D graphics support** via React Three Fiber for advanced visual effects
- **GLSL shader support** through Vite plugins for visual enhancements
- **Asset management** for large 3D models, textures, and audio files

### Game State Management
The gaming system uses multiple specialized stores:

- **Game progression store** tracking current stage, screen state, and unlocked content
- **Score management** with persistent high scores across gaming sessions  
- **Audio control store** managing sound effects and background music
- **Cultural education system** providing contextual information for each gaming era

## External Dependencies

### Database and Storage
- **Drizzle ORM** configured for PostgreSQL with type-safe database operations
- **Neon Database** integration for serverless PostgreSQL hosting
- **Database migrations** managed through Drizzle Kit with schema versioning

### UI and Design System
- **Radix UI** comprehensive component library for accessible interface elements
- **Tailwind CSS** utility-first CSS framework with custom design tokens
- **Lucide React** for consistent iconography throughout the application
- **Inter font** via Fontsource for typography

### Development and Build Tools
- **TypeScript** for type safety across the entire application stack
- **Vite** for fast development builds and hot module replacement
- **PostCSS** with Autoprefixer for CSS processing
- **ESBuild** for production bundling and optimization

### Gaming and Graphics
- **React Three Fiber** for 3D graphics and WebGL integration
- **React Three Drei** for additional 3D utilities and helpers
- **React Three Post-processing** for visual effects and shaders
- **GLSL shader support** for custom visual effects

### Audio and Media
- **Web Audio API** for sound management and audio processing
- **Canvas API** for 2D game rendering and graphics manipulation

### Session Management
- **Connect PG Simple** for PostgreSQL-based session storage
- **Express Session** middleware for user session handling

The architecture is designed to be modular and scalable, with clear separation between gaming logic, user interface, and backend services. The cultural education system is integrated throughout the gaming experience, making learning an integral part of gameplay progression.