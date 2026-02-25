import '@testing-library/jest-dom'

// Mock window.location for tests that need it
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000/rsvp/test-token',
    pathname: '/rsvp/test-token',
    origin: 'http://localhost:3000',
  },
  writable: true,
})
