import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingWelcome } from './OnboardingWelcome';
import { MemoryRouter } from 'react-router-dom';

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('OnboardingWelcome', () => {
  const mockDismiss = vi.fn();

  beforeEach(() => {
    mockDismiss.mockClear();
  });

  it('renders step 1 with user name', () => {
    renderWithRouter(<OnboardingWelcome userName="Alex" onDismiss={mockDismiss} />);
    expect(screen.getByText('Welcome to the Hub, Alex!')).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 7/)).toBeInTheDocument();
  });

  it('renders step 1 without user name', () => {
    renderWithRouter(<OnboardingWelcome onDismiss={mockDismiss} />);
    expect(screen.getByText('Welcome to the Hub!')).toBeInTheDocument();
  });

  it('navigates forward through all 7 steps', () => {
    renderWithRouter(<OnboardingWelcome userName="Test" onDismiss={mockDismiss} />);

    // Step 1
    expect(screen.getByText(/Step 1 of 7/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2 - Dashboard
    expect(screen.getByText(/Step 2 of 7/)).toBeInTheDocument();
    expect(screen.getByText('Your Dashboard')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 3 - Database
    expect(screen.getByText(/Step 3 of 7/)).toBeInTheDocument();
    expect(screen.getByText('Your Database')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add your first contacts/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 4 - SphereSync
    expect(screen.getByText(/Step 4 of 7/)).toBeInTheDocument();
    expect(screen.getByText('SphereSync')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 5 - Scoreboard
    expect(screen.getByText(/Step 5 of 7/)).toBeInTheDocument();
    expect(screen.getByText('Success Scoreboard')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 6 - Newsletter
    expect(screen.getByText(/Step 6 of 7/)).toBeInTheDocument();
    expect(screen.getByText('E-Newsletter')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 7 - Settings (last step)
    expect(screen.getByText(/Step 7 of 7/)).toBeInTheDocument();
    expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('navigates back', () => {
    renderWithRouter(<OnboardingWelcome onDismiss={mockDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/Step 2 of 7/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(/Step 1 of 7/)).toBeInTheDocument();
  });

  it('does not show Back button on step 1', () => {
    renderWithRouter(<OnboardingWelcome onDismiss={mockDismiss} />);
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
  });

  it('calls onDismiss when X is clicked', () => {
    renderWithRouter(<OnboardingWelcome onDismiss={mockDismiss} />);
    fireEvent.click(screen.getByLabelText('Dismiss onboarding'));
    expect(mockDismiss).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when Get Started is clicked on last step', () => {
    renderWithRouter(<OnboardingWelcome onDismiss={mockDismiss} />);
    // Navigate to last step
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    }
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(mockDismiss).toHaveBeenCalledOnce();
  });
});
