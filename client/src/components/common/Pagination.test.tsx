import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the first, last and nearby pages with ellipses and marks the current one', () => {
    render(<Pagination currentPage={5} totalPages={10} onPageChange={vi.fn()} />);
    const pages = screen.getAllByRole('button').map((b) => b.textContent).filter(Boolean);
    expect(pages).toEqual(['1', '3', '4', '5', '6', '7', '10']);
    expect(screen.getAllByText('...')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-current', 'page');
  });

  it('navigates with the arrows and disables them at the ends', async () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await userEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onPageChange.mock.calls).toEqual([[2], [3]]);

    rerender(<Pagination currentPage={3} totalPages={3} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });
});
