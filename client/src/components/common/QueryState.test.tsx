import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QueryState } from './QueryState';

const empty = { title: 'No gigs yet', description: 'Post one to get started.' };

describe('QueryState', () => {
  it('shows an accessible loading skeleton instead of the content', () => {
    render(<QueryState isLoading isError={false}><p>content</p></QueryState>);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('shows the API error message with a retry button', async () => {
    const onRetry = vi.fn();
    render(
      <QueryState isLoading={false} isError error={{ response: { data: { message: 'Gig not found' } } }} onRetry={onRetry}>
        <p>content</p>
      </QueryState>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Gig not found');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the empty state, then the content once there is data', () => {
    const { rerender } = render(<QueryState isLoading={false} isError={false} isEmpty empty={empty}><p>content</p></QueryState>);
    expect(screen.getByText('No gigs yet')).toBeInTheDocument();
    expect(screen.queryByText('content')).not.toBeInTheDocument();

    rerender(<QueryState isLoading={false} isError={false} isEmpty={false} empty={empty}><p>content</p></QueryState>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
