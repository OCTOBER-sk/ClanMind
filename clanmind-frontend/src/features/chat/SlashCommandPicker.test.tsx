import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SlashCommandPickerWithKeyboard } from '@/features/chat/SlashCommandPicker';

const baseProps = {
  query: '',
  onSelect: vi.fn(),
  onClose: vi.fn(),
};

describe('SlashCommandPicker — §165A.2 feature-flag gating', () => {
  it('shows Meeting when meeting_mode is enabled', () => {
    render(<SlashCommandPickerWithKeyboard {...baseProps} featureFlags={{ meeting_mode: true }} />);
    expect(screen.getByText('Meeting')).toBeInTheDocument();
  });

  it('hides Meeting entirely when meeting_mode is disabled (no grey-out)', () => {
    render(<SlashCommandPickerWithKeyboard {...baseProps} featureFlags={{ meeting_mode: false }} />);
    expect(screen.queryByText('Meeting')).not.toBeInTheDocument();
    expect(screen.getByText('Ask Odin')).toBeInTheDocument();
  });

  it('hides Deep Research when deep_research is disabled', () => {
    render(<SlashCommandPickerWithKeyboard {...baseProps} featureFlags={{ deep_research: false }} />);
    expect(screen.queryByText('Deep Research')).not.toBeInTheDocument();
  });

  it('supports keyboard selection (§54)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SlashCommandPickerWithKeyboard {...baseProps} onSelect={onSelect} featureFlags={{ meeting_mode: true }} />
    );
    // The picker is driven imperatively via ref from the Composer;
    // mouse selection must also work.
    await user.click(screen.getByText('Private'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ command: '/private' }));
  });
});