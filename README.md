
# MetaSpace Project

Welcome to **MetaSpace**, a 2D metaverse platform inspired by GatherTown. This project is designed to provide an engaging and interactive virtual space for users to meet, collaborate, and explore. With real-time multiplayer capabilities and a focus on proximity-based interactions, MetaSpace offers a unique blend of social connectivity and immersive experience.

## Current Features

### 1. Space Creation
- Users can create and customize virtual spaces to host events, meetings, or casual hangouts.

### 2. Multiplayer Functionality
- Real-time multiplayer interactions are powered by WebSockets, enabling smooth and seamless communication between users.

### 3. Proximity Detection (Planned)
- Proximity-based interactions will allow users to engage with others within certain areas of the virtual space, simulating real-world social dynamics.

### 4. WebRTC Integration (In Progress)
- Upcoming features include voice and video calling using WebRTC, enhancing the social experience within MetaSpace.

### 5. UI/UX (In Progress)
- A user-friendly and visually appealing interface is being developed to ensure an intuitive experience for all users.

## Installation

To get started with MetaSpace, follow these steps:

### Prerequisites
- Node.js (v14 or later)
- npm or yarn

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/prajyot7070/MetaSpace.git
   cd MetaSpace
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   Or with yarn:
   ```bash
   yarn install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   Or with yarn:
   ```bash
   yarn dev
   ```

4. Access the application at `http://localhost:3000`.

## Directory Structure

The project is structured into several key directories:

- **apps/frontend**: Contains the frontend code, including components, pages, and game logic.
- **apps/httpservice**: Manages API routes and server-side logic.
- **apps/ws**: Handles WebSocket connections for multiplayer functionality.
- **packages/db**: Contains database schemas and migration files.
- **packages/ui**: Houses reusable UI components and configurations.

## Roadmap

- [x] Space creation logic
- [x] WebSocket-based multiplayer
- [ ] Proximity detection for user interactions
- [ ] WebRTC server for voice and video calling
- [ ] Enhanced UI/UX design

## License

MetaSpace is licensed under the MIT License. See `LICENSE` for more information.

## Contact

For any inquiries, please contact [prajyot7070](mailto:prajyot7070@example.com).

We hope you enjoy exploring and contributing to MetaSpace!


