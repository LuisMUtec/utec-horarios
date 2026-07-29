// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FeedbackButton from '@/components/FeedbackButton';
import posthog from 'posthog-js';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() },
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FeedbackButton', () => {
  it('lleva al grupo de ayuda en WhatsApp', () => {
    render(<FeedbackButton />);

    const link = screen.getByRole('link', { name: /Unirse al grupo de ayuda en WhatsApp/ });
    expect(link.getAttribute('href')).toBe('https://chat.whatsapp.com/LrTT67wC0yZ2Y6WX1Ib0gT');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('captura feedback_link_clicked al hacer clic', () => {
    render(<FeedbackButton />);

    fireEvent.click(screen.getByRole('link', { name: /Unirse al grupo de ayuda en WhatsApp/ }));

    expect(posthog.capture).toHaveBeenCalledWith('feedback_link_clicked');
  });
});
