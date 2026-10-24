jest.mock("axios", () => {
  const client = {
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  };
  return {
    __esModule: true,
    default: {
      ...client,
      create: jest.fn(() => client),
    },
  };
});

import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the StreamGod wordmark', () => {
  render(<App />);
  expect(screen.getAllByText(/StreamGod/i).length).toBeGreaterThan(0);
});
