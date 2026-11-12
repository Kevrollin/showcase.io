import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildChecklist } from '@/features/dashboard/checklist';
import type { Business } from '@/types/models';
import { TypeStep } from './steps/TypeStep';

describe('TypeStep', () => {
  it('requires a choice before continuing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onContinue = vi.fn();
    const { rerender } = render(<TypeStep value={null} onChange={onChange} onContinue={onContinue} />);

    expect(screen.getByRole('heading', { name: 'What would you like to showcase?' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /portfolio/i }));
    expect(onChange).toHaveBeenCalledWith('portfolio');

    rerender(<TypeStep value="portfolio" onChange={onChange} onContinue={onContinue} />);
    expect(screen.getByRole('radio', { name: /portfolio/i })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalled();
  });
});

describe('getting-started checklist', () => {
  const business = {
    name: 'Kelvin Designs',
    description: null,
    category: null,
    logo_path: null,
    whatsapp_number: '+254712345678',
    status: 'draft',
  } as unknown as Business;

  it('reflects real progress', () => {
    const list = buildChecklist(business, []);
    expect(Object.fromEntries(list.map((c) => [c.id, c.done]))).toEqual({
      profile: false,
      logo: false,
      item: false,
      whatsapp: true,
      publish: false,
    });
  });

  it('is complete once everything is set up', () => {
    const done = buildChecklist(
      { ...business, description: 'Design', category: 'graphic-design', logo_path: 'x/y/brand/logo.webp', status: 'published' },
      [{ id: 'i' } as never],
    );
    expect(done.every((c) => c.done)).toBe(true);
  });
});
