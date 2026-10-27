import { describe, expect, it } from 'vitest';
import { formatBudget, formatCurrency, fullName, getErrorMessage, getInitials, populated, refId } from './helpers';

describe('helpers', () => {
  it('formats rupees in the Indian grouping', () => {
    expect(formatCurrency(150000)).toBe('₹1,50,000');
    expect(formatCurrency(99.5)).toBe('₹99.5');
  });

  it('formats fixed and hourly budgets', () => {
    expect(formatBudget({ budgetMin: 5000, budgetMax: 10000, budgetType: 'fixed' })).toBe('₹5,000 – ₹10,000');
    expect(formatBudget({ budgetMin: 1500, budgetMax: 1500, budgetType: 'hourly' })).toBe('₹1,500/hr');
  });

  it('prefers the API message, then the error message, then the fallback', () => {
    expect(getErrorMessage({ response: { data: { message: 'Email taken' } }, message: 'Request failed' })).toBe('Email taken');
    expect(getErrorMessage(new Error('Network Error'))).toBe('Network Error');
    expect(getErrorMessage('boom', 'Could not save')).toBe('Could not save');
  });

  it('handles populated references and bare ids', () => {
    const user = { _id: 'u1', firstName: 'Asha' };
    expect(populated(user)).toBe(user);
    expect(populated('u1')).toBeUndefined();
    expect(refId(user)).toBe('u1');
    expect(refId('u2')).toBe('u2');
    expect(refId(undefined)).toBeUndefined();
  });

  it('builds names and initials', () => {
    expect(fullName({ firstName: 'Asha', lastName: 'Rao' })).toBe('Asha Rao');
    expect(fullName(null)).toBe('User');
    expect(getInitials('asha', 'rao')).toBe('AR');
  });
});
